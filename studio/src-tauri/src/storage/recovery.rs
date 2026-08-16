use std::path::PathBuf;

use super::{StorageError, StudioPaths, write_atomic};

#[derive(Clone)]
pub struct RecoveryStore {
    paths: StudioPaths,
}

impl RecoveryStore {
    pub fn new(paths: StudioPaths) -> Self {
        Self { paths }
    }

    pub fn write_last_known_good(
        &self,
        id: &str,
        config: &str,
    ) -> Result<PathBuf, StorageError> {
        let path = self.paths.recovery(id);
        write_atomic(&path, config)?;
        Ok(path)
    }

    pub fn read_last_known_good(&self, id: &str) -> Result<Option<String>, StorageError> {
        let path = self.paths.recovery(id);
        if !path.exists() {
            return Ok(None);
        }
        Ok(Some(std::fs::read_to_string(path)?))
    }
}
