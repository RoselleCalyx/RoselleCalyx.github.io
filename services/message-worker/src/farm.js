const MAX_TREES = 8;
// CMS baseline residents and approved visitor additions share 24 places.
const MAX_PENDING = 200, MAX_VISITOR_PENDING = 3;
const TYPES = ['apple', 'peach', 'orange', 'cherry', 'kiwi', 'grape', 'durian', 'mango'];
const SPECIES = ['rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin', 'redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec'];
const TOKEN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TREE_COLUMNS = 'id, type, slot, seed, variant, planted_abs, water, owner_hash, initial';
const ADOPTION_COLUMNS = 'id, species, name, adopted_by AS adoptedBy, note, created_at, status';
const EMPTY_SLOT = "SELECT CAST(value AS INTEGER) AS slot FROM json_each('[0,1,2,3,4,5,6,7]') WHERE value NOT IN (SELECT slot FROM farm_trees) ORDER BY value LIMIT 1";
const TREE_JSON = "json_object('id', id, 'type', type, 'slot', slot, 'seed', seed, 'variant', variant, 'planted_abs', planted_abs, 'water', water, 'owner_hash', owner_hash, 'initial', initial)";
const equal = (left, right) => typeof left === 'string' && typeof right === 'string' && left === right;

export async function farmRoute(request, env, path, url, helpers) {
  const { HTTPError, jsonBody, digest, rateLimit, authorize } = helpers;
  const fail = (status, code, message) => { throw new HTTPError(status, code, message); };
  const validatedID = value => {
    if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'validation', 'Please use a valid submission ID.');
    return value.toLowerCase();
  };
  const visitor = async value => {
    if (typeof value !== 'string' || !TOKEN.test(value)) fail(400, 'validation', 'The farm visitor credential is not valid. Reload the farm and try again.');
    return digest(value);
  };
  const text = (value, maximum, label, required = false) => {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)) fail(400, 'validation', 'Please check the ' + label + '.');
    const clean = value.trim();
    if (Array.from(clean).length > maximum || (required && !clean)) fail(400, 'validation', 'The ' + label + ' must contain ' + (required ? '1–' : 'at most ') + maximum + ' characters.');
    return clean;
  };
  const checked = result => {
    if (!result || result.success === false) throw new Error('shared farm database operation failed');
    return result.results || [];
  };
  const publicTree = (row, visitorHash, host = false) => ({
    id: row.id, type: row.type, slot: row.slot, seed: row.seed, variant: row.variant,
    plantedAbs: row.planted_abs, water: row.water,
    canRemove: !!(host || (!row.initial && visitorHash && equal(row.owner_hash, visitorHash)))
  });
  const previousOperation = async (id, fingerprint) => {
    const row = await env.DB.prepare('SELECT payload_hash, result_json FROM farm_operations WHERE submission_id = ?').bind(id).first();
    if (!row) return null;
    if (!equal(row.payload_hash, fingerprint)) fail(409, 'submission_conflict', 'This submission ID was already used for another farm action.');
    return JSON.parse(row.result_json);
  };
  const fromOperation = (result, fingerprint, visitorHash) => {
    const row = checked(result)[0];
    if (!row) return null;
    if (!equal(row.payload_hash, fingerprint)) fail(409, 'submission_conflict', 'This submission ID was already used for another farm action.');
    return { ok: true, tree: publicTree(JSON.parse(row.result_json), visitorHash) };
  };
  const treeMatch = /^\/api\/farm\/trees\/([a-zA-Z0-9_-]{1,64})(\/water)?$/.exec(path);

  if (path === '/api/farm' && request.method === 'GET') {
    const token = request.headers.get('X-Farm-Token');
    const hash = token === null ? null : await visitor(token);
    const host = request.headers.has('Authorization') ? !!(await authorize(request, env)) : false;
    const results = await env.DB.batch([
      env.DB.prepare('SELECT ' + TREE_COLUMNS + ' FROM farm_trees ORDER BY slot'),
      env.DB.prepare("SELECT id, species, name, adopted_by AS adoptedBy, note, substr(created_at, 1, 7) AS since FROM farm_adoptions WHERE status = 'approved' ORDER BY created_at, id")
    ]);
    return { ok: true, maxTrees: MAX_TREES, trees: checked(results[0]).map(row => publicTree(row, hash, host)), residents: checked(results[1]) };
  }

  if (path === '/api/farm/trees' && request.method === 'POST') {
    const body = await jsonBody(request, ['type', 'visitorToken', 'submissionId']);
    if (!TYPES.includes(body.type)) fail(400, 'validation', 'Choose a known fruit tree.');
    const visitorHash = await visitor(body.visitorToken), submissionId = validatedID(body.submissionId);
    const fingerprint = await digest(JSON.stringify({ kind: 'plant', type: body.type, visitorHash }));
    const prior = await previousOperation(submissionId, fingerprint);
    if (prior) return { ok: true, tree: publicTree(prior, visitorHash) };
    await rateLimit(request, env, 'farm-plant', 12, 3600);
    const id = crypto.randomUUID(), time = new Date().toISOString();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0], variant = seed % 3, season = Math.floor(Date.now() / 480000);
    const results = await env.DB.batch([
      // Selecting and inserting the free slot happens in one SQL statement;
      // UNIQUE(slot) and the eight allowed values enforce the global capacity.
      env.DB.prepare('INSERT INTO farm_trees (id, type, slot, seed, variant, planted_abs, water, owner_hash, initial, created_at) SELECT ?, ?, slot, ?, ?, ?, 0, ?, 0, ? FROM (' + EMPTY_SLOT + ') WHERE NOT EXISTS (SELECT 1 FROM farm_operations WHERE submission_id = ?) ON CONFLICT DO NOTHING')
        .bind(id, body.type, seed, variant, season, visitorHash, time, submissionId),
      env.DB.prepare("INSERT INTO farm_operations (submission_id, kind, payload_hash, visitor_hash, tree_id, result_json, created_at) SELECT ?, 'plant', ?, ?, id, " + TREE_JSON + ' , ? FROM farm_trees WHERE id = ? ON CONFLICT(submission_id) DO NOTHING')
        .bind(submissionId, fingerprint, visitorHash, time, id),
      env.DB.prepare('SELECT payload_hash, result_json FROM farm_operations WHERE submission_id = ?').bind(submissionId)
    ]);
    const result = fromOperation(results[2], fingerprint, visitorHash);
    checked(results[0]); checked(results[1]);
    if (!result) fail(409, 'farm_full', 'The shared orchard is full. It holds at most 8 trees.');
    return result;
  }

  if (treeMatch && treeMatch[2] === '/water' && request.method === 'POST') {
    const body = await jsonBody(request, ['visitorToken', 'submissionId']);
    const visitorHash = await visitor(body.visitorToken), submissionId = validatedID(body.submissionId), id = treeMatch[1];
    const fingerprint = await digest(JSON.stringify({ kind: 'water', id, visitorHash }));
    const prior = await previousOperation(submissionId, fingerprint);
    if (prior) return { ok: true, tree: publicTree(prior, visitorHash) };
    await rateLimit(request, env, 'farm-water', 90, 600);
    const time = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE farm_trees SET water = MIN(3, water + 1) WHERE id = ? AND NOT EXISTS (SELECT 1 FROM farm_operations WHERE submission_id = ?)').bind(id, submissionId),
      env.DB.prepare("INSERT INTO farm_operations (submission_id, kind, payload_hash, visitor_hash, tree_id, result_json, created_at) SELECT ?, 'water', ?, ?, id, " + TREE_JSON + ', ? FROM farm_trees WHERE id = ? ON CONFLICT(submission_id) DO NOTHING')
        .bind(submissionId, fingerprint, visitorHash, time, id),
      env.DB.prepare('SELECT payload_hash, result_json FROM farm_operations WHERE submission_id = ?').bind(submissionId)
    ]);
    const result = fromOperation(results[2], fingerprint, visitorHash);
    checked(results[0]); checked(results[1]);
    if (!result) fail(404, 'tree_not_found', 'This tree is no longer in the shared orchard.');
    return result;
  }

  if (treeMatch && !treeMatch[2] && request.method === 'DELETE') {
    const host = request.headers.has('Authorization') ? !!(await authorize(request, env)) : false;
    const body = request.body ? await jsonBody(request, ['visitorToken']) : {};
    const hash = host && body.visitorToken == null ? null : await visitor(body.visitorToken);
    const current = await env.DB.prepare('SELECT ' + TREE_COLUMNS + ' FROM farm_trees WHERE id = ?').bind(treeMatch[1]).first();
    if (!current) fail(404, 'tree_not_found', 'This tree is no longer in the shared orchard.');
    if (!host && (current.initial || !equal(current.owner_hash, hash))) fail(403, 'ownership_required', 'Only the visitor who planted this tree or the farm keeper can remove it.');
    if (!host) await rateLimit(request, env, 'farm-remove', 20, 600);
    const removed = await env.DB.prepare('DELETE FROM farm_trees WHERE id = ? AND (? = 1 OR (initial = 0 AND owner_hash = ?)) RETURNING id').bind(treeMatch[1], host ? 1 : 0, hash).first();
    if (!removed) fail(404, 'tree_not_found', 'This tree is no longer in the shared orchard.');
    return { ok: true, deleted: true };
  }

  if (path === '/api/farm/adoptions' && request.method === 'POST') {
    const body = await jsonBody(request, ['species', 'name', 'adoptedBy', 'note', 'submissionId', 'visitorToken', 'website']);
    if (!SPECIES.includes(body.species)) fail(400, 'validation', 'Choose an animal species other than the keeper.');
    if (body.website != null && body.website !== '') fail(400, 'validation', 'This adoption request could not be accepted.');
    const name = text(body.name, 24, 'animal name', true), adoptedBy = text(body.adoptedBy, 40, 'adopter name') || 'a visitor', note = text(body.note, 140, 'animal note');
    const visitorHash = await visitor(body.visitorToken), submissionId = validatedID(body.submissionId);
    const fingerprint = await digest(JSON.stringify({ species: body.species, name, adoptedBy, note, visitorHash }));
    const previous = await env.DB.prepare('SELECT id, payload_hash, status FROM farm_adoptions WHERE submission_id = ?').bind(submissionId).first();
    if (previous) {
      if (!equal(previous.payload_hash, fingerprint)) fail(409, 'submission_conflict', 'This submission ID was already used for another adoption request.');
      return { ok: true, id: previous.id, status: previous.status };
    }
    await rateLimit(request, env, 'farm-adopt', 5, 3600);
    const results = await env.DB.batch([
      env.DB.prepare("INSERT INTO farm_adoptions (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ? WHERE (SELECT COUNT(*) FROM farm_adoptions WHERE status = 'pending') < ? AND (SELECT COUNT(*) FROM farm_adoptions WHERE status = 'pending' AND visitor_hash = ?) < ? ON CONFLICT(submission_id) DO NOTHING")
        .bind(crypto.randomUUID(), submissionId, fingerprint, visitorHash, body.species, name, adoptedBy, note, new Date().toISOString(), MAX_PENDING, visitorHash, MAX_VISITOR_PENDING),
      env.DB.prepare('SELECT id, payload_hash, status FROM farm_adoptions WHERE submission_id = ?').bind(submissionId)
    ]);
    checked(results[0]);
    const row = checked(results[1])[0];
    if (!row) fail(409, 'farm_pending_full', 'Too many adoption requests are waiting. Please wait for the keeper to review them.');
    if (!equal(row.payload_hash, fingerprint)) fail(409, 'submission_conflict', 'This submission ID was already used for another adoption request.');
    return { ok: true, id: row.id, status: row.status };
  }

  if (path.startsWith('/api/host/farm/')) {
    await authorize(request, env);
    const resident = /^\/api\/host\/farm\/residents\/([0-9a-f-]{36})$/i.exec(path);
    if (resident && UUID.test(resident[1]) && request.method === 'DELETE') {
      if (request.body) await jsonBody(request, []);
      const row = await env.DB.prepare("UPDATE farm_adoptions SET status = 'rejected', reviewed_at = ? WHERE id = ? AND status = 'approved' RETURNING id")
        .bind(new Date().toISOString(), resident[1].toLowerCase()).first();
      if (!row) fail(404, 'resident_not_found', 'This approved resident was not found. Refresh the resident list.');
      return { ok: true, deleted: true };
    }
    if (path === '/api/host/farm/adoptions' && request.method === 'GET') {
      const status = url.searchParams.get('status') || 'pending';
      if (!['pending', 'approved', 'rejected'].includes(status)) fail(400, 'validation', 'Choose a valid adoption status.');
      return checked(await env.DB.prepare('SELECT ' + ADOPTION_COLUMNS + ' FROM farm_adoptions WHERE status = ? ORDER BY created_at, id LIMIT 200').bind(status).all());
    }
    const match = /^\/api\/host\/farm\/adoptions\/([0-9a-f-]{36})$/i.exec(path);
    if (match && UUID.test(match[1]) && request.method === 'PATCH') {
      const body = await jsonBody(request, ['status']);
      if (!['approved', 'rejected'].includes(body.status)) fail(400, 'validation', 'Approve or reject this adoption request.');
      const id = match[1].toLowerCase();
      const current = await env.DB.prepare('SELECT ' + ADOPTION_COLUMNS + ' FROM farm_adoptions WHERE id = ?').bind(id).first();
      if (!current) fail(404, 'adoption_not_found', 'This adoption request was not found.');
      if (current.status === body.status) return current;
      if (current.status !== 'pending') fail(409, 'adoption_reviewed', 'This adoption request has already been reviewed. Reload the list.');
      const row = await env.DB.prepare("UPDATE farm_adoptions SET status = ?, reviewed_at = ? WHERE id = ? AND status = 'pending' AND (? <> 'approved' OR (SELECT COUNT(*) FROM farm_adoptions WHERE status = 'approved') + (SELECT COALESCE(json_array_length(content_json, '$.farm.residents'), 10) FROM site_content WHERE id = 1) < 24) RETURNING " + ADOPTION_COLUMNS)
        .bind(body.status, new Date().toISOString(), id, body.status).first();
      if (row) return row;
      const latest = await env.DB.prepare('SELECT ' + ADOPTION_COLUMNS + ' FROM farm_adoptions WHERE id = ?').bind(id).first();
      if (latest?.status === body.status) return latest;
      if (latest?.status !== 'pending') fail(409, 'adoption_reviewed', 'This adoption request has already been reviewed. Reload the list.');
      fail(409, 'farm_full', 'The shared farm has reached its limit of 24 residents, plus the keeper.');
    }
  }
  fail(404, 'not_found', 'This farm endpoint does not exist.');
}
