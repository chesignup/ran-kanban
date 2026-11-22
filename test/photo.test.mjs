// Photo attach while Android shows a permission dialog or recreates the activity.
// Run: node --test test/photo.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const ranJava = readFileSync(
  fileURLToPath(new URL('../android/app/src/main/java/il/co/karisi/ran/RanCapturePlugin.java', import.meta.url)),
  'utf8',
);
const pure = html.match(/\/\/ <photo-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/photo-pure>/);
assert.ok(pure, 'photo-pure block missing from index.html');
const api = new Function(pure[1] + '\nreturn {shouldHoldSheet,onDialogCancel,onDialogClose,parsePhotoSession,photoSessionStale,pendingHolds,taskFromSession,restoredPhoto,planPhotoRestore,attachPhoto,planCaptureDelivery,capturePromiseRace,normalizePhotoResult,captureKey,parseIngestedCaptures,claimCapture,rememberCapture};')();
const {
  shouldHoldSheet, onDialogCancel, onDialogClose, parsePhotoSession, photoSessionStale,
  pendingHolds, taskFromSession, restoredPhoto, planPhotoRestore, attachPhoto,
  planCaptureDelivery, capturePromiseRace, normalizePhotoResult, captureKey,
  parseIngestedCaptures, claimCapture, rememberCapture,
} = api;

const quiet = {};

test('permission, camera, and pause do not dismiss the edit sheet', () => {
  for (const flags of [
    {capture: true},
    {perm: true},
    {hidden: true},
    {paused: true},
    {suspend: true},
    {capture: true, hidden: true, paused: true},
  ]) {
    assert.equal(shouldHoldSheet(flags), true);
    assert.equal(onDialogCancel(flags), 'prevent');
    assert.equal(onDialogClose(flags), 'ignore');
  }
  assert.equal(onDialogCancel(quiet), 'allow');
  assert.equal(onDialogClose(quiet), 'proceed');
  assert.equal(shouldHoldSheet(null), false);
});

test('a pending photo session round-trips and expires', () => {
  const raw = JSON.stringify({
    v: 1, at: 1_000, taskId: 't9', page: 'ran', name: 'מדידה', phone: '050',
    address: 'הרצל 1', notes: 'הערה', ll: [32.1, 34.8],
    att: [{id: 'a1', name: 'old.jpg', type: 'image/jpeg'}, {name: 'skip'}],
  });
  const s = parsePhotoSession(raw);
  assert.equal(s.taskId, 't9');
  assert.equal(s.page, 'ran');
  assert.equal(s.name, 'מדידה');
  assert.deepEqual(s.att, [{id: 'a1', name: 'old.jpg', type: 'image/jpeg'}]);
  assert.equal(pendingHolds('t9', raw, 1_000 + 60_000), true);
  assert.equal(pendingHolds('other', raw, 1_000), false);
  assert.equal(photoSessionStale(s, 1_000 + 900_001), true);
  assert.equal(pendingHolds('t9', raw, 1_000 + 900_001), false);
  assert.equal(parsePhotoSession('nope'), null);
  assert.equal(parsePhotoSession({}), null);
});

