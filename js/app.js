/**
 * Main app controller.
 * Handles: theme, language, analyse, clear, search, export.
 */

// ── Theme ────────────────────────────────────────────────────────────────────

function getEffectiveTheme() {
  if (document.documentElement.classList.contains('theme-light')) return 'light';
  if (document.documentElement.classList.contains('theme-dark'))  return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.remove('theme-light', 'theme-dark');
  html.classList.add(`theme-${theme}`);
  localStorage.setItem('fb-sg-theme', theme);

  const btnDark  = document.getElementById('btn-theme-dark');
  const btnLight = document.getElementById('btn-theme-light');
  btnDark.classList.toggle('active',  theme === 'dark');
  btnLight.classList.toggle('active', theme === 'light');
}

function initTheme() {
  const saved = localStorage.getItem('fb-sg-theme');
  // Respect saved choice; otherwise fall back to system preference
  if (saved) {
    applyTheme(saved);
  } else {
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(system);
  }
}

// ── Language ─────────────────────────────────────────────────────────────────

window.setLang = function (lang) {
  currentLang = lang;
  localStorage.setItem('fb-sg-lang', lang);
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  document.getElementById('btn-zh').classList.toggle('active', lang === 'zh');
  applyLang();

  // Re-render if we have data
  if (window._lastProfiles) {
    renderAll(window._lastProfiles);
  }

  // Keep button text correct while idle
  if (!btnAnalyse.disabled) btnAnalyse.textContent = t('btnAnalyse');
};

// ── DOM refs ─────────────────────────────────────────────────────────────────

const input      = document.getElementById('source-input');
const btnAnalyse = document.getElementById('btn-analyse');
const btnClear   = document.getElementById('btn-clear');
const errorEl    = document.getElementById('error-msg');

// ── Analyse ──────────────────────────────────────────────────────────────────

input.addEventListener('input', () => {
  btnAnalyse.disabled = input.value.trim().length === 0;
  errorEl.style.display = 'none';
});

btnAnalyse.addEventListener('click', () => {
  errorEl.style.display = 'none';
  const raw = input.value.trim();
  if (!raw) return;

  btnAnalyse.disabled = true;
  btnAnalyse.textContent = t('btnParsing');

  // Defer so browser can repaint the "Parsing…" label before the heavy parse
  setTimeout(() => {
    try {
      const { profiles, selfImgUrl, selfId, selfName, error } = parseFacebookSource(raw);
      if (error) {
        errorEl.textContent = t('errorEmpty');
        errorEl.style.display = 'block';
      } else {
        window._lastProfiles = profiles;
        window._selfImgUrl = selfImgUrl || '';
        window._selfId = selfId || '';
        window._selfName = selfName || '';
        renderAll(profiles);
        document.getElementById('graph-section').scrollIntoView({ behavior: 'smooth' });
      }
    } catch (e) {
      errorEl.textContent = t('errorParse') + e.message;
      errorEl.style.display = 'block';
    }
    btnAnalyse.disabled = false;
    btnAnalyse.textContent = t('btnAnalyse');
  }, 50);
});

// ── Clear ─────────────────────────────────────────────────────────────────────

btnClear.addEventListener('click', () => {
  input.value = '';
  window._lastProfiles = null;
  window._importedEdges = [];
  btnAnalyse.disabled = true;
  errorEl.style.display = 'none';
  clearCharts();
});

// ── Search ────────────────────────────────────────────────────────────────────

const searchInput = document.getElementById('search-input');

searchInput.addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#table-container tbody tr');
  let visible = 0;
  rows.forEach(row => {
    const name = row.dataset.name || '';
    const show = !q || name.includes(q);
    row.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('search-count').textContent = t('searchCount', visible);
  if (typeof window.highlightGraphNode === 'function') window.highlightGraphNode(q);
});

// Esc clears search + restores graph
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape' && searchInput.value) {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    searchInput.blur();
  }
});

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cols.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

