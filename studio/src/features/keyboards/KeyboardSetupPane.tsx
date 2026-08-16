import { Keyboard } from 'lucide-react';
import { Button } from '../../components/Button';
import type { KeyboardCatalogItem } from './keyboardCatalog';

export function KeyboardSetupPane({
  keyboard,
  onSetup,
}: {
  keyboard?: KeyboardCatalogItem;
  onSetup: () => void;
}) {
  return <div className="keyboard-setup-pane">
    <Keyboard size={28} />
    <h2>{keyboard ? `Set up ${keyboard.name}` : 'Connect a keyboard'}</h2>
    <p>{keyboard
      ? 'Create a keyboard-specific Global profile and keep this device in Studio even when it is disconnected.'
      : 'Connected keyboards will appear here automatically.'}</p>
    {keyboard && <Button className="primary" onClick={onSetup}>Set up keyboard</Button>}
  </div>;
}
