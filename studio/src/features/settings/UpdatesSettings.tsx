import { Button } from '../../components/Button';
export function UpdatesSettings({ version, onCheck }: {
    version: {
        studio: string;
        kanata: string;
        sha: string;
    };
    onCheck: () => void;
}) { return <section><h3>Updates</h3><p className="muted">Studio {version.studio} · Kanata {version.kanata} · {version.sha.slice(0, 8)}</p><Button onClick={onCheck}>Check for update</Button></section>; }
