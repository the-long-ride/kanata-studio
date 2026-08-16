use crate::domain::{ActionSpec, AdvancedActionSpec, Platform};

use super::{CompileError, StudioExternalAction, basic::action_expression, escape::validate_atom};

pub fn compile_advanced(
    seed: &str,
    action: &AdvancedActionSpec,
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
    depth: u8,
) -> Result<String, CompileError> {
    if depth > 8 {
        return Err(CompileError::TooDeep);
    }

    let nested = |suffix: &str,
                  value: &ActionSpec,
                  external: &mut Vec<(String, StudioExternalAction)>|
     -> Result<String, CompileError> {
        action_expression(
            &format!("{seed}-{suffix}"),
            value,
            platform,
            external,
            depth + 1,
        )
    };

    match action {
        AdvancedActionSpec::RawAction { expression } => {
            let trimmed = expression.trim();
            if trimmed.is_empty() {
                return Err(CompileError::InvalidExpression("blank raw action".into()));
            }
            Ok(trimmed.into())
        }
        AdvancedActionSpec::TapHold {
            tap,
            hold,
            timeout_ms,
        } => {
            let tap = nested("tap", tap, external)?;
            let hold = nested("hold", hold, external)?;
            Ok(format!("(tap-hold {timeout_ms} {timeout_ms} {tap} {hold})"))
        }
        AdvancedActionSpec::Macro { actions } => {
            let mut parts = Vec::with_capacity(actions.len());
            for (index, item) in actions.iter().enumerate() {
                parts.push(nested(&format!("macro-{index}"), item, external)?);
            }
            Ok(format!("(macro {})", parts.join(" ")))
        }
        AdvancedActionSpec::LayerMomentary { layer } => {
            Ok(format!("(layer-while-held {})", validate_atom(layer)?))
        }
        AdvancedActionSpec::LayerSwitch { layer } => {
            Ok(format!("(layer-switch {})", validate_atom(layer)?))
        }
    }
}
