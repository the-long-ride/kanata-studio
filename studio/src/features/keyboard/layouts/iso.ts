import { ansi, type KeyGeometry } from './ansi';
export const iso: KeyGeometry[] = ansi.map(k => k.id === 'ret' ? { ...k, label: 'Enter ↵' } : k).concat([{ id: 'non_us_bslash', label: '<>', x: 60, y: 188, w: 42, h: 42 }]);
