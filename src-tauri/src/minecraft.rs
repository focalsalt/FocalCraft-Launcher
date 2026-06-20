#![allow(dead_code)]

use notify::Watcher;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Semaphore;
use zip::ZipArchive;

// ==========================================
// 資料結構定義
// ==========================================

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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallation {
    pub path: String,
    pub version: String,
    pub major: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub instance_id: Option<String>,
    pub status: String,
    pub progress: f64,
    pub detail: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<ManifestVersion>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    pub release_time: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersionInfo {
    pub component: Option<String>,
    pub major_version: u32,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftVersionInfo {
    pub id: Option<String>,
    pub inherits_from: Option<String>,
    pub downloads: Option<ClientDownloads>,
    #[serde(default)]
    pub libraries: Vec<Library>,
    pub asset_index: Option<AssetIndexRef>,
    pub main_class: Option<String>,
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<Arguments>,
    pub java_version: Option<JavaVersionInfo>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ClientDownloads {
    pub client: Option<DownloadItem>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DownloadItem {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<ArtifactItem>,
    pub classifiers: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ArtifactItem {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Rule {
    pub action: String,
    pub os: Option<RuleOs>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RuleOs {
    pub name: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub total_size: Option<u64>,
    pub url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AssetIndex {
    pub objects: std::collections::HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Arguments {
    pub game: Option<Vec<serde_json::Value>>,
}

// Fabric API 資料結構
#[derive(Debug, Deserialize, Clone)]
pub struct FabricLoaderInfo {
    pub loader: FabricLoader,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FabricLoader {
    pub version: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FabricProfile {
    pub main_class: String,
    pub libraries: Vec<FabricLibrary>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FabricLibrary {
    pub name: String,
    pub url: String,
}

// Modrinth API 資料結構
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackInfo {
    pub name: String,
    pub version_id: String,
    pub game_version: String,
    pub modloader: String,
    pub modloader_version: String,
    pub mods: Vec<ModInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModInfo {
    pub id: String,       // Unique key for matching: filename (Modrinth) or project_id string (CurseForge)
    pub name: String,
    pub version: String,  // The mod's version in the modpack
    pub author: String,
    pub license: String,
    pub size: u64,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthIndex {
    pub name: String,
    pub version_id: String,
    pub dependencies: std::collections::HashMap<String, String>,
    pub files: Vec<ModrinthFile>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthFile {
    pub path: String,
    pub hashes: std::collections::HashMap<String, String>,
    pub downloads: Vec<String>,
    pub file_size: u64,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthProject {
    pub id: String,
    pub title: String,
    pub license: Option<ModrinthLicense>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthLicense {
    pub name: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ModrinthVersionFile {
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlockedMod {
    pub project_id: u32,
    pub file_id: u32,
    pub file_name: String,
    pub sha1: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CurseForgeManifest {
    pub name: String,
    pub version: String,
    pub minecraft: CurseForgeMinecraftMeta,
    pub files: Vec<CurseForgeManifestFile>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CurseForgeMinecraftMeta {
    pub version: String,
    #[serde(rename = "modLoaders")]
    pub mod_loaders: Vec<CurseForgeModLoaderMeta>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CurseForgeModLoaderMeta {
    pub id: String,
    pub primary: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CurseForgeManifestFile {
    #[serde(rename = "projectID")]
    pub project_id: u32,
    #[serde(rename = "fileID")]
    pub file_id: u32,
    pub required: bool,
}

// ==========================================
// 輔助函式
// ==========================================

fn get_app_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    Ok(PathBuf::from(appdata).join("focal-craft-launcher"))
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

// ==========================================
// 實例管理 (CRUD)
// ==========================================

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

#[tauri::command]
pub async fn delete_instance(id: String) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&id);
    if instance_dir.exists() {
        fs::remove_dir_all(instance_dir).map_err(|e| format!("無法刪除實例資料夾: {}", e))?;
    }
    Ok(())
}

// ==========================================
// Java 偵測與自動下載
// ==========================================

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
    if let Ok(base_dir) = get_app_dir() {
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

fn create_command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // 隱藏主控台視窗
    }
    cmd
}

fn check_java_version(java_path: &str) -> Option<JavaInstallation> {
    let output = create_command(java_path).arg("-version").output().ok()?;
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
    let base_dir = get_app_dir()?;
    let java_base_dir = base_dir.join("java");
    fs::create_dir_all(&java_base_dir).map_err(|e| format!("無法建立 Java 目錄: {}", e))?;

    let download_url = format!(
        "https://api.adoptium.net/v3/binary/latest/{}/ga/windows/x64/jre/hotspot/normal/eclipse",
        major_version
    );

    let dest_dir = java_base_dir.join(format!("jre_{}", major_version));
    if dest_dir.exists() {
        // 如果已經存在，檢查是否有效，有效就直接回傳
        let java_exe = dest_dir.join("bin").join("java.exe");
        if java_exe.exists() {
            return Ok(java_exe.to_string_lossy().to_string());
        }
        // 如果不完整，刪除重新下載
        let _ = fs::remove_dir_all(&dest_dir);
    }

    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: instance_id.clone(),
            status: "java_downloading".to_string(),
            progress: 0.0,
            detail: format!("準備下載 JRE {}...", major_version),
        },
    )
    .ok();

    let client = reqwest::Client::new();
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
        },
    )
    .ok();

    let zip_file =
        fs::File::open(&temp_zip_path).map_err(|e| format!("無法開啟 JRE zip: {}", e))?;
    let mut archive = ZipArchive::new(zip_file).map_err(|e| format!("解析 JRE zip 失敗: {}", e))?;

    fs::create_dir_all(&dest_dir).map_err(|e| format!("建立 JRE 解壓縮資料夾失敗: {}", e))?;

    // Adoptium 的 zip 包通常內含一個根資料夾，我們要將裡面的東西解壓，並移除多餘的根目錄層級
    let mut root_dir_name = String::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("讀取 zip 項目失敗: {}", e))?;
        if entry.is_dir() {
            let path = entry.name();
            // 第一個目錄就是根目錄
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

        // 去除根資料夾名稱字首
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

    // 刪除暫存的 zip 檔
    let _ = fs::remove_file(&temp_zip_path);

    let java_exe = dest_dir.join("bin").join("java.exe");
    if java_exe.exists() {
        Ok(java_exe.to_string_lossy().to_string())
    } else {
        Err("找不到 java.exe。解壓失敗或架構不相容。".to_string())
    }
}

// ==========================================
// Minecraft 版本清單與下載
// ==========================================

#[tauri::command]
pub async fn get_minecraft_versions() -> Result<VersionManifest, String> {
    println!("Fetching Minecraft versions from Mojang...");
    let client = reqwest::Client::builder()
        .user_agent("focal-craft-launcher")
        .build()
        .map_err(|e| format!("Failed to build reqwest client: {}", e))?;

    let res = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| {
            let err_msg = format!("取得 Mojang 版本清單失敗: {}", e);
            println!("{}", err_msg);
            err_msg
        })?;

    let data = res.json::<VersionManifest>().await.map_err(|e| {
        let err_msg = format!("解析 Mojang 版本清單失敗: {}", e);
        println!("{}", err_msg);
        err_msg
    })?;

    println!(
        "Successfully fetched {} Minecraft versions.",
        data.versions.len()
    );
    Ok(data)
}

fn find_loader_json(versions_dir: &Path) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(versions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(sub_entries) = fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        if sub_path.is_file()
                            && sub_path.extension().and_then(|s| s.to_str()) == Some("json")
                        {
                            let name = sub_path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                            if name.contains("forge") || name.contains("neoforge") {
                                return Some(sub_path);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

#[derive(Clone)]
struct DownloadTask {
    url: String,
    dest: PathBuf,
    sha1: String,
    size: u64,
    is_asset: bool,
}

#[tauri::command]
pub async fn install_instance_files(
    app: AppHandle,
    state: State<'_, crate::SessionState>,
    instance_id: String,
    java_path: Option<String>,
) -> Result<(), String> {
    let session = get_or_create_session(&state, &instance_id);
    if session
        .cancel_token
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err("Cancelled".to_string());
    }
    let base_dir = get_app_dir()?;
    let cfg_file = get_instances_dir()?.join(&instance_id).join("instance.cfg");
    if !cfg_file.exists() {
        return Err("找不到該實例的設定檔".to_string());
    }

    let cfg_content =
        fs::read_to_string(&cfg_file).map_err(|e| format!("無法讀取 instance.cfg: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&cfg_content).map_err(|e| format!("無法解析 instance.cfg: {}", e))?;
    cfg.id = instance_id.clone();

    let version_id = cfg.version.clone();
    let modloader = cfg.modloader.clone();

    // 確保下載所需的目錄存在
    let versions_dir = base_dir.join("version");
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let libraries_dir = instance_dir.join("libraries");
    let assets_dir = instance_dir.join("assets");
    fs::create_dir_all(&versions_dir).ok();
    fs::create_dir_all(&libraries_dir).ok();
    fs::create_dir_all(&assets_dir).ok();

    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: Some(instance_id.clone()),
            status: "downloading_meta".to_string(),
            progress: 5.0,
            detail: "獲取 Minecraft 版本清單中...".to_string(),
        },
    )
    .ok();

    // 1. 取得 version_manifest_v2 并獲取指定版本的 json url
    let client = reqwest::Client::new();
    let version_json_dir = versions_dir.join(&version_id);
    let version_json_path = version_json_dir.join(format!("{}.json", version_id));

    let mut version_info_str = String::new();
    let mut is_valid = false;

    if version_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&version_json_path) {
            if let Ok(info) = serde_json::from_str::<MinecraftVersionInfo>(&content) {
                if info.downloads.is_some()
                    || info.inherits_from.is_some()
                    || !info.libraries.is_empty()
                {
                    version_info_str = content;
                    is_valid = true;
                }
            }
        }
    }

    if !is_valid {
        let manifest = get_minecraft_versions().await?;
        let version_entry = manifest
            .versions
            .iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| format!("未知的 Minecraft 版本: {}", version_id))?;
        let res = client
            .get(&version_entry.url)
            .send()
            .await
            .map_err(|e| format!("取得版本 JSON 失敗: {}", e))?;
        let text = res
            .text()
            .await
            .map_err(|e| format!("讀取版本 JSON 內容失敗: {}", e))?;
        fs::create_dir_all(&version_json_dir).ok();
        fs::write(&version_json_path, &text).map_err(|e| format!("寫入版本 JSON 失敗: {}", e))?;
        version_info_str = text;
    }

    let vanilla_info: MinecraftVersionInfo = serde_json::from_str(&version_info_str)
        .map_err(|e| format!("解析版本 JSON 失敗: {}", e))?;

    // 若存在繼承版本，載入基礎版本的 JSON 設定檔
    let mut base_vanilla_info: Option<MinecraftVersionInfo> = None;
    if let Some(ref base_ver) = vanilla_info.inherits_from {
        let base_version_json_dir = versions_dir.join(base_ver);
        let base_version_json_path = base_version_json_dir.join(format!("{}.json", base_ver));
        let base_version_info_str = if base_version_json_path.exists() {
            fs::read_to_string(&base_version_json_path)
                .map_err(|e| format!("讀取本地基礎版本 JSON 失敗: {}", e))?
        } else {
            let manifest = get_minecraft_versions().await?;
            let base_entry = manifest
                .versions
                .iter()
                .find(|v| v.id == *base_ver)
                .ok_or_else(|| format!("未知的基礎 Minecraft 版本: {}", base_ver))?;
            let res = client
                .get(&base_entry.url)
                .send()
                .await
                .map_err(|e| format!("取得基礎版本 JSON 失敗: {}", e))?;
            let text = res
                .text()
                .await
                .map_err(|e| format!("讀取基礎版本 JSON 內容失敗: {}", e))?;
            fs::create_dir_all(&base_version_json_dir).ok();
            fs::write(&base_version_json_path, &text)
                .map_err(|e| format!("寫入基礎版本 JSON 失敗: {}", e))?;
            text
        };
        let parsed_base: MinecraftVersionInfo = serde_json::from_str(&base_version_info_str)
            .map_err(|e| format!("解析基礎版本 JSON 失敗: {}", e))?;
        base_vanilla_info = Some(parsed_base);
    }

    // 3. 準備下載任務列表 (分兩類)
    let mut lib_queue: Vec<DownloadTask> = vec![]; // 遊戲 jar / libraries
    let mut asset_queue: Vec<DownloadTask> = vec![]; // assets 資源檔案

    // 客戶端 Jar 主程式
    if let Some(ref base_info) = base_vanilla_info {
        if let Some(ref downloads) = base_info.downloads {
            if let Some(ref client_jar) = downloads.client {
                let base_ver = vanilla_info.inherits_from.as_ref().unwrap();
                let dest_jar = versions_dir
                    .join(base_ver)
                    .join(format!("{}.jar", base_ver));
                lib_queue.push(DownloadTask {
                    url: client_jar.url.clone(),
                    dest: dest_jar,
                    sha1: client_jar.sha1.clone(),
                    size: client_jar.size,
                    is_asset: false,
                });
            }
        }
    } else {
        if let Some(ref downloads) = vanilla_info.downloads {
            if let Some(ref client_jar) = downloads.client {
                let dest_jar = version_json_dir.join(format!("{}.jar", version_id));
                lib_queue.push(DownloadTask {
                    url: client_jar.url.clone(),
                    dest: dest_jar,
                    sha1: client_jar.sha1.clone(),
                    size: client_jar.size,
                    is_asset: false,
                });
            }
        }
    }

    // 原生程式庫（合併當前與基礎版本的程式庫）
    let mut libraries_to_check = vanilla_info.libraries.clone();
    if let Some(ref base_info) = base_vanilla_info {
        libraries_to_check.extend(base_info.libraries.clone());
    }

    for lib in &libraries_to_check {
        if should_use_library(&lib.rules) {
            if let Some(ref downloads) = lib.downloads {
                if let Some(ref artifact) = downloads.artifact {
                    let dest = libraries_dir.join(&artifact.path);
                    if !lib_queue.iter().any(|t| t.dest == dest) {
                        lib_queue.push(DownloadTask {
                            url: artifact.url.clone(),
                            dest,
                            sha1: artifact.sha1.clone(),
                            size: artifact.size,
                            is_asset: false,
                        });
                    }
                }
                // 下載 natives (適用於舊版，例如 LWJGL dlls)
                if let Some(ref natives_val) = lib.natives {
                    if let Some(native_key) = natives_val.get("windows") {
                        let native_key_str =
                            native_key.as_str().unwrap_or("").replace("${arch}", "64");
                        if let Some(ref classifiers) = downloads.classifiers {
                            if let Some(classifier_art_val) = classifiers.get(&native_key_str) {
                                if let Ok(classifier_art) = serde_json::from_value::<ArtifactItem>(
                                    classifier_art_val.clone(),
                                ) {
                                    let dest = libraries_dir.join(&classifier_art.path);
                                    if !lib_queue.iter().any(|t| t.dest == dest) {
                                        lib_queue.push(DownloadTask {
                                            url: classifier_art.url,
                                            dest,
                                            sha1: classifier_art.sha1,
                                            size: classifier_art.size,
                                            is_asset: false,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Fabric Libraries & Custom Main Class (若選擇 Fabric)
    if modloader.eq_ignore_ascii_case("fabric") {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "downloading_meta".to_string(),
                progress: 10.0,
                detail: "取得 Fabric Loader 資訊中...".to_string(),
            },
        )
        .ok();

        let query_version = vanilla_info.inherits_from.as_ref().unwrap_or(&version_id);
        let loader_version = match cfg.loader_version {
            Some(ref v) if !v.is_empty() => v.clone(),
            _ => {
                let loader_res = client
                    .get(format!(
                        "https://meta.fabricmc.net/v2/versions/loader/{}",
                        query_version
                    ))
                    .send()
                    .await
                    .map_err(|e| format!("取得 Fabric Loader 列表失敗: {}", e))?;
                let loaders = loader_res
                    .json::<Vec<FabricLoaderInfo>>()
                    .await
                    .map_err(|e| format!("解析 Fabric Loader 列表失敗: {}", e))?;
                let latest_loader = loaders
                    .first()
                    .ok_or_else(|| "該版本無可用的 Fabric Loader".to_string())?;
                latest_loader.loader.version.clone()
            }
        };

        // 讀取 Fabric profile
        let profile_url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
            query_version, loader_version
        );

        let fabric_profile_res = client
            .get(&profile_url)
            .send()
            .await
            .map_err(|e| format!("取得 Fabric Profile 失敗: {}", e))?;
        let fabric_profile = fabric_profile_res
            .json::<FabricProfile>()
            .await
            .map_err(|e| format!("解析 Fabric Profile 失敗: {}", e))?;

        // 儲存 Fabric 專屬 libraries
        for flib in fabric_profile.libraries {
            // 解析 maven 名稱轉換成路徑
            // 例如 "net.fabricmc:fabric-loader:0.14.22" -> "net/fabricmc/fabric-loader/0.14.22/fabric-loader-0.14.22.jar"
            if let Some(path) = maven_to_path(&flib.name) {
                let dest = libraries_dir.join(Path::new(&path));
                // Fabric API 沒有提供 SHA1/Size，我們填入空或估算
                lib_queue.push(DownloadTask {
                    url: format!("{}{}", flib.url, path.replace('\\', "/")),
                    dest,
                    sha1: String::new(),
                    size: 0,
                    is_asset: false,
                });
            }
        }
    }

    // 5. Assets (資源包、聲音等)
    let asset_index_ref_opt = vanilla_info.asset_index.as_ref().or_else(|| {
        base_vanilla_info
            .as_ref()
            .and_then(|b| b.asset_index.as_ref())
    });

    if let Some(asset_index_ref) = asset_index_ref_opt {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "downloading_meta".to_string(),
                progress: 15.0,
                detail: "下載 Assets 索引檔案中...".to_string(),
            },
        )
        .ok();

        let index_dest = assets_dir
            .join("indexes")
            .join(format!("{}.json", asset_index_ref.id));
        fs::create_dir_all(index_dest.parent().unwrap()).ok();

        let index_content = if index_dest.exists() {
            fs::read_to_string(&index_dest)
                .map_err(|e| format!("讀起本地 Assets 索引失敗: {}", e))?
        } else {
            let res = client
                .get(&asset_index_ref.url)
                .send()
                .await
                .map_err(|e| format!("下載 Assets 索引失敗: {}", e))?;
            let text = res
                .text()
                .await
                .map_err(|e| format!("讀取 Assets 索引內容失敗: {}", e))?;
            fs::write(&index_dest, &text).map_err(|e| format!("寫入 Assets 索引失敗: {}", e))?;
            text
        };

        let asset_index: AssetIndex = serde_json::from_str(&index_content)
            .map_err(|e| format!("解析 Assets 索引失敗: {}", e))?;

        // 收集所有 assets 下載任務（分離到 asset_queue）
        let objects_dir = assets_dir.join("objects");
        for obj in asset_index.objects.values() {
            let first_two = &obj.hash[0..2];
            let relative_path = format!("{}/{}", first_two, obj.hash);
            let dest = objects_dir.join(&relative_path);
            asset_queue.push(DownloadTask {
                url: format!("https://resources.download.minecraft.net/{}", relative_path),
                dest,
                sha1: obj.hash.clone(),
                size: obj.size,
                is_asset: true,
            });
        }
    }

    // 6. 兩階段併發下載：第一階段 Libraries/Jars (20-45%)，第二階段 Assets (45-95%)

    // ── Helper closure: 過濾需要下載的任務
    fn filter_tasks(queue: Vec<DownloadTask>) -> Vec<DownloadTask> {
        let mut result = vec![];
        for task in queue {
            let needs_download = if !task.dest.exists() {
                true
            } else if task.size > 0 {
                if let Ok(metadata) = fs::metadata(&task.dest) {
                    metadata.len() != task.size
                } else {
                    true
                }
            } else if !task.sha1.is_empty() {
                !verify_sha1(&task.dest, &task.sha1)
            } else {
                false
            };
            if needs_download {
                result.push(task);
            }
        }
        result
    }

    // ── 第一階段：Libraries / Jars (20% → 45%)
    let libs_to_download = filter_tasks(lib_queue);
    let lib_total = libs_to_download.len();

    if lib_total > 0 {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "downloading_files".to_string(),
                progress: 20.0,
                detail: format!("下載遊戲依賴：0/{} 個", lib_total),
            },
        )
        .ok();

        let semaphore = Arc::new(Semaphore::new(15));
        let downloaded_count = Arc::new(tokio::sync::Mutex::new(0usize));
        let app_handle = Arc::new(app.clone());
        let mut tasks = vec![];
        let cancel_tok = session.cancel_token.clone();

        for task in libs_to_download {
            let sem = semaphore.clone();
            let count = downloaded_count.clone();
            let app_h = app_handle.clone();
            let inst_id = instance_id.clone();
            let cancel_t = cancel_tok.clone();

            tasks.push(tokio::spawn(async move {
                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                let _permit = sem.acquire().await.unwrap();
                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                let client = reqwest::Client::new();
                if let Some(parent) = task.dest.parent() {
                    fs::create_dir_all(parent).ok();
                }

                let mut retries = 3;
                let mut success = false;
                while retries > 0 && !success {
                    if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                        return;
                    }
                    if let Ok(res) = client.get(&task.url).send().await {
                        if res.status().is_success() {
                            if let Ok(bytes) = res.bytes().await {
                                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                                    return;
                                }
                                if fs::write(&task.dest, &bytes).is_ok() {
                                    if task.sha1.is_empty() || verify_sha1(&task.dest, &task.sha1) {
                                        success = true;
                                    } else {
                                        let _ = fs::remove_file(&task.dest);
                                    }
                                }
                            }
                        }
                    }
                    if !success {
                        retries -= 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }

                let mut c = count.lock().await;
                *c += 1;
                // 20% → 45%
                let progress = 20.0 + ((*c as f64 / lib_total as f64) * 25.0);
                app_h
                    .emit(
                        "download-progress",
                        ProgressPayload {
                            instance_id: Some(inst_id),
                            status: "downloading_files".to_string(),
                            progress,
                            detail: format!("下載遊戲依賴：{}/{} 個", *c, lib_total),
                        },
                    )
                    .ok();
            }));
        }
        for handle in tasks {
            let _ = handle.await;
        }
        if session
            .cancel_token
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return Err("Cancelled".to_string());
        }
    }

    // ── 第二階段：Assets 資源 (45% → 95%)
    let assets_to_download = filter_tasks(asset_queue);
    let asset_total = assets_to_download.len();

    if asset_total > 0 {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "downloading_assets".to_string(),
                progress: 45.0,
                detail: format!("下載 Assets 資源：0/{} 個", asset_total),
            },
        )
        .ok();

        let semaphore = Arc::new(Semaphore::new(30)); // assets 小檔案，可多開
        let downloaded_count = Arc::new(tokio::sync::Mutex::new(0usize));
        let app_handle = Arc::new(app.clone());
        let mut tasks = vec![];
        let cancel_tok = session.cancel_token.clone();

        for task in assets_to_download {
            let sem = semaphore.clone();
            let count = downloaded_count.clone();
            let app_h = app_handle.clone();
            let inst_id = instance_id.clone();
            let cancel_t = cancel_tok.clone();

            tasks.push(tokio::spawn(async move {
                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                let _permit = sem.acquire().await.unwrap();
                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                let client = reqwest::Client::new();
                if let Some(parent) = task.dest.parent() {
                    fs::create_dir_all(parent).ok();
                }

                let mut retries = 3;
                let mut success = false;
                while retries > 0 && !success {
                    if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                        return;
                    }
                    if let Ok(res) = client.get(&task.url).send().await {
                        if res.status().is_success() {
                            if let Ok(bytes) = res.bytes().await {
                                if cancel_t.load(std::sync::atomic::Ordering::Relaxed) {
                                    return;
                                }
                                if fs::write(&task.dest, &bytes).is_ok() {
                                    if task.sha1.is_empty() || verify_sha1(&task.dest, &task.sha1) {
                                        success = true;
                                    } else {
                                        let _ = fs::remove_file(&task.dest);
                                    }
                                }
                            }
                        }
                    }
                    if !success {
                        retries -= 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    }
                }

                let mut c = count.lock().await;
                *c += 1;
                // 只每 50 個或最後一個才發事件，減少 IPC 壓力
                if *c % 50 == 0 || *c == asset_total {
                    // 45% → 95%
                    let progress = 45.0 + ((*c as f64 / asset_total as f64) * 50.0);
                    app_h
                        .emit(
                            "download-progress",
                            ProgressPayload {
                                instance_id: Some(inst_id),
                                status: "downloading_assets".to_string(),
                                progress,
                                detail: format!("下載 Assets 資源：{}/{} 個", *c, asset_total),
                            },
                        )
                        .ok();
                }
            }));
        }
        for handle in tasks {
            let _ = handle.await;
        }
        if session
            .cancel_token
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return Err("Cancelled".to_string());
        }
    }

    // 7. Forge / NeoForge Installer Execution
    let mc_dir = get_instances_dir()?.join(&instance_id).join("minecraft");
    let versions_dir = mc_dir.join("versions");
    let loader_json = find_loader_json(&versions_dir);

    let is_forge = modloader.eq_ignore_ascii_case("forge");
    let is_neoforge = modloader.eq_ignore_ascii_case("neoforge");

    if (is_forge || is_neoforge) && loader_json.is_none() {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "installing_loader".to_string(),
                progress: 90.0,
                detail: format!("正在下載 {} 安裝檔...", modloader),
            },
        )
        .ok();

        let loader_ver = cfg.loader_version.clone().unwrap_or_default();
        if loader_ver.is_empty() {
            return Err(format!("未指定 {} 版本", modloader));
        }

        // 建立安裝檔下載網址
        let query_version = vanilla_info.inherits_from.as_ref().unwrap_or(&version_id);
        let installer_url = if is_forge {
            format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-installer.jar",
                query_version, loader_ver, query_version, loader_ver
            )
        } else {
            // NeoForge 下載網址
            // 對於 MC 1.20.1，NeoForge 命名為 "forge" 且版本號類似 "1.20.1-47.1.80"
            if query_version == "1.20.1" {
                format!(
                    "https://maven.neoforged.net/releases/net/neoforged/forge/{}/forge-{}-installer.jar",
                    loader_ver, loader_ver
                )
            } else {
                format!(
                    "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
                    loader_ver, loader_ver
                )
            }
        };

        if session
            .cancel_token
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return Err("Cancelled".to_string());
        }

        let temp_installer = get_instances_dir()?
            .join(&instance_id)
            .join("installer_tmp.jar");
        download_file(&installer_url, &temp_installer)
            .await
            .map_err(|e| format!("下載 {} 安裝檔失敗: {}", modloader, e))?;

        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "installing_loader".to_string(),
                progress: 95.0,
                detail: format!("正在執行 {} 安裝程序 (背景執行)...", modloader),
            },
        )
        .ok();

        // 執行安裝程式
        // 執行指令：java -jar <安裝檔> --installClient <麥塊目錄>
        let java_exec = java_path.clone().unwrap_or_else(|| "java".to_string());
        let mut installer_cmd = create_command(&java_exec);
        installer_cmd
            .arg("-jar")
            .arg(&temp_installer)
            .arg("--installClient")
            .arg(&mc_dir);

        let output = installer_cmd.output();
        let _ = fs::remove_file(&temp_installer); // 清除安裝檔暫存

        match output {
            Ok(out) => {
                if !out.status.success() {
                    let err_log = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("安裝檔執行失敗: {}", err_log));
                }
            }
            Err(e) => {
                return Err(format!("無法執行安裝檔: {}", e));
            }
        }
    }

    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: Some(instance_id.clone()),
            status: "complete".to_string(),
            progress: 100.0,
            detail: "下載與安裝完成，準備啟動！".to_string(),
        },
    )
    .ok();

    Ok(())
}

fn should_use_library(rules: &Option<Vec<Rule>>) -> bool {
    let Some(rules) = rules else {
        return true;
    };
    let mut allowed = false;
    for rule in rules {
        let action = &rule.action;
        let os_matches = if let Some(ref os) = rule.os {
            os.name == "windows"
        } else {
            true
        };
        if os_matches {
            allowed = action == "allow";
        }
    }
    allowed
}
fn maven_to_path(name: &str) -> Option<String> {
    // 例如 "net.fabricmc:fabric-loader:0.14.22" -> "net/fabricmc/fabric-loader/0.14.22/fabric-loader-0.14.22.jar"
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    // 有些可能有 classifier, e.g. "group:artifact:version:classifier"
    let classifier = if parts.len() >= 4 {
        format!("-{}", parts[3])
    } else {
        "".to_string()
    };

    Some(format!(
        "{}/{}/{}/{}-{}{}.jar",
        group, artifact, version, artifact, version, classifier
    ))
}

#[tauri::command]
pub async fn search_modrinth_modpacks(
    query: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let offset_val = offset.unwrap_or(0);
    let limit_val = limit.unwrap_or(20);
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets=[[\"project_type:modpack\"]]&offset={}&limit={}",
        query, offset_val, limit_val
    );

    let res = client
        .get(&url)
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("搜尋 Modrinth 失敗: {}", e))?;

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 Modrinth 回應失敗: {}", e))?;

    Ok(json)
}

/// Extract a version number from a mod filename.
/// e.g. "sodium-fabric-mc1.20.1-0.5.3.jar" -> "0.5.3"
///      "fabric-api-0.91.0+1.20.4.jar" -> "0.91.0+1.20.4"
fn extract_version_from_filename(filename: &str) -> String {
    let stem = filename.trim_end_matches(".jar");
    // Try to find the last segment that starts with a digit after a '-'
    let parts: Vec<&str> = stem.split('-').collect();
    // Walk backwards to find the last version-like segment
    for part in parts.iter().rev() {
        if part.starts_with(|c: char| c.is_ascii_digit()) {
            return part.to_string();
        }
    }
    // Fallback: return the full stem
    stem.to_string()
}

#[tauri::command]
pub async fn parse_pack_info(file_path: String) -> Result<ModpackInfo, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("找不到選擇的整合包檔案".to_string());
    }

    let (pack_type, index_opt, manifest_opt, mmc_opt) = {
        let file = fs::File::open(path).map_err(|e| format!("無法開啟檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        let is_modrinth = archive.by_name("modrinth.index.json").is_ok();
        let is_curseforge = archive.by_name("manifest.json").is_ok();

        if is_modrinth {
            let mut index_entry = archive.by_name("modrinth.index.json").unwrap();
            let index: ModrinthIndex = serde_json::from_reader(&mut index_entry)
                .map_err(|e| format!("解析 modrinth.index.json 失敗: {}", e))?;
            ("modrinth", Some(index), None, None)
        } else if is_curseforge {
            let mut manifest_entry = archive.by_name("manifest.json").unwrap();
            let manifest: CurseForgeManifest = serde_json::from_reader(&mut manifest_entry)
                .map_err(|e| format!("解析 manifest.json 失敗: {}", e))?;
            ("curseforge", None, Some(manifest), None)
        } else {
            let mut instance_cfg_entry = None;
            let mut mmc_pack_entry = None;
            for i in 0..archive.len() {
                if let Ok(entry) = archive.by_index(i) {
                    let name = entry.name();
                    if name.ends_with("instance.cfg") {
                        instance_cfg_entry = Some(name.to_string());
                    } else if name.ends_with("mmc-pack.json") {
                        mmc_pack_entry = Some(name.to_string());
                    }
                }
            }

            if instance_cfg_entry.is_some() || mmc_pack_entry.is_some() {
                ("multimc", None, None, Some((instance_cfg_entry, mmc_pack_entry)))
            } else {
                return Err("不支援的整合包格式（未找到 modrinth.index.json、manifest.json 或 instance.cfg）".to_string());
            }
        }
    };

    if pack_type == "multimc" {
        let (inst_cfg_name, mmc_pack_name) = mmc_opt.unwrap();
        let file = fs::File::open(path).map_err(|e| format!("無法開啟檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        let mut name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("MultiMC Pack").to_string();
        if let Some(cfg_name) = inst_cfg_name {
            if let Ok(mut entry) = archive.by_name(&cfg_name) {
                let mut content = String::new();
                use std::io::Read;
                if entry.read_to_string(&mut content).is_ok() {
                    for line in content.lines() {
                        if line.starts_with("name=") {
                            name = line.strip_prefix("name=").unwrap().to_string();
                            break;
                        }
                    }
                }
            }
        }

        let mut game_version = "1.20.1".to_string();
        let mut modloader = "Vanilla".to_string();
        let mut modloader_version = "".to_string();

        if let Some(pack_json_name) = mmc_pack_name {
            if let Ok(mut entry) = archive.by_name(&pack_json_name) {
                #[derive(Deserialize)]
                struct MmcComponent {
                    uid: String,
                    version: Option<String>,
                }
                #[derive(Deserialize)]
                struct MmcPackJson {
                    components: Vec<MmcComponent>,
                }
                if let Ok(pack_json) = serde_json::from_reader::<_, MmcPackJson>(&mut entry) {
                    for comp in pack_json.components {
                        if comp.uid == "net.minecraft" || comp.uid == "org.multimc.minecraft" {
                            if let Some(v) = comp.version {
                                game_version = v;
                            }
                        } else if comp.uid == "net.fabricmc.fabric-loader" {
                            modloader = "Fabric".to_string();
                            if let Some(v) = comp.version {
                                modloader_version = v;
                            }
                        } else if comp.uid == "net.minecraftforge" {
                            modloader = "Forge".to_string();
                            if let Some(v) = comp.version {
                                modloader_version = v;
                            }
                        } else if comp.uid == "org.neoforged" || comp.uid == "org.neoforge" {
                            modloader = "NeoForge".to_string();
                            if let Some(v) = comp.version {
                                modloader_version = v;
                            }
                        }
                    }
                }
            }
        }

        let mut mods = vec![];
        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index(i) {
                let entry_name = entry.name();
                let is_jar = entry_name.to_lowercase().ends_with(".jar");
                let is_in_mods = entry_name.contains("/mods/") || entry_name.contains("\\mods\\") || entry_name.starts_with("mods/") || entry_name.starts_with("mods\\");
                if is_jar && is_in_mods {
                    let filename = Path::new(entry_name)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(entry_name)
                        .to_string();
                    let version = extract_version_from_filename(&filename);
                    mods.push(ModInfo {
                        id: entry_name.to_string(),
                        name: filename.clone(),
                        version,
                        author: "Local".to_string(),
                        license: "Local Mod".to_string(),
                        size: entry.size(),
                    });
                }
            }
        }

        Ok(ModpackInfo {
            name,
            version_id: "1.0.0".to_string(),
            game_version,
            modloader,
            modloader_version,
            mods,
        })
    } else if pack_type == "modrinth" {
        let index = index_opt.unwrap();
        let game_version = index
            .dependencies
            .get("minecraft")
            .ok_or_else(|| "mrpack 未指定 Minecraft 版本".to_string())?
            .clone();

        let mut modloader = "Vanilla".to_string();
        let mut modloader_version = "".to_string();
        if let Some(v) = index.dependencies.get("fabric-loader") {
            modloader = "Fabric".to_string();
            modloader_version = v.clone();
        } else if let Some(v) = index.dependencies.get("forge") {
            modloader = "Forge".to_string();
            modloader_version = v.clone();
        }

        let mut mod_files = vec![];
        for f in &index.files {
            let is_mod = f.path.starts_with("mods/") || f.path.starts_with("mods\\");
            if is_mod {
                mod_files.push(f.clone());
            }
        }

        let mut sha1_hashes = vec![];
        for f in &mod_files {
            if let Some(sha1) = f.hashes.get("sha1") {
                sha1_hashes.push(sha1.clone());
            }
        }

        let mut mods = vec![];
        let client = reqwest::Client::new();

        if !sha1_hashes.is_empty() {
            let lookup_url = "https://api.modrinth.com/v2/version_files";
            let body = serde_json::json!({
                "hashes": sha1_hashes,
                "algorithm": "sha1"
            });

            if let Ok(res) = client
                .post(lookup_url)
                .header("User-Agent", "focal-craft-launcher")
                .json(&body)
                .send()
                .await
            {
                if let Ok(lookup_data) = res
                    .json::<std::collections::HashMap<String, serde_json::Value>>()
                    .await
                {
                    let mut project_ids = vec![];
                    let mut hash_to_project = std::collections::HashMap::new();
                    let mut hash_to_version = std::collections::HashMap::new();

                    for (hash, val) in lookup_data {
                        if let Some(p_id) = val.get("project_id").and_then(|p| p.as_str()) {
                            project_ids.push(p_id.to_string());
                            hash_to_project.insert(hash.clone(), p_id.to_string());
                        }
                        if let Some(v_num) = val.get("version_number").and_then(|v| v.as_str()) {
                            hash_to_version.insert(hash, v_num.to_string());
                        }
                    }

                    let mut id_to_proj = std::collections::HashMap::new();
                    if !project_ids.is_empty() {
                        project_ids.sort();
                        project_ids.dedup();

                        let ids_str = serde_json::to_string(&project_ids).unwrap();
                        let projects_url =
                            format!("https://api.modrinth.com/v2/projects?ids={}", ids_str);

                        if let Ok(proj_res) = client
                            .get(&projects_url)
                            .header("User-Agent", "focal-craft-launcher")
                            .send()
                            .await
                        {
                            if let Ok(projects_list) = proj_res.json::<Vec<ModrinthProject>>().await
                            {
                                for proj in projects_list {
                                    id_to_proj.insert(proj.id.clone(), proj);
                                }
                            }
                        }
                    }

                    for f in &mod_files {
                        let filename = Path::new(&f.path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or(&f.path)
                            .to_string();
                        let mut name = filename.clone();
                        let author = "Modrinth".to_string();
                        let mut license = "Open Source / Custom".to_string();
                        let mut version = String::new();

                        if let Some(sha1) = f.hashes.get("sha1") {
                            if let Some(ver) = hash_to_version.get(sha1) {
                                version = ver.clone();
                            }
                            if let Some(p_id) = hash_to_project.get(sha1) {
                                if let Some(proj) = id_to_proj.get(p_id) {
                                    name = proj.title.clone();
                                    if let Some(ref lic) = proj.license {
                                        license = lic.name.clone();
                                    }
                                }
                            }
                        }

                        if version.is_empty() {
                            version = extract_version_from_filename(&filename);
                        }

                        mods.push(ModInfo {
                            id: filename,
                            name,
                            version,
                            author,
                            license,
                            size: f.file_size,
                        });
                    }
                }
            }
        }

        if mods.is_empty() {
            for f in &mod_files {
                let filename = Path::new(&f.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&f.path)
                    .to_string();
                let version = extract_version_from_filename(&filename);
                mods.push(ModInfo {
                    id: filename.clone(),
                    name: filename,
                    version,
                    author: "Unknown".to_string(),
                    license: "Unspecified".to_string(),
                    size: f.file_size,
                });
            }
        }

        Ok(ModpackInfo {
            name: index.name,
            version_id: index.version_id,
            game_version,
            modloader,
            modloader_version,
            mods,
        })
    } else {
        let manifest = manifest_opt.unwrap();
        let game_version = manifest.minecraft.version.clone();
        let mut modloader = "Vanilla".to_string();
        let mut modloader_version = "".to_string();

        if let Some(primary_loader) = manifest.minecraft.mod_loaders.iter().find(|l| l.primary) {
            let id = &primary_loader.id;
            if let Some(stripped) = id.strip_prefix("fabric-") {
                modloader = "Fabric".to_string();
                modloader_version = stripped.to_string();
            } else if let Some(stripped) = id.strip_prefix("forge-") {
                modloader = "Forge".to_string();
                modloader_version = stripped.to_string();
            } else if let Some(stripped) = id.strip_prefix("neoforge-") {
                modloader = "NeoForge".to_string();
                modloader_version = stripped.to_string();
            }
        }

        let project_ids: Vec<u32> = manifest.files.iter().map(|f| f.project_id).collect();
        let proj_to_file: std::collections::HashMap<u32, u32> = manifest.files.iter()
            .map(|f| (f.project_id, f.file_id)).collect();
        let mut mods = vec![];

        if !project_ids.is_empty() {
            let client = reqwest::Client::new();
            let mut proj_meta: std::collections::HashMap<u32, serde_json::Value> = std::collections::HashMap::new();
            for chunk in project_ids.chunks(100) {
                let body = serde_json::json!({ "modIds": chunk });
                if let Ok(res) = client
                    .post("https://api.curseforge.com/v1/mods")
                    .header("x-api-key", "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm")
                    .json(&body)
                    .send()
                    .await
                {
                    if res.status().is_success() {
                        if let Ok(resp_val) = res.json::<serde_json::Value>().await {
                            if let Some(data_arr) = resp_val["data"].as_array() {
                                for m_val in data_arr {
                                    if let Some(mid) = m_val["id"].as_u64() {
                                        proj_meta.insert(mid as u32, m_val.clone());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let file_ids: Vec<u32> = project_ids.iter().filter_map(|pid| proj_to_file.get(pid)).cloned().collect();
            let mut file_meta: std::collections::HashMap<u32, serde_json::Value> = std::collections::HashMap::new();
            for chunk in file_ids.chunks(100) {
                let body = serde_json::json!({ "fileIds": chunk });
                if let Ok(res) = client
                    .post("https://api.curseforge.com/v1/mods/files")
                    .header("x-api-key", "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm")
                    .json(&body)
                    .send()
                    .await
                {
                    if res.status().is_success() {
                        if let Ok(resp_val) = res.json::<serde_json::Value>().await {
                            if let Some(data_arr) = resp_val["data"].as_array() {
                                for f_val in data_arr {
                                    if let Some(fid) = f_val["id"].as_u64() {
                                        file_meta.insert(fid as u32, f_val.clone());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            for pid in &project_ids {
                let m_val = proj_meta.get(pid);
                let name = m_val
                    .and_then(|v| v["name"].as_str())
                    .unwrap_or("")
                    .to_string();
                let name = if name.is_empty() { format!("Mod ID: {}", pid) } else { name };
                let author = m_val
                    .and_then(|v| v["authors"].as_array())
                    .and_then(|a| a.first())
                    .and_then(|a| a["name"].as_str())
                    .unwrap_or("CurseForge")
                    .to_string();
                let summary = m_val
                    .and_then(|v| v["summary"].as_str())
                    .unwrap_or("")
                    .to_string();
                let version = if let Some(fid) = proj_to_file.get(pid) {
                    if let Some(f_val) = file_meta.get(fid) {
                        let display_name = f_val["displayName"].as_str().unwrap_or("");
                        let file_name = f_val["fileName"].as_str().unwrap_or("");
                        if !display_name.is_empty() {
                            extract_version_from_filename(display_name)
                        } else {
                            extract_version_from_filename(file_name)
                        }
                    } else { String::new() }
                } else { String::new() };

                mods.push(ModInfo {
                    id: pid.to_string(),
                    name,
                    version,
                    author,
                    license: summary,
                    size: 0,
                });
            }
        }

        if mods.is_empty() {
            for f in &manifest.files {
                mods.push(ModInfo {
                    id: f.project_id.to_string(),
                    name: format!("Mod ID: {}", f.project_id),
                    version: String::new(),
                    author: "CurseForge".to_string(),
                    license: "Manual Download".to_string(),
                    size: 0,
                });
            }
        }

        Ok(ModpackInfo {
            name: manifest.name,
            version_id: manifest.version,
            game_version,
            modloader,
            modloader_version,
            mods,
        })
    }
}

#[tauri::command]
pub async fn import_pack(
    app: AppHandle,
    instance_id: String,
    file_path: String,
    selected_mods: Option<Vec<String>>,
) -> Result<Vec<BlockedMod>, String> {
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let mc_dir = instance_dir.join("minecraft");

    fs::create_dir_all(&mc_dir).ok();

    let (pack_type, modrinth_files, curseforge_files) = {
        let file = fs::File::open(&file_path).map_err(|e| format!("無法開啟整合包檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        let is_modrinth = archive.by_name("modrinth.index.json").is_ok();
        let is_curseforge = archive.by_name("manifest.json").is_ok();

        if is_modrinth {
            let mut index_entry = archive.by_name("modrinth.index.json").unwrap();
            let index: ModrinthIndex = serde_json::from_reader(&mut index_entry)
                .map_err(|e| format!("解析 modrinth.index.json 失敗: {}", e))?;
            ("modrinth", Some(index.files), None)
        } else if is_curseforge {
            let mut manifest_entry = archive.by_name("manifest.json").unwrap();
            let manifest: CurseForgeManifest = serde_json::from_reader(&mut manifest_entry)
                .map_err(|e| format!("解析 manifest.json 失敗: {}", e))?;
            ("curseforge", None, Some(manifest.files))
        } else {
            let mut is_mmc = false;
            for i in 0..archive.len() {
                if let Ok(entry) = archive.by_index(i) {
                    let name = entry.name();
                    if name.ends_with("instance.cfg") || name.ends_with("mmc-pack.json") {
                        is_mmc = true;
                        break;
                    }
                }
            }
            if is_mmc {
                ("multimc", None, None)
            } else {
                return Err("不支援的整合包格式（未找到 modrinth.index.json、manifest.json 或 instance.cfg）".to_string());
            }
        }
    };

    let mut blocked_mods = vec![];

    if pack_type == "modrinth" {
        let files = modrinth_files.unwrap();
        let mut files_to_download = vec![];
        for f in files {
            if let Some(ref sel) = selected_mods {
                let is_mod = f.path.starts_with("mods/") || f.path.starts_with("mods\\");
                if is_mod {
                    let filename = Path::new(&f.path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&f.path)
                        .to_string();
                    if !sel.contains(&f.path) && !sel.contains(&filename) {
                        continue;
                    }
                }
            }
            files_to_download.push(f);
        }
        let total_files = files_to_download.len();

        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "importing_modpack".to_string(),
                progress: 0.0,
                detail: format!("開始匯入 Modpack，共 {} 個檔案...", total_files),
            },
        )
        .ok();

        let downloaded_count = Arc::new(tokio::sync::Mutex::new(0));
        let semaphore = Arc::new(Semaphore::new(10));
        let mut tasks = vec![];

        let app_handle = Arc::new(app.clone());

        for f in files_to_download {
            let sem = semaphore.clone();
            let count = downloaded_count.clone();
            let app_h = app_handle.clone();
            let inst_id = instance_id.clone();
            let dest = mc_dir.join(f.path.replace('/', "\\"));

            let download_url = f
                .downloads
                .first()
                .cloned()
                .ok_or_else(|| "檔案缺少下載網址".to_string())?;

            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                let client = reqwest::Client::new();
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).ok();
                }

                let mut success = false;
                let mut retries = 3;
                while retries > 0 && !success {
                    if let Ok(res) = client.get(&download_url).send().await {
                        if res.status().is_success() {
                            if let Ok(bytes) = res.bytes().await {
                                if fs::write(&dest, &bytes).is_ok() {
                                    success = true;
                                }
                            }
                        }
                    }
                    if !success {
                        retries -= 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }

                let mut c = count.lock().await;
                *c += 1;
                let progress = (*c as f64 / total_files as f64) * 80.0;
                app_h
                    .emit(
                        "download-progress",
                        ProgressPayload {
                            instance_id: Some(inst_id),
                            status: "importing_modpack".to_string(),
                            progress,
                            detail: format!("匯入進度：{}/{} 個檔案", *c, total_files),
                        },
                    )
                    .ok();
            }));
        }

        for t in tasks {
            let _ = t.await;
        }

        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "importing_modpack".to_string(),
                progress: 90.0,
                detail: "正在解壓設定檔與覆蓋項目 (overrides)...".to_string(),
            },
        )
        .ok();

        let file = fs::File::open(&file_path).map_err(|e| format!("無法再次開啟整合包檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).unwrap();
            let entry_name = entry.name().replace('/', "\\");

            if let Some(relative_path) = entry_name.strip_prefix("overrides\\") {
                if relative_path.is_empty() {
                    continue;
                }

                let out_path = mc_dir.join(relative_path);
                if entry.is_dir() {
                    fs::create_dir_all(&out_path).ok();
                } else {
                    if let Some(parent) = out_path.parent() {
                        fs::create_dir_all(parent).ok();
                    }
                    let mut outfile = fs::File::create(&out_path).unwrap();
                    std::io::copy(&mut entry, &mut outfile).ok();
                }
            }
        }
    } else if pack_type == "curseforge" {
        let manifest_files = curseforge_files.unwrap();
        let mut file_ids = vec![];
        for f in &manifest_files {
            if let Some(ref sel) = selected_mods {
                let id_str = f.project_id.to_string();
                let name_filter = format!("Mod ID: {}", f.project_id);
                if !sel.contains(&id_str) && !sel.contains(&name_filter) {
                    continue;
                }
            }
            file_ids.push(f.file_id);
        }

        let total_files = file_ids.len();
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "importing_modpack".to_string(),
                progress: 0.0,
                detail: format!("開始匯入 CurseForge 整合包，共 {} 個檔案...", total_files),
            },
        )
        .ok();

        let mut curseforge_files = vec![];
        let client = reqwest::Client::new();
        for chunk in file_ids.chunks(100) {
            let body = serde_json::json!({
                "fileIds": chunk
            });
            if let Ok(res) = client
                .post("https://api.curseforge.com/v1/mods/files")
                .header(
                    "x-api-key",
                    "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm",
                )
                .json(&body)
                .send()
                .await
            {
                if res.status().is_success() {
                    if let Ok(resp_val) = res.json::<serde_json::Value>().await {
                        if let Some(data_arr) = resp_val["data"].as_array() {
                            for f_val in data_arr {
                                curseforge_files.push(f_val.clone());
                            }
                        }
                    }
                }
            }
        }

        let mut tasks = vec![];
        let sem = Arc::new(Semaphore::new(10));
        let count = Arc::new(tokio::sync::Mutex::new(0));
        let app_handle = Arc::new(app.clone());

        for f_val in curseforge_files {
            let file_id = f_val["id"].as_u64().unwrap_or(0) as u32;
            let project_id = f_val["modId"].as_u64().unwrap_or(0) as u32;
            let file_name = f_val["fileName"].as_str().unwrap_or("").to_string();
            let download_url = f_val["downloadUrl"].as_str().map(|s| s.to_string());
            let sha1 = f_val["hashes"]
                .as_array()
                .and_then(|arr| arr.iter().find(|h| h["algo"].as_i64() == Some(1)))
                .and_then(|h| h["value"].as_str())
                .unwrap_or("")
                .to_string();

            if download_url.is_none() || download_url.as_ref().unwrap().trim().is_empty() {
                blocked_mods.push(BlockedMod {
                    project_id,
                    file_id,
                    file_name,
                    sha1,
                });
                let count_clone = count.clone();
                let app_h = app_handle.clone();
                let inst_id = instance_id.clone();
                tokio::spawn(async move {
                    let mut c = count_clone.lock().await;
                    *c += 1;
                    let progress = (*c as f64 / total_files as f64) * 80.0;
                    app_h
                        .emit(
                            "download-progress",
                            ProgressPayload {
                                instance_id: Some(inst_id),
                                status: "importing_modpack".to_string(),
                                progress,
                                detail: format!("匯入進度：{}/{} 個 Mod", *c, total_files),
                            },
                        )
                        .ok();
                });
                continue;
            }

            let url = download_url.unwrap();
            let dest = mc_dir.join("mods").join(&file_name);
            let sem_clone = sem.clone();
            let count_clone = count.clone();
            let app_h = app_handle.clone();
            let inst_id = instance_id.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = sem_clone.acquire().await.unwrap();
                let client = reqwest::Client::new();
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).ok();
                }

                let mut success = false;
                let mut retries = 3;
                while retries > 0 && !success {
                    if let Ok(res) = client.get(&url).send().await {
                        if res.status().is_success() {
                            if let Ok(bytes) = res.bytes().await {
                                if fs::write(&dest, &bytes).is_ok() {
                                    success = true;
                                }
                            }
                        }
                    }
                    if !success {
                        retries -= 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }

                let mut c = count_clone.lock().await;
                *c += 1;
                let progress = (*c as f64 / total_files as f64) * 80.0;
                app_h
                    .emit(
                        "download-progress",
                        ProgressPayload {
                            instance_id: Some(inst_id),
                            status: "importing_modpack".to_string(),
                            progress,
                            detail: format!("匯入進度：{}/{} 個 Mod", *c, total_files),
                        },
                    )
                    .ok();
            }));
        }

        for t in tasks {
            let _ = t.await;
        }

        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "importing_modpack".to_string(),
                progress: 90.0,
                detail: "正在解壓設定檔與覆蓋項目 (overrides)...".to_string(),
            },
        )
        .ok();

        // 重新開啟 zip 以解壓 overrides
        let file =
            fs::File::open(&file_path).map_err(|e| format!("無法再次開啟整合包檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).unwrap();
            let entry_name = entry.name().replace('/', "\\");

            if let Some(relative_path) = entry_name.strip_prefix("overrides\\") {
                if relative_path.is_empty() {
                    continue;
                }

                let out_path = mc_dir.join(relative_path);
                if entry.is_dir() {
                    fs::create_dir_all(&out_path).ok();
                } else {
                    if let Some(parent) = out_path.parent() {
                        fs::create_dir_all(parent).ok();
                    }
                    let mut outfile = fs::File::create(&out_path).unwrap();
                    std::io::copy(&mut entry, &mut outfile).ok();
                }
            }
        }
    } else if pack_type == "multimc" {
        app.emit(
            "download-progress",
            ProgressPayload {
                instance_id: Some(instance_id.clone()),
                status: "importing_modpack".to_string(),
                progress: 10.0,
                detail: "正在解壓縮 MultiMC 整合包...".to_string(),
            },
        )
        .ok();

        let file = fs::File::open(&file_path).map_err(|e| format!("無法開啟整合包檔案: {}", e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 zip 失敗: {}", e))?;

        let mut cfg_name = None;
        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index(i) {
                let name = entry.name();
                if name.ends_with("instance.cfg") {
                    cfg_name = Some(name.to_string());
                    break;
                }
            }
        }
        let mut found_prefix = String::new();
        if let Some(name) = cfg_name {
            if let Some(idx) = name.rfind("instance.cfg") {
                found_prefix = name[..idx].to_string();
            }
        }

        let mut mc_prefix = found_prefix.clone();
        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index(i) {
                let name = entry.name();
                if name.starts_with(&(found_prefix.clone() + "minecraft/")) || name.starts_with(&(found_prefix.clone() + "minecraft\\")) {
                    mc_prefix = found_prefix.clone() + "minecraft/";
                    break;
                } else if name.starts_with(&(found_prefix.clone() + ".minecraft/")) || name.starts_with(&(found_prefix.clone() + ".minecraft\\")) {
                    mc_prefix = found_prefix.clone() + ".minecraft/";
                    break;
                }
            }
        }

        let total_entries = archive.len();
        for i in 0..total_entries {
            let mut entry = archive.by_index(i).map_err(|e| format!("讀取 entry 失敗: {}", e))?;
            let entry_name = entry.name().to_string();

            let name_lower = entry_name.to_lowercase();
            if name_lower.contains("assets/") || name_lower.contains("assets\\") || name_lower.contains("libraries/") || name_lower.contains("libraries\\") {
                continue;
            }

            if !entry_name.starts_with(&mc_prefix) {
                continue;
            }
            let relative_path = entry_name.strip_prefix(&mc_prefix).unwrap().replace('/', "\\");
            if relative_path.is_empty() || relative_path == "instance.cfg" || relative_path == "mmc-pack.json" {
                continue;
            }

            if let Some(ref sel) = selected_mods {
                let is_mod = relative_path.starts_with("mods/") || relative_path.starts_with("mods\\");
                if is_mod {
                    let filename = Path::new(&relative_path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&relative_path)
                        .to_string();
                    if !sel.contains(&entry_name) && !sel.contains(&relative_path) && !sel.contains(&filename) {
                        continue;
                    }
                }
            }

            let out_path = mc_dir.join(&relative_path);
            if entry.is_dir() {
                fs::create_dir_all(&out_path).ok();
            } else {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent).ok();
                }
                let mut outfile = fs::File::create(&out_path).map_err(|e| format!("無法建立檔案: {}", e))?;
                std::io::copy(&mut entry, &mut outfile).ok();
            }

            if i % 10 == 0 {
                let progress = 10.0 + (i as f64 / total_entries as f64) * 80.0;
                app.emit(
                    "download-progress",
                    ProgressPayload {
                        instance_id: Some(instance_id.clone()),
                        status: "importing_modpack".to_string(),
                        progress,
                        detail: format!("解壓縮進度：{}/{}...", i, total_entries),
                    },
                )
                .ok();
            }
        }
    }

    app.emit(
        "download-progress",
        ProgressPayload {
            instance_id: Some(instance_id.clone()),
            status: "complete".to_string(),
            progress: 100.0,
            detail: "Modpack 導入完成！".to_string(),
        },
    )
    .ok();

    Ok(blocked_mods)
}

// ==========================================
// 遊戲程序啟動 (Launch)
// ==========================================

#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    state: State<'_, crate::SessionState>,
    instance_id: String,
    java_path: String,
    account_json: String,
) -> Result<(), String> {
    let session = get_or_create_session(&state, &instance_id);
    {
        let child_guard = session.child.lock().map_err(|e| e.to_string())?;
        if child_guard.is_some() {
            return Err("該實例遊戲已在運行中！".to_string());
        }
    }
    if session
        .cancel_token
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err("Cancelled".to_string());
    }

    let base_dir = get_app_dir()?;
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let mc_dir = instance_dir.join("minecraft");
    let natives_dir = instance_dir.join("natives");
    fs::create_dir_all(&natives_dir).ok();

    let cfg_file = instance_dir.join("instance.cfg");
    let cfg_content =
        fs::read_to_string(&cfg_file).map_err(|e| format!("無法讀取 instance.cfg: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&cfg_content).map_err(|e| format!("無法解析 instance.cfg: {}", e))?;
    cfg.id = instance_id.clone();

    // 解析帳號
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LaunchAccount {
        id: String,
        mc_id: String,
        mc_access_token: String,
    }
    let account: LaunchAccount =
        serde_json::from_str(&account_json).map_err(|e| format!("無法解析登入帳號: {}", e))?;

    // 1. 取得版本 JSON 內容
    let version_json_path = base_dir
        .join("version")
        .join(&cfg.version)
        .join(format!("{}.json", cfg.version));
    if !version_json_path.exists() {
        return Err("找不到版本 JSON 檔案，請先下載！".to_string());
    }

    let version_info_str =
        fs::read_to_string(&version_json_path).map_err(|e| format!("無法讀取版本 JSON: {}", e))?;
    let vanilla_info: MinecraftVersionInfo =
        serde_json::from_str(&version_info_str).map_err(|e| format!("無法解析版本 JSON: {}", e))?;

    // 若存在繼承版本，載入基礎版本的 JSON 設定檔
    let mut base_vanilla_info: Option<MinecraftVersionInfo> = None;
    if let Some(ref base_ver) = vanilla_info.inherits_from {
        let base_version_json_path = base_dir
            .join("version")
            .join(base_ver)
            .join(format!("{}.json", base_ver));
        if base_version_json_path.exists() {
            let base_version_info_str = fs::read_to_string(&base_version_json_path)
                .map_err(|e| format!("無法讀取基礎版本 JSON: {}", e))?;
            let parsed_base: MinecraftVersionInfo = serde_json::from_str(&base_version_info_str)
                .map_err(|e| format!("無法解析基礎版本 JSON: {}", e))?;
            base_vanilla_info = Some(parsed_base);
        } else {
            return Err(format!(
                "找不到基礎版本 {} 的 JSON 檔案，請重新安裝！",
                base_ver
            ));
        }
    }

    // 2. 解壓 Native Libraries (適用舊版本)
    let libraries_dir = instance_dir.join("libraries");
    let mut libraries_for_natives = vanilla_info.libraries.clone();
    if let Some(ref base_info) = base_vanilla_info {
        libraries_for_natives.extend(base_info.libraries.clone());
    }

    for lib in &libraries_for_natives {
        if should_use_library(&lib.rules) {
            if let Some(ref downloads) = lib.downloads {
                if let Some(ref natives_val) = lib.natives {
                    if let Some(native_key) = natives_val.get("windows") {
                        let native_key_str =
                            native_key.as_str().unwrap_or("").replace("${arch}", "64");
                        if let Some(ref classifiers) = downloads.classifiers {
                            if let Some(classifier_art_val) = classifiers.get(&native_key_str) {
                                if let Ok(classifier_art) = serde_json::from_value::<ArtifactItem>(
                                    classifier_art_val.clone(),
                                ) {
                                    let native_jar_path = libraries_dir.join(&classifier_art.path);
                                    if native_jar_path.exists() {
                                        let jar_file = fs::File::open(&native_jar_path).unwrap();
                                        if let Ok(mut archive) = ZipArchive::new(jar_file) {
                                            for j in 0..archive.len() {
                                                let mut entry = archive.by_index(j).unwrap();
                                                let entry_name = entry.name().to_string();
                                                if entry_name.ends_with(".dll") {
                                                    let out_path = natives_dir.join(&entry_name);
                                                    if let Some(p) = out_path.parent() {
                                                        fs::create_dir_all(p).ok();
                                                    }
                                                    let mut outfile =
                                                        fs::File::create(&out_path).unwrap();
                                                    std::io::copy(&mut entry, &mut outfile).ok();
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. 建立 Classpath
    let mut classpath_items = vec![];

    // 加入 vanilla libraries
    let mut vanilla_libs = vanilla_info.libraries.clone();
    if let Some(ref base_info) = base_vanilla_info {
        vanilla_libs.extend(base_info.libraries.clone());
    }

    for lib in &vanilla_libs {
        if should_use_library(&lib.rules) {
            if let Some(ref downloads) = lib.downloads {
                if let Some(ref artifact) = downloads.artifact {
                    let lib_path = libraries_dir.join(&artifact.path);
                    if lib_path.exists() && !classpath_items.contains(&lib_path) {
                        classpath_items.push(lib_path);
                    }
                }
            }
        }
    }

    // 載入第三方加載器（Fabric/Forge/NeoForge/Custom）程式庫
    let is_fabric = cfg.modloader.eq_ignore_ascii_case("fabric");
    let is_forge = cfg.modloader.eq_ignore_ascii_case("forge");
    let is_neoforge = cfg.modloader.eq_ignore_ascii_case("neoforge");
    let is_custom = cfg.modloader.eq_ignore_ascii_case("custom");

    let mut fabric_main_class: Option<String> = None;
    let mut loader_main_class: Option<String> = None;
    let mut loader_jvm_args: Vec<String> = vec![];
    let mut loader_game_args: Vec<String> = vec![];

    if is_fabric {
        let query_version = vanilla_info.inherits_from.as_ref().unwrap_or(&cfg.version);
        let loader_version = match cfg.loader_version {
            Some(ref v) if !v.is_empty() => v.clone(),
            _ => {
                let loader_res = reqwest::Client::new()
                    .get(format!(
                        "https://meta.fabricmc.net/v2/versions/loader/{}",
                        query_version
                    ))
                    .send()
                    .await
                    .map_err(|e| format!("取得 Fabric Loader 失敗: {}", e))?;
                let loaders = loader_res
                    .json::<Vec<FabricLoaderInfo>>()
                    .await
                    .unwrap_or_default();
                let latest_loader = loaders
                    .first()
                    .ok_or_else(|| "該版本無可用的 Fabric Loader".to_string())?;
                latest_loader.loader.version.clone()
            }
        };
        let profile_url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
            query_version, loader_version
        );
        if let Ok(res) = reqwest::Client::new().get(&profile_url).send().await {
            if let Ok(fabric_profile) = res.json::<FabricProfile>().await {
                fabric_main_class = Some(fabric_profile.main_class.clone());
                for flib in fabric_profile.libraries {
                    if let Some(path) = maven_to_path(&flib.name) {
                        let lib_path = libraries_dir.join(Path::new(&path));
                        if lib_path.exists() {
                            classpath_items.push(lib_path);
                        }
                    }
                }
            }
        }
    } else if is_forge || is_neoforge {
        let versions_dir = mc_dir.join("versions");
        if let Some(json_path) = find_loader_json(&versions_dir) {
            if let Ok(json_content) = fs::read_to_string(&json_path) {
                if let Ok(loader_val) = serde_json::from_str::<serde_json::Value>(&json_content) {
                    if let Some(mc) = loader_val["mainClass"].as_str() {
                        loader_main_class = Some(mc.to_string());
                    }
                    if let Some(libs) = loader_val["libraries"].as_array() {
                        for lib in libs {
                            if let Some(name) = lib["name"].as_str() {
                                if let Some(path) = maven_to_path(name) {
                                    let lib_path_global = libraries_dir.join(&path);
                                    let lib_path_instance = mc_dir.join("libraries").join(&path);
                                    if lib_path_instance.exists() {
                                        classpath_items.push(lib_path_instance);
                                    } else if lib_path_global.exists() {
                                        classpath_items.push(lib_path_global);
                                    }
                                }
                            }
                        }
                    }
                    if let Some(jvm_array) = loader_val["arguments"]["jvm"].as_array() {
                        for arg_val in jvm_array {
                            if let Some(s) = arg_val.as_str() {
                                loader_jvm_args.push(s.to_string());
                            }
                        }
                    }
                    if let Some(game_array) = loader_val["arguments"]["game"].as_array() {
                        for arg_val in game_array {
                            if let Some(s) = arg_val.as_str() {
                                loader_game_args.push(s.to_string());
                            }
                        }
                    }
                }
            }
        }
    } else if is_custom {
        let custom_jar = get_instances_dir()?.join(&cfg.id).join("custom_loader.jar");
        if custom_jar.exists() {
            classpath_items.push(custom_jar);
        }
        if let Some(ref mc) = cfg.loader_version {
            if !mc.trim().is_empty() {
                loader_main_class = Some(mc.clone());
            }
        }
    }

    // 載入遊戲主程式 JAR 檔
    let jar_version = vanilla_info.inherits_from.as_ref().unwrap_or(&cfg.version);
    let client_jar_path = base_dir
        .join("version")
        .join(jar_version)
        .join(format!("{}.jar", jar_version));
    classpath_items.push(client_jar_path);

    // 建立 Classpath 參數（Windows 使用分號分隔）
    let classpath_items = resolve_classpath_duplicates(classpath_items);
    let classpath_str = classpath_items
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<String>>()
        .join(";");

    // 組裝 Java 啟動參數
    let mut cmd = create_command(&java_path);
    cmd.current_dir(&mc_dir);

    // JVM 記憶體參數
    let max_mem = cfg.max_memory.unwrap_or(4096);
    cmd.arg(format!("-Xmx{}M", max_mem));
    cmd.arg(format!("-Xms{}M", (max_mem / 4).max(512)));

    // 預設注入優化之 G1GC 垃圾回收參數
    let mut has_custom_args = false;
    if let Some(ref custom_args) = cfg.jvm_args {
        if !custom_args.trim().is_empty() {
            has_custom_args = true;
        }
    }

    if !has_custom_args {
        cmd.arg("-XX:+UseG1GC");
        cmd.arg("-XX:+UnlockExperimentalVMOptions");
        cmd.arg("-XX:MaxGCPauseMillis=50");
        cmd.arg("-XX:G1NewSizePercent=20");
        cmd.arg("-XX:G1ReservePercent=20");
        cmd.arg("-XX:G1HeapRegionSize=16M");
        cmd.arg("-XX:+ParallelRefProcEnabled");
        cmd.arg("-XX:SurvivorRatio=8");
    } else {
        cmd.arg("-XX:+UseG1GC");
        cmd.arg("-XX:+ParallelRefProcEnabled");
        cmd.arg("-XX:MaxGCPauseMillis=200");
    }

    cmd.arg("-Dsun.stdout.encoding=UTF-8");
    cmd.arg("-Dsun.stderr.encoding=UTF-8");
    cmd.arg(format!(
        "-Djava.library.path={}",
        natives_dir.to_string_lossy()
    ));
    cmd.arg("-Dminecraft.launcher.brand=FocalCraft");
    cmd.arg("-Dminecraft.launcher.version=0.1.0");

    // 設置 Fabric 執行環境標誌
    if is_fabric {
        cmd.arg("-Dfabric.development=false");
    }

    // 載入使用者自訂 JVM 參數
    if let Some(ref custom_args) = cfg.jvm_args {
        if !custom_args.trim().is_empty() {
            for arg in custom_args.split_whitespace() {
                cmd.arg(arg);
            }
        }
    }

    // 設置變數替換對照表
    let assets_dir = instance_dir.join("assets");
    let asset_index_id = vanilla_info
        .asset_index
        .as_ref()
        .or_else(|| {
            base_vanilla_info
                .as_ref()
                .and_then(|b| b.asset_index.as_ref())
        })
        .map(|a| a.id.clone())
        .unwrap_or_else(|| "legacy".to_string());
    let vars: std::collections::HashMap<&str, String> = [
        ("auth_player_name", account.mc_id.clone()),
        ("version_name", cfg.version.clone()),
        ("game_directory", mc_dir.to_string_lossy().to_string()),
        ("assets_root", assets_dir.to_string_lossy().to_string()),
        ("assets_index_name", asset_index_id),
        ("auth_uuid", account.id.replace("-", "")),
        ("auth_access_token", account.mc_access_token.clone()),
        ("user_type", "msa".to_string()),
        ("version_type", "FocalCraft".to_string()),
        ("resolution_width", "856".to_string()),
        ("resolution_height", "482".to_string()),
        (
            "natives_directory",
            natives_dir.to_string_lossy().to_string(),
        ),
        ("launcher_name", "FocalCraft".to_string()),
        ("launcher_version", "0.1.0".to_string()),
        ("classpath", classpath_str.clone()),
    ]
    .iter()
    .cloned()
    .collect();

    fn substitute(s: &str, vars: &std::collections::HashMap<&str, String>) -> String {
        let mut result = s.to_string();
        for (k, v) in vars {
            result = result.replace(&format!("${{{}}}", k), v);
        }
        result
    }

    // 載入第三方加載器專屬 JVM 參數
    for arg in &loader_jvm_args {
        cmd.arg(substitute(arg, &vars));
    }

    // 設定 Classpath 與進入點
    cmd.arg("-cp");
    cmd.arg(&classpath_str);

    // 決定主程式啟動類別 (MainClass)
    let main_class_default: String;
    let main_class = if let Some(ref lmc) = loader_main_class {
        lmc.as_str()
    } else if let Some(ref fc) = fabric_main_class {
        fc.as_str()
    } else if is_fabric {
        "net.fabricmc.loader.impl.launch.knot.KnotClient"
    } else {
        main_class_default = vanilla_info
            .main_class
            .as_ref()
            .or_else(|| {
                base_vanilla_info
                    .as_ref()
                    .and_then(|b| b.main_class.as_ref())
            })
            .cloned()
            .unwrap_or_else(|| "net.minecraft.client.main.Main".to_string());
        &main_class_default
    };
    cmd.arg(main_class);

    // 組裝 Minecraft 遊戲執行參數
    if !loader_game_args.is_empty() {
        for arg in &loader_game_args {
            cmd.arg(substitute(arg, &vars));
        }
    }
    // 處理舊格式參數（Minecraft 1.12 以前）
    else if let Some(mc_args_str) = vanilla_info.minecraft_arguments.as_ref().or_else(|| {
        base_vanilla_info
            .as_ref()
            .and_then(|b| b.minecraft_arguments.as_ref())
    }) {
        for token in mc_args_str.split_whitespace() {
            cmd.arg(substitute(token, &vars));
        }
    }
    // 處理新格式參數（Minecraft 1.13 以上）
    else if let Some(arguments) = vanilla_info.arguments.as_ref().or_else(|| {
        base_vanilla_info
            .as_ref()
            .and_then(|b| b.arguments.as_ref())
    }) {
        if let Some(ref game_args) = arguments.game {
            for arg_val in game_args {
                if let Some(s) = arg_val.as_str() {
                    cmd.arg(substitute(s, &vars));
                }
            }
        }
    }

    if session
        .cancel_token
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err("Cancelled".to_string());
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("無法啟動 Minecraft 進程: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // 在 Session 中註冊子行程
    let session_child = session.child.clone();
    {
        let mut child_guard = session_child.lock().unwrap();
        *child_guard = Some(child);
    }

    // 發送事件通知前端遊戲已啟動
    app.emit(
        "game-status",
        serde_json::json!({
            "instanceId": instance_id,
            "status": "running"
        }),
    )
    .ok();

    // 在背景執行緒中串流標準輸出 (stdout)
    let app_stdout = app.clone();
    let inst_id_stdout = instance_id.clone();
    if let Some(stdout) = stdout {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stdout);
            for l in reader.lines().map_while(Result::ok) {
                let _ = app_stdout.emit(
                    "game-log",
                    serde_json::json!({
                        "instanceId": inst_id_stdout,
                        "text": l,
                        "stream": "stdout"
                    }),
                );
            }
        });
    }

    // 在背景執行緒中串流標準錯誤 (stderr)
    let app_stderr = app.clone();
    let inst_id_stderr = instance_id.clone();
    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            for l in reader.lines().map_while(Result::ok) {
                let _ = app_stderr.emit(
                    "game-log",
                    serde_json::json!({
                        "instanceId": inst_id_stderr,
                        "text": l,
                        "stream": "stderr"
                    }),
                );
            }
        });
    }

    // 在背景執行緒監控遊戲程序退出，並偵測崩潰（Bug #5）
    let app_handle = app.clone();
    let inst_id = instance_id.clone();
    tokio::task::spawn(async move {
        let mut exit_code = 0;
        let mut exited = false;

        loop {
            {
                let mut guard = session_child.lock().unwrap();
                if let Some(ref mut child) = *guard {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            exit_code = status.code().unwrap_or(0);
                            exited = true;
                        }
                        Ok(None) => {}
                        Err(_) => {
                            exit_code = -1;
                            exited = true;
                        }
                    }
                } else {
                    exit_code = -1;
                    exited = true;
                }
            }
            if exited {
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        // 清理暫存資源
        {
            let mut guard = session_child.lock().unwrap();
            *guard = None;
        }

        // 遊戲退出，更新 lastPlayed
        update_last_played(&inst_id).ok();

        let crashed = exit_code != 0;
        app_handle
            .emit(
                "game-status",
                serde_json::json!({
                    "instanceId": inst_id,
                    "status": "exited",
                    "exitCode": exit_code,
                    "crashed": crashed
                }),
            )
            .ok();
    });

    Ok(())
}

fn update_last_played(instance_id: &str) -> Result<(), String> {
    let cfg_file = get_instances_dir()?.join(instance_id).join("instance.cfg");
    if cfg_file.exists() {
        if let Ok(content) = fs::read_to_string(&cfg_file) {
            if let Ok(mut cfg) = serde_json::from_str::<InstanceConfig>(&content) {
                cfg.id = instance_id.to_string();
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                cfg.last_played = Some(now);
                if let Ok(json) = serde_json::to_string_pretty(&cfg) {
                    let _ = fs::write(cfg_file, json);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn select_mrpack_file() -> Result<String, String> {
    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.OpenFileDialog
        $f.Filter = "整合包檔案 (*.mrpack;*.zip)|*.mrpack;*.zip|Modrinth 整合包 (*.mrpack)|*.mrpack|CurseForge 整合包 (*.zip)|*.zip"
        $f.Title = "選擇整合包檔案 (.mrpack / .zip)"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.FileName
        }
    "#.to_string();

    let output = tokio::task::spawn_blocking(move || {
        create_command("powershell")
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
pub async fn download_pack(url: String) -> Result<String, String> {
    let base_dir = get_app_dir()?;
    let temp_dir = base_dir.join("temp");
    fs::create_dir_all(&temp_dir).ok();

    let dest_path = temp_dir.join("temp_download.pack");
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("下載整合包失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("下載伺服器回應錯誤: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取整合包內容失敗: {}", e))?;
    fs::write(&dest_path, &bytes).map_err(|e| format!("寫入整合包失敗: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

// ==========================================
// 全域設定與檔案遷移
// ==========================================

#[tauri::command]
pub async fn load_global_config() -> Result<GlobalConfig, String> {
    let base_dir = get_app_dir()?;
    let global_cfg_path = base_dir.join("global.cfg");
    if global_cfg_path.exists() {
        let content = fs::read_to_string(&global_cfg_path)
            .map_err(|e| format!("讀取 global.cfg 失敗: {}", e))?;
        let config: GlobalConfig =
            serde_json::from_str(&content).map_err(|e| format!("解析 global.cfg 失敗: {}", e))?;
        Ok(config)
    } else {
        Ok(GlobalConfig {
            default_max_memory: Some(4096),
            default_jvm_args: None,
            custom_java_path: None,
            instances_path: None,
            language: None,
            main_color: None,
        })
    }
}

#[tauri::command]
pub async fn save_global_config(config: GlobalConfig) -> Result<(), String> {
    let base_dir = get_app_dir()?;
    let global_cfg_path = base_dir.join("global.cfg");

    // 1. 取得舊設定中的實例儲存路徑
    let mut old_path = None;
    if global_cfg_path.exists() {
        if let Ok(content) = fs::read_to_string(&global_cfg_path) {
            if let Ok(old_cfg) = serde_json::from_str::<GlobalConfig>(&content) {
                old_path = old_cfg.instances_path;
            }
        }
    }

    let actual_old_path = match old_path {
        Some(ref p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => base_dir.join("instances"),
    };

    let actual_new_path = match config.instances_path {
        Some(ref p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => base_dir.join("instances"),
    };

    // 2. 如果儲存位置有變，且舊位置存在，自動進行檔案遷移
    if actual_old_path != actual_new_path && actual_old_path.exists() {
        fs::create_dir_all(&actual_new_path)
            .map_err(|e| format!("無法建立新的實例儲存資料夾: {}", e))?;

        if let Ok(entries) = fs::read_dir(&actual_old_path) {
            for entry in entries.flatten() {
                let from_path = entry.path();
                if let Some(file_name) = from_path.file_name() {
                    let to_path = actual_new_path.join(file_name);
                    if from_path.is_dir() {
                        if fs::rename(&from_path, &to_path).is_err() {
                            copy_dir_recursive(&from_path, &to_path)?;
                            let _ = fs::remove_dir_all(&from_path);
                        }
                    } else if from_path.is_file()
                        && fs::rename(&from_path, &to_path).is_err() {
                            fs::copy(&from_path, &to_path)
                                .map_err(|e| format!("複製檔案失敗: {}", e))?;
                            let _ = fs::remove_file(&from_path);
                        }
                }
            }
        }
    }

    // 3. 寫入新設定
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化 global.cfg 失敗: {}", e))?;
    fs::write(global_cfg_path, content).map_err(|e| format!("寫入 global.cfg 失敗: {}", e))?;
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
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

fn extract_main_class_from_jar(jar_path: &Path) -> Result<String, String> {
    let file = fs::File::open(jar_path).map_err(|e| format!("無法開啟 jar 檔案: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("無法解析 jar 檔案: {}", e))?;
    let mut manifest_file = archive
        .by_name("META-INF/MANIFEST.MF")
        .map_err(|e| format!("找不到 META-INF/MANIFEST.MF: {}", e))?;

    use std::io::Read;
    let mut content = String::new();
    manifest_file
        .read_to_string(&mut content)
        .map_err(|e| format!("讀取 MANIFEST.MF 失敗: {}", e))?;

    let mut main_class = None;
    let mut current_key = String::new();
    let mut current_val = String::new();

    for line in content.lines() {
        if let Some(stripped) = line.strip_prefix(' ') {
            current_val.push_str(stripped.trim_end());
        } else {
            if current_key.eq_ignore_ascii_case("main-class") {
                main_class = Some(current_val.trim().to_string());
            }
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                current_key = parts[0].trim().to_string();
                current_val = parts[1].trim_end().to_string();
            } else {
                current_key.clear();
                current_val.clear();
            }
        }
    }
    if current_key.eq_ignore_ascii_case("main-class") {
        main_class = Some(current_val.trim().to_string());
    }

    main_class.ok_or_else(|| "MANIFEST.MF 中未找到 Main-Class".to_string())
}

#[tauri::command]
pub async fn upload_custom_loader_jar(
    instance_id: String,
    source_path: String,
) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let dest_path = instance_dir.join("custom_loader.jar");

    // 複製檔案
    fs::copy(&source_path, &dest_path).map_err(|e| format!("無法複製自訂 Loader 檔案: {}", e))?;

    // 擷取主類別 (Main-Class)
    let main_class = extract_main_class_from_jar(&dest_path)?;

    // 使用擷取的主類別更新實例設定檔
    let cfg_file = instance_dir.join("instance.cfg");
    if cfg_file.exists() {
        let content =
            fs::read_to_string(&cfg_file).map_err(|e| format!("讀取設定檔失敗: {}", e))?;
        let mut cfg: InstanceConfig =
            serde_json::from_str(&content).map_err(|e| format!("解析設定檔失敗: {}", e))?;
        cfg.id = instance_id.clone();
        cfg.loader_version = Some(main_class);
        let cfg_json =
            serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化設定檔失敗: {}", e))?;
        fs::write(&cfg_file, cfg_json).map_err(|e| format!("寫入設定檔失敗: {}", e))?;
    }

    Ok(())
}

#[derive(Deserialize)]
struct MmcVersionRequirement {
    equals: Option<String>,
    uid: Option<String>,
}

#[derive(Deserialize)]
struct MmcVersionEntry {
    version: String,
    requires: Option<Vec<MmcVersionRequirement>>,
}

#[derive(Deserialize)]
struct MmcIndex {
    versions: Vec<MmcVersionEntry>,
}

async fn get_fabric_loader_versions_internal(game_version: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}",
            game_version
        ))
        .send()
        .await
        .map_err(|e| format!("取得 Fabric Loader 失敗: {}", e))?;

    #[derive(Deserialize)]
    struct FabricLoader {
        version: String,
    }
    #[derive(Deserialize)]
    struct FabricLoaderEntry {
        loader: FabricLoader,
    }

    let list = res
        .json::<Vec<FabricLoaderEntry>>()
        .await
        .map_err(|e| format!("解析 Fabric Loader 失敗: {}", e))?;

    Ok(list.into_iter().map(|item| item.loader.version).collect())
}

#[tauri::command]
pub async fn get_loader_versions(
    modloader: String,
    game_version: String,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = match modloader.to_ascii_lowercase().as_str() {
        "fabric" => return get_fabric_loader_versions_internal(&game_version).await,
        "forge" => "https://meta.multimc.org/v1/net.minecraftforge/index.json",
        "neoforge" => "https://meta.multimc.org/v1/org.neoforged/index.json",
        _ => return Err("不支援的 Modloader 類型".to_string()),
    };

    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("取得 {} 版本列表失敗: {}", modloader, e))?;

    let index = res
        .json::<MmcIndex>()
        .await
        .map_err(|e| format!("解析 {} 版本列表失敗: {}", modloader, e))?;

    let mut filtered_versions = vec![];
    for entry in index.versions {
        let is_compatible = if let Some(reqs) = entry.requires {
            reqs.iter().any(|r| {
                r.uid.as_deref() == Some("net.minecraft")
                    && r.equals.as_deref() == Some(&game_version)
            })
        } else {
            false
        };
        if is_compatible {
            filtered_versions.push(entry.version);
        }
    }

    Ok(filtered_versions)
}

async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("下載失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("下載伺服器回應錯誤: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取下載內容失敗: {}", e))?;
    fs::write(dest, &bytes).map_err(|e| format!("寫入檔案失敗: {}", e))?;
    Ok(())
}

fn verify_sha1(path: &Path, expected_sha1: &str) -> bool {
    if expected_sha1.is_empty() {
        return true;
    }
    if let Ok(bytes) = fs::read(path) {
        use sha1::{Digest, Sha1};
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let result = hasher.finalize();
        let actual_sha1 = format!("{:x}", result);
        actual_sha1.eq_ignore_ascii_case(expected_sha1)
    } else {
        false
    }
}

#[tauri::command]
pub async fn select_directory() -> Result<String, String> {
    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = "選擇實例儲存資料夾"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.SelectedPath
        }
    "#
    .to_string();

    let output = tokio::task::spawn_blocking(move || {
        create_command("powershell")
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
pub async fn select_java_file() -> Result<String, String> {
    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.OpenFileDialog
        $f.Filter = "Java Executable (java.exe;javaw.exe)|java.exe;javaw.exe"
        $f.Title = "選擇 Java 執行檔"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $f.FileName
        }
    "#
    .to_string();

    let output = tokio::task::spawn_blocking(move || {
        create_command("powershell")
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
pub async fn verify_custom_java(path: String) -> Result<Option<JavaInstallation>, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(None);
    }
    Ok(check_java_version(&path))
}

// ==========================================
// 實例詳情與檔案管理 API
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModItem {
    pub file_name: String,
    pub name: String,
    pub version: String,
    pub environment: String,
    pub sha1: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePackItem {
    pub file_name: String,
    pub name: String,
    pub description: String,
    pub pack_format: i32,
    pub game_version: String,
    pub sha1: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorldItem {
    pub folder_name: String,
    pub name: String,
    pub size_bytes: u64,
    pub datapacks: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerItem {
    pub name: String,
    pub ip: String,
    pub accept_textures: Option<u8>,
}

// 解析 JAR 元資料的輔助函式
fn parse_fabric_mod_json(zip: &mut ZipArchive<fs::File>) -> Option<(String, String, String)> {
    let mut entry = zip.by_name("fabric.mod.json").ok()?;
    let val: serde_json::Value = serde_json::from_reader(&mut entry).ok()?;
    let name = val
        .get("name")
        .and_then(|n| n.as_str())
        .or_else(|| val.get("id").and_then(|i| i.as_str()))?
        .to_string();
    let version = val.get("version")?.as_str()?.to_string();
    let environment = val
        .get("environment")
        .and_then(|e| e.as_str())
        .unwrap_or("both")
        .to_string();
    Some((name, version, environment))
}

fn parse_mcmod_info(zip: &mut ZipArchive<fs::File>) -> Option<(String, String, String)> {
    let mut entry = zip.by_name("mcmod.info").ok()?;
    let val: serde_json::Value = serde_json::from_reader(&mut entry).ok()?;
    let mod_obj = if val.is_array() {
        val.get(0)?
    } else {
        val.get("modList").and_then(|l| l.get(0)).unwrap_or(&val)
    };
    let name = mod_obj.get("name")?.as_str()?.to_string();
    let version = mod_obj
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    Some((name, version, "both".to_string()))
}

fn parse_mods_toml(zip: &mut ZipArchive<fs::File>) -> Option<(String, String, String)> {
    let mut entry = zip.by_name("META-INF/mods.toml").ok()?;
    use std::io::Read;
    let mut content = String::new();
    entry.read_to_string(&mut content).ok()?;

    let mut name = None;
    let mut version = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("displayName") {
            if let Some(val) = trimmed.split('=').nth(1) {
                name = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        } else if trimmed.starts_with("version") {
            if let Some(val) = trimmed.split('=').nth(1) {
                version = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }

    if name.is_some() || version.is_some() {
        Some((
            name.unwrap_or_else(|| "Unknown Forge Mod".to_string()),
            version.unwrap_or_else(|| "unknown".to_string()),
            "both".to_string(),
        ))
    } else {
        None
    }
}

fn calculate_sha1(path: &Path) -> Result<String, String> {
    use sha1::{Digest, Sha1};
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", hasher.finalize()))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedModInfo {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub sha1: String,
}

#[allow(clippy::type_complexity)]
fn get_mod_cache() -> &'static std::sync::Mutex<
    std::collections::HashMap<PathBuf, (u64, std::time::SystemTime, CachedModInfo)>,
> {
    static CACHE: std::sync::OnceLock<
        std::sync::Mutex<
            std::collections::HashMap<PathBuf, (u64, std::time::SystemTime, CachedModInfo)>,
        >,
    > = std::sync::OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn parse_mod_file(path: PathBuf) -> Result<CachedModInfo, String> {
    let sha1 = calculate_sha1(&path).unwrap_or_default();
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let is_enabled = file_name.ends_with(".jar");
    let mut name = if is_enabled {
        file_name.replace(".jar", "")
    } else {
        file_name.replace(".jar.disabled", "")
    };

    let mut version = "unknown".to_string();
    let mut environment = "both".to_string();

    if let Ok(file) = fs::File::open(&path) {
        if let Ok(mut archive) = ZipArchive::new(file) {
            if let Some((mod_name, mod_ver, mod_env)) = parse_fabric_mod_json(&mut archive)
                .or_else(|| parse_mods_toml(&mut archive))
                .or_else(|| parse_mcmod_info(&mut archive))
            {
                name = mod_name;
                version = mod_ver;
                environment = mod_env;
            }
        }
    }

    Ok(CachedModInfo {
        name,
        version,
        environment,
        sha1,
    })
}

#[tauri::command]
pub async fn get_installed_mods(instance_id: String) -> Result<Vec<ModItem>, String> {
    let mods_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("mods");
    if !mods_dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(mods_dir).map_err(|e| format!("無法讀取 mods 資料夾: {}", e))?;
    let mut files_to_process = vec![];

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let is_enabled = file_name.ends_with(".jar");
            let is_disabled = file_name.ends_with(".jar.disabled");
            if is_enabled || is_disabled {
                files_to_process.push((path, file_name, is_enabled));
            }
        }
    }

    let mut handles = vec![];
    for (path, file_name, enabled) in files_to_process {
        handles.push(tokio::task::spawn_blocking(
            move || -> Result<ModItem, String> {
                let metadata = fs::metadata(&path).ok();
                let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let modified = metadata
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

                {
                    let cache = get_mod_cache().lock().unwrap();
                    if let Some((cached_size, cached_modified, info)) = cache.get(&path) {
                        if *cached_size == size && *cached_modified == modified {
                            return Ok(ModItem {
                                file_name,
                                name: info.name.clone(),
                                version: info.version.clone(),
                                environment: info.environment.clone(),
                                sha1: info.sha1.clone(),
                                enabled,
                            });
                        }
                    }
                }

                let info = parse_mod_file(path.clone())?;

                {
                    let mut cache = get_mod_cache().lock().unwrap();
                    cache.insert(path, (size, modified, info.clone()));
                }

                Ok(ModItem {
                    file_name,
                    name: info.name,
                    version: info.version,
                    environment: info.environment,
                    sha1: info.sha1,
                    enabled,
                })
            },
        ));
    }

    let mut list = vec![];
    for h in handles {
        if let Ok(Ok(item)) = h.await {
            list.push(item);
        }
    }

    Ok(list)
}

#[tauri::command]
pub async fn toggle_mod(
    instance_id: String,
    file_name: String,
    enabled: bool,
) -> Result<String, String> {
    let mods_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("mods");
    let current_path = mods_dir.join(&file_name);
    if !current_path.exists() {
        return Err("找不到該模組檔案".to_string());
    }

    let new_file_name = if enabled {
        if file_name.ends_with(".jar.disabled") {
            file_name.replace(".jar.disabled", ".jar")
        } else {
            file_name.clone()
        }
    } else {
        if file_name.ends_with(".jar") {
            format!("{}.disabled", file_name)
        } else {
            file_name.clone()
        }
    };

    let new_path = mods_dir.join(&new_file_name);
    if current_path != new_path {
        if new_path.exists() {
            return Err(format!(
                "無法啟用/停用模組：目標檔案 {} 已存在！",
                new_file_name
            ));
        }
        fs::rename(current_path, new_path).map_err(|e| format!("切換模組狀態失敗: {}", e))?;
    }

    Ok(new_file_name)
}

fn parse_mcmeta_json(content: &str) -> Option<(Option<String>, String, i32)> {
    let val: serde_json::Value = serde_json::from_str(content).ok()?;
    let pack = val.get("pack")?;
    let pack_format = pack.get("pack_format")?.as_i64()? as i32;
    let description = pack
        .get("description")
        .map(|d| {
            if d.is_string() {
                d.as_str().unwrap().to_string()
            } else {
                d.to_string()
            }
        })
        .unwrap_or_default();
    let title = pack
        .get("title")
        .and_then(|t| t.as_str())
        .map(|t| t.to_string());
    Some((title, description, pack_format))
}

fn map_pack_format_to_version(format: i32) -> String {
    match format {
        1 => "1.6.x - 1.8.x".to_string(),
        2 => "1.9.x - 1.10.x".to_string(),
        3 => "1.11.x - 1.12.x".to_string(),
        4 => "1.13.x - 1.14.x".to_string(),
        5 => "1.15.x - 1.16.1".to_string(),
        6 => "1.16.2 - 1.16.5".to_string(),
        7 => "1.17.x".to_string(),
        8 => "1.18.x".to_string(),
        9 => "1.19.x - 1.19.2".to_string(),
        12 => "1.19.3".to_string(),
        13 => "1.19.4".to_string(),
        15 => "1.20 - 1.20.1".to_string(),
        18 => "1.20.2".to_string(),
        22 => "1.20.3 - 1.20.4".to_string(),
        34 => "1.20.5 - 1.21".to_string(),
        f => format!("Format {}", f),
    }
}

#[tauri::command]
pub async fn get_installed_resourcepacks(
    instance_id: String,
) -> Result<Vec<ResourcePackItem>, String> {
    let rp_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("resourcepacks");
    if !rp_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries =
        fs::read_dir(rp_dir).map_err(|e| format!("無法讀取 resourcepacks 資料夾: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if file_name.is_empty() || file_name.starts_with('.') {
            continue;
        }

        let sha1 = if path.is_file() {
            calculate_sha1(&path).unwrap_or_default()
        } else {
            "".to_string()
        };

        let mut name = file_name.clone();
        let mut description = String::new();
        let mut pack_format = 0;

        if path.is_dir() {
            let mcmeta_path = path.join("pack.mcmeta");
            if mcmeta_path.exists() {
                if let Ok(content) = fs::read_to_string(mcmeta_path) {
                    if let Some((p_name, p_desc, p_format)) = parse_mcmeta_json(&content) {
                        name = p_name.unwrap_or_else(|| file_name.clone());
                        description = p_desc;
                        pack_format = p_format;
                    }
                }
            }
        } else if path.is_file() && (file_name.ends_with(".zip") || file_name.ends_with(".jar"))
        {
            if let Ok(file) = fs::File::open(&path) {
                if let Ok(mut archive) = ZipArchive::new(file) {
                    if let Ok(mut mcmeta_entry) = archive.by_name("pack.mcmeta") {
                        use std::io::Read;
                        let mut content = String::new();
                        if mcmeta_entry.read_to_string(&mut content).is_ok() {
                            if let Some((p_name, p_desc, p_format)) =
                                parse_mcmeta_json(&content)
                            {
                                name = p_name.unwrap_or_else(|| file_name.clone());
                                description = p_desc;
                                pack_format = p_format;
                            }
                        }
                    }
                }
            }
        }

        let game_version = map_pack_format_to_version(pack_format);

        list.push(ResourcePackItem {
            file_name,
            name,
            description,
            pack_format,
            game_version,
            sha1,
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_installed_shaderpacks(
    instance_id: String,
) -> Result<Vec<ResourcePackItem>, String> {
    let sp_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("shaderpacks");
    if !sp_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries =
        fs::read_dir(sp_dir).map_err(|e| format!("無法讀取 shaderpacks 資料夾: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if file_name.is_empty() || file_name.starts_with('.') {
            continue;
        }

        let sha1 = if path.is_file() {
            calculate_sha1(&path).unwrap_or_default()
        } else {
            "".to_string()
        };

        list.push(ResourcePackItem {
            file_name: file_name.clone(),
            name: file_name,
            description: "光影包".to_string(),
            pack_format: 0,
            game_version: "".to_string(),
            sha1,
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_installed_datapacks(
    instance_id: String,
    world_folder: String,
) -> Result<Vec<ResourcePackItem>, String> {
    let dp_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("saves")
        .join(&world_folder)
        .join("datapacks");
    if !dp_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries = fs::read_dir(dp_dir).map_err(|e| format!("無法讀取 datapacks 資料夾: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if file_name.is_empty() || file_name.starts_with('.') {
            continue;
        }

        let sha1 = if path.is_file() {
            calculate_sha1(&path).unwrap_or_default()
        } else {
            "".to_string()
        };

        let mut name = file_name.clone();
        let mut description = String::new();
        let mut pack_format = 0;

        if path.is_dir() {
            let mcmeta_path = path.join("pack.mcmeta");
            if mcmeta_path.exists() {
                if let Ok(content) = fs::read_to_string(mcmeta_path) {
                    if let Some((p_name, p_desc, p_format)) = parse_mcmeta_json(&content) {
                        name = p_name.unwrap_or_else(|| file_name.clone());
                        description = p_desc;
                        pack_format = p_format;
                    }
                }
            }
        } else if path.is_file() && file_name.ends_with(".zip") {
            if let Ok(file) = fs::File::open(&path) {
                if let Ok(mut archive) = ZipArchive::new(file) {
                    if let Ok(mut mcmeta_entry) = archive.by_name("pack.mcmeta") {
                        use std::io::Read;
                        let mut content = String::new();
                        if mcmeta_entry.read_to_string(&mut content).is_ok() {
                            if let Some((p_name, p_desc, p_format)) =
                                parse_mcmeta_json(&content)
                            {
                                name = p_name.unwrap_or_else(|| file_name.clone());
                                description = p_desc;
                                pack_format = p_format;
                            }
                        }
                    }
                }
            }
        }

        let game_version = map_pack_format_to_version(pack_format);

        list.push(ResourcePackItem {
            file_name,
            name,
            description,
            pack_format,
            game_version,
            sha1,
        });
    }

    Ok(list)
}

fn get_folder_size(path: &Path) -> Result<u64, std::io::Error> {
    let mut total_size = 0;
    if path.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let entry_path = entry.path();
            if entry_path.is_dir() {
                total_size += get_folder_size(&entry_path)?;
            } else {
                total_size += entry.metadata()?.len();
            }
        }
    } else {
        total_size = path.metadata()?.len();
    }
    Ok(total_size)
}

#[tauri::command]
pub async fn get_installed_worlds(instance_id: String) -> Result<Vec<WorldItem>, String> {
    let saves_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("saves");
    if !saves_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = vec![];
    let entries = fs::read_dir(saves_dir).map_err(|e| format!("無法讀取 saves 資料夾: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let folder_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if folder_name.is_empty() || folder_name.starts_with('.') {
                continue;
            }

            let size_bytes = get_folder_size(&path).unwrap_or(0);

            let datapacks_dir = path.join("datapacks");
            let mut datapacks = vec![];
            if datapacks_dir.exists() && datapacks_dir.is_dir() {
                if let Ok(dp_entries) = fs::read_dir(datapacks_dir) {
                    for dp in dp_entries.flatten() {
                        let name = dp.file_name().to_string_lossy().to_string();
                        if !name.starts_with('.') {
                            datapacks.push(name);
                        }
                    }
                }
            }

            list.push(WorldItem {
                folder_name: folder_name.clone(),
                name: folder_name,
                size_bytes,
                datapacks,
            });
        }
    }
    Ok(list)
}

// ==========================================
// 針對 servers.dat 的 NBT 解析器與序列化器
// ==========================================

#[derive(Debug, Clone)]
pub enum NbtValue {
    End,
    Byte(i8),
    Short(i16),
    Int(i32),
    Long(i64),
    Float(f32),
    Double(f64),
    ByteArray(Vec<u8>),
    String(String),
    List(Vec<NbtValue>),
    Compound(std::collections::HashMap<String, NbtValue>),
    IntArray(Vec<i32>),
    LongArray(Vec<i64>),
}

fn read_bytes(data: &[u8], offset: &mut usize, len: usize) -> Result<Vec<u8>, String> {
    if *offset + len > data.len() {
        return Err("NBT 資料不完整，已到達尾端".to_string());
    }
    let res = data[*offset..*offset + len].to_vec();
    *offset += len;
    Ok(res)
}

fn read_u8(data: &[u8], offset: &mut usize) -> Result<u8, String> {
    if *offset + 1 > data.len() {
        return Err("NBT 資料不完整，已到達尾端".to_string());
    }
    let res = data[*offset];
    *offset += 1;
    Ok(res)
}

fn read_i16(data: &[u8], offset: &mut usize) -> Result<i16, String> {
    let bytes = read_bytes(data, offset, 2)?;
    Ok(i16::from_be_bytes([bytes[0], bytes[1]]))
}

fn read_i32(data: &[u8], offset: &mut usize) -> Result<i32, String> {
    let bytes = read_bytes(data, offset, 4)?;
    Ok(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn read_i64(data: &[u8], offset: &mut usize) -> Result<i64, String> {
    let bytes = read_bytes(data, offset, 8)?;
    Ok(i64::from_be_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ]))
}

fn read_nbt_string(data: &[u8], offset: &mut usize) -> Result<String, String> {
    let len = read_i16(data, offset)? as usize;
    let bytes = read_bytes(data, offset, len)?;
    String::from_utf8(bytes).map_err(|e| format!("無效的 NBT UTF-8 字串: {}", e))
}

fn parse_nbt_tag(tag_type: u8, data: &[u8], offset: &mut usize) -> Result<NbtValue, String> {
    match tag_type {
        0 => Ok(NbtValue::End),
        1 => {
            let b = read_u8(data, offset)? as i8;
            Ok(NbtValue::Byte(b))
        }
        2 => {
            let s = read_i16(data, offset)?;
            Ok(NbtValue::Short(s))
        }
        3 => {
            let i = read_i32(data, offset)?;
            Ok(NbtValue::Int(i))
        }
        4 => {
            let l = read_i64(data, offset)?;
            Ok(NbtValue::Long(l))
        }
        5 => {
            let bytes = read_bytes(data, offset, 4)?;
            let f = f32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            Ok(NbtValue::Float(f))
        }
        6 => {
            let bytes = read_bytes(data, offset, 8)?;
            let d = f64::from_be_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ]);
            Ok(NbtValue::Double(d))
        }
        7 => {
            let len = read_i32(data, offset)? as usize;
            let bytes = read_bytes(data, offset, len)?;
            Ok(NbtValue::ByteArray(bytes))
        }
        8 => {
            let s = read_nbt_string(data, offset)?;
            Ok(NbtValue::String(s))
        }
        9 => {
            let elem_type = read_u8(data, offset)?;
            let len = read_i32(data, offset)? as usize;
            let mut list = Vec::with_capacity(len);
            for _ in 0..len {
                list.push(parse_nbt_tag(elem_type, data, offset)?);
            }
            Ok(NbtValue::List(list))
        }
        10 => {
            let mut map = std::collections::HashMap::new();
            loop {
                let inner_type = read_u8(data, offset)?;
                if inner_type == 0 {
                    break;
                }
                let name = read_nbt_string(data, offset)?;
                let value = parse_nbt_tag(inner_type, data, offset)?;
                map.insert(name, value);
            }
            Ok(NbtValue::Compound(map))
        }
        11 => {
            let len = read_i32(data, offset)? as usize;
            let mut list = Vec::with_capacity(len);
            for _ in 0..len {
                list.push(read_i32(data, offset)?);
            }
            Ok(NbtValue::IntArray(list))
        }
        12 => {
            let len = read_i32(data, offset)? as usize;
            let mut list = Vec::with_capacity(len);
            for _ in 0..len {
                list.push(read_i64(data, offset)?);
            }
            Ok(NbtValue::LongArray(list))
        }
        _ => Err(format!("未知的 NBT Tag 類型: {}", tag_type)),
    }
}

pub fn parse_nbt(data: &[u8]) -> Result<NbtValue, String> {
    let mut offset = 0;
    let root_type = read_u8(data, &mut offset)?;
    if root_type == 0 {
        return Ok(NbtValue::End);
    }
    let _root_name = read_nbt_string(data, &mut offset)?;
    parse_nbt_tag(root_type, data, &mut offset)
}

fn write_nbt_u8(out: &mut Vec<u8>, val: u8) {
    out.push(val);
}

fn write_nbt_i16(out: &mut Vec<u8>, val: i16) {
    out.extend_from_slice(&val.to_be_bytes());
}

fn write_nbt_i32(out: &mut Vec<u8>, val: i32) {
    out.extend_from_slice(&val.to_be_bytes());
}

fn write_nbt_string(out: &mut Vec<u8>, val: &str) {
    write_nbt_i16(out, val.len() as i16);
    out.extend_from_slice(val.as_bytes());
}

#[tauri::command]
pub async fn get_servers(instance_id: String) -> Result<Vec<ServerItem>, String> {
    let servers_dat_path = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("servers.dat");
    if !servers_dat_path.exists() {
        return Ok(vec![]);
    }

    let bytes = fs::read(&servers_dat_path).map_err(|e| format!("無法讀取 servers.dat: {}", e))?;
    let nbt = parse_nbt(&bytes).map_err(|e| format!("解析 servers.dat 失敗: {}", e))?;

    let mut servers_list = vec![];
    if let NbtValue::Compound(root_map) = nbt {
        if let Some(NbtValue::List(list)) = root_map.get("servers") {
            for item in list {
                if let NbtValue::Compound(server_map) = item {
                    let name = match server_map.get("name") {
                        Some(NbtValue::String(s)) => s.clone(),
                        _ => "未命名伺服器".to_string(),
                    };
                    let ip = match server_map.get("ip") {
                        Some(NbtValue::String(s)) => s.clone(),
                        _ => "".to_string(),
                    };
                    let accept_textures = match server_map.get("acceptTextures") {
                        Some(NbtValue::Byte(b)) => Some(*b as u8),
                        Some(NbtValue::Int(i)) => Some(*i as u8),
                        _ => Some(0),
                    };
                    servers_list.push(ServerItem {
                        name,
                        ip,
                        accept_textures,
                    });
                }
            }
        }
    }
    Ok(servers_list)
}

#[tauri::command]
pub async fn save_servers(instance_id: String, servers: Vec<ServerItem>) -> Result<(), String> {
    let servers_dat_path = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("servers.dat");

    let mut out = vec![];

    // 根標籤：TAG_Compound (10)
    write_nbt_u8(&mut out, 10);
    // 根名稱：空字串
    write_nbt_string(&mut out, "");

    // 標籤：TAG_List (9) 對應 "servers"
    write_nbt_u8(&mut out, 9);
    write_nbt_string(&mut out, "servers");
    // 元素類型：TAG_Compound (10)
    write_nbt_u8(&mut out, 10);
    // 清單長度
    write_nbt_i32(&mut out, servers.len() as i32);

    for server in servers {
        // 標籤：TAG_String (8) 對應 "name"
        write_nbt_u8(&mut out, 8);
        write_nbt_string(&mut out, "name");
        write_nbt_string(&mut out, &server.name);

        // 標籤：TAG_String (8) 對應 "ip"
        write_nbt_u8(&mut out, 8);
        write_nbt_string(&mut out, "ip");
        write_nbt_string(&mut out, &server.ip);

        // 標籤：TAG_Byte (1) 對應 "acceptTextures"
        write_nbt_u8(&mut out, 1);
        write_nbt_string(&mut out, "acceptTextures");
        write_nbt_u8(&mut out, server.accept_textures.unwrap_or(0));

        // 結束 Compound：TAG_End (0)
        write_nbt_u8(&mut out, 0);
    }

    // 結束根 Compound：TAG_End (0)
    write_nbt_u8(&mut out, 0);

    fs::write(servers_dat_path, out).map_err(|e| format!("無法寫入 servers.dat: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn read_latest_log(instance_id: String) -> Result<String, String> {
    let log_file = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join("logs")
        .join("latest.log");

    if log_file.exists() {
        fs::read_to_string(log_file).map_err(|e| format!("無法讀取日誌檔案: {}", e))
    } else {
        Ok(String::new())
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
        return Err("無效的安全網址類型，必須以 http:// 或 https:// 開頭！".to_string());
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
    let dest_dir = get_instances_dir()?
        .join(&instance_id)
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
    let saves_dir = get_instances_dir()?
        .join(&instance_id)
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
    let client = reqwest::Client::new();
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
        create_command("powershell")
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
        create_command("powershell")
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
pub async fn search_modrinth(
    query: String,
    project_type: String,
    game_versions: Vec<String>,
    loader: Option<String>,
    category: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let offset_val = offset.unwrap_or(0);
    let limit_val = limit.unwrap_or(20);

    let mut facets_list: Vec<Vec<String>> = vec![vec![format!("project_type:{}", project_type)]];

    if !game_versions.is_empty() {
        let gv_facets: Vec<String> = game_versions
            .iter()
            .filter(|gv| !gv.trim().is_empty())
            .map(|gv| format!("versions:{}", gv))
            .collect();
        if !gv_facets.is_empty() {
            facets_list.push(gv_facets);
        }
    }

    if let Some(ref ld) = loader {
        if !ld.trim().is_empty()
            && !ld.eq_ignore_ascii_case("vanilla")
            && !ld.eq_ignore_ascii_case("all")
        {
            facets_list.push(vec![format!("categories:{}", ld.to_ascii_lowercase())]);
        }
    }

    if let Some(ref cat) = category {
        if !cat.trim().is_empty() {
            facets_list.push(vec![format!("categories:{}", cat)]);
        }
    }

    let facets_str =
        serde_json::to_string(&facets_list).map_err(|e| format!("序列化 facets 失敗: {}", e))?;

    let res = client
        .get("https://api.modrinth.com/v2/search")
        .query(&[
            ("query", &query),
            ("facets", &facets_str),
            ("offset", &offset_val.to_string()),
            ("limit", &limit_val.to_string()),
        ])
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("搜尋 Modrinth 失敗: {}", e))?;

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 Modrinth 回應失敗: {}", e))?;

    Ok(json)
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
pub async fn watch_instance_folders(
    app: AppHandle,
    state: State<'_, crate::WatcherState>,
    instance_id: String,
) -> Result<(), String> {
    // 1. 先停止舊的監聽器
    {
        let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
        if let Some((old_id, mut old_watcher)) = w_lock.take() {
            println!("Stopping watcher for instance: {}", old_id);
            let path = get_instances_dir()?.join(&old_id).join("minecraft");
            let _ = old_watcher.unwatch(&path);
        }
    }

    // 2. 啟動新的監聽器
    let instance_path = get_instances_dir()?.join(&instance_id).join("minecraft");
    if !instance_path.exists() {
        let _ = fs::create_dir_all(&instance_path);
    }

    let app_clone = app.clone();
    let instance_id_clone = instance_id.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| match res {
            Ok(event) => {
                let is_relevant_event = matches!(
                    event.kind,
                    notify::EventKind::Create(_)
                        | notify::EventKind::Modify(_)
                        | notify::EventKind::Remove(_)
                );
                if is_relevant_event {
                    for path in &event.paths {
                        for component in path.components() {
                            if let Some(name) = component.as_os_str().to_str() {
                                if name == "mods"
                                    || name == "saves"
                                    || name == "screenshots"
                                    || name == "datapacks"
                                {
                                    println!(
                                        "Folder watcher event: {} in {}",
                                        name,
                                        path.display()
                                    );
                                    let _ = app_clone.emit(
                                        "folder-change",
                                        serde_json::json!({
                                            "folder": name,
                                            "instanceId": instance_id_clone,
                                        }),
                                    );
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Watcher error: {:?}", e);
            }
        })
        .map_err(|e| format!("無法建立檔案監聽器: {}", e))?;

    watcher
        .watch(&instance_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("監聽資料夾失敗: {}", e))?;

    {
        let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
        *w_lock = Some((instance_id, watcher));
    }

    println!("Started folder watcher for instance at {:?}", instance_path);
    Ok(())
}

#[tauri::command]
pub async fn unwatch_instance_folders(state: State<'_, crate::WatcherState>) -> Result<(), String> {
    let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    if let Some((old_id, mut old_watcher)) = w_lock.take() {
        println!("Unwatching folder for instance: {}", old_id);
        let path = get_instances_dir()?.join(&old_id).join("minecraft");
        let _ = old_watcher.unwatch(&path);
    }
    Ok(())
}

// ==========================================
// 啟動會話與行程管理
// ==========================================

use std::sync::atomic::Ordering;

fn get_or_create_session(
    state: &crate::SessionState,
    instance_id: &str,
) -> std::sync::Arc<crate::ActiveSession> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(instance_id) {
        if session.cancel_token.load(Ordering::Relaxed) {
            let new_session = std::sync::Arc::new(crate::ActiveSession {
                cancel_token: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
                child: std::sync::Arc::new(std::sync::Mutex::new(None)),
            });
            sessions.insert(instance_id.to_string(), new_session.clone());
            new_session
        } else {
            session.clone()
        }
    } else {
        let new_session = std::sync::Arc::new(crate::ActiveSession {
            cancel_token: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            child: std::sync::Arc::new(std::sync::Mutex::new(None)),
        });
        sessions.insert(instance_id.to_string(), new_session.clone());
        new_session
    }
}

#[tauri::command]
pub async fn init_launch_session(
    state: State<'_, crate::SessionState>,
    instance_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let new_session = std::sync::Arc::new(crate::ActiveSession {
        cancel_token: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        child: std::sync::Arc::new(std::sync::Mutex::new(None)),
    });
    sessions.insert(instance_id, new_session);
    Ok(())
}

#[tauri::command]
pub async fn cancel_launch_session(
    state: State<'_, crate::SessionState>,
    instance_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get(&instance_id) {
        session.cancel_token.store(true, Ordering::Relaxed);
        println!("Launch session cancelled for instance: {}", instance_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn kill_launch_session(
    state: State<'_, crate::SessionState>,
    instance_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.remove(&instance_id) {
        session.cancel_token.store(true, Ordering::Relaxed);
        let mut child_guard = session.child.lock().map_err(|e| e.to_string())?;
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            println!(
                "Killed running game child process for instance: {}",
                instance_id
            );
        }
    }
    Ok(())
}

// ==========================================
// Java 需求版本自動比對
// ==========================================

#[tauri::command]
pub async fn get_required_java_version(
    _state: State<'_, crate::SessionState>,
    instance_id: String,
) -> Result<u32, String> {
    let base_dir = get_app_dir()?;
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let cfg_file = instance_dir.join("instance.cfg");
    if !cfg_file.exists() {
        return Err("找不到該實例的設定檔".to_string());
    }

    let cfg_content =
        fs::read_to_string(&cfg_file).map_err(|e| format!("無法讀取 instance.cfg: {}", e))?;
    let mut cfg: InstanceConfig =
        serde_json::from_str(&cfg_content).map_err(|e| format!("無法解析 instance.cfg: {}", e))?;
    cfg.id = instance_id.clone();
    let version_id = cfg.version;

    // 嘗試使用本地版本 JSON
    let version_json_dir = base_dir.join("version").join(&version_id);
    let version_json_path = version_json_dir.join(format!("{}.json", version_id));

    let mut is_local_valid = false;
    let mut local_java_major = 8;

    if version_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&version_json_path) {
            if let Ok(info) = serde_json::from_str::<MinecraftVersionInfo>(&content) {
                if info.downloads.is_some()
                    || info.inherits_from.is_some()
                    || !info.libraries.is_empty()
                {
                    is_local_valid = true;
                    if let Some(ref jv) = info.java_version {
                        local_java_major = jv.major_version;
                    }
                }
            }
        }
    }

    if is_local_valid {
        println!(
            "Found Java requirements from local version JSON for {}: Java {}",
            version_id, local_java_major
        );
        return Ok(local_java_major);
    }

    // 嘗試使用 Mojang API 線上取得
    let client = reqwest::Client::builder()
        .user_agent("focal-craft-launcher")
        .build();
    if let Ok(client) = client {
        if let Ok(res) = client
            .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
            .send()
            .await
        {
            if let Ok(manifest) = res.json::<VersionManifest>().await {
                if let Some(v_entry) = manifest.versions.iter().find(|v| v.id == version_id) {
                    if let Ok(detail_res) = client.get(&v_entry.url).send().await {
                        #[derive(Debug, Deserialize, Serialize)]
                        #[serde(rename_all = "camelCase")]
                        struct RemoteJavaVersion {
                            major_version: u32,
                        }
                        #[derive(Debug, Deserialize, Serialize)]
                        #[serde(rename_all = "camelCase")]
                        struct RemoteVersionJson {
                            java_version: Option<RemoteJavaVersion>,
                        }
                        if let Ok(text) = detail_res.text().await {
                            if let Ok(remote_json) =
                                serde_json::from_str::<RemoteVersionJson>(&text)
                            {
                                if let Some(ref jv) = remote_json.java_version {
                                    println!(
                                        "Found Java requirements from Mojang API for {}: Java {}",
                                        version_id, jv.major_version
                                    );
                                    fs::create_dir_all(&version_json_dir).ok();
                                    let _ = fs::write(&version_json_path, &text); // 寫入原始 JSON 內容
                                    return Ok(remote_json.java_version.unwrap().major_version);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 備用比對規則
    let parts: Vec<&str> = version_id.split('.').collect();
    if parts.len() >= 2 {
        if let Ok(minor) = parts[1].parse::<u32>() {
            let patch = parts
                .get(2)
                .and_then(|p| p.parse::<u32>().ok())
                .unwrap_or(0);
            if minor >= 26 {
                return Ok(25);
            }
            if minor >= 21 || (minor == 20 && patch >= 5) {
                return Ok(21);
            }
            if minor >= 18 {
                return Ok(17);
            }
            if minor >= 17 {
                return Ok(16);
            }
            if minor >= 12 {
                return Ok(8);
            }
        }
    }

    if version_id.starts_with("26w") {
        return Ok(25);
    }
    if version_id.starts_with("25w") {
        return Ok(21);
    }
    if version_id.starts_with("24w") {
        if let Some(w_str) = version_id.get(3..5) {
            if let Ok(week) = w_str.parse::<u32>() {
                if week >= 14 {
                    return Ok(21);
                }
            }
        }
        return Ok(17);
    }
    if version_id.starts_with("23w")
        || version_id.starts_with("22w")
        || version_id.starts_with("21w")
    {
        if version_id.starts_with("21w19a") || version_id.as_str() > "21w19a" {
            return Ok(16);
        }
        return Ok(8);
    }

    Ok(8)
}

// ==========================================
// CurseForge API 整合
// ==========================================

const CURSEFORGE_API_KEY: &str = match option_env!("CURSEFORGE_API_KEY") {
    Some(key) => key,
    None => "$2a$10$UV61tkObiJ7wMSPb3apjguujEf4KMFhaDnpCam67q6p1o/TU67/rm",
};

#[tauri::command]
pub async fn search_curseforge(
    query: String,
    class_id: u32,
    game_version: String,
    category_id: Option<u32>,
    search_index: u32,
    page_size: u32,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut query_params = vec![
        ("gameId".to_string(), "432".to_string()),
        ("classId".to_string(), class_id.to_string()),
        ("searchFilter".to_string(), query),
        ("gameVersion".to_string(), game_version),
        ("index".to_string(), search_index.to_string()),
        ("pageSize".to_string(), page_size.to_string()),
    ];

    if let Some(cat_id) = category_id {
        query_params.push(("categoryId".to_string(), cat_id.to_string()));
    }

    let res = client
        .get("https://api.curseforge.com/v1/mods/search")
        .header("x-api-key", CURSEFORGE_API_KEY)
        .query(&query_params)
        .send()
        .await
        .map_err(|e| format!("搜尋 CurseForge 失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 搜尋結果失敗: {}", e))?;
    Ok(val)
}

#[tauri::command]
pub async fn get_curseforge_project_description(mod_id: u32) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!(
            "https://api.curseforge.com/v1/mods/{}/description",
            mod_id
        ))
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("獲取 CurseForge 說明失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    #[derive(Deserialize)]
    struct DescResponse {
        data: String,
    }
    let val = res
        .json::<DescResponse>()
        .await
        .map_err(|e| format!("解析 CurseForge 說明失敗: {}", e))?;
    Ok(val.data)
}

#[tauri::command]
pub async fn get_curseforge_project_files(mod_id: u32) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!(
            "https://api.curseforge.com/v1/mods/{}/files",
            mod_id
        ))
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("獲取 CurseForge 檔案失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 檔案列表失敗: {}", e))?;
    Ok(val)
}

#[tauri::command]
pub async fn get_curseforge_projects(mod_ids: Vec<u32>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "modIds": mod_ids
    });
    let res = client
        .post("https://api.curseforge.com/v1/mods")
        .header("x-api-key", CURSEFORGE_API_KEY)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("批次獲取 CurseForge 專案失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 專案結果失敗: {}", e))?;
    Ok(val)
}

#[tauri::command]
pub async fn download_curseforge_file(
    instance_id: String,
    folder_name: String,
    download_url: String,
    file_name: String,
) -> Result<(), String> {
    let dest_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join(&folder_name);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("無法建立目標資料夾: {}", e))?;

    let temp_dest = dest_dir.join(format!("{}.tmp", file_name));
    let client = reqwest::Client::new();
    let res = client
        .get(&download_url)
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("下載檔案失敗: {}", e))?;

    if !res.status().is_success() {
        if let Ok(res_fallback) = reqwest::Client::new().get(&download_url).send().await {
            if res_fallback.status().is_success() {
                if let Ok(bytes) = res_fallback.bytes().await {
                    fs::write(&temp_dest, &bytes).map_err(|e| format!("寫入暫存檔失敗: {}", e))?;
                    let final_dest = dest_dir.join(&file_name);
                    fs::rename(temp_dest, final_dest)
                        .map_err(|e| format!("重命名檔案失敗: {}", e))?;
                    return Ok(());
                }
            }
        }
        return Err(format!("下載伺服器回應錯誤: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取下載內容失敗: {}", e))?;
    fs::write(&temp_dest, &bytes).map_err(|e| format!("寫入暫存檔失敗: {}", e))?;

    let final_dest = dest_dir.join(&file_name);
    fs::rename(temp_dest, final_dest).map_err(|e| format!("重命名檔案失敗: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn scan_downloads_for_hashes(
    hashes: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let mut matched_files = std::collections::HashMap::new();
    let downloads_dir = std::env::var("USERPROFILE")
        .map(|p| PathBuf::from(p).join("Downloads"))
        .ok();

    if let Some(dir) = downloads_dir {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        if file_name.ends_with(".jar") || file_name.ends_with(".zip") {
                            if let Ok(sha1) = calculate_sha1(&path) {
                                if hashes.contains(&sha1) {
                                    matched_files
                                        .insert(sha1, path.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(matched_files)
}

fn compare_versions(v1: &str, v2: &str) -> std::cmp::Ordering {
    if v1 == v2 {
        return std::cmp::Ordering::Equal;
    }
    
    let parse_part = |s: &str| -> (i32, String) {
        let num_str: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
        let suffix: String = s.chars().skip(num_str.len()).collect();
        let num = num_str.parse::<i32>().unwrap_or(0);
        (num, suffix)
    };

    let parts1: Vec<&str> = v1.split('.').collect();
    let parts2: Vec<&str> = v2.split('.').collect();
    
    for i in 0..std::cmp::max(parts1.len(), parts2.len()) {
        let s1 = parts1.get(i).unwrap_or(&"");
        let s2 = parts2.get(i).unwrap_or(&"");
        
        let (n1, suff1) = parse_part(s1);
        let (n2, suff2) = parse_part(s2);
        
        match n1.cmp(&n2) {
            std::cmp::Ordering::Equal => {
                match suff1.cmp(&suff2) {
                    std::cmp::Ordering::Equal => continue,
                    other => return other,
                }
            }
            other => return other,
        }
    }
    
    std::cmp::Ordering::Equal
}

fn extract_version_from_path(path: &Path) -> String {
    path.parent()
        .and_then(|p| p.file_name())
        .and_then(|f| f.to_str())
        .unwrap_or("")
        .to_string()
}

fn resolve_classpath_duplicates(items: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut resolved: Vec<PathBuf> = vec![];
    let mut grandparent_indices: std::collections::HashMap<PathBuf, usize> = std::collections::HashMap::new();

    for item in items {
        let is_lib = item.components().any(|c| c.as_os_str() == "libraries");
        if is_lib {
            if let Some(grandparent) = item.parent().and_then(|p| p.parent()) {
                let mut gp = grandparent.to_path_buf();
                
                // If it is a native library, append a suffix to its group key
                // so we don't discard it as a duplicate of the main library jar
                if let Some(file_name) = item.file_name().and_then(|f| f.to_str()) {
                    let file_name_lower = file_name.to_lowercase();
                    if file_name_lower.contains("-natives-") {
                        gp.push("natives");
                    }
                }

                let gp_key = gp;
                if let Some(&idx) = grandparent_indices.get(&gp_key) {
                    let existing_item = &resolved[idx];
                    let existing_ver = extract_version_from_path(existing_item);
                    let current_ver = extract_version_from_path(&item);
                    if compare_versions(&current_ver, &existing_ver) == std::cmp::Ordering::Greater {
                        resolved[idx] = item;
                    }
                    continue;
                } else {
                    grandparent_indices.insert(gp_key, resolved.len());
                    resolved.push(item);
                    continue;
                }
            }
        }
        resolved.push(item);
    }
    resolved
}

// ==========================================
// 實例匯出功能 (Export Instance)
// ==========================================

fn murmur2_hash(data: &[u8]) -> u32 {
    let m: u32 = 0x5bd1e995;
    let r: i32 = 24;
    let seed: u32 = 1;
    let mut h: u32 = seed ^ (data.len() as u32);

    let mut chunks = data.chunks_exact(4);
    while let Some(chunk) = chunks.next() {
        let mut k = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        k = k.wrapping_mul(m);
        k ^= k >> r;
        k = k.wrapping_mul(m);
        h = h.wrapping_mul(m);
        h ^= k;
    }

    let remainder = chunks.remainder();
    if remainder.len() >= 3 {
        h ^= (remainder[2] as u32) << 16;
    }
    if remainder.len() >= 2 {
        h ^= (remainder[1] as u32) << 8;
    }
    if remainder.len() >= 1 {
        h ^= remainder[0] as u32;
        h = h.wrapping_mul(m);
    }

    h ^= h >> 13;
    h = h.wrapping_mul(m);
    h ^= h >> 15;
    h
}

fn get_curseforge_fingerprint(bytes: &[u8]) -> u32 {
    let filtered: Vec<u8> = bytes.iter().copied().filter(|&b| b != 9 && b != 10 && b != 13 && b != 32).collect();
    murmur2_hash(&filtered)
}

fn write_dir_to_zip<W: std::io::Write + std::io::Seek>(
    dir_path: &Path,
    zip_prefix: &str,
    zip: &mut zip::ZipWriter<W>,
    options: zip::write::FileOptions,
) -> Result<(), String> {
    let walk_dir = |dir: &Path| -> Result<Vec<PathBuf>, String> {
        let mut files = vec![];
        let mut queue = vec![dir.to_path_buf()];
        while let Some(current) = queue.pop() {
            if let Ok(entries) = fs::read_dir(current) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        queue.push(path);
                    } else {
                        files.push(path);
                    }
                }
            }
        }
        Ok(files)
    };

    let files = walk_dir(dir_path)?;
    for file_path in files {
        if let Ok(relative_path) = file_path.strip_prefix(dir_path) {
            let zip_path = Path::new(zip_prefix).join(relative_path).to_string_lossy().replace('\\', "/");
            zip.start_file(zip_path, options)
                .map_err(|e| format!("無法寫入壓縮檔: {}", e))?;
            if let Ok(bytes) = fs::read(&file_path) {
                use std::io::Write;
                zip.write_all(&bytes).map_err(|e| format!("無法寫入壓縮檔內容: {}", e))?;
            }
        }
    }
    Ok(())
}

#[derive(Debug, Deserialize, Clone)]
struct CurseForgeFingerprintResponse {
    data: CurseForgeFingerprintsData,
}

#[derive(Debug, Deserialize, Clone)]
struct CurseForgeFingerprintsData {
    #[serde(rename = "exactMatches")]
    exact_matches: Vec<CurseForgeFingerprintMatch>,
    #[serde(rename = "exactFingerprints")]
    exact_fingerprints: Vec<u32>,
}

#[derive(Debug, Deserialize, Clone)]
struct CurseForgeFingerprintMatch {
    id: u32,
    file: CurseForgeFingerprintFile,
}

#[derive(Debug, Deserialize, Clone)]
struct CurseForgeFingerprintFile {
    id: u32,
    #[serde(rename = "fileName")]
    file_name: String,
}

#[tauri::command]
pub async fn export_instance(
    instance_id: String,
    export_type: String,
    selected_mods: Vec<String>,
    dest_zip_path: String,
) -> Result<(), String> {
    let instance_dir = get_instances_dir()?.join(&instance_id);
    let mc_dir = instance_dir.join("minecraft");

    let cfg_file = instance_dir.join("instance.cfg");
    let cfg_content = fs::read_to_string(&cfg_file)
        .map_err(|e| format!("無法讀取 instance.cfg: {}", e))?;
    let cfg: InstanceConfig = serde_json::from_str(&cfg_content)
        .map_err(|e| format!("無法解析 instance.cfg: {}", e))?;

    let file = fs::File::create(&dest_zip_path)
        .map_err(|e| format!("無法建立匯出檔案: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    if export_type == "multimc" {
        let inst_cfg = format!(
            "InstanceType=OneSix\nname={}\niconKey=default\n",
            cfg.name
        );
        zip.start_file("instance.cfg", options)
            .map_err(|e| format!("寫入 instance.cfg 失敗: {}", e))?;
        use std::io::Write;
        zip.write_all(inst_cfg.as_bytes()).map_err(|e| e.to_string())?;

        let mut components = vec![
            serde_json::json!({
                "important": true,
                "uid": "net.minecraft",
                "version": cfg.version
            })
        ];
        if cfg.modloader != "Vanilla" {
            let uid = match cfg.modloader.as_str() {
                "Fabric" => "net.fabricmc.fabric-loader",
                "Forge" => "net.minecraftforge",
                "NeoForge" => "org.neoforged",
                _ => "",
            };
            if !uid.is_empty() {
                components.push(serde_json::json!({
                    "uid": uid,
                    "version": cfg.loader_version.clone().unwrap_or_default()
                }));
            }
        }
        let mmc_pack = serde_json::json!({
            "components": components,
            "formatVersion": 1
        });
        zip.start_file("mmc-pack.json", options)
            .map_err(|e| format!("寫入 mmc-pack.json 失敗: {}", e))?;
        serde_json::to_writer(&mut zip, &mmc_pack).map_err(|e| e.to_string())?;

        let options_path = mc_dir.join("options.txt");
        if options_path.exists() {
            zip.start_file("minecraft/options.txt", options)
                .map_err(|e| format!("寫入 options.txt 失敗: {}", e))?;
            let content = fs::read(&options_path).map_err(|e| e.to_string())?;
            zip.write_all(&content).map_err(|e| e.to_string())?;
        }

        let config_dir = mc_dir.join("config");
        if config_dir.exists() {
            write_dir_to_zip(&config_dir, "minecraft/config", &mut zip, options)?;
        }

        let mods_dir = mc_dir.join("mods");
        for mod_name in &selected_mods {
            let mod_path = mods_dir.join(mod_name);
            if mod_path.exists() {
                zip.start_file(format!("minecraft/mods/{}", mod_name), options)
                    .map_err(|e| format!("寫入模組 {} 失敗: {}", e, mod_name))?;
                let content = fs::read(&mod_path).map_err(|e| e.to_string())?;
                zip.write_all(&content).map_err(|e| e.to_string())?;
            }
        }

    } else if export_type == "modrinth" {
        let mut index_files = vec![];
        let mut unmatched_mods = vec![];
        let client = reqwest::Client::new();

        let mods_dir = mc_dir.join("mods");
        let mut mod_hashes = vec![];
        let mut hash_to_filename = std::collections::HashMap::new();

        for mod_name in &selected_mods {
            let mod_path = mods_dir.join(mod_name);
            if mod_path.exists() {
                if let Ok(bytes) = fs::read(&mod_path) {
                    use sha1::Digest;
                    let mut hasher = sha1::Sha1::new();
                    hasher.update(&bytes);
                    let sha1_hex = format!("{:x}", hasher.finalize());
                    mod_hashes.push(sha1_hex.clone());
                    hash_to_filename.insert(sha1_hex, mod_name.clone());
                }
            }
        }

        let mut matched_hashes = std::collections::HashSet::new();
        if !mod_hashes.is_empty() {
            let body = serde_json::json!({
                "hashes": mod_hashes,
                "algorithm": "sha1"
            });
            if let Ok(res) = client
                .post("https://api.modrinth.com/v2/version_files")
                .header("User-Agent", "focal-craft-launcher")
                .json(&body)
                .send()
                .await
            {
                if res.status().is_success() {
                    #[derive(Deserialize, Debug, Clone)]
                    struct ModrinthFileItem {
                        url: String,
                        hashes: std::collections::HashMap<String, String>,
                        size: u64,
                    }
                    #[derive(Deserialize, Debug, Clone)]
                    struct ModrinthVersionObj {
                        files: Vec<ModrinthFileItem>,
                    }
                    if let Ok(lookup_data) = res.json::<std::collections::HashMap<String, ModrinthVersionObj>>().await {
                        for (sha1_hex, version_obj) in lookup_data {
                            if let Some(filename) = hash_to_filename.get(&sha1_hex) {
                                if let Some(file_item) = version_obj.files.iter().find(|f| f.hashes.get("sha1") == Some(&sha1_hex)) {
                                    matched_hashes.insert(sha1_hex.clone());
                                    let mut hashes_map = std::collections::HashMap::new();
                                    hashes_map.insert("sha1".to_string(), sha1_hex.clone());
                                    if let Some(sha512_val) = file_item.hashes.get("sha512") {
                                        hashes_map.insert("sha512".to_string(), sha512_val.clone());
                                    } else {
                                        let mod_path = mods_dir.join(filename);
                                        if let Ok(bytes) = fs::read(&mod_path) {
                                            use sha2::Digest;
                                            let mut hasher = sha2::Sha512::new();
                                            hasher.update(&bytes);
                                            hashes_map.insert("sha512".to_string(), format!("{:x}", hasher.finalize()));
                                        }
                                    }
                                    index_files.push(serde_json::json!({
                                        "path": format!("mods/{}", filename),
                                        "hashes": hashes_map,
                                        "downloads": [file_item.url.clone()],
                                        "fileSize": file_item.size
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }

        for sha1_hex in &mod_hashes {
            if !matched_hashes.contains(sha1_hex) {
                if let Some(filename) = hash_to_filename.get(sha1_hex) {
                    unmatched_mods.push(filename.clone());
                }
            }
        }

        let mut dependencies = std::collections::HashMap::new();
        dependencies.insert("minecraft".to_string(), cfg.version.clone());
        if cfg.modloader != "Vanilla" {
            let loader_key = match cfg.modloader.as_str() {
                "Fabric" => "fabric-loader",
                "Forge" => "forge",
                "NeoForge" => "neoforge",
                _ => "",
            };
            if !loader_key.is_empty() {
                dependencies.insert(loader_key.to_string(), cfg.loader_version.clone().unwrap_or_default());
            }
        }

        let index_json = serde_json::json!({
            "formatVersion": 1,
            "game": "minecraft",
            "name": cfg.name,
            "versionId": cfg.version,
            "dependencies": dependencies,
            "files": index_files
        });

        zip.start_file("modrinth.index.json", options)
            .map_err(|e| format!("寫入 modrinth.index.json 失敗: {}", e))?;
        serde_json::to_writer(&mut zip, &index_json).map_err(|e| e.to_string())?;

        let options_path = mc_dir.join("options.txt");
        if options_path.exists() {
            zip.start_file("overrides/options.txt", options)
                .map_err(|e| format!("寫入 options.txt 失敗: {}", e))?;
            let content = fs::read(&options_path).map_err(|e| e.to_string())?;
            zip.write_all(&content).map_err(|e| e.to_string())?;
        }

        let config_dir = mc_dir.join("config");
        if config_dir.exists() {
            write_dir_to_zip(&config_dir, "overrides/config", &mut zip, options)?;
        }

        for filename in unmatched_mods {
            let mod_path = mods_dir.join(&filename);
            if mod_path.exists() {
                zip.start_file(format!("overrides/mods/{}", filename), options)
                    .map_err(|e| format!("寫入模組 {} 失敗: {}", e, filename))?;
                let content = fs::read(&mod_path).map_err(|e| e.to_string())?;
                zip.write_all(&content).map_err(|e| e.to_string())?;
            }
        }

    } else if export_type == "curseforge" {
        let mut manifest_files = vec![];
        let mut unmatched_mods = vec![];
        let client = reqwest::Client::new();

        let mods_dir = mc_dir.join("mods");
        let mut fingerprints = vec![];
        let mut hash_to_filename = std::collections::HashMap::new();

        for mod_name in &selected_mods {
            let mod_path = mods_dir.join(mod_name);
            if mod_path.exists() {
                if let Ok(bytes) = fs::read(&mod_path) {
                    let fp = get_curseforge_fingerprint(&bytes);
                    fingerprints.push(fp);
                    hash_to_filename.insert(fp, mod_name.clone());
                }
            }
        }

        let mut matched_fps = std::collections::HashSet::new();
        if !fingerprints.is_empty() {
            let body = serde_json::json!({
                "fingerprints": fingerprints
            });
            if let Ok(res) = client
                .post("https://api.curseforge.com/v1/fingerprints")
                .header("x-api-key", "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm")
                .json(&body)
                .send()
                .await
            {
                if res.status().is_success() {
                    if let Ok(resp_val) = res.json::<CurseForgeFingerprintResponse>().await {
                        for item in resp_val.data.exact_matches {
                            manifest_files.push(serde_json::json!({
                                "projectID": item.id,
                                "fileID": item.file.id,
                                "required": true
                            }));
                        }
                        for fp in resp_val.data.exact_fingerprints {
                            matched_fps.insert(fp);
                        }
                    }
                }
            }
        }

        for fp in &fingerprints {
            if !matched_fps.contains(fp) {
                if let Some(filename) = hash_to_filename.get(fp) {
                    unmatched_mods.push(filename.clone());
                }
            }
        }

        let mut mod_loaders = vec![];
        if cfg.modloader != "Vanilla" {
            let loader_name = cfg.modloader.to_lowercase();
            let loader_ver = cfg.loader_version.clone().unwrap_or_default();
            mod_loaders.push(serde_json::json!({
                "id": format!("{}-{}", loader_name, loader_ver),
                "primary": true
            }));
        }

        let manifest_json = serde_json::json!({
            "minecraft": {
                "version": cfg.version,
                "modLoaders": mod_loaders
            },
            "manifestType": "minecraftModpack",
            "manifestVersion": 1,
            "name": cfg.name,
            "version": cfg.loader_version.clone().unwrap_or_else(|| "1.0.0".to_string()),
            "author": "FocalCraft",
            "files": manifest_files,
            "overrides": "overrides"
        });

        zip.start_file("manifest.json", options)
            .map_err(|e| format!("寫入 manifest.json 失敗: {}", e))?;
        serde_json::to_writer(&mut zip, &manifest_json).map_err(|e| e.to_string())?;

        let options_path = mc_dir.join("options.txt");
        if options_path.exists() {
            zip.start_file("overrides/options.txt", options)
                .map_err(|e| format!("寫入 options.txt 失敗: {}", e))?;
            let content = fs::read(&options_path).map_err(|e| e.to_string())?;
            zip.write_all(&content).map_err(|e| e.to_string())?;
        }

        let config_dir = mc_dir.join("config");
        if config_dir.exists() {
            write_dir_to_zip(&config_dir, "overrides/config", &mut zip, options)?;
        }

        for filename in unmatched_mods {
            let mod_path = mods_dir.join(&filename);
            if mod_path.exists() {
                zip.start_file(format!("overrides/mods/{}", filename), options)
                    .map_err(|e| format!("寫入模組 {} 失敗: {}", e, filename))?;
                let content = fs::read(&mod_path).map_err(|e| e.to_string())?;
                zip.write_all(&content).map_err(|e| e.to_string())?;
            }
        }
    }

    zip.finish().map_err(|e| format!("壓縮完成失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn select_export_zip_path(default_name: String) -> Result<String, String> {
    let script = format!(
        r#"
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.SaveFileDialog
        $f.Filter = "ZIP 壓縮檔 (*.zip)|*.zip|Modrinth 整合包 (*.mrpack)|*.mrpack"
        $f.FileName = "{}"
        $f.Title = "選擇匯出儲存路徑"
        $res = $f.ShowDialog()
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{
            Write-Output $f.FileName
        }}
        "#,
        default_name
    );

    let output = tokio::task::spawn_blocking(move || {
        create_command("powershell")
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
