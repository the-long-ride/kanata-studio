import { Toggle } from '../../components/Toggle';
export function GeneralSettings({ start, onStart }: {
    start: boolean;
    onStart: (v: boolean) => void;
}) { return <section><h3>General</h3><Toggle checked={start} onChange={onStart} label="Start with system"/></section>; }
