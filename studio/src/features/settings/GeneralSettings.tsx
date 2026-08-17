import { Toggle } from '../../components/Toggle';

export function GeneralSettings({
  start,
  stopKanataOnQuit,
  onStart,
  onStopKanataOnQuit,
}: {
  start: boolean;
  stopKanataOnQuit: boolean;
  onStart: (value: boolean) => void;
  onStopKanataOnQuit: (value: boolean) => void;
}) {
  return <section>
    <h3>General</h3>
    <Toggle checked={start} onChange={onStart} label="Start with system" />
    <Toggle
      checked={stopKanataOnQuit}
      onChange={onStopKanataOnQuit}
      label="Stop Kanata engine when Kanata Studio quits"
    />
  </section>;
}
