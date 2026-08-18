import type { KeyGeometry } from './layouts/ansi';

export function KeyboardKey({
  keyDef,
  selected,
  pressed,
  inherited,
  overridden,
  displayLabel,
  fnLegend,
  hardwareControlled = false,
  onSelect,
}: {
  keyDef: KeyGeometry;
  selected: boolean;
  pressed: boolean;
  inherited: boolean;
  overridden: boolean;
  displayLabel?: string;
  fnLegend?: string;
  hardwareControlled?: boolean;
  onSelect: () => void;
}) {
  const title = hardwareControlled
    ? 'Hardware-controlled · not exposed to Kanata'
    : inherited ? 'Inherited from Global' : undefined;
  return <button
    className={`keyboard-key ${selected ? 'selected' : ''} ${pressed ? 'pressed' : ''} ${inherited ? 'inherited' : ''} ${overridden ? 'overridden' : ''} ${hardwareControlled ? 'hardware-controlled' : ''}`}
    style={{ left: keyDef.x, top: keyDef.y, width: keyDef.w, height: keyDef.h }}
    onClick={() => { if (!hardwareControlled) onSelect(); }}
    aria-disabled={hardwareControlled ? 'true' : undefined}
    title={title}
  >
    <span className="key-main-label">{displayLabel ?? keyDef.label}</span>
    {fnLegend && <span className="fn-legend">{fnLegend}</span>}
    {inherited && <span className="inherit-mark">↙</span>}
  </button>;
}
