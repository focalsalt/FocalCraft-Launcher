use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

mod minecraft;

const MICROSOFT_CLIENT_ID: &str = match option_env!("MICROSOFT_CLIENT_ID") {
    Some(id) => id,
    None => "6752d2be-2e07-4784-bb95-65f042228343",
};

pub struct WatcherState {
    pub watcher: std::sync::Mutex<Option<(String, notify::RecommendedWatcher)>>,
}

pub struct RootWatcherState {
    pub watcher: std::sync::Mutex<Option<notify::RecommendedWatcher>>,
}

pub struct ActiveSession {
    pub cancel_token: std::sync::Arc<std::sync::atomic::AtomicBool>,
    pub child: std::sync::Arc<std::sync::Mutex<Option<std::process::Child>>>,
}

pub struct SessionState {
    pub sessions:
        std::sync::Mutex<std::collections::HashMap<String, std::sync::Arc<ActiveSession>>>,
}

// ==========================================
// 資料結構定義
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,               // 玩家 UUID
    pub mc_id: String,            // 玩家名稱
    pub avatar_url: String,       // 頭像網址
    pub ms_refresh_token: String, // 微軟刷新權杖
    pub mc_access_token: String,  // 遊戲存取權杖
    pub token_expires_at: u64,    // 權杖過期時間
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MicrosoftTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

// Xbox Live 驗證請求
#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
struct XboxLiveAuthRequest {
    properties: XboxLiveAuthProperties,
    relying_party: String,
    token_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
struct XboxLiveAuthProperties {
    auth_method: String,
    site_name: String,
    #[serde(rename = "RpsTicket")]
    user_token: String,
}

// Xbox Live/XSTS 驗證回應
#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XboxLiveAuthResponse {
    token: String,
    display_claims: DisplayClaims,
}

#[derive(Deserialize)]
struct DisplayClaims {
    xui: Vec<XuiClaim>,
}

#[derive(Deserialize)]
struct XuiClaim {
    uhs: String,
}

// XSTS 驗證請求
#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
struct XstsAuthRequest {
    properties: XstsAuthProperties,
    relying_party: String,
    token_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
struct XstsAuthProperties {
    sandbox_id: String,
    user_tokens: Vec<String>,
}

// Minecraft 登入請求
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MinecraftLoginRequest {
    identity_token: String,
}

// Minecraft 登入回應
#[derive(Deserialize)]
struct MinecraftLoginResponse {
    access_token: String,
    expires_in: u64,
}

// Minecraft 遊戲所有權回應
#[derive(Deserialize)]
struct EntitlementsResponse {
    items: Vec<EntitlementItem>,
}

#[derive(Deserialize)]
struct EntitlementItem {
    name: String,
}

// Minecraft Profile 回應
#[derive(Deserialize)]
struct MinecraftProfileResponse {
    id: String,
    name: String,
}

// ==========================================
// Tauri Commands
// ==========================================

#[tauri::command]
fn init_app_dirs() -> Result<String, String> {
    // 取得 APPDATA 路徑
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    let base_dir = PathBuf::from(appdata).join("focal-craft-launcher");

    let dirs_to_create = vec![
        base_dir.clone(),
        base_dir.join("java"),
        base_dir.join("version"),
        base_dir.join("instances"),
        base_dir.join("skins"),
    ];

    for dir in dirs_to_create {
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("建立資料夾失敗: {}", e))?;
        }
    }

    // 建立預設設定檔
    let global_cfg = base_dir.join("global.cfg");
    if !global_cfg.exists() {
        fs::write(&global_cfg, "{}").map_err(|e| format!("建立 global.cfg 失敗: {}", e))?;
    }

    let accounts_cfg = base_dir.join("accounts.cfg");
    if !accounts_cfg.exists() {
        fs::write(&accounts_cfg, "[]").map_err(|e| format!("建立 accounts.cfg 失敗: {}", e))?;
    }

    Ok(base_dir.to_string_lossy().into_owned())
}

#[cfg(target_os = "windows")]
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    windows_dpapi::encrypt_data(data, windows_dpapi::Scope::User)
        .map_err(|e| format!("DPAPI 加密失敗: {:?}", e))
}

