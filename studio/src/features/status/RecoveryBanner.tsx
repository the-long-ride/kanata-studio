import { Button } from '../../components/Button';
export function RecoveryBanner({ message, onRestart, onRestore, onDisable, onLogs }: {
    message: string;
    onRestart: () => void;
    onRestore: () => void;
    onDisable: () => void;
    onLogs: () => void;
}) { return <div className="recovery-banner"><b>Remapping needs attention</b><span>{message}</span><Button onClick={onRestart}>Restart engine</Button><Button onClick={onRestore}>Restore last-known-good</Button><Button onClick={onDisable}>Disable</Button><Button onClick={onLogs}>Logs</Button></div>; }
