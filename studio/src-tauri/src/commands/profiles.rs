use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app_state::AppState,
    domain::{StudioProfile, validate_profile_set},
    runtime::apply_current_context,
    storage::ProfileRepository,
    validation::ValidationResult,
};

#[derive(Deserialize)]
pub struct CreateProfileInput {
    pub profile: StudioProfile,
    #[serde(default = "default_apply")]
    pub apply: bool,
}

fn default_apply() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileInput {
    pub profile: StudioProfile,
    pub expected_revision: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub profile: StudioProfile,
    pub validation: ValidationResult,
    pub engine_statuses: Vec<crate::engine::EngineStatus>,
    pub applied: bool,
}

#[tauri::command(async)]
pub fn create_profile(
    state: State<'_, AppState>,
    input: CreateProfileInput,
) -> Result<StudioProfile, String> {
    let mut next = state.profiles.read().clone();
    if next.iter().any(|profile| profile.id == input.profile.id) {
        return Err("profile id already exists".into());
    }
    next.push(input.profile.clone());
    if input.apply {
        commit_profile_set(&state, next)?;
    } else {
        persist_profile_set(&state, next)?;
    }
    Ok(input.profile)
}

#[tauri::command(async)]
pub fn update_profile(
    state: State<'_, AppState>,
    input: UpdateProfileInput,
) -> Result<ApplyResult, String> {
    let current = state.profiles.read().clone();
    let old = current
        .iter()
        .find(|profile| profile.id == input.profile.id)
        .ok_or("profile not found")?;
    if old.revision != input.expected_revision {
        return Err("stale revision; reload the profile before saving".into());
    }

    let mut candidate = input.profile;
    candidate.revision = old.revision + 1;
    let mut next = current;
    *next
        .iter_mut()
        .find(|profile| profile.id == candidate.id)
        .expect("profile exists") = candidate.clone();
    commit_profile_set(&state, next)?;

    Ok(ApplyResult {
        profile: candidate,
        validation: ValidationResult::ok(),
        engine_statuses: state.engine_statuses(),
        applied: true,
    })
}

#[tauri::command(async)]
pub fn delete_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if id == "global" {
        return Err("Global cannot be deleted".into());
    }
    let mut next = state.profiles.read().clone();
    let before = next.len();
    next.retain(|profile| profile.id != id);
    if next.len() == before {
        return Err("profile not found".into());
    }
    commit_profile_set(&state, next)
}

pub(crate) fn persist_profile_set(
    state: &AppState,
    next: Vec<StudioProfile>,
) -> Result<(), String> {
    validate_profile_set(&next).map_err(|error| error.to_string())?;
    state
        .profile_store
        .save_all(&next)
        .map_err(|error| error.to_string())?;
    *state.profiles.write() = next;
    Ok(())
}

pub(crate) fn commit_profile_set(state: &AppState, next: Vec<StudioProfile>) -> Result<(), String> {
    validate_profile_set(&next).map_err(|error| error.to_string())?;
    let previous = state.profiles.read().clone();
    *state.profiles.write() = next.clone();

    if let Err(error) = apply_current_context(state) {
        *state.profiles.write() = previous;
        let _ = apply_current_context(state);
        return Err(error.to_string());
    }
    if let Err(error) = state.profile_store.save_all(&next) {
        *state.profiles.write() = previous;
        let _ = apply_current_context(state);
        return Err(error.to_string());
    }
    Ok(())
}