#[cfg(target_os = "windows")]
fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    windows_dpapi::decrypt_data(data, windows_dpapi::Scope::User)
        .map_err(|e| format!("DPAPI 解密失敗: {:?}", e))
}

#[cfg(not(target_os = "windows"))]
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(target_os = "windows"))]
fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[tauri::command]
fn load_accounts() -> Result<String, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    let accounts_cfg = PathBuf::from(appdata)
        .join("focal-craft-launcher")
        .join("accounts.cfg");

    if accounts_cfg.exists() {
        let bytes = fs::read(&accounts_cfg).map_err(|e| format!("讀取 accounts.cfg 失敗: {}", e))?;
        
        // 嘗試使用 DPAPI 解密
        match decrypt_data(&bytes) {
            Ok(decrypted_bytes) => {
                String::from_utf8(decrypted_bytes).map_err(|e| format!("解析帳號字串為 UTF-8 失敗: {}", e))
            }
            Err(_) => {
                // 若解密失敗則嘗試解析為舊版明文 JSON
                if let Ok(plain_text) = String::from_utf8(bytes.clone()) {
                    let trimmed = plain_text.trim();
                    if trimmed.starts_with('[') && trimmed.ends_with(']') {
                        // 將舊版明文自動加密存檔
                        if let Err(e) = save_accounts(plain_text.clone()) {
                            eprintln!("自動升級加密帳號設定檔失敗: {}", e);
                        } else {
                            println!("成功自動將帳號設定檔升級為 DPAPI 安全加密格式！");
                        }
                        return Ok(plain_text);
                    }
                }
                Err("無法解密帳號設定檔，且非有效明文格式".to_string())
            }
        }
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn save_accounts(accounts_json: String) -> Result<(), String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    let accounts_cfg = PathBuf::from(appdata)
        .join("focal-craft-launcher")
        .join("accounts.cfg");

    let encrypted_bytes = encrypt_data(accounts_json.as_bytes())?;
    fs::write(&accounts_cfg, encrypted_bytes).map_err(|e| format!("寫入 accounts.cfg 失敗: {}", e))
}

#[tauri::command]
async fn get_device_code() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", MICROSOFT_CLIENT_ID),
        ("scope", "XboxLive.signin offline_access"),
    ];

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("發送 Device Code 請求失敗: {}", e))?;

    if res.status().is_success() {
        let data = res
            .json::<DeviceCodeResponse>()
            .await
            .map_err(|e| format!("解析 Device Code 回應失敗: {}", e))?;
        Ok(data)
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("微軟 API 回傳錯誤: {}", err_text))
    }
}

#[tauri::command]
async fn poll_device_token(device_code: String) -> Result<MicrosoftTokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ("client_id", MICROSOFT_CLIENT_ID),
        ("device_code", &device_code),
    ];

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("發送 Token 輪詢請求失敗: {}", e))?;

    if res.status().is_success() {
        let data = res
            .json::<MicrosoftTokenResponse>()
            .await
            .map_err(|e| format!("解析 Token 回應失敗: {}", e))?;
        Ok(data)
    } else {
        #[derive(Deserialize)]
        struct ErrorResponse {
            error: String,
        }
        if let Ok(err_data) = res.json::<ErrorResponse>().await {
            Err(err_data.error)
        } else {
            Err("未知驗證錯誤".to_string())
        }
    }
}

