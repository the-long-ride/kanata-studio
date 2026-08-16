import { useState } from 'react';
import type { CapabilitySet, KeyboardDevice, StudioSettings } from '../../lib/types';
import { DeviceStep } from './DeviceStep';
import { StartupStep } from './StartupStep';
import { ProfileStep } from './ProfileStep';
import './onboarding.css';
export function Onboarding({ devices, capabilities, settings, onFinish }: {
    devices: KeyboardDevice[];
    capabilities: CapabilitySet;
    settings: StudioSettings;
    onFinish: (s: StudioSettings, profile?: {
        name: string;
        exe: string;
    }) => void;
}) { const [step, setStep] = useState(0); const [start, setStart] = useState(settings.startWithSystem); const content = step === 0 ? <DeviceStep devices={devices} capabilities={capabilities} onNext={() => setStep(1)}/> : step === 1 ? <StartupStep value={start} onChange={setStart} onNext={() => setStep(2)}/> : <ProfileStep onFinish={p => onFinish({ ...settings, startWithSystem: start, onboardingCompleted: true }, p)}/>; return <div className="onboarding-wrap"><section className="onboarding"><div className="onboarding-progress">{step + 1} / 3</div>{content}</section></div>; }
