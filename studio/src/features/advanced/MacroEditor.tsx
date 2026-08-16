import { useEffect, useRef, useState } from 'react';
import { Circle, Square } from 'lucide-react';
import { Button } from '../../components/Button';
import type { ActionSpec } from '../../lib/types';
import { appendRecordedStep, recordedActionFromKey } from './macroRecording';
import { NestedActionList } from './NestedActionList';

export function MacroEditor({ actions, onChange }: {
  actions: ActionSpec[];
  onChange: (actions: ActionSpec[]) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [exactTiming, setExactTiming] = useState(false);
  const lastAt = useRef<number>();
  useEffect(() => {
    if (!recording) {
      lastAt.current = undefined;
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const action = recordedActionFromKey(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      const result = appendRecordedStep(
        actions,
        action,
        lastAt.current,
        performance.now(),
        exactTiming,
      );
      lastAt.current = result.at;
      onChange(result.steps);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [actions, exactTiming, onChange, recording]);

  return <div className="macro-editor">
    <div className={`macro-record-bar ${recording ? 'recording' : ''}`}>
      <Button className={recording ? 'record-stop' : ''} onClick={() => setRecording(value => !value)}>
        {recording ? <Square size={12} /> : <Circle size={12} />}
        {recording ? 'Stop recording' : 'Record sequence'}
      </Button>
      <label className="macro-exact-toggle">
        <input type="checkbox" checked={exactTiming} onChange={event => setExactTiming(event.target.checked)} />
        Record exact timing
      </label>
    </div>
    {recording && <p className="recording-hint">Recording keyboard events… use the Stop button when finished.</p>}
    <NestedActionList actions={actions} onChange={onChange} allowDelay />
    <p className="muted macro-fn-note">Fn can be recorded only when the operating system exposes it as a key event.</p>
  </div>;
}
