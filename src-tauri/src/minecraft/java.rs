use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;
use zip::ZipArchive;
use super::ProgressPayload;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallation {
    pub path: String,
    pub version: String,
    pub major: u32,
}

#[tauri::command]
pub async fn detect_java() -> Result<Vec<JavaInstallation>, String> {
    let mut installations = vec![];
    let mut search_paths = vec![];

    // 1. 常見系統路徑
    let paths = vec![
        PathBuf::from("C:\\Program Files\\Java"),
        PathBuf::from("C:\\Program Files (x86)\\Java"),
        PathBuf::from("C:\\Program Files\\Eclipse Adoptium"),
        PathBuf::from("C:\\Program Files\\BellSoft"),
    ];

    for path in paths {
        if path.exists() {
            search_paths.push(path);
        }
    }

    // 2. launcher 自載的 java 路徑
    if let Ok(base_dir) = crate::get_app_dir() {
        let launcher_java_dir = base_dir.join("java");
        if launcher_java_dir.exists() {
            search_paths.push(launcher_java_dir);
        }
    }

    // 3. JAVA_HOME 環境變數
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(java_home);
        if p.exists() {
            search_paths.push(p);
        }
    }

    // 遞迴尋找 java.exe
    let mut checked_paths = std::collections::HashSet::new();

    for base_path in search_paths {
        find_java_executables(&base_path, 0, &mut checked_paths);
    }

    // 檢查每一個找到的 java.exe 的版本
    for java_path in checked_paths {
        if let Some(install) = check_java_version(&java_path) {
            installations.push(install);
        }
    }

    Ok(installations)
}

fn find_java_executables(dir: &Path, depth: u32, results: &mut std::collections::HashSet<String>) {
    if depth > 4 {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                find_java_executables(&path, depth + 1, results);
            } else if path.is_file() {
                if let Some(file_name) = path.file_name() {
                    if file_name.eq_ignore_ascii_case("java.exe") {
                        results.insert(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
}

fn check_java_version(java_path: &str) -> Option<JavaInstallation> {
    let output = super::create_command(java_path).arg("-version").output().ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    let first_line = stderr.lines().next()?;

    // 解析 java version "..." 或 openjdk version "..."
    let parts: Vec<&str> = first_line.split('"').collect();
    if parts.len() >= 2 {
        let version_str = parts[1];
        let major = parse_major_java_version(version_str);
        return Some(JavaInstallation {
            path: java_path.to_string(),
            version: version_str.to_string(),
            major,
        });
    }
    None
}

fn parse_major_java_version(version_str: &str) -> u32 {
    // 範例: "1.8.0_381" -> 8
    // 範例: "17.0.8" -> 17
    let parts: Vec<&str> = version_str.split('.').collect();
    if parts.is_empty() {
        return 0;
    }
    if parts[0] == "1" && parts.len() > 1 {
        parts[1].parse::<u32>().unwrap_or(8)
    } else {
        parts[0].parse::<u32>().unwrap_or(0)
    }
}

#[tauri::command]
pub async fn download_java(
    app: AppHandle,
    major_version: u32,
    instance_id: Option<String>,
) -> Result<String, String> {
    let base_dir = crate::get_app_dir()?;
    let java_base_dir = base_dir.join("java");
    fs::create_dir_all(&java_base_dir).map_err(|e| format!("無法建立 Java 目錄: {}", e))?;

    let download_url = format!(
        "https://api.adoptium.net/v3/binary/latest/{}/ga/windows/x64/jre/hotspot/normal/eclipse",
        major_version
    );

    let dest_dir = java_base_dir.join(format!("jre_{}", major_version));
    if dest_dir.exists() {
        let java_exe = dest_dir.join("bin").join("java.exe");
        if java_exe.exists() {
            return Ok(java_exe.to_string_lossy().to_string());
        }
        let _ = fs::remove_dir_all(&dest_dir);
    }

    let mut params = std::collections::HashMap::new();
    params.insert("version".to_string(), major_version.to_string());
    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: instance_id.clone(),
            status: "java_downloading".to_string(),
            progress: 0.0,
            detail: format!("準備下載 JRE {}...", major_version),
            status_code: Some("status.jre.preparing".to_string()),
            status_params: Some(params),
        },
    )
    .ok();

    let client = crate::get_client().clone();
    let mut response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("請求 Adoptium API 失敗: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Adoptium API 回傳錯誤: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(50 * 1024 * 1024); // 預估 50MB
    let mut downloaded = 0u64;
    let temp_zip_path = java_base_dir.join(format!("temp_jre_{}.zip", major_version));
    let mut temp_file =
        fs::File::create(&temp_zip_path).map_err(|e| format!("建立暫存檔失敗: {}", e))?;

    use std::io::Write;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("下載 JRE 失敗: {}", e))?
    {
        temp_file
            .write_all(&chunk)
            .map_err(|e| format!("寫入 JRE 失敗: {}", e))?;
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: instance_id.clone(),
                status: "java_downloading".to_string(),
                progress,
                detail: format!(
                    "已下載 {:.1} MB / {:.1} MB",
                    downloaded as f64 / 1024.0 / 1024.0,
                    total_size as f64 / 1024.0 / 1024.0
                ),
                ..Default::default()
            },
        )
        .ok();
    }
    drop(temp_file);

    // 解壓縮 JRE
    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: instance_id.clone(),
            status: "java_extracting".to_string(),
            progress: 100.0,
            detail: "正在解壓縮 JRE，這可能需要一點時間...".to_string(),
            ..Default::default()
        },
    )
    .ok();

    let zip_file =
        fs::File::open(&temp_zip_path).map_err(|e| format!("無法開啟 JRE zip: {}", e))?;
    let mut archive = ZipArchive::new(zip_file).map_err(|e| format!("解析 JRE zip 失敗: {}", e))?;

    fs::create_dir_all(&dest_dir).map_err(|e| format!("建立 JRE 解壓縮資料夾失敗: {}", e))?;

    let mut root_dir_name = String::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("讀取 zip 項目失敗: {}", e))?;
        if entry.is_dir() {
            let path = entry.name();
            if root_dir_name.is_empty() {
                root_dir_name = path.to_string();
                break;
            }
        }
    }

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("讀取 zip 項目失敗: {}", e))?;
        let entry_name = entry.name();

        let relative_path = if !root_dir_name.is_empty() && entry_name.starts_with(&root_dir_name) {
            &entry_name[root_dir_name.len()..]
        } else {
            entry_name
        };

        if relative_path.is_empty() {
            continue;
        }

        let out_path = dest_dir.join(relative_path);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("建立檔案失敗 {}: {}", relative_path, e))?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| format!("解壓檔案失敗: {}", e))?;
        }
    }

    let _ = fs::remove_file(&temp_zip_path);

    let java_exe = dest_dir.join("bin").join("java.exe");
    if java_exe.exists() {
        Ok(java_exe.to_string_lossy().to_string())
    } else {
        Err("找不到 java.exe。解壓失敗或架構不相容。".to_string())
    }
}

#[tauri::command]
pub async fn verify_custom_java(path: String) -> Result<Option<JavaInstallation>, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(None);
    }
    Ok(check_java_version(&path))
}

// ==================== 單元測試 ====================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_major_java_version() {
        assert_eq!(parse_major_java_version("1.8.0_381"), 8);
        assert_eq!(parse_major_java_version("17.0.8"), 17);
        assert_eq!(parse_major_java_version("1.7.0_80"), 7);
        assert_eq!(parse_major_java_version("21.0.1"), 21);
        assert_eq!(parse_major_java_version("invalid"), 0);
    }
}
