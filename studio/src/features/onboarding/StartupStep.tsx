import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
export function StartupStep({ value, onChange, onNext }: {
    value: boolean;
    onChange: (v: boolean) => void;
    onNext: () => void;
}) { return <><h2>Background startup</h2><p className="sub">Kanata Studio starts in the tray and keeps remapping active.</p><Toggle checked={value} onChange={onChange} label="Start with system"/><Button className="primary" onClick={onNext}>Continue</Button></>; }
