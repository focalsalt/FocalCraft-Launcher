use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use zip::ZipArchive;
use crate::get_app_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstanceConfig {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub id: String,
    pub name: String,
    pub version: String,
    pub modloader: String, // 模組載入器類型："Vanilla" | "Fabric" | "Forge" | "Quilt" | "NeoForge"
    pub created_time: u64,
    pub last_played: Option<u64>,
    pub play_time: Option<u64>,
    pub jvm_args: Option<String>,
    pub max_memory: Option<u32>,
    pub loader_version: Option<String>,
    pub icon: Option<String>,
    pub modrinth_project_id: Option<String>,
    pub modrinth_version_id: Option<String>,
    pub java_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfig {
    pub default_max_memory: Option<u32>,
    pub default_jvm_args: Option<String>,
    pub custom_java_path: Option<String>,
    pub instances_path: Option<String>,
    pub language: Option<String>,
    pub main_color: Option<String>,
}

pub fn get_instances_dir() -> Result<PathBuf, String> {
    let base_dir = get_app_dir()?;
    let global_cfg_path = base_dir.join("global.cfg");
    if global_cfg_path.exists() {
        if let Ok(content) = fs::read_to_string(&global_cfg_path) {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct TempGlobalConfig {
                instances_path: Option<String>,
            }
            if let Ok(g_cfg) = serde_json::from_str::<TempGlobalConfig>(&content) {
                if let Some(ref path_str) = g_cfg.instances_path {
                    if !path_str.trim().is_empty() {
                        let custom_path = PathBuf::from(path_str);
                        let _ = fs::create_dir_all(&custom_path);
                        return Ok(custom_path);
                    }
                }
            }
        }
    }
    let default_path = base_dir.join("instances");
    let _ = fs::create_dir_all(&default_path);
    Ok(default_path)
}

pub fn save_instance_config(cfg_file: &Path, cfg: &InstanceConfig) -> Result<(), String> {
    let mut cfg_to_save = cfg.clone();
    cfg_to_save.id = String::new(); // 寫入檔案前清除 ID
    let cfg_json = serde_json::to_string_pretty(&cfg_to_save)
        .map_err(|e| format!("序列化設定檔失敗: {}", e))?;
    fs::write(cfg_file, cfg_json).map_err(|e| format!("寫入設定檔失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<InstanceConfig>, String> {
    let instances_dir = get_instances_dir()?;
    if !instances_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries =
        fs::read_dir(instances_dir).map_err(|e| format!("無法讀取 instances 資料夾: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let cfg_file = path.join("instance.cfg");
            if cfg_file.exists() {
                if let Ok(content) = fs::read_to_string(cfg_file) {
                    if let Ok(mut cfg) = serde_json::from_str::<InstanceConfig>(&content) {
                        cfg.id = path.file_name().unwrap().to_string_lossy().to_string();
                        list.push(cfg);
                    }
                }
            }
        }
    }

    // 根據載入的順序進行排序
    let order = load_instance_order().await.unwrap_or_default();
    list.sort_by(|a, b| {
        let pos_a = order
            .iter()
            .position(|id| id == &a.id)
            .unwrap_or(usize::MAX);
        let pos_b = order
            .iter()
            .position(|id| id == &b.id)
            .unwrap_or(usize::MAX);
        pos_a.cmp(&pos_b)
    });

    Ok(list)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_instance(
    id: String,
    name: String,
    version: String,
    modloader: String,
    loader_version: Option<String>,
    icon: Option<String>,
    modrinth_project_id: Option<String>,
    modrinth_version_id: Option<String>,
) -> Result<InstanceConfig, String> {
    let instance_dir = get_instances_dir()?.join(&id);

    fs::create_dir_all(&instance_dir).map_err(|e| format!("無法建立實例資料夾: {}", e))?;
    fs::create_dir_all(instance_dir.join("minecraft"))
        .map_err(|e| format!("無法建立 minecraft 資料夾: {}", e))?;
    fs::create_dir_all(instance_dir.join("natives"))
        .map_err(|e| format!("無法建立 natives 資料夾: {}", e))?;

    let created_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // 讀取全局設定以取得預設值
    let base_dir = get_app_dir()?;
    let global_cfg_path = base_dir.join("global.cfg");
    let mut default_memory = Some(4096);
    let mut default_jvm_args = None;

    if global_cfg_path.exists() {
        if let Ok(content) = fs::read_to_string(&global_cfg_path) {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct TempGlobalConfig {
                default_max_memory: Option<u32>,
                default_jvm_args: Option<String>,
            }
            if let Ok(g_cfg) = serde_json::from_str::<TempGlobalConfig>(&content) {
                if let Some(mem) = g_cfg.default_max_memory {
                    default_memory = Some(mem);
                }
                if let Some(ref args) = g_cfg.default_jvm_args {
                    if !args.trim().is_empty() {
                        default_jvm_args = Some(args.clone());
                    }
                }
            }
        }
    }

    let cfg = InstanceConfig {
        id,
        name,
        version,
        modloader,
        created_time,
        last_played: None,
        play_time: None,
        jvm_args: default_jvm_args,
        max_memory: default_memory,
        loader_version,
        icon,
        modrinth_project_id,
        modrinth_version_id,
        java_path: None,
    };

    save_instance_config(&instance_dir.join("instance.cfg"), &cfg)?;

    Ok(cfg)
}

#[tauri::command]
pub async fn update_instance_settings(
    id: String,
    jvm_args: Option<String>,
    max_memory: Option<u32>,
    java_path: Option<String>,
) -> Result<(), String> {
    let cfg_file = get_instances_dir()?.join(&id).join("instance.cfg");
    if !cfg_file.exists() {
        return Err("實例設定檔不存在".to_string());
    }

    let content = fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
    cfg.id = id.clone();

    cfg.jvm_args = jvm_args;
    cfg.max_memory = max_memory;
    cfg.java_path = java_path;

    save_instance_config(&cfg_file, &cfg)?;

    Ok(())
}

pub(crate) fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("建立資料夾失敗: {}", e))?;
    let entries = fs::read_dir(src).map_err(|e| format!("讀取資料夾失敗: {}", e))?;
    for entry in entries.flatten() {
        let from_path = entry.path();
        if let Some(file_name) = from_path.file_name() {
            let to_path = dst.join(file_name);
            if from_path.is_dir() {
                copy_dir_recursive(&from_path, &to_path)?;
            } else {
                fs::copy(&from_path, &to_path).map_err(|e| format!("複製檔案失敗: {}", e))?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_instance_order(order: Vec<String>) -> Result<(), String> {
    let base_dir = get_app_dir()?;
    let order_file = base_dir.join("instance_order.json");
    let content =
        serde_json::to_string_pretty(&order).map_err(|e| format!("序列化順序檔失敗: {}", e))?;
    fs::write(order_file, content).map_err(|e| format!("寫入順序檔失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_instance_order() -> Result<Vec<String>, String> {
    let base_dir = get_app_dir()?;
    let order_file = base_dir.join("instance_order.json");
    if order_file.exists() {
        let content =
            fs::read_to_string(order_file).map_err(|e| format!("讀取順序檔失敗: {}", e))?;
        let order: Vec<String> =
            serde_json::from_str(&content).map_err(|e| format!("解析順序檔失敗: {}", e))?;
        Ok(order)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn update_instance_config(
    id: String,
    name: String,
    version: String,
    modloader: String,
    loader_version: Option<String>,
    modrinth_project_id: Option<String>,
    modrinth_version_id: Option<String>,
) -> Result<(), String> {
    let cfg_file = get_instances_dir()?.join(&id).join("instance.cfg");
    if !cfg_file.exists() {
        return Err("實例設定檔不存在".to_string());
    }

    let content = fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
    cfg.id = id.clone();

    cfg.name = name;
    cfg.version = version;
    cfg.modloader = modloader;
    cfg.loader_version = loader_version;

    if modrinth_project_id.is_some() {
        cfg.modrinth_project_id = modrinth_project_id;
    }
    if modrinth_version_id.is_some() {
        cfg.modrinth_version_id = modrinth_version_id;
    }

    save_instance_config(&cfg_file, &cfg)?;

    Ok(())
}

#[tauri::command]
pub async fn update_instance_icon(id: String, file_path: String) -> Result<String, String> {
    let instance_dir = get_instances_dir()?.join(&id);
    if !instance_dir.exists() {
        return Err("實例資料夾不存在".to_string());
    }

    let src_path = Path::new(&file_path);
    if !src_path.exists() {
        return Err("選取的檔案不存在".to_string());
    }

    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest_filename = format!("icon.{}", ext);
    let dest_path = instance_dir.join(&dest_filename);

    fs::copy(src_path, &dest_path).map_err(|e| format!("複製圖示失敗: {}", e))?;

    let cfg_file = instance_dir.join("instance.cfg");
    if cfg_file.exists() {
        let content =
            fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
        let mut cfg: InstanceConfig =
            serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
        cfg.id = id.clone();
        cfg.icon = Some(dest_filename.clone());
        save_instance_config(&cfg_file, &cfg)?;
    }

    Ok(dest_filename)
}

#[tauri::command]
pub async fn update_instance_icon_url(id: String, url: String) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&id);
    if !instance_dir.exists() {
        return Err("實例資料夾不存在".to_string());
    }

    let trimmed_url = url.trim();
    if !trimmed_url.starts_with("http://") && !trimmed_url.starts_with("https://") {
        return Err("無效的安全網址類型，必須以 http:// 或 https:// 開文！".to_string());
    }

    let cfg_file = instance_dir.join("instance.cfg");
    if cfg_file.exists() {
        let content =
            fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
        let mut cfg: InstanceConfig =
            serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
        cfg.id = id.clone();
        cfg.icon = Some(trimmed_url.to_string());
        save_instance_config(&cfg_file, &cfg)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn update_instance_icon_value(id: String, value: Option<String>) -> Result<(), String> {
    let cfg_file = get_instances_dir()?.join(&id).join("instance.cfg");
    if !cfg_file.exists() {
        return Err("實例設定檔不存在".to_string());
    }

    let content = fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
    cfg.id = id.clone();
    cfg.icon = value;

    save_instance_config(&cfg_file, &cfg)?;

    Ok(())
}

#[tauri::command]
pub async fn delete_instance_file(
    instance_id: String,
    folder_name: String,
    file_name: String,
) -> Result<(), String> {
    let target_path = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join(&folder_name)
        .join(&file_name);

    if target_path.exists() {
        if target_path.is_dir() {
            fs::remove_dir_all(target_path).map_err(|e| format!("無法刪除資料夾: {}", e))?;
        } else {
            fs::remove_file(target_path).map_err(|e| format!("無法刪除檔案: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_files(
    instance_id: String,
    folder_name: String,
    file_paths: Vec<String>,
) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&instance_id);
    if !instance_dir.exists() || !instance_dir.join("instance.cfg").exists() {
        return Err("實例資料夾或設定檔不存在，可能已被更名或刪除".to_string());
    }

    let dest_dir = instance_dir
        .join("minecraft")
        .join(&folder_name);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("無法建立目標資料夾: {}", e))?;

    for fp in file_paths {
        let src_path = Path::new(&fp);
        if src_path.exists() {
            let file_name = src_path
                .file_name()
                .ok_or_else(|| "無效的檔案名稱".to_string())?;
            let dest_path = dest_dir.join(file_name);
            if src_path.is_dir() {
                if fs::rename(src_path, &dest_path).is_err() {
                    copy_dir_recursive(src_path, &dest_path)?;
                    let _ = fs::remove_dir_all(src_path);
                }
            } else {
                if fs::rename(src_path, &dest_path).is_err() {
                    fs::copy(src_path, &dest_path).map_err(|e| format!("複製檔案失敗: {}", e))?;
                    let _ = fs::remove_file(src_path);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_world_zip(instance_id: String, zip_path: String) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&instance_id);
    if !instance_dir.exists() || !instance_dir.join("instance.cfg").exists() {
        return Err("實例資料夾或設定檔不存在，可能已被更名或刪除".to_string());
    }

    let saves_dir = instance_dir
        .join("minecraft")
        .join("saves");
    fs::create_dir_all(&saves_dir).map_err(|e| format!("無法建立 saves 資料夾: {}", e))?;

    let zip_file = fs::File::open(&zip_path).map_err(|e| format!("無法開啟 zip 檔案: {}", e))?;
    let mut archive = ZipArchive::new(zip_file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

    let mut root_dir = None;
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("讀取 zip 項目失敗: {}", e))?;
        let name = entry.name();
        if name.ends_with("level.dat") {
            let parts: Vec<&str> = name.split('/').collect();
            if parts.len() > 1 {
                root_dir = Some(parts[0].to_string());
                break;
            }
        }
    }

    let zip_name = Path::new(&zip_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("ImportedWorld")
        .to_string();

    let target_dir = match root_dir {
        Some(ref _dir) => saves_dir.clone(),
        None => saves_dir.join(&zip_name),
    };

    fs::create_dir_all(&target_dir).map_err(|e| format!("無法建立世界資料夾: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("讀取 zip 項目失敗: {}", e))?;
        let entry_name = entry.name().to_string();

        if entry_name.ends_with('/') {
            let out_path = target_dir.join(&entry_name);
            fs::create_dir_all(&out_path).ok();
            continue;
        }

        let out_path = target_dir.join(&entry_name);
        if let Some(p) = out_path.parent() {
            fs::create_dir_all(p).ok();
        }

        let mut outfile = fs::File::create(&out_path)
            .map_err(|e| format!("無法建立檔案 {}: {}", entry_name, e))?;
        std::io::copy(&mut entry, &mut outfile).map_err(|e| format!("寫入檔案失敗: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn download_and_replace_file(
    instance_id: String,
    folder_name: String,
    download_url: String,
    new_filename: String,
    old_filename: Option<String>,
) -> Result<(), String> {
    let dest_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join(&folder_name);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("無法建立目標資料夾: {}", e))?;

    let temp_dest = dest_dir.join(format!("{}.tmp", new_filename));
    let client = crate::get_client().clone();
    let res = client
        .get(&download_url)
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("下載檔案失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("下載伺服器回應錯誤: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取下載內容失敗: {}", e))?;
    fs::write(&temp_dest, &bytes).map_err(|e| format!("寫入暫存檔失敗: {}", e))?;

    if let Some(ref old_name) = old_filename {
        if !old_name.trim().is_empty() {
            let old_path = dest_dir.join(old_name);
            if old_path.exists() {
                let _ = fs::remove_file(old_path);
            }
        }
    }

    let final_dest = dest_dir.join(&new_filename);
    fs::rename(temp_dest, final_dest).map_err(|e| format!("重命名檔案失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn select_multiple_files(title: String, filter: String) -> Result<Vec<String>, String> {
    let script = format!(
        r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.OpenFileDialog
        $f.Multiselect = $true
        $f.Filter = "{}"
        $f.Title = "{}"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{
            $f.FileNames | ForEach-Object {{ Write-Output $_ }}
        }}
        "#,
        filter, title
    );

    let output = tokio::task::spawn_blocking(move || {
        super::create_command("powershell")
            .arg("-Command")
            .arg(&script)
            .output()
    })
    .await
    .map_err(|e| format!("執行緒執行失敗: {}", e))?
    .map_err(|e| format!("無法執行 PowerShell: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("PowerShell 執行失敗: {}", err));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let paths: Vec<String> = stdout
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if paths.is_empty() {
        return Err("CANCELLED".to_string());
    }
    Ok(paths)
}

#[tauri::command]
pub async fn select_single_file(title: String, filter: String) -> Result<String, String> {
    let script = format!(
        r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.OpenFileDialog
        $f.Filter = "{}"
        $f.Title = "{}"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{
            Write-Output $f.FileName
        }}
        "#,
        filter, title
    );

    let output = tokio::task::spawn_blocking(move || {
        super::create_command("powershell")
            .arg("-Command")
            .arg(&script)
            .output()
    })
    .await
    .map_err(|e| format!("執行緒執行失敗: {}", e))?
    .map_err(|e| format!("無法執行 PowerShell: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("PowerShell 執行失敗: {}", err));
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        return Err("CANCELLED".to_string());
    }
    Ok(path)
}

#[tauri::command]
pub async fn get_screenshots(instance_id: String) -> Result<Vec<String>, String> {
    let screenshots_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("screenshots");
    if !screenshots_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries =
        fs::read_dir(screenshots_dir).map_err(|e| format!("無法讀取 screenshots 資料夾: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "png"
                    || ext_lower == "jpg"
                    || ext_lower == "jpeg"
                    || ext_lower == "webp"
                {
                    if let Some(p_str) = path.to_str() {
                        list.push(p_str.to_string());
                    }
                }
            }
        }
    }

    list.sort();
    Ok(list)
}

#[tauri::command]
pub async fn delete_instance(id: String) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&id);
    if instance_dir.exists() {
        fs::remove_dir_all(instance_dir).map_err(|e| format!("無法刪除實例資料夾: {}", e))?;
    }
    Ok(())
}
