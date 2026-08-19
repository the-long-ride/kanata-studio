import { Switch } from '../../components/Switch';

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
    <Switch checked={start} onChange={onStart} label="Start with system" />
    <Switch
      checked={stopKanataOnQuit}
      onChange={onStopKanataOnQuit}
      label="Stop Kanata engine when Kanata Studio quits"
    />
  </section>;
}
