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
const api = new Function(pure[1] + '\nreturn {shouldHoldSheet,onDialogCancel,onDialogClose,parsePhotoSession,photoSessionStale,pendingHolds,taskFromSession,restoredPhoto,planPhotoRestore,attachPhoto};')();
const {
  shouldHoldSheet, onDialogCancel, onDialogClose, parsePhotoSession, photoSessionStale,
  pendingHolds, taskFromSession, restoredPhoto, planPhotoRestore, attachPhoto,
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
  assert.match(addPhoto, /ingestPhoto\([^)]*,taskId\)/);
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
