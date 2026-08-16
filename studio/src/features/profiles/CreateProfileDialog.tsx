import { useState } from 'react';
import { Button } from '../../components/Button';

export type NewProfileInput = {
  name: string;
  executable: string;
};

export function CreateProfileDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: NewProfileInput) => void;
}) {
  const [name, setName] = useState('');
  const [executable, setExecutable] = useState('');
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="dialog" onMouseDown={event => event.stopPropagation()} onSubmit={event => {
      event.preventDefault();
      if (!executable.trim()) return;
      onCreate({ name: name.trim() || executable.trim(), executable: executable.trim() });
    }}>
      <h3>New app profile</h3>
      <p className="muted">This profile belongs to the keyboard selected in the top bar.</p>
      <label className="field">Name<input className="ui-input" value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="field">Executable<input className="ui-input" value={executable} onChange={event => setExecutable(event.target.value)} placeholder="Code.exe" autoFocus /></label>
      <div className="dialog-actions">
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button className="primary" disabled={!executable.trim()}>Create</Button>
      </div>
    </form>
  </div>;
}
