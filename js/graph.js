/**
 * D3 affinity orbit graph.
 * Renders top N friends as force-directed nodes orbiting "You" at the centre.
 * Closer orbit = higher affinity score.
 */

window.renderGraph = function (profiles, topN = 30) {
  // Clean up any existing tooltip
  d3.select('#d3-tooltip').remove();

  const top = profiles.slice(0, topN);
  const container = document.getElementById('chart-graph');
  container.innerHTML = '';

  const W = container.clientWidth || 860;
  const H = 580;
  const cx = W / 2;
  const cy = H / 2;
  const MAX_ORBIT = Math.min(cx, cy) - 40;

  // Build node data — targetRadius inversely proportional to score
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

  // Dashed orbit rings for reference
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', 55 + frac * (MAX_ORBIT - 55))
      .attr('fill', 'none')
      .attr('stroke', 'var(--border)')
      .attr('stroke-dasharray', '3 5')
      .attr('opacity', 0.25);
  });

  // Lines from centre to each friend node
  const links = svg.selectAll('line.orbit-link')
    .data(nodes).enter()
    .append('line')
    .attr('class', 'orbit-link')
    .attr('x1', cx).attr('y1', cy)
    .attr('stroke', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke-opacity', d => 0.15 + (d.normalised / 100) * 0.55)
    .attr('stroke-width', d => 0.5 + (d.normalised / 100) * 2);

  // Friend nodes
  const nodeG = svg.selectAll('g.friend-node')
    .data(nodes).enter()
    .append('g')
    .attr('class', 'friend-node')
    .style('cursor', 'pointer');

  nodeG.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.active ? 'var(--accent)' : 'var(--node-inactive)')
    .attr('stroke', 'var(--bg-card)')
    .attr('stroke-width', 1.5)
    .attr('fill-opacity', 0.88);

  // Rank label inside larger nodes
  nodeG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', d => d.r > 11 ? '9px' : '7px')
    .attr('fill', '#fff')
    .attr('pointer-events', 'none')
    .text((_, i) => i + 1);

  // Centre "You" node (drawn last so it's on top)
  svg.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', 24)
    .attr('fill', 'var(--accent)');
  svg.append('text')
    .attr('x', cx).attr('y', cy)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '11px')
    .attr('font-weight', 'bold')
    .attr('fill', '#fff')
    .attr('font-family', "'Gaegu','Noto Sans TC',cursive")
    .text(t('graphCenter'));

  // Tooltip
  const tooltip = d3.select('body').append('div').attr('id', 'd3-tooltip');

  nodeG
    .on('mouseover', (event, d) => {
      tooltip.style('display', 'block').html(
        `<strong>${d.name}</strong><br>` +
        `${t('graphHoverScore')}: ${d.normalised.toFixed(1)}<br>` +
        `${d.active ? t('graphLegendActive') : t('graphLegendInact')}`
      );
    })
    .on('mousemove', event => {
      tooltip
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 36) + 'px');
    })
    .on('mouseout', () => tooltip.style('display', 'none'));

  // Force simulation
  d3.forceSimulation(nodes)
    .force('radial',    d3.forceRadial(d => d.targetRadius, cx, cy).strength(0.75))
    .force('charge',    d3.forceManyBody().strength(-18))
    .force('collision', d3.forceCollide(d => d.r + 5))
    .on('tick', () => {
      links
        .attr('x2', d => d.x)
        .attr('y2', d => d.y);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });
};
