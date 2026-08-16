use crate::domain::{ActionSpec, MediaAction, Modifier, Platform};

use super::{CompileError, StudioExternalAction, escape::validate_atom, register_external};

fn modifier_prefix(modifier: &Modifier) -> &'static str {
    match modifier {
        Modifier::Ctrl => "C-",
        Modifier::Shift => "S-",
        Modifier::Alt => "A-",
        Modifier::Meta => "M-",
    }
}

fn media_key(action: &MediaAction) -> &'static str {
    match action {
        MediaAction::PlayPause => "pp",
        MediaAction::Next => "next",
        MediaAction::Previous => "prev",
        MediaAction::VolumeUp => "volu",
        MediaAction::VolumeDown => "vold",
        MediaAction::Mute => "mute",
    }
}

pub fn action_expression(
    seed: &str,
    action: &ActionSpec,
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
    depth: u8,
) -> Result<String, CompileError> {
    if depth > 8 {
        return Err(CompileError::TooDeep);
    }
    match action {
        ActionSpec::Key { key } => Ok(validate_atom(key)?.into()),
        ActionSpec::Shortcut { modifiers, key } => {
            validate_atom(key)?;
            let prefix = modifiers.iter().map(modifier_prefix).collect::<String>();
            Ok(format!("{prefix}{key}"))
        }
        ActionSpec::Media { action } => Ok(media_key(action).into()),
        ActionSpec::Delay { ms } => {
            if *ms == 0 {
                return Err(CompileError::InvalidExpression(
                    "macro delay must be positive".into(),
                ));
            }
            Ok(ms.to_string())
        }
        ActionSpec::Disabled => Ok("XX".into()),
        ActionSpec::Text { text } => Ok(register_external(
            seed,
            StudioExternalAction::Text { text: text.clone() },
            external,
        )),
        ActionSpec::LaunchApp { path, args } => Ok(register_external(
            seed,
            StudioExternalAction::LaunchApp {
                path: path.clone(),
                args: args.clone(),
            },
            external,
        )),
        ActionSpec::OpenUrl { url } => Ok(register_external(
            seed,
            StudioExternalAction::OpenUrl { url: url.clone() },
            external,
        )),
        ActionSpec::Advanced { action } => {
            super::advanced::compile_advanced(seed, action, platform, external, depth + 1)
        }
    }
}

pub fn action_to_kbd(
    key: &str,
    action: &ActionSpec,
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    validate_atom(key)?;
    if matches!(action, ActionSpec::Delay { .. }) {
        return Err(CompileError::InvalidExpression(
            "delay is only valid inside a macro".into(),
        ));
    }
    let expression = action_expression(key, action, platform, external, 0)?;
    Ok(format!("  {key} {expression}"))
}
