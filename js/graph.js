/**
 * D3 affinity orbit graph.
 * Renders top N friends as force-directed nodes orbiting "You" at the centre.
 * Nodes show profile pictures (clipped to circles) and are clickable.
 * Closer orbit = higher affinity score.
 *
 * UX features:
 *   - Hover enlarges individual node correctly even during simulation
 *   - "You" centre node shows the user's own profile picture
 *   - Drag any friend node to pin it; double-click a pinned node to release it
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

  const svg = d3.select('#chart-graph')
    .append('svg')
    .attr('width', '100%')
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);

  const defs = svg.append('defs');

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

  // Lines from centre to each friend
  const links = svg.selectAll('line.orbit-link')
    .data(nodes).enter()
    .append('line')
    .attr('class', 'orbit-link')
    .attr('x1', cx).attr('y1', cy)
    .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke-opacity', d => 0.15 + (d.normalised / 100) * 0.55)
    .attr('stroke-width', d => 0.5 + (d.normalised / 100) * 2);

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
  let hoveredNode = null;  // used by tick to maintain scale during simulation
  let simRunning  = true;  // true until force simulation settles
  let nodeMoved   = false; // true if pointer moved during current drag session

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
      // Release the node — let the simulation spring it back elastically
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
      // When sim has settled, apply scale directly (tick no longer runs)
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
      // Suppress click when pointer actually moved during drag
      if (nodeMoved) { nodeMoved = false; return; }
      if (d.linkUrl) window.open(d.linkUrl, '_blank', 'noopener');
    });

  // ── Force simulation ──────────────────────────────────────────────────────
  const simulation = d3.forceSimulation(nodes)
    .force('radial',    d3.forceRadial(d => d.targetRadius, cx, cy).strength(0.75))
    .force('charge',    d3.forceManyBody().strength(-18))
    .force('collision', d3.forceCollide(d => d.r + 16))
    .on('tick', () => {
      links.attr('x2', d => d.x).attr('y2', d => d.y);
      // Apply hover scale via hoveredNode so it works even during simulation
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
