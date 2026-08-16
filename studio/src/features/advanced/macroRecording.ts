import type { ActionSpec, Modifier } from '../../lib/types';

export type KeyLike = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

const modifierKeys = new Set([
  'Control', 'Shift', 'Alt', 'Meta', 'AltGraph',
]);

const names: Record<string, string> = {
  Escape: 'esc', Enter: 'ret', Backspace: 'bspc', Tab: 'tab',
  ' ': 'spc', Spacebar: 'spc', Delete: 'del', Insert: 'ins',
  Home: 'home', End: 'end', PageUp: 'pgup', PageDown: 'pgdn',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  CapsLock: 'caps', Fn: 'fn',
};

export function normalizeRecordedKey(key: string): string | undefined {
  if (modifierKeys.has(key)) return undefined;
  if (names[key]) return names[key];
  if (/^F\d{1,2}$/i.test(key)) return key.toLowerCase();
  if (key.length === 1) return key.toLowerCase();
  return key.toLowerCase();
}

export function recordedActionFromKey(event: KeyLike): ActionSpec | undefined {
  const key = normalizeRecordedKey(event.key);
  if (!key) return undefined;
  const modifiers: Modifier[] = [];
  if (event.ctrlKey) modifiers.push('Ctrl');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.altKey) modifiers.push('Alt');
  if (event.metaKey) modifiers.push('Meta');
  if (modifiers.length) return { type: 'shortcut', modifiers, key };
  return { type: 'key', key };
}

export function appendRecordedStep(
  steps: ActionSpec[],
  action: ActionSpec,
  previousAt: number | undefined,
  at: number,
  exactTiming: boolean,
): { steps: ActionSpec[]; at: number } {
  const next = [...steps];
  if (previousAt !== undefined) {
    const elapsed = Math.max(0, Math.round(at - previousAt));
    if (exactTiming && elapsed > 0) {
      next.push({ type: 'delay', ms: Math.min(elapsed, 60000) });
    } else if (!exactTiming && elapsed >= 180) {
      next.push({ type: 'delay', ms: 150 });
    }
  }
  next.push(action);
  return { steps: next, at };
}
