import { useEffect, useState } from 'react';
import type { ActionSpec, KeyboardLayout } from '../../lib/types';
import { keyboardEventCodeToKanataId } from './keyEventCode';
import { ansi } from './layouts/ansi';
import { iso } from './layouts/iso';
import { jis } from './layouts/jis';
import { KeyboardKey } from './KeyboardKey';
import './keyboard.css';

export function KeyboardCanvas({ layout, selected, onSelect, direct, inherited }: {
  layout: KeyboardLayout;
  selected?: string;
  onSelect: (id: string) => void;
  direct: Record<string, ActionSpec>;
  inherited: Record<string, ActionSpec>;
}) {
  const keys = layout === 'Iso' ? iso : layout === 'Jis' ? jis : ansi;
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());

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

  return <div className="keyboard-wrap"><div className="keyboard-board">{keys.map(key => (
    <KeyboardKey
      key={key.id}
      keyDef={key}
      selected={selected === key.id}
      pressed={pressed.has(key.id)}
      overridden={key.id in direct}
      inherited={!(key.id in direct) && key.id in inherited}
      onSelect={() => onSelect(key.id)}
    />
  ))}</div></div>;
}
