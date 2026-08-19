import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import type { KeyboardLayout, KeyboardVisualPreset } from '../../lib/types';
import { resolveVisualPreset, type KeyboardCatalogItem } from './keyboardCatalog';

type ManagerProps = {
  open: boolean;
  keyboard?: KeyboardCatalogItem;
  items: KeyboardCatalogItem[];
  onClose: () => void;
  onSetup: () => Promise<void>;
  onUpdate: (input: { id: string; name?: string; layoutOverride: KeyboardLayout | null; visualPresetOverride?: KeyboardVisualPreset | null }) => Promise<void>;
  onCopy: (sourceId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function KeyboardManagerDialog(props: ManagerProps) {
  if (!props.open || !props.keyboard) return null;
  const key = [
    props.keyboard.id,
    props.keyboard.name,
    props.keyboard.layoutOverride ?? 'Auto',
    props.keyboard.visualPresetOverride ?? 'Auto',
    props.keyboard.reportedKeyCount ?? 'Unknown',
  ].join(':');
  return <KeyboardManagerForm key={key} {...props} keyboard={props.keyboard} />;
}

function KeyboardManagerForm({
  keyboard,
  items,
  onClose,
  onSetup,
  onUpdate,
  onCopy,
  onRefresh,
}: Omit<ManagerProps, 'open' | 'keyboard'> & { keyboard: KeyboardCatalogItem }) {
  const sources = items.filter(item => item.configured && item.id !== keyboard.id);
  const [name, setName] = useState(keyboard.name);
  const [layout, setLayout] = useState<KeyboardLayout | 'Auto'>(keyboard.layoutOverride ?? 'Auto');
  const [visualPreset, setVisualPreset] = useState<KeyboardVisualPreset | 'Auto'>(keyboard.visualPresetOverride ?? 'Auto');
  const [source, setSource] = useState(sources[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch {
      // The registry hook reports the actionable error in the shared issue dialog.
    } finally {
      setBusy(false);
    }
  };

  return <Modal title="Keyboard settings" onClose={onClose} className="keyboard-manager">
    <div className="keyboard-manager-head">
      <div><p className="muted">{keyboard.detectedName}</p></div>
      <Button type="button" disabled={busy} onClick={() => void run(onRefresh)}>
        <RefreshCw size={13} /> Refresh
      </Button>
    </div>
    <div className="device-status-line">
      <span className={`device-status-dot ${keyboard.connected ? '' : 'offline'}`} />
      {keyboard.connected ? 'Connected' : 'Disconnected'}
      {!keyboard.configured && <span> · New device</span>}
    </div>
    {!keyboard.configured ? <>
      <p className="muted">Set up this keyboard to create its own Global and app profiles.</p>
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button className="primary" disabled={busy} onClick={() => void run(onSetup)}>Set up</Button>
      </div>
    </> : <>
      <label className="field">Display name
        <input className="ui-input" value={name} onChange={event => setName(event.target.value)} />
      </label>
      <label className="field">Physical layout
        <Select value={layout} onChange={event => setLayout(event.target.value as KeyboardLayout | 'Auto')}>
          <option value="Auto">Auto ({keyboard.layout})</option>
          <option value="Ansi">ANSI</option><option value="Iso">ISO</option><option value="Jis">JIS</option>
        </Select>
      </label>
      <label className="field">Visual keyboard
        <Select value={visualPreset} onChange={event => setVisualPreset(event.target.value as KeyboardVisualPreset | 'Auto')}>
          <option value="Auto">{autoVisualLabel(keyboard)}</option>
          <option value="fullsize">Full size</option>
          <option value="tkl">TKL</option>
          <option value="75">75%</option>
          <option value="65">65%</option>
          <option value="60">60%</option>
        </Select>
      </label>
      <div className="keyboard-metadata">
        <span>ID</span><code>{keyboard.id}</code>
        <span>USB</span><code>{usbLabel(keyboard)}</code>
        {keyboard.reportedKeyCount != null && <><span>Keys</span><code>{keyboard.reportedKeyCount}</code></>}
      </div>
      <div className="keyboard-copy-block">
        <strong>Copy everything from</strong>
        <p className="muted">Replaces this keyboard&apos;s Global/app profiles and layout overrides.</p>
        <div className="keyboard-copy-row">
          <Select value={source} disabled={!sources.length} onChange={event => setSource(event.target.value)}>
            {!sources.length && <option value="">No other configured keyboards</option>}
            {sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Button disabled={!source || busy} onClick={() => void run(() => onCopy(source))}>Copy</Button>
        </div>
      </div>
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button className="primary" disabled={!name.trim() || busy} onClick={() => void run(() => onUpdate({
          id: keyboard.id,
          name: name.trim(),
          layoutOverride: layout === 'Auto' ? null : layout,
          visualPresetOverride: visualPreset === 'Auto' ? null : visualPreset,
        }))}>Save</Button>
      </div>
    </>}
  </Modal>;
}

function autoVisualLabel(keyboard: KeyboardCatalogItem): string {
  const labels: Record<KeyboardVisualPreset, string> = {
    fullsize: 'Full size',
    tkl: 'TKL',
    '75': '75%',
    '65': '65%',
    '60': '60%',
  };
  const autoPreset = resolveVisualPreset({
    name: keyboard.detectedName,
    layout: keyboard.layout,
    reportedKeyCount: keyboard.reportedKeyCount,
    functionKeyCount: keyboard.functionKeyCount,
    keyboardType: keyboard.keyboardType,
  });
  const visual = autoPreset ? labels[autoPreset] : 'Generic Extended';
  const keyCount = keyboard.reportedKeyCount == null ? '' : ` · ${keyboard.reportedKeyCount} keys`;
  return `Auto (${visual}${keyCount})`;
}

function usbLabel(keyboard: KeyboardCatalogItem): string {
  if (keyboard.vendorId == null || keyboard.productId == null) return 'Unknown';
  return `${hex(keyboard.vendorId)}:${hex(keyboard.productId)}`;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, '0').toUpperCase();
}
