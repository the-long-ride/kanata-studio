import { cp, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = resolve(import.meta.dirname, '..');
const repo = resolve(studio, '..');
const outputDir = resolve(studio, 'src-tauri', 'binaries');
const target =
  process.env.TAURI_ENV_TARGET_TRIPLE ??
  process.env.TARGET ??
  defaultTarget();

if (!target) {
  throw new Error('Unsupported target; set TARGET explicitly.');
}

const isWindowsTarget = target.includes('windows');
const executableExtension = isWindowsTarget ? '.exe' : '';
await mkdir(outputDir, { recursive: true });

function defaultTarget() {
  if (process.platform === 'win32') return 'x86_64-pc-windows-msvc';
  if (process.platform === 'linux') return 'x86_64-unknown-linux-gnu';
  if (process.platform === 'darwin') {
    return process.arch === 'arm64'
      ? 'aarch64-apple-darwin'
      : 'x86_64-apple-darwin';
  }
  return undefined;
}

async function buildKanata(features, outputName) {
  const result = spawnSync(
    'cargo',
    ['build', '--release', '--target', target, '--features', features],
    { cwd: repo, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);

  const source = resolve(
    repo,
    'target',
    target,
    'release',
    `kanata${executableExtension}`,
  );
  const destination = resolve(
    outputDir,
    `${outputName}-${target}${executableExtension}`,
  );
  await cp(source, destination);
}

const standardFeatures = isWindowsTarget
  ? 'cmd,tcp_server,winiov2,win_manifest,studio_sidecar'
  : 'cmd,tcp_server';
await buildKanata(standardFeatures, 'kanata-engine');

if (isWindowsTarget && target.startsWith('x86_64')) {
  await buildKanata(
    'cmd,tcp_server,interception_driver,win_manifest,studio_sidecar',
    'kanata-engine-interception',
  );

  const interceptionDll = resolve(
    repo,
    'interception',
    'library',
    'x64',
    'interception.dll',
  );
  if (existsSync(interceptionDll)) {
    await cp(interceptionDll, resolve(outputDir, 'interception.dll'));
  } else {
    console.warn(
      'Interception DLL was not found; per-device Windows mode will require a separately installed DLL.',
    );
  }
}
