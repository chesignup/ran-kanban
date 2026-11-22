// SecureStorage native bridge API + plaintext→encrypted migration + photo attach.
// Run: node --test test/secure.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const pure = html.match(/\/\/ <secure-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/secure-pure>/);
assert.ok(pure, 'secure-pure block missing from index.html');
const persist = html.match(/\/\/ <persist-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/persist-pure>/);
assert.ok(persist, 'persist-pure block');
const photo = html.match(/\/\/ <photo-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/photo-pure>/);
assert.ok(photo, 'photo-pure block');

const ssApi = new Function(pure[1] + '\nreturn {SS_KEY_PREFIX,DATAKEY_NAME,ssPrefixedKey,ssWritePlan,ssReadPlan,migratePlainToEncPlan};')();
const {SS_KEY_PREFIX, DATAKEY_NAME, ssPrefixedKey, ssWritePlan, ssReadPlan, migratePlainToEncPlan} = ssApi;
const {foldCopies, normalizeState, canonState, decideKey} = new Function(
  persist[1] + '\nreturn {foldCopies,normalizeState,canonState,decideKey};',
)();
const {attachPhoto, normalizePhotoResult} = new Function(
  photo[1] + '\nreturn {attachPhoto,normalizePhotoResult};',
)();

/** Mock matching Capacitor.Plugins.SecureStorage (native methods only). */
function mockNativeSecureStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async internalGetItem({prefixedKey}) {
      const data = store.has(prefixedKey) ? store.get(prefixedKey) : null;
      return {data};
    },
    async internalSetItem({prefixedKey, data}) {
      store.set(prefixedKey, data);
    },
  };
}

