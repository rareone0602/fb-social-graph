/**
 * Stats + ranked table + the single chart that's earned its place.
 * Depends on: window.t() from i18n.js, window.currentLang from i18n.js
 *
 * Layout (top to bottom):
 *   1. Stats bar — three narrative facts
 *   2. D3 Orbit Graph — hero piece
 *   3. Active/Inactive donut — single comparative fact that survived the cull
 *   4. Search / Export / Share controls
 *   5. Table with profile pictures and clickable names
 */

window.clearCharts = function () {
  document.getElementById('charts').innerHTML = '';
  document.getElementById('table-container').innerHTML = '';
  document.getElementById('graph-section').style.display = 'none';
  document.getElementById('table-controls').style.display = 'none';
  document.querySelectorAll('.d3-tooltip').forEach(el => el.remove());
};

window.renderAll = function (profiles, topN = 50) {
  clearCharts();

  document.getElementById('charts').innerHTML = `
    <div class="stats-bar" id="stats-bar"></div>
    <div class="chart-row">
      <div class="chart-box chart-full" id="chart-donut" style="min-height:340px"></div>
    </div>
  `;

  renderStats(profiles);

  // ── D3 Orbit Graph (hero) ──
  const graphSection = document.getElementById('graph-section');
  graphSection.style.display = 'block';
  document.getElementById('graph-title').textContent = t('graphTitle');
  try { renderGraph(profiles, topN); } catch (e) { console.warn('D3 graph failed:', e); }
  // Show import legend if there are imported edges
  const legendImport = document.getElementById('legend-import');
  if (legendImport) legendImport.style.display = (window._importedEdges || []).length ? '' : 'none';
  // Render contributor chip strip (no-op if empty)
  if (typeof window.renderContributors === 'function') window.renderContributors();

  // ── Donut chart ──
  requestAnimationFrame(() => {
    try { renderDonut(profiles); } catch (e) { console.warn('Donut chart failed:', e); }
  });

  // ── Table with search/export controls ──
  document.getElementById('table-controls').style.display = 'flex';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  document.getElementById('btn-export').textContent = t('btnExport');
  renderTable(profiles);
};

// ── Stats ────────────────────────────────────────────────────────────────────

function countMutualBestFriends(profiles) {
  const edges = window._importedEdges || [];
  if (!edges.length || !profiles.length) return 0;
  const selfName = (window._selfName || '').toLowerCase();
  if (!selfName) return 0;
  const myTopName = profiles[0].name.toLowerCase();

  // Group edges by contributor (fromName), find each contributor's top-1 (max normalised)
  const topByContributor = new Map();
  for (const e of edges) {
    const k = e.fromName.toLowerCase();
    const cur = topByContributor.get(k);
    if (!cur || e.normalised > cur.normalised) topByContributor.set(k, e);
  }

  let mutual = 0;
  for (const [contribName, top] of topByContributor) {
    if (contribName === myTopName && top.toName.toLowerCase() === selfName) mutual++;
  }
  return mutual;
}

function renderStats(profiles) {
  const n = profiles.length;
  const nActive = profiles.filter(p => p.active).length;
  const topName = profiles[0]?.name || '—';
  const mutual = countMutualBestFriends(profiles);

  const tiles = [
    `<div class="stat stat-narrative">
       <span class="stat-label">${t('statTopLabel')}</span>
       <span class="stat-val">${escapeHtml(topName)}</span>
     </div>`,
    `<div class="stat stat-narrative">
       <span class="stat-label">${t('statActiveLabel')}</span>
       <span class="stat-val">${t('statActiveVal', nActive, n)}</span>
     </div>`,
  ];
  if (mutual > 0) {
    tiles.push(
      `<div class="stat stat-narrative stat-mutual">
         <span class="stat-label">${t('statMutualLabel')}</span>
         <span class="stat-val">${t('statMutualVal', mutual)}</span>
       </div>`
    );
  }

  document.getElementById('stats-bar').innerHTML = tiles.join('');
}

// ── Active/Inactive Donut (the only chart left after the cull) ───────────────

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

// ── Table with profile pictures + clickable names ────────────────────────────

window.renderTable = function (profiles) {
  const container = document.getElementById('table-container');
  let rows = '';
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const activeSymbol = p.active ? '●' : '○';
    const activeLabel = `${activeSymbol} ${p.active ? t('activeYes') : t('activeNo')}`;
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
