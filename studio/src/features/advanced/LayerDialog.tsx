import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';

export function LayerDialog({
  open,
  existingNames,
  onClose,
  onSubmit,
}: {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const trimmed = name.trim();
  const duplicate = Boolean(trimmed) && existingNames.some(
    item => item.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  const invalid = !trimmed || duplicate;

  const submit = () => {
    if (!invalid) onSubmit(trimmed);
  };

  return <Modal open={open} title="Add layer" onClose={onClose} className="layer-dialog">
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <label className="field">Layer name
        <input
          className="ui-input"
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>
      {duplicate && <span className="chord-error">A layer with this name already exists.</span>}
      <div className="dialog-actions">
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="primary" disabled={invalid}>Add layer</Button>
      </div>
    </form>
  </Modal>;
}