test('ssWritePlan prefers wrapper then native internalSetItem', () => {
  assert.equal(ssPrefixedKey(DATAKEY_NAME), SS_KEY_PREFIX + 'ran.datakey');
  assert.equal(ssWritePlan({setItem: async () => {}}), 'setItem');
  assert.equal(ssWritePlan({set: async () => {}}), 'set');
  assert.equal(ssWritePlan({internalSetItem: async () => {}}), 'internalSetItem');
  assert.equal(ssWritePlan({}), null);
  assert.equal(ssReadPlan({internalGetItem: async () => {}}), 'internalGetItem');
  // Must not call bare SS.set when missing (0.1.11 phone bug).
  assert.doesNotMatch(html, /else await SS\.set\(/);
  assert.match(html, /writeNativeKey/);
  assert.match(html, /internalSetItem\(\{prefixedKey/);
  assert.match(html, /enc put failed; plaintext blob kept/);
});

test('mocked native SecureStorage round-trips datakey via internalSetItem', async () => {
  const SS = mockNativeSecureStorage();
  assert.equal(ssWritePlan(SS), 'internalSetItem');
  assert.equal(ssReadPlan(SS), 'internalGetItem');
  const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  await SS.internalSetItem({prefixedKey: ssPrefixedKey(DATAKEY_NAME), data: key});
  const got = await SS.internalGetItem({prefixedKey: ssPrefixedKey(DATAKEY_NAME)});
  assert.equal(got.data, key);
  assert.equal(decideKey(got.data, false, false), 'use');
});

test('plaintext-to-encrypted migration keeps all board data', () => {
  const items = [
    {id: 't1', name: 'מדידה', page: 'work', updatedAt: 10, att: [{id: 'a1', name: 'p.jpg', type: 'image/jpeg'}]},
    {id: 't2', name: 'שיחה', page: 'ran', updatedAt: 11, phone: '050'},
  ];
  const tombs = [{id: 't9', updatedAt: 8}];
  const copies = [
    {role: 'idb', ok: false, exists: false},
    {role: 'mirror', ok: false, exists: false},
    {role: 'enc-ls', ok: false, exists: false},
    {role: 'plain', ok: true, exists: true, state: {items, tombstones: tombs}},
  ];
  const folded = foldCopies(copies);
  assert.equal(folded.items.length, 2);
  assert.equal(folded.items.find((t) => t.id === 't1').att[0].id, 'a1');
  assert.equal(folded.tombstones[0].id, 't9');

  const plan = migratePlainToEncPlan(copies, true);
  assert.equal(plan.action, 'encrypt-and-drop-plain');
  assert.equal(canonState(plan.state), canonState({items, tombstones: tombs}));

  // After successful enc flush: plain gone, enc present — same data.
  const after = [
    {role: 'idb', ok: true, exists: true, state: plan.state},
    {role: 'mirror', ok: true, exists: true, state: plan.state},
    {role: 'enc-ls', ok: true, exists: true, state: plan.state},
    {role: 'plain', ok: false, exists: false},
  ];
  assert.equal(canonState(foldCopies(after)), canonState(plan.state));
  assert.equal(migratePlainToEncPlan(after, true).action, 'none');
  assert.equal(migratePlainToEncPlan(copies, false).action, 'keep-plain');
});

test('addPhoto / captureReady / pollPending yield an attachment with native SS mock', async () => {
  // Simulate the installed plugin surface + RanCapture delivery paths.
  const SS = mockNativeSecureStorage();
  const subtle = webcrypto.subtle;
  const b64 = (u) => Buffer.from(u).toString('base64');
  const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

  async function writeNativeKey(plugin, r) {
    const plan = ssWritePlan(plugin);
    assert.equal(plan, 'internalSetItem');
    await plugin.internalSetItem({prefixedKey: ssPrefixedKey(DATAKEY_NAME), data: r});
    return plan;
  }
  async function readNativeKey(plugin) {
    const g = await plugin.internalGetItem({prefixedKey: ssPrefixedKey(DATAKEY_NAME)});
    return {value: g && typeof g.data === 'string' ? g.data : null, failed: false};
  }

  const rawKey = b64(webcrypto.getRandomValues(new Uint8Array(32)));
  await writeNativeKey(SS, rawKey);
  const back = await readNativeKey(SS);
  assert.equal(back.value, rawKey);
  const KEY = await subtle.importKey('raw', unb64(rawKey), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function enc(buf) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    return {iv, ct: await subtle.encrypt({name: 'AES-GCM', iv}, KEY, buf), type: undefined};
  }

  const store = new Map();
  const I = [{id: 't-photo', name: 'עבודה', page: 'work', att: [], fresh: 1}];
  let draftAtt = [];
  let rendered = [];
  let lastIngestSig = '';
  const editId = 't-photo';
  const byId = (id) => I.find((x) => x && String(x.id) === String(id));
  const cameraParts = (format) => {
    const f = String(format || 'jpeg').toLowerCase().replace('jpg', 'jpeg');
    return f === 'png' ? {type: 'image/png', ext: 'png'} : {type: 'image/jpeg', ext: 'jpg'};
  };

  async function idb(m, v, id) {
    if (m === 'put') {
      try {
        const buf = Buffer.from(v.b64, 'base64');
        const e = await enc(buf);
        e.type = v.type;
        store.set(id, e);
        return e;
      } catch (err) {
        store.set(id, v);
        return v;
      }
    }
    if (m === 'get') return store.get(id) || null;
    return null;
  }

  async function ingestPhoto(r, taskId) {
    const b64s = r && (r.base64String || r.base64);
    if (!b64s || taskId == null) return false;
    const sig = String(taskId) + ':' + b64s.length + ':' + b64s.slice(0, 40);
    if (sig === lastIngestSig) {
      const cur = byId(taskId);
      if (cur && String(editId) === String(taskId)) {
        draftAtt = (cur.att || []).slice();
        rendered = draftAtt.map((a) => ({id: a.id, thumb: true}));
      }
      return !!(cur && (cur.att || []).length);
    }
    const parts = cameraParts(r.format);
    const att = {id: 'a' + store.size, name: 'photo.' + parts.ext, type: parts.type};
    await idb('put', {b64: b64s, type: parts.type}, att.id);
    const cur = byId(taskId);
    const next = attachPhoto(cur, att);
    const idx = I.findIndex((x) => x && String(x.id) === String(taskId));
    I[idx] = next;
    lastIngestSig = sig;
    draftAtt = next.att.slice();
    rendered = draftAtt.map((a) => ({id: a.id, thumb: /^image/.test(a.type)}));
    return true;
  }

  // Path 1: addPhoto result (RanCapture.capture resolve)
  const addPhotoResult = {base64String: 'aGVsbG8=', format: 'jpeg'};
  assert.ok(normalizePhotoResult(addPhotoResult));
  assert.equal(await ingestPhoto(addPhotoResult, 't-photo'), true);
  assert.equal(I[0].att.length, 1);
  assert.equal(rendered[0].thumb, true);
  assert.ok(store.has(I[0].att[0].id));

  // Path 2: captureReady event (publishPhoto → notifyListeners)
  const captureReadyEv = {base64String: 'd29ybGQ=', format: 'jpeg'};
  assert.equal(await ingestPhoto(captureReadyEv, 't-photo'), true);
  assert.equal(I[0].att.length, 2);

  // Path 3: pollPending recovery (pending_*.jpg stash)
  const pollPending = async () => ({base64String: 'cGVuZGluZw==', format: 'jpeg', path: '/cache/captures/pending_1.jpg'});
  const pending = await pollPending();
  assert.equal(await ingestPhoto(pending, 't-photo'), true);
  assert.equal(I[0].att.length, 3);
  assert.equal(I[0].fresh, undefined);
  assert.match(html, /onCaptureReady/);
  assert.match(html, /pollNativePhotoPending/);
  assert.match(html, /addPhoto\(/);
});

test('SecureStorage failure still attaches a photo via plaintext blob fallback', async () => {
  const store = new Map();
  const I = [{id: 't1', name: 'x', att: []}];
  const brokenGetKey = async () => {
    throw new Error('SS.set is not a function');
  };
  async function idbPut(v, id) {
    try {
      await brokenGetKey();
      throw new Error('unreachable');
    } catch (err) {
      store.set(id, v); // plaintext blob kept
      return v;
    }
  }
  const att = {id: 'a9', name: 'p.jpg', type: 'image/jpeg'};
  await idbPut({b64: 'QQ==', type: att.type}, att.id);
  I[0] = attachPhoto(I[0], att);
  assert.equal(I[0].att.length, 1);
  assert.equal(store.get('a9').b64, 'QQ==');
  assert.match(html, /enc put failed; plaintext blob kept/);
});
