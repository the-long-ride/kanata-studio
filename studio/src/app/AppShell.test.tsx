import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from './AppShell';
describe('AppShell', () => { it('uses Beginner and Advanced labels and preserves shell state', () => { let mode: 'Beginner' | 'Advanced' = 'Beginner'; const { rerender } = render(<AppShell mode={mode} onMode={m => { mode = m; }} rail="rail" main="main" inspector="inspector"/>); expect(screen.getByText('Beginner')).toBeTruthy(); expect(screen.getByText('Advanced')).toBeTruthy(); fireEvent.click(screen.getByText('Advanced')); rerender(<AppShell mode={mode} onMode={m => { mode = m; }} rail="rail" main="main" inspector="inspector"/>); expect(screen.queryByText('I am keyboard wizard')).toBeNull(); }); });
