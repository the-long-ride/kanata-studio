import { useState } from 'react';
import { Button } from '../../components/Button';

export function ProfileStep({ onFinish, busy }: {
    onFinish: (p?: { name: string; exe: string; }) => void;
    busy: boolean;
}) {
    const [exe, setExe] = useState('');
    const profile = exe ? { name: exe.replace(/\.exe$/i, ''), exe } : undefined;
    return <><h2>First app profile</h2><p className="sub">Optional. Global works everywhere.</p><input className="ui-input" value={exe} onChange={e => setExe(e.target.value)} placeholder="Code.exe"/><div><Button disabled={busy} onClick={() => onFinish()}>Use Global only</Button> <Button className="primary" disabled={busy} onClick={() => onFinish(profile)}>{busy ? 'Finishing…' : 'Finish'}</Button></div></>;
}
