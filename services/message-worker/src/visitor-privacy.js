const MOONS = ['Titan', 'Enceladus', 'Dione', 'Rhea', 'Iapetus', 'Mimas', 'Tethys', 'Hyperion', 'Phoebe', 'Janus'];
const WORDS = ['Amber', 'Silver', 'Quiet', 'Golden', 'Misty', 'Gentle', 'Bright', 'Velvet', 'Hidden', 'Distant', 'Snowy', 'Dreamy', 'Soft', 'Wild', 'Little', 'Starry'];
export const HOST_ALIAS = 'Titan · Host';
// Trusted, Host-managed legacy records use the site owner's public badge.
export function isLegacyHost(name) { return String(name).trim().toLowerCase() === 'chen'; }
export function aliasForId(id) {
  if (!Number.isSafeInteger(id) || id < 1) throw Error('visitor identity unavailable');
  let group = Math.floor((id - 1) / MOONS.length);
  const words = [MOONS[(id - 1) % MOONS.length]];
  while (group > 0) {
    words.unshift(WORDS[(group - 1) % WORDS.length]);
    group = Math.floor((group - 1) / WORDS.length);
  }
  return words.join(' ');
}
export async function visitorAlias(env, key) {
  await env.DB.prepare('INSERT INTO visitor_aliases (identity_key) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM visitor_aliases WHERE identity_key = ?) ON CONFLICT(identity_key) DO NOTHING').bind(key,key).run();
  const row = await env.DB.prepare('SELECT id FROM visitor_aliases WHERE identity_key = ?').bind(key).first();
  if (!row || !Number.isSafeInteger(row.id)) throw Error('visitor identity unavailable');
  return aliasForId(row.id);
}
export async function legacyIdentity(name, env) {
  if (env) {
    const matches = await env.DB.prepare('SELECT DISTINCT visitor_hash FROM farm_adoptions WHERE adopted_by = ? LIMIT 2').bind(name.trim()).all();
    if (matches.results?.length === 1) return matches.results[0].visitor_hash;
  }
  const bytes = new TextEncoder().encode('legacy-visitor:' + name.trim());
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
export function redactNames(text, identities) {
  const names = new Map(identities.filter(row => row.name && row.name !== 'a visitor').map(row => [row.name.toLowerCase(),row.alias]));
  if (!names.size) return text;
  const escape = name => Array.from(name,c => '\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c).join('');
  const pattern = [...names.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|');
  return String(text || '').replace(new RegExp('(?<![A-Za-z0-9_])(?:' + pattern + ')(?![A-Za-z0-9_])','gi'),name => names.get(name.toLowerCase()));
}