test('restored camera result attaches to the same task, or reopens it', () => {
  const ev = {pluginId: 'Camera', methodName: 'getPhoto', success: true, data: {base64String: 'QUJD', format: 'jpeg'}};
  const photo = restoredPhoto(ev);
  assert.equal(photo.ok, true);
  assert.equal(photo.base64String, 'QUJD');
  assert.equal(restoredPhoto({pluginId: 'Camera', methodName: 'getPhoto', success: false, error: {message: 'User cancelled'}}).ok, false);
  assert.equal(restoredPhoto({pluginId: 'Filesystem', methodName: 'readFile', success: true, data: {base64String: 'x'}}), null);
  assert.equal(restoredPhoto({pluginId: 'Camera', methodName: 'checkPermissions', success: true, data: {}}), null);
  assert.equal(restoredPhoto({pluginId: 'Camera', methodName: 'getPhoto', success: true, data: {}}).ok, false);

  const session = parsePhotoSession({taskId: 't9', name: 'חדש', page: 'work', at: 5});
  const items = [{id: 't1', name: 'אחר', att: []}];
  assert.equal(planPhotoRestore(session, null, items).action, 'wait');
  assert.deepEqual(planPhotoRestore(session, {ok: false}, items), {action: 'drop', taskId: 't9', exists: false});
  const created = planPhotoRestore(session, photo, items);
  assert.equal(created.action, 'attach');
  assert.equal(created.create, true);
  const task = taskFromSession(session);
  assert.equal(task.name, 'חדש');
  assert.equal(task.page, 'work');
  const withExisting = [{id: 't9', name: 'חדש', fresh: 1, att: [{id: 'a1'}]}];
  assert.equal(planPhotoRestore(session, photo, withExisting).create, false);
  assert.equal(planPhotoRestore(session, {ok: false}, withExisting).action, 'reopen');
  const next = attachPhoto(withExisting[0], {id: 'a2', name: 'photo.jpg', type: 'image/jpeg'});
  assert.equal(next.fresh, undefined);
  assert.deepEqual(next.att.map(a => a.id), ['a1', 'a2']);
  assert.equal(attachPhoto(null, {id: 'a'}), null);
});

