use std::collections::BTreeMap;

use serde_json::Value;

use crate::{compiler::StudioExternalAction, engine::EngineId};

use super::{ActionError, ExternalActionExecutor};

pub fn parse_action_id(value: &Value) -> Result<&str, ActionError> {
    let parts = value.as_array().ok_or(ActionError::Malformed)?;
    if parts.len() != 3
        || parts[0].as_str() != Some("kanata-studio")
        || parts[1].as_str() != Some("action")
    {
        return Err(ActionError::Malformed);
    }
    parts[2].as_str().ok_or(ActionError::Malformed)
}

pub fn dispatch_message(
    engine_id: &EngineId,
    value: &Value,
    registry: &BTreeMap<String, StudioExternalAction>,
    executor: &dyn ExternalActionExecutor,
) -> Result<(), ActionError> {
    let id = parse_action_id(value)?;
    let action = registry
        .get(id)
        .ok_or_else(|| ActionError::Unknown(id.to_string()))?;
    executor.execute(engine_id, action)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_studio_action_message() {
        let value = serde_json::json!(["kanata-studio", "action", "abc123"]);
        assert_eq!(parse_action_id(&value).unwrap(), "abc123");
    }

    #[test]
    fn rejects_unscoped_messages() {
        let value = serde_json::json!(["other-app", "action", "abc123"]);
        assert!(matches!(parse_action_id(&value), Err(ActionError::Malformed)));
    }
}