function csvQuote(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

// ── Export CSV (unified edge list) ───────────────────────────────────────────
//
// Format: Rank, From Name, From ID, To Name, To ID, Raw Base, Score (0-100), Active
// Contains user→friend edges + all imported edges = superset of any imported CSV.

document.getElementById('btn-export').addEventListener('click', () => {
  const profiles = window._lastProfiles;
  if (!profiles) return;

  const selfName = window._selfName || t('graphCenter');
  const selfId   = window._selfId   || '';
  const meta     = `# Exported-By: ${selfId || 'unknown'}`;
  const header   = 'Rank,From Name,From ID,To Name,To ID,Raw Base,Score (0-100),Active';

  const rows = [];
  let rank = 1;

  // User → friend edges
  for (const p of profiles) {
    rows.push([rank++, csvQuote(selfName), selfId, csvQuote(p.name), p.profileId || '', p.rawBase.toFixed(6), p.normalised.toFixed(2), p.active ? 'YES' : 'NO'].join(','));
  }

  // Imported friend → friend edges (superset of imported files)
  for (const e of window._importedEdges) {
    rows.push([rank++, csvQuote(e.fromName), e.fromId, csvQuote(e.toName), e.toId, e.rawBase.toFixed(6), e.normalised.toFixed(2), e.active ? 'YES' : 'NO'].join(','));
  }

  const csv = [meta, header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fb_social_graph.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import CSV ───────────────────────────────────────────────────────────────
//
// Handles two formats:
//   1. Edge format (has "From Name" column): each row is a directed edge,
//      no modal needed — source is in the "From" column.
//   2. Legacy profile format (has "Name" but no "From Name"): rows are profiles,
//      uses Exported-By metadata or modal to identify source friend.
//
// Imported edges are stored in window._importedEdges and included in future exports
// (superset property).

window._importedEdges = [];

function parseCsvImport(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  let exportedById = '';
  let dataStart = 0;
  if (lines[0].startsWith('#')) {
    const m = lines[0].match(/Exported-By:\s*(\S+)/);
    if (m && m[1] !== 'unknown') exportedById = m[1];
    dataStart = 1;
  }
  if (lines.length < dataStart + 2) return null;

  const header = parseCsvLine(lines[dataStart]).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const col = name => header.findIndex(h => h === name);

  const isEdgeFormat = col('from name') >= 0 && col('to name') >= 0;

  if (isEdgeFormat) {
    return parseEdgeFormat(lines, dataStart, header, col);
  } else {
    return parseLegacyFormat(lines, dataStart, header, col, exportedById);
  }
}

function parseEdgeFormat(lines, dataStart, header, col) {
  const iFromName = col('from name');
  const iFromId   = col('from id');
  const iToName   = col('to name');
  const iToId     = col('to id');
  const iRaw      = header.findIndex(h => h.includes('raw'));
  const iScore    = header.findIndex(h => h.includes('score'));
  const iActive   = col('active');

  const edges = [];
  for (let i = dataStart + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = parseCsvLine(lines[i]);
    const fromName = (c[iFromName] || '').trim();
    const fromId   = iFromId >= 0 ? (c[iFromId] || '').trim() : '';
    const toName   = (c[iToName] || '').trim();
    const toId     = iToId >= 0 ? (c[iToId] || '').trim() : '';
    const rawBase  = iRaw >= 0 ? parseFloat(c[iRaw]) || 0 : 0;
    const score    = iScore >= 0 ? parseFloat(c[iScore]) || 0 : 0;
    const active   = iActive >= 0 ? (c[iActive] || '').trim().toUpperCase() === 'YES' : false;
    if (!fromName || !toName) continue;
    edges.push({ fromName, fromId, toName, toId, rawBase: rawBase || score / 100, normalised: score, active });
  }
  return edges.length ? { type: 'edges', edges } : null;
}

function parseLegacyFormat(lines, dataStart, header, col, exportedById) {
  const iName  = col('name');
  const iId    = header.findIndex(h => h.includes('profile id') || h === 'profileid');
  const iRaw   = header.findIndex(h => h.includes('raw'));
  const iScore = header.findIndex(h => h.includes('score'));
  const iActive = col('active');
  if (iName === -1) return null;

  const entries = [];
  for (let i = dataStart + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = parseCsvLine(lines[i]);
    const name      = (c[iName] || '').trim();
    const profileId = iId >= 0 ? (c[iId] || '').trim() : '';
    const rawBase   = iRaw >= 0 ? parseFloat(c[iRaw]) || 0 : 0;
    const score     = iScore >= 0 ? parseFloat(c[iScore]) || 0 : 0;
    const active    = iActive >= 0 ? (c[iActive] || '').trim().toUpperCase() === 'YES' : false;
    if (!name) continue;
    entries.push({ name, profileId, rawBase: rawBase || score / 100, normalised: score, active });
  }
  return entries.length ? { type: 'legacy', exportedById, entries } : null;
}

/**
 * Add edges to _importedEdges where both endpoints are in V.
 * Skips duplicates and self-loops. Returns count of edges added.
 */
function addEdgesToGraph(edges) {
  const profiles = window._lastProfiles;
  if (!profiles) return 0;

  const top50 = profiles.slice(0, 50);
  const vByName = new Map();
  const vById   = new Map();
  top50.forEach(p => {
    vByName.set(p.name.toLowerCase(), p);
    if (p.profileId) vById.set(p.profileId, p);
  });

  const selfId = window._selfId || '';

  function resolveV(name, id) {
    return (id && vById.get(id)) || vByName.get(name.toLowerCase()) || null;
  }

  let added = 0;
  for (const e of edges) {
    // Skip edges that originate from the user (we already have user→friend edges)
    if (e.fromId && e.fromId === selfId) continue;

    const fromNode = resolveV(e.fromName, e.fromId);
    const toNode   = resolveV(e.toName, e.toId);
    if (!fromNode || !toNode) continue;
    if (fromNode === toNode) continue; // no self-loops

    // Deduplicate
    const exists = window._importedEdges.some(x =>
      x.fromName.toLowerCase() === fromNode.name.toLowerCase() &&
      x.toName.toLowerCase() === toNode.name.toLowerCase()
    );
    if (exists) continue;

    window._importedEdges.push({
      fromName: fromNode.name,
      fromId: fromNode.profileId || e.fromId,
      toName: toNode.name,
      toId: toNode.profileId || e.toId,
      rawBase: e.rawBase,
      normalised: e.normalised,
      active: e.active,
    });
    added++;
  }
  return added;
}

/**
 * Convert legacy profile-list import into edges (source → each matched profile in V).
 */
function legacyToEdges(sourceName, sourceId, entries) {
  return entries.map(e => ({
    fromName: sourceName,
    fromId: sourceId,
    toName: e.name,
    toId: e.profileId,
    rawBase: e.rawBase,
    normalised: e.normalised,
    active: e.active,
  }));
}

function triggerCsvImport() {
  if (!window._lastProfiles) {
    showToast(t('importModalNoData'));
    return;
  }
  document.getElementById('csv-file-input').click();
}

document.getElementById('btn-import').addEventListener('click', triggerCsvImport);

document.getElementById('csv-file-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  this.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    errorEl.style.display = 'none';
    const result = parseCsvImport(e.target.result);
    if (!result) { showImportError(t('toastImportErr')); return; }

    if (result.type === 'edges') {
      // New edge format — no modal needed, source is in each row
      const added = addEdgesToGraph(result.edges);
      if (added > 0) {
        renderAll(window._lastProfiles);
        document.getElementById('graph-section').scrollIntoView({ behavior: 'smooth' });
        showToast(t('toastImported', added));
      } else {
        showImportError(t('toastImportNoEdges'));
      }
    } else {
      // Legacy profile format — need modal to identify source friend
      showImportModal(result.exportedById, result.entries);
    }
  };
  reader.readAsText(file, 'utf-8');
});

// Persistent import errors (replaces 3-second toasts that swallowed the message)
function showImportError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

// ── Contributor chip strip ────────────────────────────────────────────────────
// One chip per friend who has imported their CSV. Click × to remove just that
// contributor's edges (the only "undo per import" surface — Clear wipes all).

window.renderContributors = function () {
  const wrap = document.getElementById('contributors');
  if (!wrap) return;
  const edges = window._importedEdges || [];
  if (!edges.length) {
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }
  const profiles = window._lastProfiles || [];
  const profileById = new Map(profiles.map(p => [p.profileId, p]));
  const profileByName = new Map(profiles.map(p => [p.name.toLowerCase(), p]));

  // Group edges by contributor (fromName, lower-cased)
  const groups = new Map();
  for (const e of edges) {
    const k = e.fromName.toLowerCase();
    if (!groups.has(k)) groups.set(k, { name: e.fromName, fromId: e.fromId, count: 0 });
    groups.get(k).count++;
  }

  const chips = [...groups.values()].map(g => {
    const profile = profileById.get(g.fromId) || profileByName.get(g.name.toLowerCase());
    const img = profile && profile.imgUrl
      ? `<img src="${escapeAttr(profile.imgUrl)}" alt="" onerror="this.style.display='none'">`
      : '';
    return `<span class="contributor-chip" data-name="${escapeAttr(g.name.toLowerCase())}">
      ${img}
      <span class="chip-name">${escapeHtml(g.name)}</span>
      <span class="chip-count">· ${g.count}</span>
      <button class="chip-remove" type="button" aria-label="${escapeAttr(t('removeContributor', g.name))}">×</button>
    </span>`;
  }).join('');

  wrap.innerHTML = `<span class="contributors-label">${t('contributorsLabel')}</span>${chips}`;
  wrap.hidden = false;

  wrap.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = btn.closest('.contributor-chip');
      const target = chip.dataset.name;
      window._importedEdges = (window._importedEdges || []).filter(
        e => e.fromName.toLowerCase() !== target
      );
      if (window._lastProfiles) renderAll(window._lastProfiles);
    });
  });
};

