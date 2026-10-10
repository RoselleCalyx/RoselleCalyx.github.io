const MOONS = ['Titan', 'Enceladus', 'Dione', 'Rhea', 'Iapetus', 'Mimas', 'Tethys', 'Hyperion', 'Phoebe', 'Janus'];
export async function visitorAlias(env, key) {
  await env.DB.prepare('INSERT INTO visitor_aliases (identity_key) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM visitor_aliases WHERE identity_key = ?) ON CONFLICT(identity_key) DO NOTHING').bind(key,key).run();
  const row = await env.DB.prepare('SELECT id FROM visitor_aliases WHERE identity_key = ?').bind(key).first();
  if (!row || !Number.isSafeInteger(row.id)) throw Error('visitor identity unavailable');
  return MOONS[(row.id - 1) % MOONS.length] + '-' + String(row.id).padStart(6, '0');
}
export async function legacyIdentity(name, env) {
  if (env) {
    const matches = await env.DB.prepare('SELECT DISTINCT visitor_hash FROM farm_adoptions WHERE adopted_by = ? LIMIT 2').bind(name.trim()).all();
    if (matches.results?.length === 1) return matches.results[0].visitor_hash;
  }
  const bytes = new TextEncoder().encode('legacy-visitor:' + name.trim());
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
export function redactName(text, name, alias) {
  if (!name || name === 'a visitor') return text;
  return String(text || '').split(name).join(alias);
}

export function redactNames(text, identities) {
  const names = new Map(identities.filter(row => row.name && row.name !== 'a visitor').map(row => [row.name.toLowerCase(),row.alias]));
  if (!names.size) return text;
  const escape = name => Array.from(name,c => '\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c).join('');
  const pattern = [...names.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|');
  return String(text || '').replace(new RegExp(pattern,'gi'),name => names.get(name.toLowerCase()));
}
