#![allow(dead_code)]

mod java;
pub use java::*;

mod downloader;
pub use downloader::*;

mod watcher;
pub use watcher::*;

mod integrations;
pub use integrations::*;

mod instance;
pub use instance::*;

mod launcher;
pub use launcher::*;

pub(crate) fn create_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // 隱藏主控台視窗
    }
    cmd
}