function showImportModal(exportedById, entries) {
  const profiles = window._lastProfiles;
  if (!profiles) return;

  const modal  = document.getElementById('import-modal');
  const select = document.getElementById('import-modal-select');
  const top50  = profiles.slice(0, 50);

  select.innerHTML = top50.map(p =>
    `<option value="${escapeAttr(p.name)}" data-id="${p.profileId || ''}">${p.name}</option>`
  ).join('');

  if (exportedById) {
    const match = top50.find(p => p.profileId === exportedById);
    if (match) select.value = match.name;
  }

  // Native <dialog>: Esc closes, focus is trapped, backdrop is provided.
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');

  const close = () => { if (modal.open) modal.close(); else modal.removeAttribute('open'); };

  document.getElementById('import-modal-confirm').onclick = () => {
    close();
    const opt = select.selectedOptions[0];
    const sourceName = opt.value;
    const sourceId   = opt.dataset.id || '';
    const edges = legacyToEdges(sourceName, sourceId, entries);
    const added = addEdgesToGraph(edges);
    if (added > 0) {
      renderAll(profiles);
      document.getElementById('graph-section').scrollIntoView({ behavior: 'smooth' });
      showToast(t('toastImported', added));
    } else {
      showImportError(t('toastImportNoEdges'));
    }
  };
  document.getElementById('import-modal-cancel').onclick = close;
  // Click on backdrop closes (native <dialog> doesn't do this by default)
  modal.onclick = e => {
    const r = modal.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close();
  };
}

