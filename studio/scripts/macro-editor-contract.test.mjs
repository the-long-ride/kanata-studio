import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');

async function importRequired(path) {
  const full = resolve(root, path);
  try { await access(full); }
  catch { assert.fail(`${path} must exist`); }
  return import(pathToFileURL(full).href);
}

test('action model and compiler support delay multi and tap dance', async () => {
  const [domain, basic, advanced] = await Promise.all([
    read('src-tauri/src/domain/action.rs'),
    read('src-tauri/src/compiler/basic.rs'),
    read('src-tauri/src/compiler/advanced.rs'),
  ]);
  assert.match(domain, /Delay\s*\{/);
  assert.match(domain, /Multi\s*\{/);
  assert.match(domain, /TapDance\s*\{/);
  assert.match(basic, /ActionSpec::Delay/);
  assert.match(advanced, /\(multi \{\}\)/);
  assert.match(advanced, /\(tap-dance \{timeout_ms\} \(/);
});

test('macro recording normalizes keys chords timing and observable fn', async () => {
  const { recordedActionFromKey, appendRecordedStep } = await importRequired('src/features/advanced/macroRecording.ts');
  assert.deepEqual(recordedActionFromKey({ key: 'Escape', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }), { type: 'key', key: 'esc' });
  assert.deepEqual(recordedActionFromKey({ key: 'P', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false }), { type: 'shortcut', modifiers: ['Ctrl', 'Shift'], key: 'p' });
  assert.equal(recordedActionFromKey({ key: 'Control', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }), undefined);
  assert.deepEqual(recordedActionFromKey({ key: 'Fn', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }), { type: 'key', key: 'fn' });
  const first = appendRecordedStep([], { type: 'key', key: 'a' }, undefined, 1000, false);
  const normalized = appendRecordedStep(first.steps, { type: 'key', key: 'b' }, first.at, 1400, false);
  assert.deepEqual(normalized.steps, [{ type: 'key', key: 'a' }, { type: 'delay', ms: 150 }, { type: 'key', key: 'b' }]);
  const exact = appendRecordedStep(first.steps, { type: 'key', key: 'b' }, first.at, 1400, true);
  assert.deepEqual(exact.steps, [{ type: 'key', key: 'a' }, { type: 'delay', ms: 400 }, { type: 'key', key: 'b' }]);
  const exactQuick = appendRecordedStep(first.steps, { type: 'key', key: 'b' }, first.at, 1050, true);
  assert.deepEqual(exactQuick.steps, [{ type: 'key', key: 'a' }, { type: 'delay', ms: 50 }, { type: 'key', key: 'b' }]);
});

test('advanced inspector exposes visual macro multi and tap-dance editors', async () => {
  const [inspector, macroEditor, nested] = await Promise.all([
    read('src/features/advanced/AdvancedInspector.tsx'),
    read('src/features/advanced/MacroEditor.tsx').catch(() => ''),
    read('src/features/advanced/NestedActionList.tsx').catch(() => ''),
  ]);
  assert.match(inspector, /Tap dance/);
  assert.match(inspector, /Multi-key/);
  assert.match(macroEditor, /Record exact timing/);
  assert.match(nested, /Add delay/);
  assert.match(nested, /Add chord/);
});
