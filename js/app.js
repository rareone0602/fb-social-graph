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
      const { profiles, error } = parseFacebookSource(raw);
      if (error) {
        errorEl.textContent = t('errorEmpty');
        errorEl.style.display = 'block';
      } else {
        window._lastProfiles = profiles;
        renderAll(profiles);
        document.getElementById('charts').scrollIntoView({ behavior: 'smooth' });
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

// ── Share to Facebook ─────────────────────────────────────────────────────────

window.shareToFacebook = function () {
  const url = encodeURIComponent('https://rareone0602.github.io/fb-social-graph/');
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    '_blank',
    'width=600,height=460,noopener'
  );
};

// ── Init ──────────────────────────────────────────────────────────────────────

initTheme();
applyLang();
// Translate share button on init
const btnShare = document.getElementById('btn-share');
if (btnShare) btnShare.textContent = t('btnShare');
