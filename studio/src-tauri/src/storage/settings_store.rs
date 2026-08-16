use crate::domain::StudioSettings;

use super::{StorageError, StudioPaths, write_atomic};

#[derive(Clone)]
pub struct SettingsStore {
    paths: StudioPaths,
}

impl SettingsStore {
    pub fn new(paths: StudioPaths) -> Self {
        Self { paths }
    }

    pub fn load(&self) -> Result<StudioSettings, StorageError> {
        let path = self.paths.settings();
        if !path.exists() {
            let settings = StudioSettings::default();
            self.save(&settings)?;
            return Ok(settings);
        }
        Ok(serde_json::from_slice(&std::fs::read(path)?)?)
    }

    pub fn save(&self, settings: &StudioSettings) -> Result<(), StorageError> {
        write_atomic(
            &self.paths.settings(),
            &serde_json::to_string_pretty(settings)?,
        )
    }
}
