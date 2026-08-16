use std::{
    io::{BufRead, BufReader, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    path::Path,
    time::{Duration, Instant},
};

use kanata_tcp_protocol::{ClientMessage, FakeKeyActionMessage, ServerMessage};

use super::EngineError;

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

    pub fn write_message(&mut self, message: &ClientMessage) -> Result<(), EngineError> {
        let mut bytes = serde_json::to_vec(message)?;
        bytes.push(b'\n');
        self.writer.write_all(&bytes)?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn read_message(&mut self) -> Result<ServerMessage, EngineError> {
        let mut line = String::new();
        let read = self.reader.read_line(&mut line)?;
        if read == 0 {
            return Err(EngineError::Protocol("Kanata TCP connection closed".into()));
        }
        let message = serde_json::from_str::<ServerMessage>(line.trim())?;
        if let ServerMessage::Error { msg } = &message {
            return Err(EngineError::Server(msg.clone()));
        }
        Ok(message)
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
                ServerMessage::ReloadResult { ok: true, .. }
                | ServerMessage::ConfigFileReload { .. } => return Ok(()),
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
