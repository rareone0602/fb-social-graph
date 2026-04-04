/**
 * Parses Facebook HTML page source to extract social graph affinity scores.
 *
 * Two data sources (tried in order):
 *   1. Bootstrap keywords — search typeahead ML payload (primary)
 *   2. Inbox tray ranked contacts — fallback
 */

/**
 * @typedef {Object} Profile
 * @property {string} name
 * @property {string} profileId
 * @property {number} rawBase       - Feature 16173: base affinity vector
 * @property {number} rawMultiplier - Feature 16174: engagement multiplier
 * @property {number} normalised    - 0-100 scaled score
 * @property {boolean} active       - has the +0.5 UI engagement bonus
 */

function extractScriptPayloads(html) {
  const re = /<script[^>]*type=["']application\/json["'][^>]*>(.*?)<\/script>/gis;
  const payloads = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    payloads.push(m[1]);
  }
  if (payloads.length === 0 && html.trim().startsWith('{')) {
    payloads.push(html);
  }
  return payloads;
}

function parseBootstrapKeywords(payloads) {
  const dossier = {};

  function parseNode(node) {
    const keyword = node.keyword_text || 'Unknown';
    const stsInfo = node.sts_info || {};
    const navResult = stsInfo.direct_nav_result || {};

    if (navResult.entity_type !== 'user') return;

    const profileId = navResult.ent_id || 'N/A';
    const profileName = navResult.title || keyword;

    let f16173 = 0, f16174 = 0;
    const loggingStr = node.item_logging_info;
    if (loggingStr) {
      try {
        const features = JSON.parse(loggingStr).features || {};
        f16173 = parseFloat(features['16173'] || 0);
        f16174 = parseFloat(features['16174'] || 0);
      } catch (_) { /* ignore */ }
    }

    if (!(profileId in dossier) || f16173 > dossier[profileId].f16173) {
      dossier[profileId] = { name: profileName, f16173, f16174 };
    }
  }

  function walk(data) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const kw = data.bootstrap_keywords;
      if (kw && typeof kw === 'object' && Array.isArray(kw.edges)) {
        for (const edge of kw.edges) {
          parseNode(edge.node || {});
        }
      }
      for (const v of Object.values(data)) walk(v);
    } else if (Array.isArray(data)) {
      for (const item of data) walk(item);
    }
  }

  for (const payload of payloads) {
    if (payload.includes('bootstrap_keywords')) {
      try { walk(JSON.parse(payload)); } catch (_) { continue; }
    }
  }
  return dossier;
}

function parseInboxTray(html) {
  const dossier = {};
  const re = /"__typename":"XFBInboxTrayRankedContact",.*?"id":"(\d+)",.*?"name":"([^"]+)"/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    matches.push([m[1], m[2]]);
  }
  if (matches.length === 0) return dossier;

  const step = 1.0 / matches.length;
  let score = 1.0;
  for (const [uid, name] of matches) {
    let decoded;
    try { decoded = JSON.parse(`"${name}"`); } catch (_) { decoded = name; }
    if (!(uid in dossier)) {
      dossier[uid] = { name: decoded, f16173: score, f16174: score / 2.0 };
      score -= step;
    }
  }
  return dossier;
}

function normalise(dossier) {
  const entries = Object.entries(dossier).filter(([, p]) => p.f16173 > 0);
  if (entries.length === 0) return [];

  const bases = entries.map(([, p]) => p.f16173);
  const minBase = Math.min(...bases);
  const maxBase = Math.max(...bases);
  const spread = maxBase > minBase ? maxBase - minBase : 1;

  const profiles = entries.map(([pid, p]) => ({
    name: p.name,
    profileId: pid,
    rawBase: p.f16173,
    rawMultiplier: p.f16174,
    normalised: ((p.f16173 - minBase) / spread) * 100,
    active: p.f16174 > (p.f16173 / 2) + 0.4,
  }));

  profiles.sort((a, b) => b.rawBase - a.rawBase);
  return profiles;
}

/**
 * Main entry point — parse pasted Facebook page source.
 * @param {string} rawHtml
 * @returns {{ profiles: Profile[], error: string|null }}
 */
function parseFacebookSource(rawHtml) {
  // Unescape HTML entities
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const html = doc.documentElement.outerHTML;

  const payloads = extractScriptPayloads(html);
  let dossier = parseBootstrapKeywords(payloads);

  if (Object.keys(dossier).length === 0) {
    dossier = parseInboxTray(html);
  }

  if (Object.keys(dossier).length === 0) {
    return { profiles: [], error: 'No profile data found. Make sure you pasted the full page source from facebook.com (Ctrl+U).' };
  }

  return { profiles: normalise(dossier), error: null };
}
