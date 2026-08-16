# Kanata Studio Design

## Product
Kanata Studio is a beginner-friendly desktop UI around Kanata. The engine remains Kanata; Studio owns profile UX, active-app switching, safe actions, device capability guidance, tray/autostart, recovery, updates, and installers.

## Modes
- Beginner: keyboard-first visual editing; Global plus app profiles; app profiles inherit Global; right-side inspector; actions limited to remap, shortcut, text, launch app, open URL, media, disable.
- Advanced: structured layers/tap-hold/chords/macros/sequences/mouse/commands/device rules plus Raw `.kbd`. After conversion to Raw, `.kbd` is authoritative and visual editing is read-only.

## Runtime
Visual profiles compile to `.kbd`, validate with `kanata-parser`, and activate through loopback-only Kanata TCP reload. Candidate configs never replace last-known-good state until validation and activation succeed. Device-related scope changes restart engines because Kanata does not live-reload device configuration.

## Platform truth
- Windows standard backend cannot distinguish physical keyboards. Specific-device profiles require Interception; the driver is never bundled.
- macOS uses Kanata device-aware configuration and requires Accessibility plus the virtual HID driver.
- Linux uses filtered engines for specific devices. On unsupported Wayland desktops, automatic per-app switching is disabled rather than guessed.

## UX
Compact xAI-inspired monochrome tool UI: 44px header, 34px sidebar rows, 30–32px controls, 184px profile rail, 300px inspector, 4/8/12px spacing. No large-card dashboard treatment.

## Lifecycle
Start with OS defaults on. Autostart is tray-only and remapping active. Closing the window hides it. Explicit Quit stops engines. App and bundled Kanata engine update together.

## Engineering guardrails
Studio TS/TSX <=250 physical lines, CSS <=300, Rust <=300, tests <=400. Existing upstream Kanata files are excluded from Studio LOC rules. Native installer CI targets Windows x64 NSIS+MSI, macOS arm64/x64 app+DMG, Linux x64 AppImage+deb.
