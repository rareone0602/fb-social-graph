/**
 * D3 affinity orbit graph.
 * Renders top N friends as force-directed nodes orbiting "You" at the centre.
 * Nodes show profile pictures (clipped to circles) and are clickable.
 *
 * Graph model G = (V, E):
 *   V = top 50 friends by raw base score
 *   E = directed edges from user → each friend
 *     ∪ directed edges from imported CSVs (friend → friend, both in V)
 *
 * UX features:
 *   - Hover enlarges individual node correctly even during simulation
 *   - "You" centre node shows the user's own profile picture
 *   - Drag any friend node to pin it; double-click a pinned node to release it
 *   - Arrowheads show edge direction
 *   - Imported edges rendered as dashed lines between friend nodes
 */

window.renderGraph = function (profiles, topN = 50) {
  const tip = document.getElementById('d3-tooltip');
  if (tip) tip.remove();

  const top = profiles.slice(0, topN);
  const container = document.getElementById('chart-graph');
  container.innerHTML = '';

  const W = container.clientWidth || 860;
  const H = 680;
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

  // Virtual center node (pinned "You") for link forces
  const centerNode = { id: 'center', fx: cx, fy: cy };
  const allNodes = [centerNode, ...nodes];

  // Build name→node lookup for imported edges
  const nodeByName = new Map();
  nodes.forEach(n => nodeByName.set(n.name.toLowerCase(), n));

  const svg = d3.select('#chart-graph')
    .append('svg')
    .attr('width', '100%')
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);

  const defs = svg.append('defs');

  // Arrowhead marker for user → friend edges
  defs.append('marker')
    .attr('id', 'arrow-user')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10).attr('refY', 3)
    .attr('markerWidth', 8).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', 'var(--accent)')
    .attr('opacity', 0.5);

  // Arrowhead markers for imported edges (active vs inactive)
  defs.append('marker')
    .attr('id', 'arrow-import-active')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10).attr('refY', 3)
    .attr('markerWidth', 8).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', 'var(--accent)')
    .attr('opacity', 0.7);

  defs.append('marker')
    .attr('id', 'arrow-import-inactive')
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10).attr('refY', 3)
    .attr('markerWidth', 8).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', 'var(--accent2)')
    .attr('opacity', 0.7);

  // Clip paths for friend node profile pictures
  nodes.forEach(d => {
    defs.append('clipPath')
      .attr('id', `clip-node-${d.id}`)
      .append('circle')
      .attr('r', d.r);
  });

  // Clip path for "You" centre node
  const selfImgUrl = window._selfImgUrl || '';
  if (selfImgUrl) {
    defs.append('clipPath')
      .attr('id', 'clip-center')
      .append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', CENTER_R);
  }

  // Dashed orbit rings
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', 55 + frac * (MAX_ORBIT - 55))
      .attr('fill', 'none')
      .attr('stroke', 'var(--border)')
      .attr('stroke-dasharray', '3 5')
      .attr('opacity', 0.25);
  });

  // Lines from centre to each friend (directed: user → friend)
  const userLinks = svg.selectAll('line.orbit-link')
    .data(nodes).enter()
    .append('line')
    .attr('class', 'orbit-link')
    .attr('x1', cx).attr('y1', cy)
    .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke-opacity', d => 0.15 + (d.normalised / 100) * 0.55)
    .attr('stroke-width', d => 0.5 + (d.normalised / 100) * 2)
    .attr('marker-end', 'url(#arrow-user)');

  // Imported friend → friend edges
  const importedEdges = (window._importedEdges || [])
    .map(e => ({
      ...e,
      sourceNode: nodeByName.get(e.fromName.toLowerCase()),
      targetNode: nodeByName.get(e.toName.toLowerCase()),
    }))
    .filter(e => e.sourceNode && e.targetNode);

  const importLinks = svg.selectAll('line.import-link')
    .data(importedEdges).enter()
    .append('line')
    .attr('class', 'import-link')
    .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--accent2)')
    .attr('stroke-opacity', d => d.active ? 0.6 : 0.5)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6 3')
    .attr('marker-end', d => d.active ? 'url(#arrow-import-active)' : 'url(#arrow-import-inactive)');

  // Friend node groups
  const nodeG = svg.selectAll('g.friend-node')
    .data(nodes).enter()
    .append('g')
    .attr('class', 'friend-node')
    .style('cursor', 'pointer');

  // Background circle (border ring + fallback if no image)
  nodeG.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke-width', 2)
    .attr('fill-opacity', 0.88);

  // Profile picture (clipped to circle)
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

  // Rank badge
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

  // Name labels — float outside nodes
  const labels = svg.selectAll('text.node-label')
    .data(nodes).enter()
    .append('text')
    .attr('class', 'node-label')
    .attr('text-anchor', 'middle')
    .attr('pointer-events', 'none')
    .text(d => d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name);

  // ── Centre "You" node ─────────────────────────────────────────────────────
  svg.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', CENTER_R)
    .attr('fill', 'var(--accent)')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  if (selfImgUrl) {
    svg.append('image')
      .attr('x', cx - CENTER_R).attr('y', cy - CENTER_R)
      .attr('width', CENTER_R * 2).attr('height', CENTER_R * 2)
      .attr('href', selfImgUrl)
      .attr('clip-path', 'url(#clip-center)')
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('pointer-events', 'none')
      .on('error', function () { d3.select(this).remove(); });
  }

  svg.append('text')
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
  const tooltip = d3.select('body').append('div').attr('id', 'd3-tooltip');

  // ── State ─────────────────────────────────────────────────────────────────
  let hoveredNode = null;
  let simRunning  = true;
  let nodeMoved   = false;

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

  // ── Hover (tooltip + scale) ───────────────────────────────────────────────
  nodeG
    .on('mouseover', (event, d) => {
      hoveredNode = d;
      const sel = d3.select(event.currentTarget).raise();
      if (!simRunning) {
        sel.attr('transform', `translate(${d.x},${d.y}) scale(1.4)`);
      }
      tooltip.style('display', 'block').html(
        `<strong>${d.name}</strong><br>` +
        `${t('graphHoverScore')}: ${d.normalised.toFixed(1)}<br>` +
        `${d.active ? t('graphLegendActive') : t('graphLegendInact')}`
      );
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 36) + 'px');
    })
    .on('mouseout', function (_, d) {
      hoveredNode = null;
      if (!simRunning) {
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
      }
      tooltip.style('display', 'none');
    })
    .on('click', (_, d) => {
      if (nodeMoved) { nodeMoved = false; return; }
      if (d.linkUrl) window.open(d.linkUrl, '_blank', 'noopener');
    });

  // ── Force simulation ──────────────────────────────────────────────────────

  // Helper: shorten a line so the arrow tip stops at the node edge
  function shortenToNode(x1, y1, x2, y2, targetR) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ratio = (dist - targetR - 2) / dist;  // -2px margin
    return { x: x1 + dx * ratio, y: y1 + dy * ratio };
  }

  // Build link data for physics: center→friend + imported friend→friend
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
      // User → friend edges: shorten to stop at node edge
      userLinks.each(function (d) {
        const end = shortenToNode(cx, cy, d.x, d.y, d.r);
        d3.select(this).attr('x2', end.x).attr('y2', end.y);
      });

      // Imported friend → friend edges
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
};
