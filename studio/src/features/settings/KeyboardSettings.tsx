import { Button } from '../../components/Button';
import type { KeyboardCatalogItem } from '../keyboards/keyboardCatalog';

export function KeyboardSettings({ keyboards, onManage }: {
  keyboards: KeyboardCatalogItem[];
  onManage: (id: string) => void;
}) {
  return <section className="settings-section">
    <h3>Keyboards</h3>
    <p className="muted">Configured keyboards stay here while disconnected. New devices are saved when you set them up.</p>
    <div className="settings-keyboard-list">
      {keyboards.map(keyboard => <div className="settings-keyboard-row" key={keyboard.id}>
        <div><strong>{keyboard.name}</strong><small>{keyboard.detectedName}</small></div>
        <span>{!keyboard.configured ? 'New device' : keyboard.connected ? 'Connected' : 'Disconnected'}</span>
        <Button onClick={() => onManage(keyboard.id)}>Manage</Button>
      </div>)}
      {!keyboards.length && <p className="muted">No keyboards detected.</p>}
    </div>
  </section>;
}
