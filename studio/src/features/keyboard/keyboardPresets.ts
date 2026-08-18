import type { KeyboardLayout, KeyboardVisualPreset } from '../../lib/types';
import type { KeyGeometry } from './layouts/ansi';
import { ansi } from './layouts/ansi';
import { iso } from './layouts/iso';
import { jis } from './layouts/jis';

export type KeyboardPreset = {
  id: KeyboardVisualPreset | 'generic';
  label: string;
  keys: KeyGeometry[];
  fnLegends: Record<string, string>;
  fnKey?: { id: string; remappable: boolean };
};

const u = 42;
const g = 4;
const navX = 718;
const numX = 866;
const key = (id: string, label: string, x: number, y: number, w = u, h = u): KeyGeometry => ({ id, label, x, y, w, h });

const navKeys: KeyGeometry[] = [
  key('prtsc', 'PrtSc', navX, 0), key('slck', 'ScrLk', navX + 46, 0), key('pause', 'Pause', navX + 92, 0),
  key('ins', 'Insert', navX, 50), key('home', 'Home', navX + 46, 50), key('pgup', 'PgUp', navX + 92, 50),
  key('del', 'Delete', navX, 96), key('end', 'End', navX + 46, 96), key('pgdn', 'PgDn', navX + 92, 96),
  key('up', '↑', navX + 46, 188), key('left', '←', navX, 234), key('down', '↓', navX + 46, 234), key('right', '→', navX + 92, 234),
];

const numpad: KeyGeometry[] = [
  key('nlck', 'Num', numX, 50), key('kp/', '/', numX + 46, 50), key('kp*', '*', numX + 92, 50), key('kp-', '-', numX + 138, 50),
  key('kp7', 'Num 7', numX, 96), key('kp8', 'Num 8', numX + 46, 96), key('kp9', 'Num 9', numX + 92, 96), key('kp+', '+', numX + 138, 96, u, 88),
  key('kp4', 'Num 4', numX, 142), key('kp5', 'Num 5', numX + 46, 142), key('kp6', 'Num 6', numX + 92, 142),
  key('kp1', 'Num 1', numX, 188), key('kp2', 'Num 2', numX + 46, 188), key('kp3', 'Num 3', numX + 92, 188), key('kprt', 'Enter', numX + 138, 188, u, 88),
  key('kp0', 'Num 0', numX, 234, 88), key('kp.', '.', numX + 92, 234),
];

const compactNav: KeyGeometry[] = [
  key('del', 'Delete', 690, 0), key('home', 'Home', 690, 50), key('pgup', 'PgUp', 690, 96), key('pgdn', 'PgDn', 690, 142),
  key('up', '↑', 690, 188), key('left', '←', 644, 234), key('down', '↓', 690, 234), key('right', '→', 736, 234),
];

const replaceMenuWithFn = (keys: KeyGeometry[]) => keys.map(item => item.id === 'menu'
  ? { ...item, id: 'fn', label: 'Fn' }
  : item);

const fnLegends: Record<string, string> = {
  f1: 'Mute',
  f2: 'Vol −',
  f3: 'Vol +',
  f4: 'Mic',
  f5: 'Bright −',
  f6: 'Bright +',
  f7: 'Previous',
  f8: 'Play/Pause',
  f9: 'Next',
  f10: 'Stop',
  f11: 'Home',
  f12: 'End',
};

const compactFnLegends: Record<string, string> = {
  ...fnLegends,
  '1': 'Mute',
  '2': 'Vol −',
  '3': 'Vol +',
  '4': 'Mic',
  '5': 'Bright −',
  '6': 'Bright +',
  '7': 'Previous',
  '8': 'Play/Pause',
  '9': 'Next',
  '0': 'Stop',
};

export const keyboardPresets: Record<KeyboardVisualPreset, KeyboardPreset> = {
  fullsize: { id: 'fullsize', label: 'Full size', keys: [...ansi, ...navKeys, ...numpad], fnLegends, fnKey: { id: 'fn', remappable: false } },
  tkl: { id: 'tkl', label: 'TKL', keys: [...ansi, ...navKeys], fnLegends, fnKey: { id: 'fn', remappable: false } },
  '75': { id: '75', label: '75%', keys: [...replaceMenuWithFn(ansi), ...compactNav], fnLegends, fnKey: { id: 'fn', remappable: false } },
  '65': { id: '65', label: '65%', keys: [...replaceMenuWithFn(ansi.filter(item => !/^f\d+$/.test(item.id))), ...compactNav.filter(item => ['del', 'up', 'left', 'down', 'right'].includes(item.id))], fnLegends: compactFnLegends, fnKey: { id: 'fn', remappable: false } },
  '60': { id: '60', label: '60%', keys: replaceMenuWithFn(ansi.filter(item => !/^f\d+$/.test(item.id))), fnLegends: compactFnLegends, fnKey: { id: 'fn', remappable: false } },
};

export function presetKeys(preset: KeyboardVisualPreset | undefined, layout: KeyboardLayout): KeyboardPreset {
  if (preset) return keyboardPresets[preset];
  const keys = layout === 'Iso' ? iso : layout === 'Jis' ? jis : ansi;
  return { id: 'generic', label: layout, keys, fnLegends: {} };
}

export function boardBounds(keys: KeyGeometry[]): { width: number; height: number } {
  const width = Math.max(...keys.map(item => item.x + item.w), 760) + g * 2;
  const height = Math.max(...keys.map(item => item.y + item.h), 276) + 24;
  return { width, height };
}
