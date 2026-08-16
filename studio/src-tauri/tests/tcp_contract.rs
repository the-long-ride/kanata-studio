use std::{
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    path::Path,
    thread,
    time::Duration,
};

use kanata_studio::engine::tcp::KanataTcpClient;
use kanata_tcp_protocol::ServerMessage;

fn write_server_message(stream: &mut std::net::TcpStream, message: ServerMessage) {
    stream.write_all(&message.as_bytes()).unwrap();
    stream.flush().unwrap();
}

#[test]
fn tcp_client_performs_hello_and_blocking_reload_contract() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut reader = BufReader::new(stream.try_clone().unwrap());

        let mut hello = String::new();
        reader.read_line(&mut hello).unwrap();
        assert!(hello.contains("Hello"));
        write_server_message(
            &mut stream,
            ServerMessage::HelloOk {
                version: "test".into(),
                protocol: 1,
                capabilities: vec!["reload".into()],
            },
        );

        let mut reload = String::new();
        reader.read_line(&mut reload).unwrap();
        assert!(reload.contains("ReloadFile"));
        assert!(reload.contains("\"wait\":true"));
        assert!(reload.contains("\"timeout_ms\":5000"));
        assert!(reload.contains("runtime.kbd"));
        write_server_message(
            &mut stream,
            ServerMessage::ReloadResult {
                ok: true,
                timeout_ms: None,
            },
        );
    });

    let mut client = KanataTcpClient::connect(port, Duration::from_secs(1)).unwrap();
    client.hello().unwrap();
    client.reload_file(Path::new("runtime.kbd")).unwrap();
    server.join().unwrap();
}

#[test]
fn tcp_client_surfaces_rejected_reload() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut reader = BufReader::new(stream.try_clone().unwrap());
        let mut request = String::new();
        reader.read_line(&mut request).unwrap();
        write_server_message(
            &mut stream,
            ServerMessage::ReloadResult {
                ok: false,
                timeout_ms: None,
            },
        );
    });

    let mut client = KanataTcpClient::connect(port, Duration::from_secs(1)).unwrap();
    let error = client.reload_file(Path::new("bad.kbd")).unwrap_err();
    assert!(error.to_string().contains("rejected reload"));
    server.join().unwrap();
}
