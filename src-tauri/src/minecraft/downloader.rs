use std::fs;
use std::path::Path;

// 下載單個檔案 (重用全域 HTTP 連線池)
pub async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = crate::get_client().clone();
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

// 驗證 SHA1 雜湊校驗
pub fn verify_sha1(path: &Path, expected_sha1: &str) -> bool {
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

// ==================== 單元測試 ====================
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_verify_sha1_correct() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("fc_test_sha1.txt");
        let content = b"FocalCraft Downloader Test Content 2026";
        
        let mut file = fs::File::create(&test_file).unwrap();
        file.write_all(content).unwrap();
        drop(file);

        // Content: "FocalCraft Downloader Test Content 2026"
        // Expected SHA1: 1f0e478546b3f7902d2de7f2e46b3cf17d2bb900 (範例計算)
        use sha1::{Digest, Sha1};
        let mut hasher = Sha1::new();
        hasher.update(content);
        let expected_sha1 = format!("{:x}", hasher.finalize());

        assert!(verify_sha1(&test_file, &expected_sha1), "雜湊校驗必須匹配成功");
        assert!(!verify_sha1(&test_file, "wrong_hash_1234567"), "錯誤的雜湊校驗必須匹配失敗");
        
        // 刪除測試檔案
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_verify_sha1_nonexistent() {
        let nonexistent_path = Path::new("this_file_does_not_exist_xyz.txt");
        assert!(!verify_sha1(nonexistent_path, "any_sha1"), "不存在的檔案校驗必須返回 false");
    }

    #[test]
    fn test_verify_sha1_empty_expected() {
        let nonexistent_path = Path::new("this_file_does_not_exist_xyz2.txt");
        assert!(verify_sha1(nonexistent_path, ""), "預期值為空時必須直接返回 true");
    }
}
