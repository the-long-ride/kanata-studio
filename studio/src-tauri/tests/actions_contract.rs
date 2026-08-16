use std::{collections::BTreeMap, sync::Mutex};

use kanata_studio::{
    actions::{dispatch_message, ActionError, ExternalActionExecutor},
    compiler::StudioExternalAction,
    engine::EngineId,
};

#[derive(Default)]
struct RecordingExecutor {
    seen: Mutex<Vec<(String, StudioExternalAction)>>,
}

impl ExternalActionExecutor for RecordingExecutor {
    fn execute(
        &self,
        engine_id: &EngineId,
        action: &StudioExternalAction,
    ) -> Result<(), ActionError> {
        self.seen.lock().unwrap().push((engine_id.0.clone(), action.clone()));
        Ok(())
    }
}

#[test]
fn registered_push_message_dispatches_exact_typed_action() {
    let action = StudioExternalAction::OpenUrl { url: "https://example.com".into() };
    let registry = BTreeMap::from([("abc".into(), action.clone())]);
    let executor = RecordingExecutor::default();
    dispatch_message(
        &EngineId("all".into()),
        &serde_json::json!(["kanata-studio", "action", "abc"]),
        &registry,
        &executor,
    )
    .unwrap();
    let seen = executor.seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    assert_eq!(seen[0].0, "all");
    assert!(matches!(&seen[0].1, StudioExternalAction::OpenUrl { url } if url == "https://example.com"));
}

#[test]
fn unknown_action_id_is_rejected() {
    let error = dispatch_message(
        &EngineId("all".into()),
        &serde_json::json!(["kanata-studio", "action", "missing"]),
        &BTreeMap::new(),
        &RecordingExecutor::default(),
    )
    .unwrap_err();
    assert!(matches!(error, ActionError::Unknown(id) if id == "missing"));
}

#[test]
fn malformed_unscoped_message_is_rejected() {
    let error = dispatch_message(
        &EngineId("all".into()),
        &serde_json::json!(["other-app", "action", "abc"]),
        &BTreeMap::new(),
        &RecordingExecutor::default(),
    )
    .unwrap_err();
    assert!(matches!(error, ActionError::Malformed));
}
