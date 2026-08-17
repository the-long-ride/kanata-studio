import type { KeyGeometry } from './layouts/ansi';

export function KeyboardKey({ keyDef, selected, pressed, inherited, overridden, onSelect }: {
  keyDef: KeyGeometry;
  selected: boolean;
  pressed: boolean;
  inherited: boolean;
  overridden: boolean;
  onSelect: () => void;
}) {
  return <button
    className={`keyboard-key ${selected ? 'selected' : ''} ${pressed ? 'pressed' : ''} ${inherited ? 'inherited' : ''} ${overridden ? 'overridden' : ''}`}
    style={{ left: keyDef.x, top: keyDef.y, width: keyDef.w, height: keyDef.h }}
    onClick={onSelect}
    title={inherited ? 'Inherited from Global' : undefined}
  >
    {keyDef.label}
    {inherited && <span className="inherit-mark">↙</span>}
  </button>;
}