// ── Share graph (native share → clipboard → download fallback) ───────────────

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

window.shareGraph = async function () {
  const btn = document.getElementById('btn-share');
  const origText = btn.textContent;
  btn.textContent = currentLang === 'zh' ? '擷取中...' : 'Capturing...';
  btn.disabled = true;

  try {
    const blob = await captureGraphAsPng();
    if (!blob) { showToast(t('toastFailed')); return; }

    const file = new File([blob], 'affinity_orbit.png', { type: 'image/png' });

    // 1. Try native share sheet (works on mobile, some desktops)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: t('graphTitle'),
        files: [file],
      });
      return;
    }

    // 2. Try copy to clipboard
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      showToast(t('toastCopied'));
      return;
    }

    // 3. Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'affinity_orbit.png';
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(t('toastSaved'));

  } catch (e) {
    // User may have cancelled the native share sheet — that's fine
    if (e.name !== 'AbortError') console.warn('Share failed:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
};

/**
 * Capture the D3 orbit SVG as a high-res PNG.
 * Resolves CSS custom properties so the exported image looks correct.
 */
async function captureGraphAsPng() {
  const svg = document.querySelector('#chart-graph svg');
  if (!svg) return null;

  const clone = svg.cloneNode(true);
  const cs = getComputedStyle(document.documentElement);

  // Remove external <image> elements (Facebook CDN blocks CORS, tainting the canvas).
  // The colored circle fallbacks underneath will show through instead.
  clone.querySelectorAll('image').forEach(img => img.remove());

  // Reset any active zoom/pan so the exported image shows the full orbit.
  clone.querySelectorAll('.zoom-root').forEach(g => g.removeAttribute('transform'));

  // Background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', cs.getPropertyValue('--bg-card').trim());
  clone.insertBefore(bg, clone.firstChild);

  // Title text
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', '50%');
  title.setAttribute('y', '28');
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('fill', cs.getPropertyValue('--accent').trim());
  title.setAttribute('font-size', '18');
  title.setAttribute('font-weight', 'bold');
  title.setAttribute('font-family', "'Gaegu','Noto Sans TC',cursive");
  title.textContent = t('graphTitle');
  clone.appendChild(title);

  // Resolve all var(--xxx) in attributes and inline styles
  const resolve = str =>
    str.replace(/var\(--([^)]+)\)/g, (_, n) => cs.getPropertyValue('--' + n).trim());

  clone.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.value.includes('var(')) attr.value = resolve(attr.value);
    }
    const style = el.getAttribute('style');
    if (style && style.includes('var(')) el.setAttribute('style', resolve(style));
  });

  // Inline CSS-class styles for labels (paint-order halo)
  const textFill = cs.getPropertyValue('--text').trim();
  const bgCard   = cs.getPropertyValue('--bg-card').trim();
  clone.querySelectorAll('.node-label').forEach(el => {
    el.setAttribute('fill', textFill);
    el.setAttribute('stroke', bgCard);
    el.setAttribute('stroke-width', '3');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('paint-order', 'stroke fill');
    el.setAttribute('font-family', "'Gaegu','Noto Sans TC',cursive");
    el.setAttribute('font-size', '9');
  });

  // Set explicit pixel dimensions for the Image
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width',  vb.width);
  clone.setAttribute('height', vb.height);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const imgUrl = URL.createObjectURL(svgBlob);

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = vb.width * 2;   // 2x for retina clarity
      c.height = vb.height * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(imgUrl);
      c.toBlob(b => resolve(b), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(imgUrl); resolve(null); };
    img.src = imgUrl;
  });
}

// ── Language init ─────────────────────────────────────────────────────────────

function initLang() {
  const saved = localStorage.getItem('fb-sg-lang');
  setLang(saved || 'zh');
}

// ── Init ──────────────────────────────────────────────────────────────────────

initTheme();
initLang();
// Translate share button on init
const btnShare = document.getElementById('btn-share');
if (btnShare) btnShare.textContent = t('btnShare');

// Show the mobile banner when the user is on a touch-only device that can't
// view Facebook page source (no Ctrl+U).
(function initMobileBanner() {
  const banner = document.getElementById('mobile-banner');
  if (!banner) return;
  const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) banner.hidden = false;
})();

// Global keyboard shortcut: '/' focuses search input (when not typing in another field)
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const search = document.getElementById('search-input');
  if (!search || search.offsetParent === null) return; // hidden
  e.preventDefault();
  search.focus();
});
