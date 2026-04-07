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
      const { profiles, selfImgUrl, error } = parseFacebookSource(raw);
      if (error) {
        errorEl.textContent = t('errorEmpty');
        errorEl.style.display = 'block';
      } else {
        window._lastProfiles = profiles;
        window._selfImgUrl = selfImgUrl || '';
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
  btnAnalyse.disabled = true;
  errorEl.style.display = 'none';
  clearCharts();
});

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('search-input').addEventListener('input', function () {
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
});

// ── Export CSV ────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  const profiles = window._lastProfiles;
  if (!profiles) return;

  const header = ['Rank', 'Name', 'Raw Base', 'Score (0-100)', 'Active'].join(',');
  const rows = profiles.map((p, i) =>
    [i + 1, `"${p.name.replace(/"/g, '""')}"`, p.rawBase.toFixed(6), p.normalised.toFixed(2), p.active ? 'YES' : 'NO'].join(',')
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fb_social_graph.csv';
  a.click();
  URL.revokeObjectURL(url);
});

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
