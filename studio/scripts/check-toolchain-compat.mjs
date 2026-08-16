import fs from 'node:fs';

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const packageJson = readJson('../package.json');
const tsconfig = readJson('../tsconfig.json');
const nodeConfig = readJson('../tsconfig.node.json');

const expectedTypeScript = '6.0.3';
const actualTypeScript = packageJson.devDependencies?.typescript;

if (actualTypeScript !== expectedTypeScript) {
  fail(
    `TypeScript must remain pinned to ${expectedTypeScript} until typescript-eslint supports TypeScript 7. ` +
      `Found: ${String(actualTypeScript)}`,
  );
}

const nodeOptions = nodeConfig.compilerOptions ?? {};

const references = tsconfig.references ?? [];
const nodeConfigIsReferenced = references.some(
  (reference) => reference.path === './tsconfig.node.json',
);
if (nodeConfigIsReferenced && nodeOptions.noEmit) {
  fail(
    'Referenced tsconfig.node.json must emit declarations; noEmit triggers TS6310.',
  );
}
if (nodeConfigIsReferenced && !nodeOptions.emitDeclarationOnly) {
  fail(
    'Referenced tsconfig.node.json must use emitDeclarationOnly to avoid JavaScript build artifacts.',
  );
}
if (
  nodeOptions.allowImportingTsExtensions &&
  !nodeOptions.noEmit &&
  !nodeOptions.emitDeclarationOnly &&
  !nodeOptions.rewriteRelativeImportExtensions
) {
  fail(
    'tsconfig.node.json enables allowImportingTsExtensions without noEmit, ' +
      'emitDeclarationOnly, or rewriteRelativeImportExtensions.',
  );
}

const appTypes = new Set(tsconfig.compilerOptions?.types ?? []);
for (const requiredType of ['node', 'vite/client']) {
  if (!appTypes.has(requiredType)) {
    fail(`tsconfig.json must include ${requiredType} in compilerOptions.types.`);
  }
}

const testSetup = fs.readFileSync(
  new URL('../src/test/setup.ts', import.meta.url),
  'utf8',
);
if (testSetup.includes('randomFillSync')) {
  fail(
    'src/test/setup.ts must use node:crypto webcrypto directly; ' +
      'randomFillSync conflicts with DOM ArrayBufferView types.',
  );
}
if (!testSetup.includes("import { webcrypto } from 'node:crypto'")) {
  fail('src/test/setup.ts must import webcrypto from node:crypto.');
}

const capabilitiesSource = fs.readFileSync(
  new URL('../src-tauri/src/platform/capabilities.rs', import.meta.url),
  'utf8',
);
if (!capabilitiesSource.includes('Foundation::FreeLibrary')) {
  fail(
    'Windows FreeLibrary must be imported from Win32::Foundation for windows-sys 0.52.',
  );
}

for (const iconName of ['32x32.png', '128x128.png']) {
  const bytes = fs.readFileSync(
    new URL(`../src-tauri/icons/${iconName}`, import.meta.url),
  );
  if (bytes.length < 26 || bytes[25] !== 6) {
    fail(`${iconName} must be an RGBA PNG (PNG color type 6) for Tauri.`);
  }
}

console.log(`Toolchain compatibility OK: TypeScript ${actualTypeScript}`);
