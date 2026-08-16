import type { UiMode } from '../lib/types';
export function ModeSwitch({ value, onChange }: {
    value: UiMode;
    onChange: (mode: UiMode) => void;
}) { return <div className="mode-switch" role="group" aria-label="Editor mode">{(['Beginner', 'Advanced'] as UiMode[]).map(mode => <button key={mode} className={value === mode ? 'active' : ''} onClick={() => onChange(mode)}>{mode}</button>)}</div>; }