#[tauri::command]
async fn login_minecraft_with_ms_token(
    ms_access_token: String,
    ms_refresh_token: String,
) -> Result<Account, String> {
    let client = reqwest::Client::new();

    // 驗證 Xbox Live
    let xbl_req = XboxLiveAuthRequest {
        properties: XboxLiveAuthProperties {
            auth_method: "RPS".to_string(),
            site_name: "user.auth.xboxlive.com".to_string(),
            user_token: format!("d={}", ms_access_token),
        },
        relying_party: "http://auth.xboxlive.com".to_string(),
        token_type: "JWT".to_string(),
    };

    let xbl_res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&xbl_req)
        .send()
        .await
        .map_err(|e| format!("Xbox Live 認證失敗: {}", e))?;

    if !xbl_res.status().is_success() {
        return Err(format!("Xbox Live 伺服器拒絕請求: {}", xbl_res.status()));
    }

    let xbl_data = xbl_res
        .json::<XboxLiveAuthResponse>()
        .await
        .map_err(|e| format!("解析 Xbox Live 回應失敗: {}", e))?;

    let xbl_token = xbl_data.token;
    let uhs = xbl_data
        .display_claims
        .xui
        .first()
        .ok_or_else(|| "無法從 Xbox Live 回應中取得 user hash (uhs)".to_string())?
        .uhs
        .clone();

    // 授權 XSTS
    let xsts_req = XstsAuthRequest {
        properties: XstsAuthProperties {
            sandbox_id: "RETAIL".to_string(),
            user_tokens: vec![xbl_token],
        },
        relying_party: "rp://api.minecraftservices.com/".to_string(),
        token_type: "JWT".to_string(),
    };

    let xsts_res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&xsts_req)
        .send()
        .await
        .map_err(|e| format!("XSTS 授權失敗: {}", e))?;

    if xsts_res.status().as_u16() == 401 {
        #[derive(Deserialize)]
        struct XstsErrorResponse {
            #[serde(rename = "XErr")]
            x_err: Option<u64>,
        }
        if let Ok(err_data) = xsts_res.json::<XstsErrorResponse>().await {
            if let Some(err_code) = err_data.x_err {
                if err_code == 2148916238 {
                    return Err("XSTS_NO_XBOX_ACCOUNT".to_string());
                } else if err_code == 2148916233 {
                    return Err("XSTS_CHILD_ACCOUNT".to_string());
                }
            }
        }
        return Err("XSTS 授權失敗：未授權 (401)".to_string());
    }

    if !xsts_res.status().is_success() {
        return Err(format!("XSTS 伺服器拒絕請求: {}", xsts_res.status()));
    }

    let xsts_data = xsts_res
        .json::<XboxLiveAuthResponse>()
        .await
        .map_err(|e| format!("解析 XSTS 回應失敗: {}", e))?;

    let xsts_token = xsts_data.token;

    // 登入 Minecraft 服務
    let mc_login_req = MinecraftLoginRequest {
        identity_token: format!("XBL3.0 x={};{}", uhs, xsts_token),
    };

    let mc_login_res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&mc_login_req)
        .send()
        .await
        .map_err(|e| format!("Minecraft 服務登入失敗: {}", e))?;

    if !mc_login_res.status().is_success() {
        return Err(format!(
            "Minecraft Services 拒絕登入: {}",
            mc_login_res.status()
        ));
    }

    let mc_login_data = mc_login_res
        .json::<MinecraftLoginResponse>()
        .await
        .map_err(|e| format!("解析 Minecraft 登入回應失敗: {}", e))?;

    let mc_token = mc_login_data.access_token;
    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
        + (mc_login_data.expires_in * 1000);

    // 檢查遊戲所有權
    let entitlements_res = client
        .get("https://api.minecraftservices.com/entitlements/mcstore")
        .bearer_auth(&mc_token)
        .send()
        .await
        .map_err(|e| format!("檢查遊戲所有權失敗: {}", e))?;

    if !entitlements_res.status().is_success() {
        return Err(format!("無法檢查遊戲所有權: {}", entitlements_res.status()));
    }

    let entitlements_data = entitlements_res
        .json::<EntitlementsResponse>()
        .await
        .map_err(|e| format!("解析遊戲所有權回應失敗: {}", e))?;

    let has_game = entitlements_data
        .items
        .iter()
        .any(|item| item.name == "game_minecraft");
    if !has_game {
        return Err("NO_MINECRAFT_LICENSE".to_string());
    }

    // 取得遊戲角色資訊
    let profile_res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_token)
        .send()
        .await
        .map_err(|e| format!("取得 Minecraft Profile 失敗: {}", e))?;

    if !profile_res.status().is_success() {
        return Err(format!(
            "無法取得 Minecraft Profile: {}",
            profile_res.status()
        ));
    }

    let profile_data = profile_res
        .json::<MinecraftProfileResponse>()
        .await
        .map_err(|e| format!("解析 Minecraft Profile 失敗: {}", e))?;

    let avatar_url = format!("https://minotar.net/avatar/{}", profile_data.id);

    Ok(Account {
        id: profile_data.id,
        mc_id: profile_data.name,
        avatar_url,
        ms_refresh_token,
        mc_access_token: mc_token,
        token_expires_at: expires_at,
    })
}

