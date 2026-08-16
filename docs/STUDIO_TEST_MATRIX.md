# Kanata Studio Release Test Matrix

## Windows x64
Onboarding; Global mapping; active-app switching; tray hide/show; autostart; all-keyboard backend; Interception-required guidance for specific-device scope; NSIS/MSI install/uninstall.

## macOS arm64/x64
Accessibility guidance; VirtualHID detection; app switching; device-aware profile; tray/autostart; app/DMG install.

## Linux x64
input/uinput status; X11 app switching; Wayland manual fallback; filtered specific-device topology; AppImage/deb.

## Beginner acceptance
Install → onboarding → Caps Lock → Remap → Escape → Applied → close window → mapping continues from tray, without editing `.kbd`.

## Advanced acceptance
Layer, tap-hold, macro, convert to raw, invalid raw stays unapplied, valid raw applies, import/export `.kbd`.

## Visual
Check 1280×720, 1440×900, 1920×1080: compact header/rail/inspector, keyboard prominence, monochrome palette, no giant cards, no clipped keys or unexpected scrollbars.

## Automated Tauri contracts
Rust integration tests cover Tauri IPC, profile resolution, compiler output, storage/recovery, engine topology, typed external actions, and TCP reload behavior. Frontend tests verify React/Tauri IPC command names and argument envelopes. All native Rust tests run on Windows, macOS, and Linux in GHA.
