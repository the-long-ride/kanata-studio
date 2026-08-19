use std::{
    io::{BufRead, BufReader, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    path::Path,
    time::{Duration, Instant},
};

use kanata_tcp_protocol::{ClientMessage, FakeKeyActionMessage, ServerMessage, ServerResponse};

use super::EngineError;

#[derive(serde::Deserialize)]
#[serde(untagged)]
enum WireMessage {
    Message(ServerMessage),
    Response(ServerResponse),
}

pub struct KanataTcpClient {
    reader: BufReader<TcpStream>,
    writer: TcpStream,
}

impl KanataTcpClient {
    pub fn connect(port: u16, connect_timeout: Duration) -> Result<Self, EngineError> {
        let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
        let stream = TcpStream::connect_timeout(&address.into(), connect_timeout)?;
        stream.set_read_timeout(Some(Duration::from_secs(6)))?;
        stream.set_write_timeout(Some(Duration::from_secs(6)))?;
        let writer = stream.try_clone()?;
        Ok(Self {
            reader: BufReader::new(stream),
            writer,
        })
    }

    pub fn connect_with_retry(port: u16, deadline: Duration) -> Result<Self, EngineError> {
        let started = Instant::now();
        loop {
            match Self::connect(port, Duration::from_millis(250)) {
                Ok(client) => return Ok(client),
                Err(error) if started.elapsed() < deadline => {
                    let _ = error;
                    std::thread::sleep(Duration::from_millis(60));
                }
                Err(error) => return Err(error),
            }
        }
    }

    pub fn reload_file_with_retry(
        port: u16,
        path: &Path,
        deadline: Duration,
    ) -> Result<(), EngineError> {
        Self::connect_with_retry(port, deadline)?.reload_file(path)
    }

    pub fn write_message(&mut self, message: &ClientMessage) -> Result<(), EngineError> {
        let mut bytes = serde_json::to_vec(message)?;
        bytes.push(b'\n');
        self.writer.write_all(&bytes)?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn read_message(&mut self) -> Result<ServerMessage, EngineError> {
        loop {
            let mut line = String::new();
            let read = self.reader.read_line(&mut line)?;
            if read == 0 {
                return Err(EngineError::Protocol("Kanata TCP connection closed".into()));
            }
            match serde_json::from_str::<WireMessage>(line.trim())? {
                WireMessage::Message(ServerMessage::Error { msg }) => {
                    return Err(EngineError::Server(msg));
                }
                WireMessage::Message(message) => return Ok(message),
                WireMessage::Response(response) => match response {
                    ServerResponse::Ok => continue,
                    ServerResponse::Error { msg } => return Err(EngineError::Server(msg)),
                },
            }
        }
    }

    pub fn hello(&mut self) -> Result<(), EngineError> {
        self.write_message(&ClientMessage::Hello {})?;
        loop {
            match self.read_message()? {
                ServerMessage::HelloOk { .. } => return Ok(()),
                ServerMessage::Error { msg } => return Err(EngineError::Server(msg)),
                _ => continue,
            }
        }
    }

    pub fn reload_file(&mut self, path: &Path) -> Result<(), EngineError> {
        self.write_message(&ClientMessage::ReloadFile {
            path: path.to_string_lossy().into_owned(),
            wait: Some(true),
            timeout_ms: Some(5_000),
        })?;
        loop {
            match self.read_message()? {
                ServerMessage::ReloadResult { ok: true, .. } => return Ok(()),
                ServerMessage::ReloadResult { ok: false, .. } => {
                    return Err(EngineError::Protocol("Kanata rejected reload".into()));
                }
                _ => continue,
            }
        }
    }

    pub fn tap_fake_key(&mut self, name: &str) -> Result<(), EngineError> {
        self.write_message(&ClientMessage::ActOnFakeKey {
            name: name.into(),
            action: FakeKeyActionMessage::Tap,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reload_waits_for_result_after_ack_and_notification() {
        use std::{net::TcpListener, sync::mpsc, thread};

        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let (notification_sent_tx, notification_sent_rx) = mpsc::channel();
        let (allow_result_tx, allow_result_rx) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut request = String::new();
            reader.read_line(&mut request).unwrap();
            stream.write_all(&ServerResponse::Ok.as_bytes()).unwrap();
            stream
                .write_all(
                    &ServerMessage::ConfigFileReload {
                        new: "runtime.kbd".into(),
                    }
                    .as_bytes(),
                )
                .unwrap();
            notification_sent_tx.send(()).unwrap();
            allow_result_rx.recv().unwrap();
            stream
                .write_all(
                    &ServerMessage::ReloadResult {
                        ok: true,
                        timeout_ms: None,
                    }
                    .as_bytes(),
                )
                .unwrap();
        });

        let (done_tx, done_rx) = mpsc::channel();
        let client = thread::spawn(move || {
            let mut client = KanataTcpClient::connect(port, Duration::from_secs(1)).unwrap();
            let result = client
                .reload_file(Path::new("runtime.kbd"))
                .map_err(|error| error.to_string());
            done_tx.send(result).unwrap();
        });

        notification_sent_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        assert!(done_rx.recv_timeout(Duration::from_millis(100)).is_err());
        allow_result_tx.send(()).unwrap();
        assert_eq!(
            done_rx.recv_timeout(Duration::from_secs(1)).unwrap(),
            Ok(())
        );
        client.join().unwrap();
        server.join().unwrap();
    }

    #[test]
    fn reload_with_retry_tolerates_listener_starting_late() {
        use std::{net::TcpListener, thread};

        let reservation = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = reservation.local_addr().unwrap().port();
        drop(reservation);

        let server = thread::spawn(move || {
            thread::sleep(Duration::from_millis(150));
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port)).unwrap();
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut request = String::new();
            reader.read_line(&mut request).unwrap();
            stream.write_all(&ServerResponse::Ok.as_bytes()).unwrap();
            stream
                .write_all(
                    &ServerMessage::ReloadResult {
                        ok: true,
                        timeout_ms: None,
                    }
                    .as_bytes(),
                )
                .unwrap();
        });

        KanataTcpClient::reload_file_with_retry(
            port,
            Path::new("runtime.kbd"),
            Duration::from_secs(1),
        )
        .unwrap();
        server.join().unwrap();
    }

    #[test]
    fn reload_message_keeps_wait_contract() {
        let message = ClientMessage::ReloadFile {
            path: "runtime.kbd".into(),
            wait: Some(true),
            timeout_ms: Some(5_000),
        };
        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("\"wait\":true"));
        assert!(json.contains("\"timeout_ms\":5000"));
    }
}
