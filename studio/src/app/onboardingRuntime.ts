import type {
  EngineStatus,
  StudioProfile,
  StudioSettings,
} from '../lib/types';
import {
  autostartIssue,
  engineIssue,
  persistenceIssue,
  type RuntimeIssue,
} from './runtimeIssues.ts';

type FirstProfile = { name: string; executable: string };
type PersistProfileOptions = { apply: boolean };
type CompletionInput = { settings: StudioSettings; firstProfile?: FirstProfile };
type CompletionResult = { settings: StudioSettings; profile?: StudioProfile };

type CompletionDeps = {
  persistSettings: (settings: StudioSettings) => Promise<StudioSettings>;
  persistProfile: (
    profile: StudioProfile,
    options: PersistProfileOptions,
  ) => Promise<StudioProfile>;
  setStartWithSystem: (enabled: boolean) => Promise<void>;
  applyRuntime: () => Promise<EngineStatus[]>;
  makeProfile: (profile: FirstProfile) => StudioProfile;
  onPersisted: (result: CompletionResult) => void;
  onIssue: (issue: RuntimeIssue) => void;
  onRuntimeApplied?: (statuses: EngineStatus[]) => void;
};

export async function completeOnboarding(
  input: CompletionInput,
  deps: CompletionDeps,
): Promise<void> {
  let saved: StudioSettings;
  let profile: StudioProfile | undefined;
  try {
    saved = await deps.persistSettings(input.settings);
    if (input.firstProfile) {
      profile = await deps.persistProfile(
        deps.makeProfile(input.firstProfile),
        { apply: false },
      );
    }
  } catch (error) {
    deps.onIssue(persistenceIssue(
      error,
      () => completeOnboarding(input, deps),
    ));
    throw error;
  }

  deps.onPersisted({ settings: saved, profile });
  const effects = [applyAutostart(saved.startWithSystem, deps)];
  if (saved.remappingEnabled) effects.push(applyEngine(deps));
  await Promise.all(effects);
}

async function applyAutostart(
  enabled: boolean,
  deps: CompletionDeps,
): Promise<void> {
  try {
    await deps.setStartWithSystem(enabled);
  } catch (error) {
    deps.onIssue(autostartIssue(
      enabled,
      error,
      () => deps.setStartWithSystem(enabled),
    ));
  }
}

async function applyEngine(deps: CompletionDeps): Promise<void> {
  try {
    const statuses = await deps.applyRuntime();
    deps.onRuntimeApplied?.(statuses);
  } catch (error) {
    deps.onIssue(engineIssue(error, async () => {
      const statuses = await deps.applyRuntime();
      deps.onRuntimeApplied?.(statuses);
    }));
  }
}
