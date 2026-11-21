// Repro + regression checks for the "tasks gone after a couple of days" bug.
// Run: node --test test/persist.test.mjs
//
// Old startup (index.html before 0.1.6), abbreviated:
//   getKey: internalGetItem({key}) throws (plugin requires prefixedKey) -> catch -> mint a new AES key
//   loadState: decrypt throws -> return null
//   I = null || [] ; await flush()  // encrypts [] and overwrites the ciphertext
// A Samsung WebView kill also dropped the 120ms debounce because visibilitychange
// called flush() without waiting, and nothing was mirrored outside WebView storage.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const pure = html.match(/\/\/ <persist-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/persist-pure>/);
assert.ok(pure, 'persist-pure block missing from index.html');
const api = new Function(pure[1] + '\nreturn {itemStamp,mergeState,normalizeState,canonItem,canonState,loadDecision,foldCopies,needsHeal,decideKey,decideFlush};')();
const {mergeState, canonState, loadDecision, foldCopies, needsHeal, decideKey, decideFlush, normalizeState} = api;

test('script parses', () => {
  const m = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  assert.ok(m, 'script block');
  new Function(m[1]);
});

test('key is not read with the broken {key} call', () => {
  assert.doesNotMatch(html, /internalGetItem\(\s*\{[^}]*\bkey\s*:/);
  assert.match(html, /getItem\('ran\.datakey'\)/);
  assert.match(html, /setItem\('ran\.datakey'/);
});

test('startup does not seed-and-overwrite', () => {
  assert.doesNotMatch(html, /loadState\(\)\s*\|\|\s*SEED/);
  assert.match(html, /navigator\.storage\.persist/);
  assert.match(html, /directory:'DATA'/);
  assert.match(html, /durability:'strict'/);
  assert.match(html, /__rkFlush/);
});

test('decrypt failure with ciphertext does not mint a key or flush empty', () => {
  // read threw, nothing returned, blobs exist  -> do not generate a new key
  assert.equal(decideKey(null, true, true), 'abort');
  assert.equal(decideKey(null, false, true), 'abort');
  assert.equal(decideKey('existing-b64', false, true), 'use');
  assert.equal(decideKey(null, false, false), 'create');
  const copies = [
    {role:'idb', ok:false, exists:true},
    {role:'mirror', ok:false, exists:false},
    {role:'enc-ls', ok:false, exists:false},
    {role:'plain', ok:false, exists:false},
  ];
  assert.equal(loadDecision(copies).status, 'error');
  assert.equal(needsHeal(copies, true), false);
  assert.equal(decideFlush(false, 0, 0, true), 'skip');
});

test('empty plaintext must not hide an undecryptable blob', () => {
  const copies = [
    {role:'idb', ok:false, exists:true},
    {role:'mirror', ok:false, exists:false},
    {role:'enc-ls', ok:false, exists:false},
    {role:'plain', ok:true, exists:true, state:{items:[], tombstones:[]}},
  ];
  assert.equal(loadDecision(copies).status, 'error');
});

test('filesystem mirror recovers when IndexedDB was evicted', () => {
  const copies = [
    {role:'idb', ok:false, exists:false},
    {role:'mirror', ok:true, exists:true, state:{items:[{id:'t1', name:'מדידה', updatedAt:4, page:'work'}], tombstones:[]}},
    {role:'enc-ls', ok:false, exists:false},
    {role:'plain', ok:false, exists:false},
  ];
  assert.equal(loadDecision(copies).status, 'ok');
  assert.equal(foldCopies(copies).items[0].name, 'מדידה');
  assert.equal(needsHeal(copies, true), true);
  assert.equal(needsHeal(copies, false), true);
});

test('newer crash-buffer wins over an older indexedDB snapshot', () => {
  const copies = [
    {role:'idb', ok:true, exists:true, state:{items:[{id:'t1', name:'ישן', updatedAt:1}], tombstones:[]}},
    {role:'mirror', ok:true, exists:true, state:{items:[{id:'t1', name:'ישן', updatedAt:1}], tombstones:[]}},
    {role:'enc-ls', ok:false, exists:false},
    {role:'plain', ok:true, exists:true, state:{items:[{id:'t1', name:'חדש', updatedAt:9}], tombstones:[]}},
  ];
  assert.equal(foldCopies(copies).items[0].name, 'חדש');
  assert.equal(needsHeal(copies, true), false);
});

test('drive merge is per item by updatedAt and never wholesale', () => {
  const local = {items:[{id:'t1', name:'חדש', updatedAt:20, page:'work'}, {id:'t2', name:'רק במכשיר', updatedAt:3}], tombstones:[]};
  const older = {items:[{id:'t1', name:'ישן', updatedAt:5}], tombstones:[]};
  const empty = {items:[], tombstones:[]};
  assert.equal(mergeState(local, older).items.find(t => t.id === 't1').name, 'חדש');
  assert.equal(mergeState(local, older).items.find(t => t.id === 't2').name, 'רק במכשיר');
  assert.equal(mergeState(local, empty).items.length, 2);
  const recovered = mergeState(empty, {items:[{id:'t9', name:'מהגיבוי', updatedAt:2}], tombstones:[]});
  assert.equal(recovered.items[0].name, 'מהגיבוי');
  const remoteNewer = mergeState(local, {items:[{id:'t1', name:'מהטלפון השני', updatedAt:30}], tombstones:[]});
  assert.equal(remoteNewer.items.find(t => t.id === 't1').name, 'מהטלפון השני');
  assert.equal(remoteNewer.items.find(t => t.id === 't2').name, 'רק במכשיר');
});

test('a newer tombstone stays deleted and an edited item beats an old tombstone', () => {
  const deleted = mergeState(
    {items:[{id:'t1', name:'חי', updatedAt:2}], tombstones:[]},
    {items:[{id:'t1', name:'חי', updatedAt:2}], tombstones:[{id:'t1', updatedAt:8}]}
  );
  assert.equal(deleted.items.length, 0);
  assert.equal(deleted.tombstones[0].id, 't1');
  const edited = mergeState(
    {items:[{id:'t1', name:'חזר', updatedAt:12}], tombstones:[]},
    {items:[], tombstones:[{id:'t1', updatedAt:4}]}
  );
  assert.equal(edited.items[0].name, 'חזר');
  assert.equal(edited.tombstones.length, 0);
});

test('equal updatedAt keeps the local copy; legacy arrays still merge', () => {
  const m = mergeState(
    {items:[{id:'a', name:'מקומי', updatedAt:5}], tombstones:[]},
    {items:[{id:'a', name:'מרוחק', updatedAt:5}], tombstones:[]}
  );
  assert.equal(m.items[0].name, 'מקומי');
  const legacy = mergeState(normalizeState([{id:'s0', name:'seed'}, {id:'t1', name:'אמיתי'}]), {items:[], tombstones:[]});
  assert.deepEqual(legacy.items.map(t => t.id), ['t1']);
});

test('canonState ignores key order and updatedAt-only object shape', () => {
  assert.equal(canonState({items:[{name:'א', id:'t', updatedAt:1}], tombstones:[]}), canonState({items:[{updatedAt:1, id:'t', name:'א'}], tombstones:[]}));
  assert.notEqual(canonState({items:[{id:'t', name:'א', updatedAt:1}]}), canonState({items:[{id:'t', name:'ב', updatedAt:1}]}));
});

test('empty overwrite guard', () => {
  assert.equal(decideFlush(true, 0, 0, true), 'skip');
  assert.equal(decideFlush(true, 0, 1, true), 'write');
  assert.equal(decideFlush(true, 2, 0, false), 'write');
  assert.equal(decideFlush(false, 2, 0, false), 'skip');
});

test('version 0.1.11 / versionCode 12', () => {
  assert.match(html, /APP_VER='0\.1\.11'/);
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(pkg.version, '0.1.11');
  const gradle = readFileSync(fileURLToPath(new URL('../android/app/build.gradle', import.meta.url)), 'utf8');
  assert.match(gradle, /versionCode 12/);
  assert.match(gradle, /versionName "0\.1\.11"/);
  const java = readFileSync(fileURLToPath(new URL('../android/app/src/main/java/il/co/karisi/ran/MainActivity.java', import.meta.url)), 'utf8');
  assert.match(java, /__rkFlush/);
});
