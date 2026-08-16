use std::net::{Ipv4Addr, TcpListener};

pub fn allocate_loopback_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    listener.local_addr().map(|address| address.port())
}
