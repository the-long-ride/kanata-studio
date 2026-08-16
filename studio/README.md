# Kanata Studio

Kanata Studio is the beginner-friendly desktop UI for this Kanata fork.

## Beginner quick start
1. Finish keyboard/permission detection.
2. Keep Start with system enabled for tray-only background startup.
3. Select Global or create an app profile.
4. Click a physical key and choose one of seven safe Beginner actions.
5. Valid changes auto-apply; invalid config never replaces last-known-good runtime state.

## Advanced
Advanced mode exposes structured layers, tap-hold, macros and native Raw `.kbd`. Converting to Raw is one-way for edit ownership: raw text becomes authoritative.

## Platform notes
- Windows: normal LLHOOK applies to all keyboards. Specific-device profiles require the Interception backend/driver; the external driver is not bundled.
- macOS: Accessibility and Karabiner VirtualHIDDevice are required. Device-aware mappings use Kanata's current macOS support.
- Linux: input/uinput permissions are required. Specific-device mappings use filtered engine processes. Unsupported Wayland environments fall back to Global/manual profile selection.

## Data and recovery
Persistent data lives in the Tauri app-data directory under `kanata-studio/`. Runtime and last-known-good `.kbd` files are separate; logs are under `logs/`.

## Upstream policy
Studio lives mostly under `studio/`. Releases record Kanata base SHA `0a391a021247aaa1cf8784dc20ef9e53a31349ca`; future upstream syncs preserve Kanata behavior first and adapt Studio second.
