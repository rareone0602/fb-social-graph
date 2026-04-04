/**
 * roughViz charts + ranked table.
 * Depends on: window.t() from i18n.js, window.currentLang from i18n.js
 */

function truncate(name, max = 16) {
  return name.length > max ? name.slice(0, max - 2) + '..' : name;
}

window.clearCharts = function () {
  document.getElementById('charts').innerHTML = '';
  document.getElementById('table-container').innerHTML = '';
  document.getElementById('graph-section').style.display = 'none';
  document.getElementById('table-controls').style.display = 'none';
  // Remove tooltip without depending on D3 being loaded
  const tip = document.getElementById('d3-tooltip');
  if (tip) tip.remove();
};

window.renderAll = function (profiles, topN = 30) {
  clearCharts();

  document.getElementById('charts').innerHTML = `
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

  requestAnimationFrame(() => {
    renderTopFriends(profiles, topN);
    renderDonut(profiles);
    renderTiers(profiles);
    renderDistribution(profiles);
  });

  // D3 graph
  const graphSection = document.getElementById('graph-section');
  graphSection.style.display = 'block';
  document.getElementById('graph-title').textContent = t('graphTitle');
  try { renderGraph(profiles, topN); } catch (e) { console.warn('D3 graph failed:', e); }

  // Table with search/export controls
  document.getElementById('table-controls').style.display = 'flex';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  document.getElementById('btn-export').textContent = t('btnExport');
  renderTable(profiles);
};

function renderStats(profiles) {
  const n = profiles.length;
  const nActive = profiles.filter(p => p.active).length;
  const avgScore = (profiles.reduce((s, p) => s + p.normalised, 0) / n).toFixed(1);
  const topName = profiles[0]?.name || '—';
  const minRaw = Math.min(...profiles.map(p => p.rawBase)).toFixed(6);
  const maxRaw = Math.max(...profiles.map(p => p.rawBase)).toFixed(6);

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat"><span class="stat-val">${n}</span><span class="stat-label">${t('statProfiles')}</span></div>
    <div class="stat"><span class="stat-val">${nActive}</span><span class="stat-label">${t('statActive')}</span></div>
    <div class="stat"><span class="stat-val">${avgScore}</span><span class="stat-label">${t('statAvg')}</span></div>
    <div class="stat"><span class="stat-val">${topName}</span><span class="stat-label">${t('statTop')}</span></div>
    <div class="stat"><span class="stat-val">${minRaw}–${maxRaw}</span><span class="stat-label">${t('statRange')}</span></div>
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
    title: t('chartTop', topN),
    titleFontSize: '1.2rem',
    roughness: 2.5,
    color: '#e94560',
    highlight: '#ff6b81',
    fillStyle: 'hachure',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    padding: 0.4,
    height: 850,
    margin: { top: 50, right: 30, bottom: 50, left: 120 },
    font: 0,
    interactive: true,
  });
}

function renderDonut(profiles) {
  const nActive = profiles.filter(p => p.active).length;
  new roughViz.Donut({
    element: '#chart-donut',
    data: {
      labels: t('chartDonutL'),
      values: [nActive, profiles.length - nActive],
    },
    title: t('chartDonut'),
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
  const keys   = ['90-100', '70-89', '50-69', '30-49', '10-29', '0-9'];
  const counts = [0, 0, 0, 0, 0, 0];
  for (const p of profiles) {
    const s = p.normalised;
    if      (s >= 90) counts[0]++;
    else if (s >= 70) counts[1]++;
    else if (s >= 50) counts[2]++;
    else if (s >= 30) counts[3]++;
    else if (s >= 10) counts[4]++;
    else              counts[5]++;
  }
  new roughViz.Bar({
    element: '#chart-tiers',
    data: { labels: keys, values: counts },
    title: t('chartTiers'),
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
  const binCount = 20;
  const bins = new Array(binCount).fill(0);
  for (const p of profiles) {
    const idx = Math.min(Math.floor(p.normalised / (100 / binCount)), binCount - 1);
    bins[idx]++;
  }
  new roughViz.Bar({
    element: '#chart-dist',
    data: { labels: bins.map((_, i) => `${i * (100 / binCount)}`), values: bins },
    title: t('chartDist'),
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

window.renderTable = function (profiles) {
  const container = document.getElementById('table-container');
  let rows = '';
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const activeLabel = p.active ? t('activeYes') : t('activeNo');
    rows += `<tr class="${p.active ? 'active-yes' : ''}" data-name="${p.name.toLowerCase()}">
      <td>${i + 1}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.rawBase.toFixed(6)}</td>
      <td>${p.normalised.toFixed(2)}</td>
      <td>${activeLabel}</td>
    </tr>`;
  }
  container.innerHTML = `
    <h2>${t('tableTitle', profiles.length)}</h2>
    <table>
      <thead><tr>
        <th>${t('colRank')}</th><th>${t('colName')}</th>
        <th>${t('colRaw')}</th><th>${t('colScore')}</th><th>${t('colActive')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  updateSearchCount(profiles.length);
};

function updateSearchCount(n) {
  const el = document.getElementById('search-count');
  if (el) el.textContent = t('searchCount', n);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