test('gallery bytes and a separate camera source both count as a photo', () => {
  const api2 = new Function(pure[1] + '\nreturn {normalizePhotoResult,captureSource,restoredPhoto};')();
  assert.equal(api2.captureSource('photos'), 'PHOTOS');
  assert.equal(api2.captureSource('camera'), 'CAMERA');
  assert.equal(api2.captureSource(undefined), 'CAMERA');
  const fromPicker = api2.normalizePhotoResult({webPath: 'https://localhost/_capacitor_file_/cache/a.jpg', format: 'jpeg'});
  assert.equal(fromPicker.base64String, '');
  assert.equal(fromPicker.webPath.includes('a.jpg'), true);
  assert.equal(api2.normalizePhotoResult({dataUrl: 'data:image/jpeg;base64,QUJD'}).base64String, 'QUJD');
  assert.equal(api2.normalizePhotoResult({}), null);
  const ran = api2.restoredPhoto({pluginId: 'RanCapture', methodName: 'capture', success: true, data: {base64String: 'QUJD', format: 'jpeg'}});
  assert.equal(ran.ok, true);
  assert.equal(ran.base64String, 'QUJD');
  assert.equal(api2.restoredPhoto({pluginId: 'RanCapture', methodName: 'pickContact', success: true, data: {base64String: 'x'}}), null);
  assert.match(html, /addPhoto\('camera'\)/);
  assert.match(html, /addPhoto\('photos'\)/);
  assert.match(html, /rk\/att\//);
  assert.doesNotMatch(html.slice(html.indexOf('async function addPhoto'), html.indexOf('async function addFile')), /source:'PROMPT'/);
  const addPhoto = html.slice(html.indexOf('async function addPhoto'), html.indexOf('async function addFile'));
  assert.match(addPhoto, /const taskId=editId/);
  assert.match(addPhoto, /ingestPhoto\(\{[\s\S]*?\},taskId\)/);
  assert.match(ranJava, /call\.setKeepAlive\(true\)/);
});

test('pause flush and photo wiring do not close the open sheet', () => {
  const flush = html.match(/window\.__rkFlush=function\(\)\{([\s\S]*?)\n\};/);
  assert.ok(flush, '__rkFlush');
  assert.doesNotMatch(flush[1], /dlg\.close|sess\s*=\s*null|sheetWanted\s*=\s*false|draw\(/);
  assert.match(html, /addEventListener\('visibilitychange',\(\)=>\{if\(document\.hidden\)onHide\(\);else onShow\(\)\}\)/);
  assert.match(html, /addEventListener\('pagehide',\(\)=>onHide\(\)\)/);
  assert.match(html, /addListener\('pause',\(\)=>onHide\(\)\)/);
  assert.match(html, /addListener\('appRestoredResult'/);
  assert.match(html, /dlg\.addEventListener\('cancel',e=>\{if\(onDialogCancel\(liveHold\(\)\)==='prevent'\)e\.preventDefault\(\)\}\)/);
  const addPhoto = html.slice(html.indexOf('async function addPhoto'), html.indexOf('async function addFile'));
  assert.ok(addPhoto.indexOf('armCapture()') < addPhoto.indexOf('PL.Camera.getPhoto'));
  assert.match(html, /function armCapture\(\)\{[\s\S]*?writePhotoPending\(\)/);
  assert.match(html, /function armCapture\(\)\{[\s\S]*?sess\.dirty=1/);
  const ingest = html.slice(html.indexOf('async function ingestPhoto'), html.indexOf('function revealTask'));
  assert.ok(ingest.indexOf("idb('put'") < ingest.indexOf('save()'));
  assert.match(ingest, /String\(editId\)===String\(taskId\)[\s\S]*?renderAtts\(\)/);
  assert.match(html, /await queuePhotoRestore\(\)/);
});

test('RanCapture plugin caches picked URIs and reads contact extras bitmap', () => {
  assert.match(ranJava, /copyUriToCache/);
  assert.match(ranJava, /extrasBitmap/);
});

test('mocked RanCapture result ingests into task att and drives renderAtts', async () => {
  // JS-level reproduction of F1/F2: plugin resolve → ingestPhoto → storage → thumbs path.
  const store = new Map();
  const I = [{id: 't-photo', name: 'TEST', page: 'work', att: []}];
  let editId = 't-photo';
  let draftAtt = [];
  let lastIngestSig = '';
  let rendered = [];
  const idb = async (op, val, key) => {
    if (op === 'put') { store.set(key, val); return; }
    if (op === 'get') return store.get(key) || null;
  };
  const cameraParts = (format) => {
    const f = String(format || 'jpeg').toLowerCase().replace('jpg', 'jpeg');
    if (f === 'png') return {type: 'image/png', ext: 'png'};
    return {type: 'image/jpeg', ext: 'jpg'};
  };
  const b64blob = (b, type) => ({__blob: true, b64: b, type});
  const byId = (id) => I.find((x) => x && String(x.id) === String(id));
  const attachPhoto = (task, att) => {
    if (!task || !att || att.id == null) return null;
    const next = {...task, att: [...(Array.isArray(task.att) ? task.att : []), att]};
    delete next.fresh;
    return next;
  };
  const renderAtts = async () => {
    rendered = [];
    for (const a of draftAtt) {
      const b = await idb('get', null, a.id);
      rendered.push({id: a.id, type: a.type, hasBlob: !!b, thumb: !!(b && /^image/.test(a.type))});
    }
  };
  const ingestedCaptures = new Set();
  const inflightCaptures = new Set();
  async function ingestPhoto(r, taskId) {
    const n = normalizePhotoResult(r) || r;
    const b64s = n && (n.base64String || n.base64);
    if (!b64s || taskId == null) return false;
    const key = captureKey(n) || (String(taskId) + ':' + b64s.length + ':' + b64s.slice(0, 40));
    const claim = claimCapture(key, ingestedCaptures, inflightCaptures);
    if (!claim.ok) {
      const cur = byId(taskId);
      if (cur && String(editId) === String(taskId)) {
        draftAtt = (cur.att || []).slice();
        await renderAtts();
      }
      return !!(cur && (cur.att || []).length);
    }
    try {
      const parts = cameraParts(n.format);
      const att = {id: 'a' + (store.size + 1), name: 'photo_' + store.size + '.' + parts.ext, type: parts.type};
      await idb('put', b64blob(b64s, parts.type), att.id);
      const cur = byId(taskId);
      if (!cur) return false;
      const next = attachPhoto(cur, att);
      const idx = I.findIndex((x) => x && String(x.id) === String(taskId));
      if (idx < 0) return false;
      I[idx] = next;
      rememberCapture(key, ingestedCaptures, 100);
      lastIngestSig = key;
      if (String(editId) === String(taskId)) {
        draftAtt = next.att.slice();
        await renderAtts();
      }
      return true;
    } finally {
      inflightCaptures.delete(key);
    }
  }

  const pluginResult = {base64String: 'aGVsbG8=', format: 'jpeg'}; // mocked RanCapture resolve
  assert.equal(await ingestPhoto(pluginResult, 't-photo'), true);
  assert.equal(I[0].att.length, 1);
  assert.equal(I[0].att[0].type, 'image/jpeg');
  assert.equal(store.has(I[0].att[0].id), true);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].thumb, true);

  // Dedupe must still refresh draftAtt/renderAtts (F1/F2 regression).
  draftAtt = [];
  rendered = [];
  assert.equal(await ingestPhoto(pluginResult, 't-photo'), true);
  assert.equal(draftAtt.length, 1);
  assert.equal(rendered[0].thumb, true);

  assert.match(html, /rkLog\('ingestPhoto:start'/);
  assert.match(html, /rkLog\('addPhoto:ran-result'/);
  assert.match(html, /claimCapture\(key,ingestedCaptures,inflightCaptures\)/);
  assert.match(html, /ingestBusy/);
  assert.match(html, /ingestPhotoBody/);
  assert.match(html, /rememberCapture\(key,ingestedCaptures/);
  assert.match(html, /PHOTO_INGESTED_KEY/);
  assert.match(ranJava, /put\("captureId"/);
});

test('null PluginCall after confirmed pick must event+stash (F1/F2 repro)', () => {
  // Before fix: onPicked/onCamera did `if (call == null) return` → hung await, no thumb.
  assert.deepEqual(
    planCaptureDelivery({callPresent: false, resultOk: true, uri: 'content://media/picker/1'}),
    {action: 'event', alsoEvent: true, stash: true},
  );
  assert.deepEqual(
    planCaptureDelivery({callPresent: true, resultOk: true, hasBytes: true}),
    {action: 'resolve', alsoEvent: true, stash: true},
  );
  assert.equal(planCaptureDelivery({callPresent: false, resultOk: false}).action, 'cancel');
  assert.match(ranJava, /publishPhoto/);
  assert.match(ranJava, /notifyListeners\("captureReady"/);
  assert.match(ranJava, /pollPending/);
  assert.match(ranJava, /Log\.i\("RK"/);
  assert.match(ranJava, /postDelayed\([\s\S]*?,\s*400\)/);
  const onPicked = ranJava.slice(ranJava.indexOf('private void onPicked'), ranJava.indexOf('private void onFiles'));
  assert.doesNotMatch(onPicked, /if \(call == null\) return;/);
  const onCamera = ranJava.slice(ranJava.indexOf('private void onCamera'), ranJava.indexOf('private void onPicked'));
  assert.doesNotMatch(onCamera, /if \(call == null\) return;/);
  assert.match(html, /capturePromiseRace/);
  assert.match(html, /pollNativePhotoPending/);
  assert.match(html, /onCaptureReady/);
  const capCfg = readFileSync(fileURLToPath(new URL('../capacitor.config.json', import.meta.url)), 'utf8');
  assert.match(capCfg, /"loggingBehavior"\s*:\s*"production"/);
});

test('capturePromiseRace rejects on timeout so pollPending can recover', async () => {
  await assert.rejects(
    () => capturePromiseRace(new Promise(() => {}), 30),
    /capture timeout/,
  );
  const ok = await capturePromiseRace(Promise.resolve({base64String: 'QQ=='}), 500);
  assert.equal(ok.base64String, 'QQ==');
});


test('captureKey prefers captureId then pending file name', () => {
  assert.equal(captureKey({captureId: 'pending_9.jpg', path: '/x/other.jpg', base64String: 'aa'}), 'pending_9.jpg');
  assert.equal(captureKey({path: '/cache/captures/pending_42.jpg', base64String: 'aa'}), 'pending_42.jpg');
  assert.match(captureKey({base64String: 'aGVsbG8='}), /^b64:/);
  assert.deepEqual(parseIngestedCaptures('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseIngestedCaptures('nope'), []);
});

test('addPhoto result + nativePhoto event + pollPending same capture -> 1 attachment', async () => {
  const store = new Map();
  const I = [{id: 't-photo', name: 'TEST', page: 'work', att: []}];
  let editId = 't-photo';
  let draftAtt = [];
  let lastIngestSig = '';
  const ingestedCaptures = new Set(parseIngestedCaptures('[]'));
  const inflightCaptures = new Set();
  const idb = async (op, val, key) => {
    if (op === 'put') { store.set(key, val); return; }
    if (op === 'get') return store.get(key) || null;
  };
  const cameraParts = (format) => ({type: 'image/jpeg', ext: 'jpg'});
  const b64blob = (b, type) => ({__blob: true, b64: b, type});
  const byId = (id) => I.find((x) => x && String(x.id) === String(id));
  let ingestBusy = Promise.resolve();
  function ingestPhoto(r, taskId) {
    const run = () => ingestPhotoBody(r, taskId);
    const p = ingestBusy.then(run, run);
    ingestBusy = p.then(() => {}, () => {});
    return p;
  }
  async function ingestPhotoBody(r, taskId) {
    const n = normalizePhotoResult(r) || r;
    const b64s = n && (n.base64String || n.base64);
    if (!b64s || taskId == null) return false;
    const key = captureKey(n) || (String(taskId) + ':' + b64s.length + ':' + b64s.slice(0, 40));
    const claim = claimCapture(key, ingestedCaptures, inflightCaptures);
    if (!claim.ok) return !!(byId(taskId) && (byId(taskId).att || []).length);
    try {
      const parts = cameraParts(n.format);
      const att = {id: 'a' + store.size, name: 'photo.' + parts.ext, type: parts.type};
      await idb('put', b64blob(b64s, parts.type), att.id);
      const cur = byId(taskId);
      const next = attachPhoto(cur, att);
      I[I.findIndex((x) => String(x.id) === String(taskId))] = next;
      rememberCapture(key, ingestedCaptures, 100);
      lastIngestSig = key;
      if (String(editId) === String(taskId)) draftAtt = next.att.slice();
      return true;
    } finally {
      inflightCaptures.delete(key);
    }
  }

  const captureId = 'pending_111.jpg';
  const path = '/cache/captures/' + captureId;
  const b64 = 'aGVsbG8='; // same bytes for all three paths
  const addPhotoResult = {base64String: b64, format: 'jpeg', captureId, path};
  const nativePhotoEvent = {base64String: b64, format: 'jpeg', captureId, path};
  const pollPending = {base64String: b64, format: 'jpeg', captureId, path};
  // Concurrent callers (promise + event + poll) — queue serializes; all resolve true, one attach
  const results = await Promise.all([
    ingestPhoto(addPhotoResult, 't-photo'),
    ingestPhoto(nativePhotoEvent, 't-photo'),
    ingestPhoto(pollPending, 't-photo'),
  ]);
  assert.deepEqual(results, [true, true, true]);
  assert.equal(I[0].att.length, 1);
  assert.equal(draftAtt.length, 1);
  assert.equal(ingestedCaptures.has(captureId), true);

  // Persist + reload set → still skip
  const persisted = JSON.stringify([...ingestedCaptures]);
  const reloaded = new Set(parseIngestedCaptures(persisted));
  assert.equal(claimCapture(captureId, reloaded, new Set()).ok, false);

  // Two different photos → 2 attachments
  const second = {base64String: 'd29ybGQ=', format: 'jpeg', captureId: 'pending_222.jpg', path: '/cache/captures/pending_222.jpg'};
  assert.equal(await ingestPhoto(second, 't-photo'), true);
  assert.equal(I[0].att.length, 2);
  assert.match(html, /captureId:\(r&&r\.captureId\)/);
  assert.match(ranJava, /ret\.put\("captureId"/);
});

