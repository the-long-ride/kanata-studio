import { useState } from 'react';
import { Button } from '../../components/Button';
export function ProfileStep({ onFinish }: {
    onFinish: (p?: {
        name: string;
        exe: string;
    }) => void;
}) { const [exe, setExe] = useState(''); return <><h2>First app profile</h2><p className="sub">Optional. Global works everywhere.</p><input className="ui-input" value={exe} onChange={e => setExe(e.target.value)} placeholder="Code.exe"/><div><Button onClick={() => onFinish()}>Use Global only</Button> <Button className="primary" onClick={() => onFinish(exe ? { name: exe.replace(/\.exe$/i, ''), exe } : undefined)}>Finish</Button></div></>; }
