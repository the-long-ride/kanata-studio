# Tauri Test Coverage

Kanata Studio tests the desktop boundary in layers so failures point to the real subsystem.

## Rust/Tauri

- `tauri_ipc.rs`: real `#[tauri::command]` invocation through Tauri `MockRuntime`.
- `domain_resolution.rs`: Global/app/device/app+device precedence, disabled profiles, Advanced title matching, raw source-of-truth.
- `compiler_contract.rs`: Beginner and Advanced actions, safe `push-msg`, paste bridge, raw passthrough, stable hashes, validation guards.
- `storage_contract.rs`: first-run bootstrap, profile/settings persistence, last-known-good recovery, atomic writes.
- `topology_contract.rs`: Windows Interception gating, Linux filtered engines, macOS device-aware engine, unknown-device fail-closed behavior.
- `actions_contract.rs`: typed external-action dispatch and malformed/unknown message rejection.
- `tcp_contract.rs`: loopback Hello/reload handshake and rejected-reload propagation against a real local TCP listener.

The native CI job runs `cargo test -p kanata-studio --all-targets` and `cargo clippy -p kanata-studio --all-targets -- -D warnings` on Windows, macOS, and Linux.

## Frontend IPC

`src/lib/tauri.test.ts` uses Tauri's frontend `mockIPC` facility to verify every Studio wrapper sends the exact command name and camelCase argument envelope expected by the Rust command layer, including manual-profile `null` semantics.

React tests run under jsdom via `vitest.config.ts` with Tauri-compatible WebCrypto setup.

## Hardware-only acceptance

Physical keyboard interception, OS permission dialogs, and installer lifecycle remain native acceptance tests because a mock runtime cannot reproduce kernel/HID behavior. The manual platform matrix is in `docs/STUDIO_TEST_MATRIX.md`.