#[tauri::command]
async fn refresh_minecraft_account(refresh_token: String) -> Result<Account, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("client_id", MICROSOFT_CLIENT_ID),
        ("refresh_token", &refresh_token),
    ];

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("發送微軟 Token 刷新請求失敗: {}", e))?;

    if res.status().is_success() {
        let data = res
            .json::<MicrosoftTokenResponse>()
            .await
            .map_err(|e| format!("解析微軟 Token 刷新回應失敗: {}", e))?;

        login_minecraft_with_ms_token(data.access_token, data.refresh_token).await
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("微軟 Token 刷新失敗: {}", err_text))
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MojangProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<MojangSkin>,
    #[serde(default)]
    pub capes: Vec<MojangCape>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MojangSkin {
    pub id: String,
    pub state: String,
    pub url: String,
    pub variant: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MojangCape {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

#[tauri::command]
async fn get_minecraft_profile(mc_access_token: String) -> Result<MojangProfile, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_access_token)
        .send()
        .await
        .map_err(|e| format!("取得 Minecraft Profile 失敗: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!(
            "無法取得 Minecraft Profile: {} ({})",
            status, err_text
        ));
    }

    let profile = res
        .json::<MojangProfile>()
        .await
        .map_err(|e| format!("解析 Minecraft Profile 失敗: {}", e))?;

    Ok(profile)
}

