import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTargetSpecificDevice,
  selectProfileDevice,
} from '../src/app/profileUiRules.ts';

const devices = [
  { id: 'ansi', name: 'ANSI board', layout: 'Ansi' },
  { id: 'jis', name: 'JIS board', layout: 'Jis', manualLayout: 'Iso' },
];

test('selectProfileDevice follows a profile-specific device before the first keyboard', () => {
  const profile = { deviceTarget: { kind: 'device', id: 'jis' } };
  assert.equal(selectProfileDevice(profile, devices)?.id, 'jis');
});

test('selectProfileDevice falls back to the first keyboard for all-keyboard profiles', () => {
  const profile = { deviceTarget: { kind: 'all' } };
  assert.equal(selectProfileDevice(profile, devices)?.id, 'ansi');
});

test('specific device targeting is offered only when the backend reports Available', () => {
  assert.equal(canTargetSpecificDevice('Available'), true);
  assert.equal(canTargetSpecificDevice('RequiresWindowsInterception'), false);
  assert.equal(canTargetSpecificDevice('Unavailable'), false);
});
