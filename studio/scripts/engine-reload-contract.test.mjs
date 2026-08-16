import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Studio reload client accepts legacy OK acknowledgement frames', () => {
  const source = read('../src-tauri/src/engine/tcp.rs');
  assert.match(source, /ServerResponse::Ok\s*=>\s*continue/);
});

test('reload wait wakes Kanata processing loop before polling completion', () => {
  const source = read('../../src/tcp_server.rs');
  const handler = source.match(/fn handle_reload_with_wait[\s\S]*?\n}\n/)[0];
  const wake = handler.indexOf('wake_processing_loop');
  const poll = handler.indexOf('while start.elapsed()');
  assert.ok(wake >= 0, 'reload handler must wake the processing loop');
  assert.ok(poll >= 0, 'reload handler must poll for completion');
  assert.ok(wake < poll, 'processing loop must be woken before reload wait polling begins');
});

test('Studio reload waits for ReloadResult instead of broadcast ConfigFileReload', () => {
  const source = read('../src-tauri/src/engine/tcp.rs');
  const body = source.match(/pub fn reload_file[\s\S]*?\n {4}}\n/)[0];
  assert.ok(
    !body.includes('ServerMessage::ConfigFileReload'),
    'ConfigFileReload is a broadcast notification, not the request completion frame',
  );
});
