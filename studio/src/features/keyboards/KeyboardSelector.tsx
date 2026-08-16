import { Keyboard, SlidersHorizontal } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { Select } from '../../components/Select';
import type { KeyboardCatalogItem } from './keyboardCatalog';
import './keyboards.css';

export function KeyboardSelector({
  items,
  selectedId,
  onSelect,
  onManage,
}: {
  items: KeyboardCatalogItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  return <div className="keyboard-selector">
    <Keyboard size={15} aria-hidden="true" />
    <Select
      aria-label="Keyboard"
      value={selectedId ?? ''}
      disabled={!items.length}
      onChange={event => onSelect(event.target.value)}
    >
      {!items.length && <option value="">No keyboard detected</option>}
      {items.map(item => <option key={item.id} value={item.id}>
        {optionLabel(item)}
      </option>)}
    </Select>
    <IconButton label="Manage keyboards" disabled={!selectedId} onClick={onManage}>
      <SlidersHorizontal size={15} />
    </IconButton>
  </div>;
}

function optionLabel(item: KeyboardCatalogItem): string {
  const status = !item.configured ? 'New device' : item.connected ? 'Connected' : 'Disconnected';
  return `${item.name} · ${status}`;
}
