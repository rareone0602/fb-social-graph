/**
 * D3 affinity orbit graph.
 * Renders top N friends as force-directed nodes orbiting "You" at the centre.
 *
 * Graph model G = (V, E):
 *   V = top 50 friends by raw base score
 *   E = directed edges from user → each friend
 *     ∪ directed edges from imported CSVs (friend → friend, both in V)
 *
 * UX features:
 *   - Hover (or first tap on touch) shows a tooltip; second tap opens the profile
 *   - Pinch / scroll-wheel zoom and pan around the orbit
 *   - Keyboard: Tab through friend nodes, Enter / Space opens the profile
 *   - Drag any friend node to pin it; release on drag-end
 *   - Imported friend → friend edges rendered as dashed lines, tooltipped too
 *   - window.highlightGraphNode(name) — fades non-matches; used by search
 */

(function () {
  // Module-scoped state, refreshed each render. Lets external code (search,
  // contributor chips) call into the live graph without us re-exporting half
  // the d3 selections.
  let api = null;

  function computeHeight(W) {
    const vh = window.innerHeight || 800;
    // Floor at 420 (orbit gets cramped below this), ceiling at 680 to match
    // the original desktop layout. Honour container width too — a square-ish
    // viewport reads better than a tall thin one.
    return Math.round(Math.min(680, Math.max(420, Math.min(vh * 0.7, W * 0.9))));
  }

  function isCoarsePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function clampTooltip(tip, x, y) {
    const rect = tip.node().getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(x, vw - rect.width - 8));
    const top  = Math.max(8, Math.min(y, vh - rect.height - 8));
    tip.style('left', left + 'px').style('top', top + 'px');
  }

  function ensureTooltip() {
    let tip = d3.select('body').select('.d3-tooltip');
    if (tip.empty()) tip = d3.select('body').append('div').attr('class', 'd3-tooltip');
    return tip;
  }

  window.renderGraph = function (profiles, topN = 50) {
    document.querySelectorAll('.d3-tooltip').forEach(el => el.remove());

    const top = profiles.slice(0, topN);
    const container = document.getElementById('chart-graph');
    container.innerHTML = '';

    const W = container.clientWidth || 860;
    const H = computeHeight(W);
    const cx = W / 2;
    const cy = H / 2;
    const MAX_ORBIT = Math.min(cx, cy) - 60;
    const CENTER_R = 28;

    const nodes = top.map((p, i) => ({
      ...p,
      id: i,
      r: 7 + (p.normalised / 100) * 13,
      targetRadius: 55 + (1 - p.normalised / 100) * (MAX_ORBIT - 55),
    }));

    const centerNode = { id: 'center', fx: cx, fy: cy };
    const allNodes = [centerNode, ...nodes];

    const nodeByName = new Map();
    nodes.forEach(n => nodeByName.set(n.name.toLowerCase(), n));

    const svg = d3.select('#chart-graph')
      .append('svg')
      .attr('width', '100%')
      .attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img')
      .attr('aria-label', t('graphTitle'));

    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 6')
      .attr('refX', 10).attr('refY', 3)
      .attr('markerWidth', 8).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L10,3 L0,6 Z')
      .attr('fill', 'context-stroke');

    nodes.forEach(d => {
      defs.append('clipPath')
        .attr('id', `clip-node-${d.id}`)
        .append('circle')
        .attr('r', d.r);
    });

    const selfImgUrl = window._selfImgUrl || '';
    if (selfImgUrl) {
      defs.append('clipPath')
        .attr('id', 'clip-center')
        .append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', CENTER_R);
    }

    // Orbit rings stay outside the zoom layer — they're orientation cues, not
    // content. Drawn first so they sit underneath everything else.
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      svg.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 55 + frac * (MAX_ORBIT - 55))
        .attr('fill', 'none')
        .attr('stroke', 'var(--border)')
        .attr('stroke-dasharray', '3 5')
        .attr('opacity', 0.25);
    });

    // Everything below scales/pans together via d3.zoom().
    const zoomRoot = svg.append('g').attr('class', 'zoom-root');

    // User → friend edges (directed)
    const userLinks = zoomRoot.selectAll('line.orbit-link')
      .data(nodes).enter()
      .append('line')
      .attr('class', 'orbit-link')
      .attr('x1', cx).attr('y1', cy)
      .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
      .attr('stroke-opacity', d => 0.15 + (d.normalised / 100) * 0.55)
      .attr('stroke-width', d => 0.5 + (d.normalised / 100) * 2)
      .attr('marker-end', 'url(#arrow)');

    // Imported friend → friend edges
    const importedEdges = (window._importedEdges || [])
      .map(e => ({
        ...e,
        sourceNode: nodeByName.get(e.fromName.toLowerCase()),
        targetNode: nodeByName.get(e.toName.toLowerCase()),
      }))
      .filter(e => e.sourceNode && e.targetNode);

    const importLinks = zoomRoot.selectAll('line.import-link')
      .data(importedEdges).enter()
      .append('line')
      .attr('class', 'import-link')
      .attr('stroke', 'var(--accent2)')
      .attr('stroke-opacity', d => d.active ? 0.85 : 0.55)
      .attr('stroke-width', d => d.active ? 2 : 1.4)
      // Active edges get a chunkier dash so the visual cue isn't colour-only.
      .attr('stroke-dasharray', d => d.active ? '8 3' : '4 4')
      .attr('marker-end', 'url(#arrow)')
      .style('cursor', 'help');

    const nodeG = zoomRoot.selectAll('g.friend-node')
      .data(nodes).enter()
      .append('g')
      .attr('class', 'friend-node')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${d.name}, ${t('graphHoverScore')} ${d.normalised.toFixed(0)}, ${d.active ? t('graphLegendActive') : t('graphLegendInact')}`)
      .style('cursor', 'pointer');

    nodeG.append('circle')
      .attr('class', 'node-bg')
      .attr('r', d => d.r)
      .attr('fill', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
      .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
      .attr('stroke-width', 2)
      .attr('fill-opacity', 0.88);

    nodeG.each(function (d) {
      if (!d.imgUrl) return;
      d3.select(this).append('image')
        .attr('x', -d.r).attr('y', -d.r)
        .attr('width', d.r * 2).attr('height', d.r * 2)
        .attr('href', d.imgUrl)
        .attr('clip-path', `url(#clip-node-${d.id})`)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .on('error', function () { d3.select(this).remove(); });
    });

    nodeG.append('circle')
      .attr('class', 'rank-badge')
      .attr('cx', d => d.r * 0.6)
      .attr('cy', d => d.r * 0.6)
      .attr('r', d => Math.max(6, d.r * 0.45))
      .attr('fill', 'var(--accent)')
      .attr('stroke', 'var(--bg-card)')
      .attr('stroke-width', 1.2);

    nodeG.append('text')
      .attr('class', 'rank-badge-text')
      .attr('x', d => d.r * 0.6)
      .attr('y', d => d.r * 0.6)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(6, d.r * 0.4) + 'px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .attr('font-family', "'Gaegu','Noto Sans TC',cursive")
      .text((_, i) => i + 1);

    const labels = zoomRoot.selectAll('text.node-label')
      .data(nodes).enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text(d => d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name);

    // ── Centre "You" node ────────────────────────────────────────────────────
    const centerG = zoomRoot.append('g').attr('class', 'center-node');

    centerG.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', CENTER_R)
      .attr('fill', 'var(--accent)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    if (selfImgUrl) {
      centerG.append('image')
        .attr('x', cx - CENTER_R).attr('y', cy - CENTER_R)
        .attr('width', CENTER_R * 2).attr('height', CENTER_R * 2)
        .attr('href', selfImgUrl)
        .attr('clip-path', 'url(#clip-center)')
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('pointer-events', 'none')
        .on('error', function () { d3.select(this).remove(); });
    }

    centerG.append('text')
      .attr('x', cx)
      .attr('y', selfImgUrl ? cy + CENTER_R + 14 : cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', selfImgUrl ? 'auto' : 'central')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', selfImgUrl ? 'var(--text)' : '#fff')
      .attr('pointer-events', 'none')
      .attr('font-family', "'Gaegu','Noto Sans TC',cursive")
      .text(t('graphCenter'));

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const tooltip = ensureTooltip();

    // ── State ─────────────────────────────────────────────────────────────────
    let hoveredNode = null;
    let simRunning  = true;
    let nodeMoved   = false;
    let lastTappedId = null;
    const coarse = isCoarsePointer();

    // ── Drag behaviour ────────────────────────────────────────────────────────
    const drag = d3.drag()
      .on('start', function (event, d) {
        nodeMoved = false;
        tooltip.style('display', 'none');
        hoveredNode = null;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        nodeMoved = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function (event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select(this).style('cursor', 'pointer');
      });

    nodeG.call(drag);

    // ── Hover & tap behaviours ───────────────────────────────────────────────
    function showNodeTooltip(d, clientX, clientY) {
      tooltip.style('display', 'block').html(
        `<strong>${escapeForTip(d.name)}</strong><br>` +
        `${t('graphHoverScore')}: ${d.normalised.toFixed(1)}<br>` +
        `${d.active ? t('graphLegendActive') : t('graphLegendInact')}`
      );
      clampTooltip(tooltip, clientX + 14, clientY - 36);
    }

    function showEdgeTooltip(d, clientX, clientY) {
      tooltip.style('display', 'block').html(
        `<strong>${escapeForTip(d.fromName)} → ${escapeForTip(d.toName)}</strong><br>` +
        `${t('graphHoverScore')}: ${d.normalised.toFixed(1)}<br>` +
        `${d.active ? t('graphLegendActive') : t('graphLegendInact')}`
      );
      clampTooltip(tooltip, clientX + 14, clientY - 36);
    }

    nodeG
      .on('mouseover', (event, d) => {
        if (coarse) return;
        hoveredNode = d;
        const sel = d3.select(event.currentTarget).raise();
        if (!simRunning) sel.attr('transform', `translate(${d.x},${d.y}) scale(1.4)`);
        showNodeTooltip(d, event.clientX, event.clientY);
      })
      .on('mousemove', event => {
        if (coarse) return;
        clampTooltip(tooltip, event.clientX + 14, event.clientY - 36);
      })
      .on('mouseout', function (_, d) {
        if (coarse) return;
        hoveredNode = null;
        if (!simRunning) d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        tooltip.style('display', 'none');
      })
      .on('click', (event, d) => {
        if (nodeMoved) { nodeMoved = false; return; }
        if (coarse) {
          // Touch: first tap shows tooltip, second tap on same node opens.
          if (lastTappedId !== d.id) {
            lastTappedId = d.id;
            showNodeTooltip(d, event.clientX || (event.touches && event.touches[0]?.clientX) || 0,
                               event.clientY || (event.touches && event.touches[0]?.clientY) || 0);
            return;
          }
          lastTappedId = null;
          tooltip.style('display', 'none');
        }
        if (d.linkUrl) window.open(d.linkUrl, '_blank', 'noopener');
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (d.linkUrl) window.open(d.linkUrl, '_blank', 'noopener');
        }
      })
      .on('focus', (event, d) => {
        const r = event.currentTarget.getBoundingClientRect();
        showNodeTooltip(d, r.right, r.top);
      })
      .on('blur', () => tooltip.style('display', 'none'));

    importLinks
      .on('mouseover', (event, d) => {
        if (coarse) return;
        showEdgeTooltip(d, event.clientX, event.clientY);
      })
      .on('mousemove', event => {
        if (coarse) return;
        clampTooltip(tooltip, event.clientX + 14, event.clientY - 36);
      })
      .on('mouseout', () => {
        if (coarse) return;
        tooltip.style('display', 'none');
      })
      .on('click', (event, d) => {
        if (!coarse) return;
        showEdgeTooltip(d, event.clientX, event.clientY);
      });

    // Tap empty space (or press Esc on the SVG) → release pinned & dismiss tooltip
    svg.on('click', function (event) {
      if (event.target === this) {
        lastTappedId = null;
        tooltip.style('display', 'none');
      }
    });

    // ── Force simulation ──────────────────────────────────────────────────────

    function shortenToNode(x1, y1, x2, y2, targetR) {
      const dx = x2 - x1, dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ratio = (dist - targetR - 2) / dist;
      return { x: x1 + dx * ratio, y: y1 + dy * ratio };
    }

    const simLinks = nodes.map(n => ({
      source: centerNode,
      target: n,
      strength: 0.08 + (n.normalised / 100) * 0.12,
    }));
    for (const e of importedEdges) {
      simLinks.push({
        source: e.sourceNode,
        target: e.targetNode,
        strength: 0.05,
      });
    }

    const simulation = d3.forceSimulation(allNodes)
      .force('radial',    d3.forceRadial(d => d.targetRadius || 0, cx, cy).strength(d => d === centerNode ? 0 : 0.3 + (d.normalised / 100) * 0.5))
      .force('link',      d3.forceLink(simLinks).strength(d => d.strength).distance(d => d.target.targetRadius || 120))
      .force('charge',    d3.forceManyBody().strength(d => d === centerNode ? 0 : -25))
      .force('collision', d3.forceCollide(d => d === centerNode ? 0 : d.r + 14))
      .on('tick', () => {
        userLinks.each(function (d) {
          const end = shortenToNode(cx, cy, d.x, d.y, d.r);
          d3.select(this).attr('x2', end.x).attr('y2', end.y);
        });

        importLinks.each(function (d) {
          const end = shortenToNode(d.sourceNode.x, d.sourceNode.y, d.targetNode.x, d.targetNode.y, d.targetNode.r);
          d3.select(this).attr('x1', d.sourceNode.x).attr('y1', d.sourceNode.y).attr('x2', end.x).attr('y2', end.y);
        });

        nodeG.attr('transform', d => {
          const base = `translate(${d.x},${d.y})`;
          return d === hoveredNode ? `${base} scale(1.4)` : base;
        });
        labels.attr('x', d => {
          const dx = d.x - cx, dy = d.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.x + (dx / dist) * (d.r + 13);
        }).attr('y', d => {
          const dx = d.x - cx, dy = d.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.y + (dy / dist) * (d.r + 13) + 4;
        });
      })
      .on('end', () => { simRunning = false; });

    // ── Pinch / wheel zoom and pan ────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([0.5, 4])
      .filter(event => {
        // Allow wheel + touch + non-primary mouse, but never start a pan from
        // a friend node (they have their own drag handler).
        if (event.target.closest('.friend-node')) return false;
        return !event.button;
      })
      .on('zoom', e => zoomRoot.attr('transform', e.transform));
    svg.call(zoom);

    // ── Highlight API (used by search) ────────────────────────────────────────
    function highlight(name) {
      const q = (name || '').toLowerCase().trim();
      if (!q) {
        nodeG.classed('faded', false).classed('highlight', false);
        userLinks.classed('faded', false);
        importLinks.classed('faded', false);
        labels.classed('faded', false);
        return;
      }
      const match = nodes.find(n => n.name.toLowerCase().includes(q));
      if (!match) {
        nodeG.classed('faded', true).classed('highlight', false);
        userLinks.classed('faded', true);
        importLinks.classed('faded', true);
        labels.classed('faded', true);
        return;
      }
      nodeG.classed('faded', d => d !== match).classed('highlight', d => d === match);
      labels.classed('faded', d => d !== match);
      userLinks.classed('faded', d => d !== match);
      importLinks.classed('faded', d => d.sourceNode !== match && d.targetNode !== match);
    }

    api = { highlight, zoom, svg, nodeG, importLinks, nodes };
    window._graphAPI = api;
  };

  // External-facing helper used by app.js search wiring.
  window.highlightGraphNode = function (name) {
    if (api && typeof api.highlight === 'function') api.highlight(name);
  };

  // Re-render on resize (debounced) so the orbit fits the viewport on rotate
  // or window resize. Cheap because there are only ≤ 50 nodes.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!window._lastProfiles) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      try { window.renderGraph(window._lastProfiles, 50); }
      catch (e) { console.warn('Resize re-render failed:', e); }
    }, 200);
  });

  function escapeForTip(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
