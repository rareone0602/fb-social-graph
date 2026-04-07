/**
 * Internationalisation — translations + t() helper.
 * Exposes: window.currentLang, window.t(), window.applyLang()
 */

window.currentLang = 'zh';

window.TRANSLATIONS = {
  en: {
    tabTitle: 'FB Social Graph Visualiser',
    title: 'FB Social Graph Visualiser',
    subtitle: "See how Facebook's ML ranks your friends",
    step1: 'Go to <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer"><strong>facebook.com</strong></a>',
    step2: 'Press <strong>Ctrl+U</strong> to view source',
    step3: '<strong>Ctrl+A</strong> select all, <strong>Ctrl+C</strong> copy, then paste below',
    placeholder: 'Paste your Facebook page source here (Ctrl+V)...',
    btnAnalyse: 'Analyse',
    btnParsing: 'Parsing...',
    btnClear: 'Clear',
    btnThemeDark: 'Dark',
    btnThemeLight: 'Light',
    privacy: 'Your data never leaves this page. All parsing happens locally in your browser.',
    explainerTitle: 'What do these numbers mean?',
    scoreDt: 'Score (0–100)',
    scoreDd: "Facebook's ML model assigns each friend a <strong>base affinity</strong> (feature 16173) reflecting how likely you are to interact with them. Normalised to 0–100 relative to your own social graph, where 100 = your closest friend.",
    rawDt: 'Raw Base',
    rawDd: "The original affinity value from Facebook's payload. The range is narrow (~0.389–0.414) because it's a probability-like weight, but small differences matter at scale.",
    activeDt: 'Active',
    activeDd: 'Detects a structural +0.5 engagement bonus in the multiplier (feature 16174). "YES" means Facebook considers you actively engaging with this person — messaging, reacting, or visiting their profile.',
    errorParse: 'Parsing failed: ',
    errorEmpty: 'No profile data found. Make sure you pasted the full page source from facebook.com (Ctrl+U).',
    tableTitle: n => `Full Ranked List (${n} profiles)`,
    statProfiles: 'Profiles',
    statActive: 'Active',
    statAvg: 'Avg Score',
    statTop: '#1 Friend',
    statRange: 'Raw Range',
    chartTop: n => `Top ${n} Friends by Affinity`,
    chartDonut: 'Active vs Inactive',
    chartDonutL: ['Active (+0.5 bonus)', 'Inactive'],
    chartTiers: 'Friends by Score Tier',
    chartDecay: 'Score Decay by Rank',
    chartDist: 'Score Distribution',
    colRank: 'Rank',
    colName: 'Name',
    colRaw: 'Raw Base',
    colScore: 'Score',
    colActive: 'Active',
    activeYes: 'YES',
    activeNo: 'NO',
    graphTitle: 'Affinity Orbit — Top 50 Friends',
    graphLegendActive: 'Active',
    graphLegendInact: 'Inactive',
    graphCenter: 'You',
    graphHoverScore: 'Score',
    searchPlaceholder: 'Search friends...',
    searchCount: n => `${n} result${n === 1 ? '' : 's'}`,
    btnExport: 'Export CSV',
    btnShare: 'Share Graph',
    toastCopied: 'Copied to clipboard — paste it anywhere!',
    toastSaved: 'Image saved to downloads.',
    toastFailed: 'Could not capture graph.',
  },
  zh: {
    tabTitle: 'FB 社交圖譜視覺化',
    title: 'FB 社交圖譜視覺化',
    subtitle: 'Facebook 的 ML 如何排名你的朋友',
    step1: '前往 <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer"><strong>facebook.com</strong></a>',
    step2: '按下 <strong>Ctrl+U</strong> 查看網頁原始碼',
    step3: '<strong>Ctrl+A</strong> 全選，<strong>Ctrl+C</strong> 複製後貼上到下方',
    placeholder: '將 Facebook 網頁原始碼貼到此處（Ctrl+V）...',
    btnAnalyse: '分析',
    btnParsing: '解析中...',
    btnClear: '清除',
    btnThemeDark: '深色',
    btnThemeLight: '淺色',
    privacy: '資料不會離開此頁面，所有解析皆在瀏覽器本地進行。',
    explainerTitle: '這些數字代表什麼？',
    scoreDt: '分數（0–100）',
    scoreDd: 'Facebook 的 ML 模型為每位朋友分配一個<strong>基礎親密度</strong>（特徵 16173），反映你與他們互動的可能性。相對於你的社交圖譜正規化至 0–100，100 分代表你最親近的朋友。',
    rawDt: '原始基礎值',
    rawDd: '直接來自 Facebook 資料的原始值，範圍狹窄（約 0.389–0.414），因為這是一種概率權重，但微小差異在排名上影響顯著。',
    activeDt: '活躍',
    activeDd: '偵測乘數（特徵 16174）中的 +0.5 結構性加分。「是」代表 Facebook 認為你正在積極與此人互動——傳訊息、按讚或瀏覽其個人檔案。',
    errorParse: '解析失敗：',
    errorEmpty: '找不到好友資料，請確認你貼上的是 facebook.com 完整頁面原始碼（Ctrl+U）。',
    tableTitle: n => `完整排名（${n} 位好友）`,
    statProfiles: '好友數',
    statActive: '活躍',
    statAvg: '平均分數',
    statTop: '最近好友',
    statRange: '原始範圍',
    chartTop: n => `前 ${n} 名好友親密度`,
    chartDonut: '活躍 vs 非活躍',
    chartDonutL: ['活躍（+0.5 加成）', '非活躍'],
    chartTiers: '各分段好友數',
    chartDecay: '分數衰減曲線',
    chartDist: '分數分佈',
    colRank: '排名',
    colName: '姓名',
    colRaw: '原始值',
    colScore: '分數',
    colActive: '活躍',
    activeYes: '是',
    activeNo: '否',
    graphTitle: '親密軌道圖 — 前 50 名好友',
    graphLegendActive: '活躍',
    graphLegendInact: '非活躍',
    graphCenter: '你',
    graphHoverScore: '分數',
    searchPlaceholder: '搜尋好友...',
    searchCount: n => `${n} 筆結果`,
    btnExport: '匯出 CSV',
    btnShare: '分享圖表',
    toastCopied: '已複製到剪貼簿——貼到任何地方分享！',
    toastSaved: '圖片已儲存。',
    toastFailed: '無法擷取圖表。',
  },
};

window.t = function (key, ...args) {
  const val = TRANSLATIONS[currentLang][key];
  return typeof val === 'function' ? val(...args) : (val ?? key);
};

window.applyLang = function () {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-TW' : 'en';
  document.title = t('tabTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (TRANSLATIONS[currentLang][key] !== undefined) el.innerHTML = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
};
