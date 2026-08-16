import { ansi, type KeyGeometry } from './ansi';
export const jis: KeyGeometry[] = ansi.concat([{ id: 'muhenkan', label: '無変換', x: 200, y: 280, w: 64, h: 42 }, { id: 'henkan', label: '変換', x: 270, y: 280, w: 64, h: 42 }, { id: 'katakana', label: 'かな', x: 340, y: 280, w: 64, h: 42 }]);
