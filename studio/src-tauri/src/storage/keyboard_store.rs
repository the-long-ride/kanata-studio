use serde::{Deserialize, Serialize};

use crate::domain::ConfiguredKeyboard;

use super::{StorageError, StudioPaths, profile_store::write_atomic};

const KEYBOARD_SCHEMA: u32 = 1;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyboardsFile {
    schema_version: u32,
    keyboards: Vec<ConfiguredKeyboard>,
}

#[derive(Clone)]
pub struct JsonKeyboardStore {
    paths: StudioPaths,
}

impl JsonKeyboardStore {
    pub fn new(paths: StudioPaths) -> Self {
        Self { paths }
    }

    pub fn load_all(&self) -> Result<Vec<ConfiguredKeyboard>, StorageError> {
        let path = self.paths.keyboards();
        if !path.exists() {
            self.save_all(&[])?;
            return Ok(Vec::new());
        }
        let file: KeyboardsFile = serde_json::from_slice(&std::fs::read(path)?)?;
        if file.schema_version != KEYBOARD_SCHEMA {
            return Err(StorageError::UnsupportedSchema(file.schema_version));
        }
        Ok(file.keyboards)
    }

    pub fn save_all(&self, keyboards: &[ConfiguredKeyboard]) -> Result<(), StorageError> {
        let file = KeyboardsFile {
            schema_version: KEYBOARD_SCHEMA,
            keyboards: keyboards.to_vec(),
        };
        write_atomic(
            &self.paths.keyboards(),
            &serde_json::to_string_pretty(&file)?,
        )
    }
}
