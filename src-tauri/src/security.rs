// ==================== Windows 平台加密實現 ====================
#[cfg(target_os = "windows")]
pub fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    windows_dpapi::encrypt_data(data, windows_dpapi::Scope::User)
        .map_err(|e| format!("DPAPI 加密失敗: {:?}", e))
}

#[cfg(target_os = "windows")]
pub fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    windows_dpapi::decrypt_data(data, windows_dpapi::Scope::User)
        .map_err(|e| format!("DPAPI 解密失敗: {:?}", e))
}

// ==================== 非 Windows 平台加密實現 ====================
#[cfg(not(target_os = "windows"))]
fn get_or_create_dek() -> Result<Vec<u8>, String> {
    use keyring::Entry;
    use base64::{engine::general_purpose, Engine as _};
    use rand::RngCore;
    use std::fs;

    let service_name = "focal-craft-launcher";
    let account_name = "dek";
    
    match Entry::new(service_name, account_name) {
        Ok(entry) => {
            match entry.get_password() {
                Ok(dek_b64) => {
                    if let Ok(dek) = general_purpose::STANDARD.decode(dek_b64.trim()) {
                        if dek.len() == 32 {
                            return Ok(dek);
                        }
                    }
                }
                Err(_) => {
                    let mut dek = vec![0u8; 32];
                    rand::thread_rng().fill_bytes(&mut dek);
                    let dek_b64 = general_purpose::STANDARD.encode(&dek);
                    if let Err(e) = entry.set_password(&dek_b64) {
                        eprintln!("Keyring 寫入密鑰失敗: {:?}", e);
                    } else {
                        return Ok(dek);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Keyring 初始化項目失敗: {:?}", e);
        }
    }

    // 當系統 Keyring 不可用時的 Fallback 降級儲存
    let app_dir = crate::get_app_dir()?;
    let key_path = app_dir.join(".fc_local_key");
    if key_path.exists() {
        let bytes = fs::read(&key_path).map_err(|e| format!("讀取本地 Fallback 密鑰失敗: {}", e))?;
        if let Ok(key_str) = String::from_utf8(bytes) {
            if let Ok(dek) = general_purpose::STANDARD.decode(key_str.trim()) {
                if dek.len() == 32 {
                    return Ok(dek);
                }
            }
        }
    }

    let mut dek = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut dek);
    let dek_b64 = general_purpose::STANDARD.encode(&dek);
    fs::write(&key_path, &dek_b64).map_err(|e| format!("寫入本地 Fallback 密鑰失敗: {}", e))?;
    eprintln!("安全性警告：Keyring 連線失敗，已降級至本地隱藏密鑰檔安全防護！");
    Ok(dek)
}

#[cfg(not(target_os = "windows"))]
pub fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
    use chacha20poly1305::aead::{Aead, KeyInit};
    use rand::RngCore;

    let dek = get_or_create_dek()?;
    let key = Key::from_slice(&dek);
    let cipher = ChaCha20Poly1305::new(key);
    
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| format!("ChaCha20 加密失敗: {:?}", e))?;

    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
pub fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
    use chacha20poly1305::aead::{Aead, KeyInit};

    if data.len() < 12 {
        return Err("解密資料過短，缺少 Nonce 標頭".to_string());
    }

    let dek = get_or_create_dek()?;
    let key = Key::from_slice(&dek);
    let cipher = ChaCha20Poly1305::new(key);

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("ChaCha20 解密失敗: {:?}", e))?;

    Ok(plaintext)
}

// ==================== 單元測試 ====================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_flow() {
        let original_data = b"Hello FocalCraft Secure Token 2026!";
        
        // 測試加密
        let encrypted = encrypt_data(original_data);
        assert!(encrypted.is_ok(), "加密應該成功");
        let encrypted_bytes = encrypted.unwrap();
        assert_ne!(original_data.to_vec(), encrypted_bytes, "加密後的資料不應該等於原始資料");

        // 測試解密
        let decrypted = decrypt_data(&encrypted_bytes);
        assert!(decrypted.is_ok(), "解密應該成功");
        let decrypted_bytes = decrypted.unwrap();
        assert_eq!(original_data.to_vec(), decrypted_bytes, "解密後的資料必須等於原始資料");
    }

    #[test]
    fn test_decrypt_too_short() {
        let invalid_data = vec![0u8; 10]; // 小於 12 字節的 Nonce 標頭
        let decrypted = decrypt_data(&invalid_data);
        assert!(decrypted.is_err(), "過短的資料解密應該出錯");
    }
}
