// Gesture routing, address suggestions, and local notification reminders.
// Run: node --test test/ui.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

const gesturePure = html.match(/\/\/ <gesture-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/gesture-pure>/);
assert.ok(gesturePure, 'gesture-pure block missing from index.html');
const {classifyCardGesture, swipePageDelta} = new Function(
  gesturePure[1] + '\nreturn {classifyCardGesture, swipePageDelta};',
)();

const suggestPure = html.match(/\/\/ <suggest-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/suggest-pure>/);
assert.ok(suggestPure, 'suggest-pure block missing from index.html');
const {commitSuggestion, stickySuggestionValue} = new Function(
  suggestPure[1] + '\nreturn {commitSuggestion, stickySuggestionValue};',
)();

const remindPure = html.match(/\/\/ <remind-pure>\r?\n([\s\S]*?)\r?\n\/\/ <\/remind-pure>/);
assert.ok(remindPure, 'remind-pure block missing from index.html');
const {reminderIds} = new Function(remindPure[1] + '\nreturn {reminderIds};')();

const now = Date.parse('2026-11-16T12:00:00');
const futureWhen = '2026-11-16T15:00';
const pastWhen = '2026-11-16T09:00';

test('card gesture classification and RTL page swipe', () => {
  assert.equal(classifyCardGesture(400, 0, 0), 'drag');
  assert.equal(classifyCardGesture(100, 0, 0), 'wait');
  assert.equal(classifyCardGesture(200, 80, 10), 'swipe');
  assert.equal(classifyCardGesture(200, -80, 10), 'swipe');
  assert.equal(classifyCardGesture(200, 10, 50), 'scroll');
  assert.equal(classifyCardGesture(500, 120, 20), 'drag');
  assert.equal(classifyCardGesture(200, 30, 10), 'wait');
  assert.equal(swipePageDelta(-20), 1);
  assert.equal(swipePageDelta(20), -1);
  assert.match(html, /classifyCardGesture\(/);
  assert.match(html, /draglock/);
  assert.match(html, /touch-action:pan-y/);
});

test('address suggestion commit, sticky IME, and pointer pick', () => {
  assert.deepEqual(commitSuggestion('הרצל 1, תל אביב'), {value: 'הרצל 1, תל אביב', close: true});
  assert.deepEqual(commitSuggestion(null), {value: '', close: true});
  const picked = 'הרצל 1, תל אביב';
  assert.equal(stickySuggestionValue('הרצל 1, תל אביבX', picked, 0), picked);
  assert.equal(stickySuggestionValue('הרצל 1, תל אביבX', picked, 449), picked);
  assert.equal(stickySuggestionValue('typed later', picked, 450), 'typed later');
  assert.equal(stickySuggestionValue('free', null, 0), 'free');
  assert.match(html, /addEventListener\('pointerdown',pick\)/);
  assert.match(html, /addEventListener\('mousedown',pick\)/);
  assert.match(html, /function chooseSuggestion\(/);
});

test('reminderIds includes only future work tasks with a when', () => {
  const items = [
    {id: 't1', page: 'work', when: futureWhen},
    {id: 't2', page: 'trash', when: futureWhen},
    {id: 't3', page: 'work', when: pastWhen},
    {id: 't4', page: 'work'},
  ];
  assert.deepEqual(reminderIds(items, now), ['t1']);
  assert.deepEqual(reminderIds([], now), []);
  assert.deepEqual(reminderIds(null, now), []);
});

test('delete, undo, and dom sync call syncReminders', () => {
  assert.match(html, /function act\([^)]*\)\{[\s\S]*?syncReminders\(/);
  assert.match(html, /function undo\(\)\{[\s\S]*?syncReminders\(/);
  assert.match(html, /function syncDom\([^)]*\)\{[\s\S]*?syncReminders\(/);
});