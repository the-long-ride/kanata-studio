import test from 'node:test';
import assert from 'node:assert/strict';
import { completeOnboarding } from '../src/app/onboardingRuntime.ts';
import { enqueueIssue } from '../src/app/runtimeIssues.ts';

const settings = {
  onboardingCompleted: true,
  startWithSystem: true,
  remappingEnabled: true,
  deviceLayoutOverrides: {},
  uiMode: 'Beginner',
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('onboarding persists before starting autostart and runtime side effects', async () => {
  const order = [];
  const autostart = deferred();
  const runtime = deferred();
  let persisted;

  const completion = completeOnboarding(
    { settings, firstProfile: { name: 'Code', executable: 'Code.exe' } },
    {
      persistSettings: async (value) => {
        order.push('settings');
        return value;
      },
      persistProfile: async (profile, options) => {
        order.push(`profile:${options.apply}`);
        return { ...profile, id: 'profile-code', revision: 0 };
      },
      setStartWithSystem: async () => {
        order.push('autostart');
        await autostart.promise;
      },
      applyRuntime: async () => {
        order.push('runtime');
        await runtime.promise;
        return [];
      },
      onPersisted: (result) => {
        order.push('persisted');
        persisted = result;
      },
      onIssue: () => assert.fail('no issue expected'),
      makeProfile: ({ name, executable }) => ({
        id: 'draft',
        revision: 0,
        name,
        enabled: true,
        appMatcher: { executable, windowTitleContains: null },
        deviceTarget: { kind: 'all' },
        source: { kind: 'visual', mappings: {}, advanced: { layers: [] } },
      }),
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order.slice(0, 3), ['settings', 'profile:false', 'persisted']);
  assert.equal(persisted.profile.id, 'profile-code');
  assert.ok(order.includes('autostart'));
  assert.ok(order.includes('runtime'));

  autostart.resolve();
  runtime.resolve();
  await completion;
});

test('runtime failures are reported after onboarding has already persisted', async () => {
  const events = [];
  const issues = [];

  await completeOnboarding(
    { settings, firstProfile: undefined },
    {
      persistSettings: async (value) => value,
      persistProfile: async () => assert.fail('profile persistence should not run'),
      setStartWithSystem: async () => {
        throw new Error('registry denied');
      },
      applyRuntime: async () => {
        throw new Error('tcp hello timed out');
      },
      onPersisted: () => events.push('persisted'),
      onIssue: (issue) => {
        events.push(issue.kind);
        issues.push(issue);
      },
      makeProfile: () => assert.fail('profile factory should not run'),
    },
  );

  assert.equal(events[0], 'persisted');
  assert.deepEqual(new Set(events.slice(1)), new Set(['autostart', 'engine']));
  assert.equal(issues.find((issue) => issue.kind === 'autostart').title, 'Could not enable Start with system');
  assert.equal(issues.find((issue) => issue.kind === 'engine').title, 'Kanata engine could not start');
  assert.match(issues.find((issue) => issue.kind === 'engine').technicalDetails, /tcp hello timed out/);
});

test('issue queue coalesces duplicate stable keys while keeping newest details', () => {
  const first = {
    key: 'engine-startup',
    kind: 'engine',
    title: 'Kanata engine could not start',
    message: 'Remapping is not active.',
    technicalDetails: 'first',
  };
  const second = { ...first, technicalDetails: 'second' };
  const queue = enqueueIssue(enqueueIssue([], first), second);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].technicalDetails, 'second');
});

import fs from 'node:fs';
const readSource = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('runtime error dialog exposes immediate recovery actions and technical details', () => {
  const dialog = readSource('../src/features/status/RuntimeErrorDialog.tsx');
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /Retry/);
  assert.match(dialog, /Open logs/);
  assert.match(dialog, /Dismiss/);
  assert.match(dialog, /<details/);
  assert.match(dialog, /Technical details/);
});

test('App routes onboarding and bootstrap runtime failures through the shared dialog', () => {
  const app = readSource('../src/app/App.tsx');
  assert.match(app, /completeOnboarding/);
  assert.match(app, /setStartWithSystem/);
  assert.match(app, /applyRuntime/);
  assert.match(app, /openLogs/);
  assert.match(app, /RuntimeErrorDialog/);
  assert.match(app, /RecoveryRequired/);
});

test('engine issue retry retries only runtime activation and reports recovered status', async () => {
  const issues = [];
  const applied = [];
  let runtimeAttempts = 0;
  let settingsWrites = 0;

  await completeOnboarding(
    { settings, firstProfile: undefined },
    {
      persistSettings: async (value) => {
        settingsWrites += 1;
        return value;
      },
      persistProfile: async () => assert.fail('profile persistence should not run'),
      setStartWithSystem: async () => {},
      applyRuntime: async () => {
        runtimeAttempts += 1;
        if (runtimeAttempts === 1) throw new Error('first startup failed');
        return [{ id: 'global', state: 'Running' }];
      },
      onPersisted: () => {},
      onIssue: (issue) => issues.push(issue),
      onRuntimeApplied: (statuses) => applied.push(statuses),
      makeProfile: () => assert.fail('profile factory should not run'),
    },
  );

  const issue = issues.find((item) => item.kind === 'engine');
  assert.equal(typeof issue.retry, 'function');
  await issue.retry();
  assert.equal(runtimeAttempts, 2);
  assert.equal(settingsWrites, 1, 'engine retry must not repeat onboarding persistence');
  assert.equal(applied.at(-1)[0].state, 'Running');
});

test('final onboarding step prevents duplicate submissions while persistence is running', () => {
  const profileStep = readSource('../src/features/onboarding/ProfileStep.tsx');
  const onboarding = readSource('../src/features/onboarding/Onboarding.tsx');
  const app = readSource('../src/app/App.tsx');
  assert.match(profileStep, /disabled=\{busy\}/);
  assert.match(profileStep, /Finishing…/);
  assert.match(onboarding, /busy=\{busy\}/);
  assert.match(app, /onboardingBusy/);
});
