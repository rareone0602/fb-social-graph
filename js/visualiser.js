/**
 * Renders roughViz charts and a ranked table from parsed profiles.
 */

function truncate(name, max = 16) {
  return name.length > max ? name.slice(0, max - 2) + '..' : name;
}

function clearCharts() {
  document.getElementById('charts').innerHTML = '';
  document.getElementById('table-container').innerHTML = '';
}

function renderAll(profiles, topN = 30) {
  clearCharts();
  const chartsEl = document.getElementById('charts');

  // Create chart containers
  chartsEl.innerHTML = `
    <div class="chart-row">
      <div class="chart-box chart-wide" id="chart-top"></div>
      <div class="chart-box" id="chart-donut"></div>
    </div>
    <div class="chart-row">
      <div class="chart-box" id="chart-tiers"></div>
      <div class="chart-box" id="chart-dist"></div>
    </div>
    <div class="stats-bar" id="stats-bar"></div>
  `;

  renderStats(profiles);
  renderTable(profiles);

  // roughViz charts need a small delay for DOM layout
  requestAnimationFrame(() => {
    renderTopFriends(profiles, topN);
    renderDonut(profiles);
    renderTiers(profiles);
    renderDistribution(profiles);
  });
}

function renderStats(profiles) {
  const n = profiles.length;
  const nActive = profiles.filter(p => p.active).length;
  const avgScore = (profiles.reduce((s, p) => s + p.normalised, 0) / n).toFixed(1);
  const topName = profiles[0]?.name || '—';
  const minRaw = Math.min(...profiles.map(p => p.rawBase)).toFixed(6);
  const maxRaw = Math.max(...profiles.map(p => p.rawBase)).toFixed(6);

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat"><span class="stat-val">${n}</span><span class="stat-label">Profiles</span></div>
    <div class="stat"><span class="stat-val">${nActive}</span><span class="stat-label">Active</span></div>
    <div class="stat"><span class="stat-val">${avgScore}</span><span class="stat-label">Avg Score</span></div>
    <div class="stat"><span class="stat-val">${topName}</span><span class="stat-label">#1 Friend</span></div>
    <div class="stat"><span class="stat-val">${minRaw}–${maxRaw}</span><span class="stat-label">Raw Range</span></div>
  `;
}

function renderTopFriends(profiles, topN) {
  const top = profiles.slice(0, topN);
  new roughViz.BarH({
    element: '#chart-top',
    data: {
      labels: top.map(p => truncate(p.name)),
      values: top.map(p => Math.round(p.normalised * 10) / 10),
    },
    title: `Top ${topN} Friends by Affinity`,
    titleFontSize: '1.2rem',
    roughness: 2.5,
    color: '#e94560',
    highlight: '#ff6b81',
    fillStyle: 'hachure',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    margin: { top: 50, right: 30, bottom: 50, left: 120 },
    padding: 0.15,
    font: 0,
    interactive: true,
  });
}

function renderDonut(profiles) {
  const nActive = profiles.filter(p => p.active).length;
  const nInactive = profiles.length - nActive;
  new roughViz.Donut({
    element: '#chart-donut',
    data: {
      labels: ['Active (+0.5 bonus)', 'Inactive'],
      values: [nActive, nInactive],
    },
    title: 'Active vs Inactive',
    titleFontSize: '1.2rem',
    roughness: 2,
    colors: ['#e94560', '#0f3460'],
    fillStyle: 'cross-hatch',
    fillWeight: 3,
    stroke: 'white',
    strokeWidth: 1,
    font: 0,
    interactive: true,
    highlight: '#ff6b81',
  });
}

function renderTiers(profiles) {
  const tiers = { '90-100': 0, '70-89': 0, '50-69': 0, '30-49': 0, '10-29': 0, '0-9': 0 };
  for (const p of profiles) {
    const s = p.normalised;
    if (s >= 90) tiers['90-100']++;
    else if (s >= 70) tiers['70-89']++;
    else if (s >= 50) tiers['50-69']++;
    else if (s >= 30) tiers['30-49']++;
    else if (s >= 10) tiers['10-29']++;
    else tiers['0-9']++;
  }
  new roughViz.Bar({
    element: '#chart-tiers',
    data: {
      labels: Object.keys(tiers),
      values: Object.values(tiers),
    },
    title: 'Friends by Score Tier',
    titleFontSize: '1.2rem',
    roughness: 2.5,
    color: '#533483',
    highlight: '#9b59b6',
    fillStyle: 'zigzag-line',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    font: 0,
    interactive: true,
    margin: { top: 50, right: 20, bottom: 70, left: 60 },
  });
}

function renderDistribution(profiles) {
  // Bucket scores into histogram bins
  const binCount = 20;
  const bins = new Array(binCount).fill(0);
  for (const p of profiles) {
    const idx = Math.min(Math.floor(p.normalised / (100 / binCount)), binCount - 1);
    bins[idx]++;
  }
  const labels = bins.map((_, i) => `${i * (100 / binCount)}`);
  new roughViz.Bar({
    element: '#chart-dist',
    data: { labels, values: bins },
    title: 'Score Distribution',
    titleFontSize: '1.2rem',
    roughness: 2.5,
    color: '#e94560',
    highlight: '#ff6b81',
    fillStyle: 'hachure',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    font: 0,
    interactive: true,
    margin: { top: 50, right: 20, bottom: 70, left: 60 },
  });
}

function renderTable(profiles) {
  const container = document.getElementById('table-container');
  let html = `
    <h2>Full Ranked List (${profiles.length} profiles)</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Raw Base</th>
          <th>Score</th>
          <th>Active</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const activeClass = p.active ? 'active-yes' : '';
    html += `
      <tr class="${activeClass}">
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.rawBase.toFixed(6)}</td>
        <td>${p.normalised.toFixed(2)}</td>
        <td>${p.active ? 'YES' : 'NO'}</td>
      </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