#[tauri::command]
async fn upload_minecraft_skin(
    mc_access_token: String,
    variant: String,
    file_path: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let file_bytes = if file_path.starts_with("http://") || file_path.starts_with("https://") {
        client.get(&file_path)
            .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .send()
            .await
            .map_err(|e| format!("下載皮膚材質失敗: {}", e))?
            .bytes()
            .await
            .map_err(|e| format!("讀取材質數據失敗: {}", e))?
            .to_vec()
    } else {
        std::fs::read(&file_path).map_err(|e| format!("讀取皮膚檔案失敗: {}", e))?
    };

    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|e| format!("建立上傳區塊失敗: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .text("variant", variant.to_lowercase())
        .part("file", file_part);

    let res = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .bearer_auth(&mc_access_token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("發送更換皮膚請求失敗: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("更換皮膚失敗: {} ({})", status, err_text));
    }

    Ok(())
}

#[tauri::command]
async fn set_active_cape(mc_access_token: String, cape_id: String) -> Result<(), String> {
    let client = reqwest::Client::new();

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct ActiveCapePayload {
        cape_id: String,
    }

    let res = client
        .put("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(&mc_access_token)
        .json(&ActiveCapePayload { cape_id })
        .send()
        .await
        .map_err(|e| format!("發送設定披風請求失敗: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("設定披風失敗: {} ({})", status, err_text));
    }

    Ok(())
}

#[tauri::command]
async fn deactivate_cape(mc_access_token: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client
        .delete("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(&mc_access_token)
        .send()
        .await
        .map_err(|e| format!("發送取消披風請求失敗: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("取消披風失敗: {} ({})", status, err_text));
    }

    Ok(())
}

#[tauri::command]
async fn get_image_base64(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let secure_url = if url.starts_with("http://textures.minecraft.net") {
        url.replace(
            "http://textures.minecraft.net",
            "https://textures.minecraft.net",
        )
    } else {
        url
    };

    let res = client
        .get(&secure_url)
        .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("下載圖片失敗: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("下載圖片伺服器回傳錯誤: {}", status));
    }

    let content_type = match res.headers().get("content-type") {
        Some(val) => val.to_str().unwrap_or("image/png").to_string(),
        None => "image/png".to_string(),
    };

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取圖片數據失敗: {}", e))?;

    use base64::{engine::general_purpose, Engine as _};
    let b64 = general_purpose::STANDARD.encode(&bytes);

    Ok(format!("data:{};base64,{}", content_type, b64))
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WardrobeSkin {
    name: String,
    file_path: String,
    variant: String, // "CLASSIC" or "SLIM"
    timestamp: u64,
    texture_base64: String,
}

#[tauri::command]
async fn save_skin_to_wardrobe(file_path: String, _variant: String) -> Result<(), String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    let skins_dir = PathBuf::from(appdata)
        .join("focal-craft-launcher")
        .join("skins");

    if !skins_dir.exists() {
        fs::create_dir_all(&skins_dir).map_err(|e| format!("建立 skins 資料夾失敗: {}", e))?;
    }

    let src_path = PathBuf::from(&file_path);
    if !src_path.exists() {
        return Err("來源皮膚檔案不存在".to_string());
    }

    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // [時間戳記].png
    let dest_filename = format!("{}.png", timestamp);
    let dest_path = skins_dir.join(&dest_filename);

    fs::copy(&src_path, &dest_path).map_err(|e| format!("複製皮膚檔案失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn get_wardrobe_skins() -> Result<Vec<WardrobeSkin>, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "無法取得 APPDATA 環境變數".to_string())?;
    let skins_dir = PathBuf::from(appdata)
        .join("focal-craft-launcher")
        .join("skins");

    if !skins_dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&skins_dir).map_err(|e| format!("讀取 skins 資料夾失敗: {}", e))?;
    let mut skins = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("讀取資料夾項目失敗: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("png") {
            let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("");

            // 解析皮膚檔名資訊
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let parts: Vec<&str> = stem.split('_').collect();

            let mut variant = "CLASSIC".to_string();
            let mut timestamp = 0;
            let mut name = stem.to_string();

            if parts.len() >= 3 {
                let ts_str = parts[parts.len() - 1];
                let var_str = parts[parts.len() - 2];

                if let Ok(ts) = ts_str.parse::<u64>() {
                    timestamp = ts;
                    variant = if var_str.to_lowercase() == "slim" {
                        "SLIM".to_string()
                    } else {
                        "CLASSIC".to_string()
                    };
                    name = parts[0..parts.len() - 2].join("_");
                }
            } else if parts.len() == 2 {
                let var_str = parts[1];
                if var_str.to_lowercase() == "slim" || var_str.to_lowercase() == "classic" {
                    variant = var_str.to_uppercase();
                    name = parts[0].to_string();
                }
            } else if parts.len() == 1 {
                if let Ok(ts) = stem.parse::<u64>() {
                    timestamp = ts;
                }
            }

            // 讀取圖片轉換為 base64
            let bytes =
                fs::read(&path).map_err(|e| format!("讀取皮膚檔案 {} 失敗: {}", filename, e))?;
            use base64::{engine::general_purpose, Engine as _};
            let b64 = general_purpose::STANDARD.encode(&bytes);
            let texture_base64 = format!("data:image/png;base64,{}", b64);

            skins.push(WardrobeSkin {
                name,
                file_path: path.to_string_lossy().to_string(),
                variant,
                timestamp,
                texture_base64,
            });
        }
    }

    // 按時間戳排序（由新到舊）
    skins.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(skins)
}

#[tauri::command]
async fn delete_skin_from_wardrobe(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("刪除皮膚檔案失敗: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn open_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let target = if !url.starts_with("http://") && !url.starts_with("https://") {
        let path = std::path::PathBuf::from(&url);
        if !path.exists() {
            let path_str = path.to_string_lossy().to_string();
            let script = format!(
                r#"
                Add-Type -AssemblyName System.Windows.Forms
                [System.Windows.Forms.MessageBox]::Show("找不到指定的路徑或檔案：`n{}", "錯誤", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
                "#,
                path_str.replace("`", "``").replace("\"", "`\"")
            );

            // 使用 spawn_blocking 避免阻塞 Tokio 執行緒池，並關閉新視窗顯示（CREATE_NO_WINDOW）
            let _ = tokio::task::spawn_blocking(move || {
                let mut cmd = std::process::Command::new("powershell");
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                cmd.arg("-Command").arg(&script).output()
            })
            .await;

            return Err("找不到指定的路徑或檔案！".to_string());
        }
        path.to_string_lossy().to_string()
    } else {
        url
    };

    app.opener()
        .open_path(&target, None::<String>)
        .map_err(|e| format!("無法開啟網頁或資料夾: {}", e))
}

// ==========================================
// Entry point
// ==========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherState {
            watcher: std::sync::Mutex::new(None),
        })
        .manage(RootWatcherState {
            watcher: std::sync::Mutex::new(None),
        })
        .manage(SessionState {
            sessions: std::sync::Mutex::new(std::collections::HashMap::new()),
        })
        .setup(|_app| {
            // 在啟動時自動初始化資料夾
            match init_app_dirs() {
                Ok(path) => println!("FocalCraft Launcher initialized at: {}", path),
                Err(e) => eprintln!("Failed to initialize: {}", e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_app_dirs,
            load_accounts,
            save_accounts,
            save_skin_to_wardrobe,
            get_wardrobe_skins,
            delete_skin_from_wardrobe,
            get_device_code,
            poll_device_token,
            login_minecraft_with_ms_token,
            refresh_minecraft_account,
            open_in_browser,
            get_minecraft_profile,
            upload_minecraft_skin,
            set_active_cape,
            deactivate_cape,
            get_image_base64,
            minecraft::get_instances,
            minecraft::create_instance,
            minecraft::update_instance_settings,
            minecraft::delete_instance,
            minecraft::detect_java,
            minecraft::download_java,
            minecraft::get_minecraft_versions,
            minecraft::install_instance_files,
            minecraft::get_loader_versions,
            minecraft::upload_custom_loader_jar,
            minecraft::save_instance_order,
            minecraft::load_instance_order,
            minecraft::search_modrinth_modpacks,
            minecraft::parse_pack_info,
            minecraft::import_pack,
            minecraft::launch_instance,
            minecraft::select_mrpack_file,
            minecraft::download_pack,
            minecraft::export_instance,
            minecraft::select_export_zip_path,
            minecraft::load_global_config,
            minecraft::save_global_config,
            minecraft::select_directory,
            minecraft::select_java_file,
            minecraft::verify_custom_java,
            minecraft::get_installed_mods,
            minecraft::get_installed_resourcepacks,
            minecraft::get_installed_shaderpacks,
            minecraft::get_installed_datapacks,
            minecraft::get_installed_worlds,
            minecraft::get_servers,
            minecraft::save_servers,
            minecraft::read_latest_log,
            minecraft::update_instance_config,
            minecraft::update_instance_icon,
            minecraft::update_instance_icon_url,
            minecraft::update_instance_icon_value,
            minecraft::delete_instance_file,
            minecraft::import_files,
            minecraft::import_world_zip,
            minecraft::download_and_replace_file,
            minecraft::select_multiple_files,
            minecraft::select_single_file,
            minecraft::search_modrinth,
            minecraft::get_screenshots,
            minecraft::toggle_mod,
            minecraft::watch_instance_folders,
            minecraft::unwatch_instance_folders,
            minecraft::watch_instances_dir,
            minecraft::init_launch_session,
            minecraft::cancel_launch_session,
            minecraft::kill_launch_session,
            minecraft::get_required_java_version,
            minecraft::search_curseforge,
            minecraft::get_curseforge_project_description,
            minecraft::get_curseforge_project_files,
            minecraft::get_curseforge_projects,
            minecraft::download_curseforge_file,
            minecraft::scan_downloads_for_hashes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dpapi_encryption_decryption() {
        let test_data = b"Hello, DPAPI security!";
        let encrypted = encrypt_data(test_data).expect("Encryption failed");
        assert_ne!(test_data.to_vec(), encrypted);
        let decrypted = decrypt_data(&encrypted).expect("Decryption failed");
        assert_eq!(test_data.to_vec(), decrypted);
    }

    #[test]
    fn test_load_accounts_migration() {
        // 驗證讀取帳號資訊與遷移機制
        let accounts = load_accounts().expect("load_accounts failed");
        println!("Loaded accounts: {}", accounts);
        assert!(accounts.starts_with('[') && accounts.ends_with(']'));

        // 再次讀取時應成功解密加密檔案
        let appdata = std::env::var("APPDATA").expect("No APPDATA");
        let accounts_cfg = std::path::PathBuf::from(appdata)
            .join("focal-craft-launcher")
            .join("accounts.cfg");
        let bytes = std::fs::read(&accounts_cfg).expect("Read failed");
        
        // 加密後的第一個字元不應為 ASCII '['
        if !bytes.is_empty() {
            assert_ne!(bytes[0], b'[');
        }
    }
}

