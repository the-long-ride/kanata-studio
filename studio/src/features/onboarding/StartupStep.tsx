import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';

export function StartupStep({ value, onChange, onNext }: {
  value: boolean;
  onChange: (value: boolean) => void;
  onNext: () => void;
}) {
  return <>
    <h2>Background startup</h2>
    <p className="sub">Kanata Studio starts in the tray and keeps remapping active.</p>
    <Switch checked={value} onChange={onChange} label="Start with system" />
    <Button className="primary" onClick={onNext}>Continue</Button>
  </>;
}
