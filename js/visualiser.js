/**
 * roughViz charts + ranked table.
 * Depends on: window.t() from i18n.js, window.currentLang from i18n.js
 *
 * Layout (top to bottom):
 *   1. Stats bar (full width summary)
 *   2. D3 Orbit Graph — hero piece (full width)
 *   3. Top 10 vertical Bar + Active/Inactive Donut (side by side)
 *   4. Score Decay Line chart (full width — rank vs score long tail)
 *   5. Tier Bar + Distribution Bar (side by side)
 *   6. Search / Export / Share controls
 *   7. Table with profile pictures and clickable names
 */

function truncate(name, max = 12) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

window.clearCharts = function () {
  document.getElementById('charts').innerHTML = '';
  document.getElementById('table-container').innerHTML = '';
  document.getElementById('graph-section').style.display = 'none';
  document.getElementById('table-controls').style.display = 'none';
  const tip = document.getElementById('d3-tooltip');
  if (tip) tip.remove();
};

window.renderAll = function (profiles, topN = 50) {
  clearCharts();

  // ── Stats bar ──
  document.getElementById('charts').innerHTML = `
    <div class="stats-bar" id="stats-bar"></div>
    <div class="chart-row">
      <div class="chart-box" id="chart-top10" style="min-height:420px"></div>
      <div class="chart-box" id="chart-donut" style="min-height:380px"></div>
    </div>
    <div class="chart-row">
      <div class="chart-box chart-full" id="chart-decay" style="min-height:340px"></div>
    </div>
    <div class="chart-row">
      <div class="chart-box" id="chart-tiers" style="min-height:380px"></div>
      <div class="chart-box" id="chart-dist" style="min-height:380px"></div>
    </div>
  `;

  renderStats(profiles);

  // ── D3 Orbit Graph (hero, before charts) ──
  const graphSection = document.getElementById('graph-section');
  graphSection.style.display = 'block';
  document.getElementById('graph-title').textContent = t('graphTitle');
  try { renderGraph(profiles, topN); } catch (e) { console.warn('D3 graph failed:', e); }
  // Show import legend if there are imported edges
  const legendImport = document.getElementById('legend-import');
  if (legendImport) legendImport.style.display = (window._importedEdges || []).length ? '' : 'none';

  // ── roughViz charts (deferred for repaint, each wrapped to prevent cascade failure) ──
  requestAnimationFrame(() => {
    try { renderTop10(profiles); }       catch (e) { console.warn('Top10 chart failed:', e); }
    try { renderDonut(profiles); }       catch (e) { console.warn('Donut chart failed:', e); }
    try { renderDecay(profiles); }       catch (e) { console.warn('Decay chart failed:', e); }
    try { renderTiers(profiles); }       catch (e) { console.warn('Tiers chart failed:', e); }
    try { renderDistribution(profiles); } catch (e) { console.warn('Dist chart failed:', e); }
  });

  // ── Table with search/export controls ──
  document.getElementById('table-controls').style.display = 'flex';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  document.getElementById('btn-export').textContent = t('btnExport');
  renderTable(profiles);
};

// ── Stats ────────────────────────────────────────────────────────────────────

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

// ── Top 10 Vertical Bar ──────────────────────────────────────────────────────

function renderTop10(profiles) {
  const top = profiles.slice(0, 10);
  new roughViz.Bar({
    element: '#chart-top10',
    data: {
      labels: top.map(p => truncate(p.name)),
      values: top.map(p => Math.round(p.normalised * 10) / 10),
    },
    title: t('chartTop', 10),
    titleFontSize: '1.2rem',
    roughness: 2.5,
    color: '#e94560',
    highlight: '#ff6b81',
    fillStyle: 'hachure',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    padding: 0.3,
    margin: { top: 50, right: 20, bottom: 90, left: 60 },
    font: 0,
    interactive: true,
  });
}

// ── Active/Inactive Donut ────────────────────────────────────────────────────

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

// ── Score Decay Bar (sampled ranks vs score — shows the long tail) ───────────

function renderDecay(profiles) {
  // Sample ~25 evenly spaced ranks to show the decay shape
  const total = profiles.length;
  const sampleCount = Math.min(total, 25);
  const step = Math.max(1, Math.floor(total / sampleCount));
  const indices = [];
  for (let i = 0; i < total; i += step) indices.push(i);
  // Always include the last rank
  if (indices[indices.length - 1] !== total - 1) indices.push(total - 1);

  new roughViz.Bar({
    element: '#chart-decay',
    data: {
      labels: indices.map(i => `#${i + 1}`),
      values: indices.map(i => Math.round(profiles[i].normalised * 10) / 10),
    },
    title: t('chartDecay'),
    titleFontSize: '1.2rem',
    roughness: 2,
    color: '#e94560',
    highlight: '#ff6b81',
    fillStyle: 'hachure',
    fillWeight: 2,
    stroke: 'white',
    strokeWidth: 0.8,
    padding: 0.2,
    font: 0,
    interactive: true,
    margin: { top: 50, right: 20, bottom: 70, left: 60 },
  });
}

// ── Tier Bar ─────────────────────────────────────────────────────────────────

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

// ── Distribution Bar ─────────────────────────────────────────────────────────

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

// ── Table with profile pictures + clickable names ────────────────────────────

window.renderTable = function (profiles) {
  const container = document.getElementById('table-container');
  let rows = '';
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const activeLabel = p.active ? t('activeYes') : t('activeNo');
    const imgTag = p.imgUrl
      ? `<img class="table-avatar" src="${escapeAttr(p.imgUrl)}" alt="" onerror="this.style.display='none'">`
      : '';
    const nameHtml = p.linkUrl
      ? `${imgTag}<a href="${escapeAttr(p.linkUrl)}" target="_blank" rel="noopener noreferrer" class="profile-link">${escapeHtml(p.name)}</a>`
      : `${imgTag}${escapeHtml(p.name)}`;

    rows += `<tr class="${p.active ? 'active-yes' : ''}" data-name="${p.name.toLowerCase()}">
      <td>${i + 1}</td>
      <td class="td-name">${nameHtml}</td>
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

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
