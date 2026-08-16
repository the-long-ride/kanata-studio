export type KeyGeometry = {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
};
const u = 42, g = 4;
const row = (y: number, items: Array<[
    string,
    string,
    number?
]>) => { let x = 0; return items.map(([id, label, width = 1]) => { const k = { id, label, x, y, w: u * width + g * (width - 1), h: u }; x += k.w + g; return k; }); };
export const ansi: KeyGeometry[] = [
    ...row(0, [['esc', 'Esc'], ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], ['f5', 'F5'], ['f6', 'F6'], ['f7', 'F7'], ['f8', 'F8'], ['f9', 'F9'], ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12']]),
    ...row(50, [['grv', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['0', '0'], ['-', '-'], ['=', '='], ['bspc', 'Backspace', 2]]),
    ...row(96, [['tab', 'Tab', 1.5], ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '['], [']', ']'], ['\\', '\\', 1.5]]),
    ...row(142, [['caps', 'Caps', 1.75], ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ';'], ["'", "'"], ['ret', 'Enter', 2.25]]),
    ...row(188, [['lsft', 'Shift', 2.25], ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', ','], ['.', '.'], ['/', '/'], ['rsft', 'Shift', 2.75]]),
    ...row(234, [['lctl', 'Ctrl', 1.25], ['lmet', 'Meta', 1.25], ['lalt', 'Alt', 1.25], ['spc', 'Space', 6.25], ['ralt', 'Alt', 1.25], ['rmet', 'Meta', 1.25], ['menu', 'Menu', 1.25], ['rctl', 'Ctrl', 1.25]])
];
