import { useEffect, useMemo, useState } from 'react';
import type { ActionSpec, KeyboardLayout, KeyboardVisualPreset } from '../../lib/types';
import { keyboardEventCodeToKanataId } from './keyEventCode';
import { boardBounds, presetKeys } from './keyboardPresets';
import { KeyboardKey } from './KeyboardKey';
import './keyboard.css';

export function KeyboardCanvas({ layout, visualPreset, selected, onSelect, direct, inherited }: {
  layout: KeyboardLayout;
  visualPreset?: KeyboardVisualPreset;
  selected?: string;
  onSelect: (id: string) => void;
  direct: Record<string, ActionSpec>;
  inherited: Record<string, ActionSpec>;
}) {
  const preset = useMemo(() => presetKeys(visualPreset, layout), [layout, visualPreset]);
  const bounds = useMemo(() => boardBounds(preset.keys), [preset.keys]);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [layerView, setLayerView] = useState<'base' | 'fn'>('base');
  const hasFnLayer = Object.keys(preset.fnLegends).length > 0;
  const visibleLayer = hasFnLayer ? layerView : 'base';

  useEffect(() => {
    const setKeyPressed = (code: string, down: boolean) => {
      const id = keyboardEventCodeToKanataId(code);
      if (!id) return;
      setPressed(current => {
        if (current.has(id) === down) return current;
        const next = new Set(current);
        if (down) next.add(id);
        else next.delete(id);
        return next;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => setKeyPressed(event.code, true);
    const onKeyUp = (event: KeyboardEvent) => setKeyPressed(event.code, false);
    const onBlur = () => setPressed(new Set());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return <div className="keyboard-wrap">
    <div className="keyboard-view-toolbar" role="group" aria-label="Keyboard layer view">
      <button type="button" className={visibleLayer === 'base' ? 'active' : ''} onClick={() => setLayerView('base')}>Base layer</button>
      {hasFnLayer && <button type="button" className={visibleLayer === 'fn' ? 'active' : ''} onClick={() => setLayerView('fn')}>Fn layer</button>}
      <span>{preset.label}</span>
      {preset.fnKey && !preset.fnKey.remappable && <span className="fn-hardware-status">Fn · Hardware-controlled</span>}
    </div>
    <div className="keyboard-board" style={{ width: bounds.width, height: bounds.height }}>
      {preset.keys.map(key => {
        const hardwareControlled = preset.fnKey?.id === key.id && !preset.fnKey.remappable;
        const fnLegend = preset.fnLegends[key.id];
        return <KeyboardKey
          key={key.id}
          keyDef={key}
          selected={selected === key.id}
          pressed={pressed.has(key.id)}
          overridden={key.id in direct}
          inherited={!(key.id in direct) && key.id in inherited}
          displayLabel={visibleLayer === 'fn' ? fnLegend ?? key.label : key.label}
          fnLegend={visibleLayer === 'base' ? fnLegend : undefined}
          hardwareControlled={hardwareControlled}
          onSelect={() => onSelect(key.id)}
        />;
      })}
    </div>
  </div>;
}
