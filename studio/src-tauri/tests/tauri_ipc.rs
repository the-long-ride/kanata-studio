#[cfg(not(target_os = "windows"))]
mod mock_ipc {
    use kanata_studio::validation::ValidationResult;
    use tauri::{
        WebviewWindowBuilder,
        ipc::{CallbackFn, InvokeBody},
        test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets},
        webview::InvokeRequest,
    };

    fn invoke(body: serde_json::Value) -> ValidationResult {
        let app = mock_builder()
            .invoke_handler(tauri::generate_handler![
                kanata_studio::commands::validate_raw_profile
            ])
            .build(mock_context(noop_assets()))
            .expect("mock Tauri app builds");
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("mock webview builds");
        let response = get_ipc_response(
            &webview,
            InvokeRequest {
                cmd: "validate_raw_profile".into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .expect("IPC command succeeds");
        response.deserialize().expect("response deserializes")
    }

    #[test]
    fn tauri_ipc_accepts_valid_raw_kanata_config() {
        let result = invoke(serde_json::json!({
            "input": {"text": "(defsrc)\n(deflayermap (base) caps esc)"}
        }));
        assert!(result.ok, "{:?}", result.message);
    }

    #[test]
    fn tauri_ipc_returns_validation_error_for_invalid_config() {
        let result = invoke(serde_json::json!({"input": {"text": "(defsrc caps"}}));
        assert!(!result.ok);
        assert!(result.message.is_some());
    }
}

#[cfg(target_os = "windows")]
mod windows_command_contract {
    use kanata_studio::commands::{ValidateRawInput, validate_raw_profile};

    #[test]
    fn validates_valid_raw_kanata_config_without_native_webview() {
        let result = validate_raw_profile(ValidateRawInput {
            text: "(defsrc)\n(deflayermap (base) caps esc)".into(),
        });
        assert!(result.ok, "{:?}", result.message);
    }

    #[test]
    fn returns_validation_error_without_native_webview() {
        let result = validate_raw_profile(ValidateRawInput {
            text: "(defsrc caps".into(),
        });
        assert!(!result.ok);
        assert!(result.message.is_some());
    }
}
