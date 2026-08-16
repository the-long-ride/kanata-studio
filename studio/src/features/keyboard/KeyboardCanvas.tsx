import type { ActionSpec, KeyboardLayout } from '../../lib/types';
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
}) { const keys = layout === 'Iso' ? iso : layout === 'Jis' ? jis : ansi; return <div className="keyboard-wrap"><div className="keyboard-board">{keys.map(k => <KeyboardKey key={k.id} keyDef={k} selected={selected === k.id} overridden={k.id in direct} inherited={!(k.id in direct) && k.id in inherited} onSelect={() => onSelect(k.id)}/>)}</div></div>; }
