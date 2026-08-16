use std::{fs, io::Write, path::Path};

use serde::{Deserialize, Serialize};

use crate::domain::{StudioProfile, global_profile};

use super::{StorageError, StudioPaths, ensure_parent};

const PROFILE_SCHEMA: u32 = 1;

#[derive(Serialize, Deserialize)]
struct ProfilesFile {
    schema_version: u32,
    profiles: Vec<StudioProfile>,
}

pub trait ProfileRepository {
    fn load_all(&self) -> Result<Vec<StudioProfile>, StorageError>;
    fn save_all(&self, profiles: &[StudioProfile]) -> Result<(), StorageError>;
}

#[derive(Clone)]
pub struct JsonProfileStore {
    paths: StudioPaths,
}

impl JsonProfileStore {
    pub fn new(paths: StudioPaths) -> Self {
        Self { paths }
    }
}

pub fn write_atomic(path: &Path, text: &str) -> Result<(), StorageError> {
    write_atomic_bytes(path, text.as_bytes())
}

fn write_atomic_bytes(path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    ensure_parent(path)?;
    let temp = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }

    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path)?;
    }
    fs::rename(temp, path)?;
    Ok(())
}

impl ProfileRepository for JsonProfileStore {
    fn load_all(&self) -> Result<Vec<StudioProfile>, StorageError> {
        let path = self.paths.profiles();
        if !path.exists() {
            let profiles = vec![global_profile()];
            self.save_all(&profiles)?;
            return Ok(profiles);
        }

        let file: ProfilesFile = serde_json::from_slice(&fs::read(path)?)?;
        if file.schema_version != PROFILE_SCHEMA {
            return Err(StorageError::UnsupportedSchema(file.schema_version));
        }
        Ok(file.profiles)
    }

    fn save_all(&self, profiles: &[StudioProfile]) -> Result<(), StorageError> {
        let envelope = ProfilesFile {
            schema_version: PROFILE_SCHEMA,
            profiles: profiles.to_vec(),
        };
        let bytes = serde_json::to_vec_pretty(&envelope)?;
        write_atomic_bytes(&self.paths.profiles(), &bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_content() {
        let root = std::env::temp_dir().join(format!("kanata-studio-{}", std::process::id()));
        let path = root.join("runtime.kbd");
        write_atomic(&path, "one").unwrap();
        write_atomic(&path, "two").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "two");
        let _ = std::fs::remove_dir_all(root);
    }
}
