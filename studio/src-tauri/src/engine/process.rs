use std::{
    sync::{Arc, Weak},
    time::Duration,
};

use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

use super::{
    EngineError, EngineId, EngineSpec, KanataTcpClient, LocalSupervisor, logs::append_engine_log,
};

pub(crate) fn spawn_sidecar(
    supervisor: &Arc<LocalSupervisor>,
    spec: &EngineSpec,
    port: u16,
) -> Result<CommandChild, EngineError> {
    let command = supervisor
        .app
        .shell()
        .sidecar(spec.backend.sidecar_name())
        .map_err(|error| EngineError::Process(error.to_string()))?
        .args([
            "--cfg".into(),
            spec.config_path.to_string_lossy().into_owned(),
            "--port".into(),
            format!("127.0.0.1:{port}"),
            "--no-wait".into(),
        ]);
    let (mut events, child) = command
        .spawn()
        .map_err(|error| EngineError::Process(error.to_string()))?;

    let pid = child.pid();
    let id = spec.id.clone();
    let log_path = supervisor.logs_dir.join(format!("{}.log", id.0));
    let weak = Arc::downgrade(supervisor);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            let Some(supervisor) = weak.upgrade() else {
                break;
            };
            match event {
                CommandEvent::Stdout(bytes) => {
                    let _ = append_engine_log(&log_path, &String::from_utf8_lossy(&bytes));
                }
                CommandEvent::Stderr(bytes) => {
                    let line = format!("ERROR {}", String::from_utf8_lossy(&bytes));
                    let _ = append_engine_log(&log_path, &line);
                }
                CommandEvent::Error(error) => {
                    let _ = append_engine_log(&log_path, &format!("PROCESS ERROR {error}"));
                }
                CommandEvent::Terminated(payload) => {
                    supervisor.handle_terminated(&id, pid, payload.code);
                    break;
                }
                _ => {}
            }
        }
    });
    Ok(child)
}

pub(crate) fn start_listener(supervisor: &Arc<LocalSupervisor>, id: EngineId, port: u16) {
    let weak: Weak<LocalSupervisor> = Arc::downgrade(supervisor);
    std::thread::spawn(move || {
        let Ok(mut client) = KanataTcpClient::connect_with_retry(port, Duration::from_secs(5))
        else {
            return;
        };
        if client.hello().is_err() {
            return;
        }
        loop {
            let Ok(message) = client.read_message() else {
                return;
            };
            let Some(supervisor) = weak.upgrade() else {
                return;
            };
            if let kanata_tcp_protocol::ServerMessage::MessagePush { message } = message {
                supervisor.dispatch_action(&id, &message);
            }
        }
    });
}
