const specialCodes: Record<string, string> = {
  Escape: 'esc',
  Backquote: 'grv',
  Minus: '-',
  Equal: '=',
  Backspace: 'bspc',
  Tab: 'tab',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  CapsLock: 'caps',
  Semicolon: ';',
  Quote: "'",
  Enter: 'ret',
  ShiftLeft: 'lsft',
  ShiftRight: 'rsft',
  Comma: ',',
  Period: '.',
  Slash: '/',
  ControlLeft: 'lctl',
  MetaLeft: 'lmet',
  AltLeft: 'lalt',
  Space: 'spc',
  AltRight: 'ralt',
  MetaRight: 'rmet',
  ContextMenu: 'menu',
  ControlRight: 'rctl',
  IntlBackslash: 'non_us_bslash',
  NonConvert: 'muhenkan',
  Convert: 'henkan',
  KanaMode: 'katakana',
};

export function keyboardEventCodeToKanataId(code: string): string | undefined {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1].toLowerCase();

  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];

  const functionKey = /^F([1-9]|1[0-2])$/.exec(code);
  if (functionKey) return `f${functionKey[1]}`;

  return specialCodes[code];
}
