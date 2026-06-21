<p align="center">
  <img src="src/assets/app-icon.svg" alt="FocalCraft Launcher Logo" width="120px">
</p>

<h1 align="center">🌌 FocalCraft Launcher</h1>

<p align="center">
  <strong>「輕量、極速、美觀 —— 重新定義你的 Minecraft 遊戲管理體驗」</strong>
</p>

<p align="center">
  <a href="https://github.com/tauri-apps/tauri"><img src="https://img.shields.io/badge/Tauri-v2-FFC107?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust 2021"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="file:///d:/Users/FocalSalt/Documents/focal-craft-launcher/LICENSE.txt"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License"></a>
</p>

---

## 📖 專案介紹

**FocalCraft Launcher** 是一款基於 **Tauri v2 + Rust** 核心與 **React + TypeScript** 現代前端技術打造的新一代 Minecraft 啟動器。

我們深知玩家在遊玩模組（Mod）與管理多個遊戲版本時的痛點，因此致力於提供一個**極致流暢、安全可靠且視覺精美**的全新選擇。藉由 Rust 的系統級效能與 Tauri v2 的輕量化架構，FocalCraft 將每一兆記憶體留給遊戲，帶給您原生級的順暢體驗。

---

## ✨ 核心特色亮點

### 🔒 1. 銀行級帳號安全防護
* **微軟 OAuth 安全驗證**：支援官方微軟裝置碼登入（Device Code Flow），保障您的密碼永不經過第三方。同時提供離線模式以供測試。
* **Windows DPAPI 系統級加密**：敏感的帳號與 Token 資訊均使用 Windows 系統內建的 DPAPI 加密技術保存於 `accounts.cfg` 中。即使他人直接複製您的設定檔，也無法在其他電腦上解密。
* **無痛自動升級**：內建自動遷移機制，若檢測到舊版明文 JSON 帳號設定檔，將於啟動時自動升級為安全加密格式。

### 🔌 2. 雙生態圈一鍵整合 (Modrinth & CurseForge)
* **內置一鍵搜尋與下載**：無需打開瀏覽器！在啟動器內即可直接瀏覽、搜尋並下載 Modrinth 與 CurseForge 上的模組 (Mods)、資源包 (Resource Packs)、光影包 (Shader Packs)、數據包 (Datapacks) 及世界存檔。
* **支援標準 `.mrpack` 格式**：一鍵匯入 Modrinth 標準模組包，自動解析並極速下載所有相依檔案。

### 🗃️ 3. 深度實例 (Instance) 沙盒化管理
* **環境完全獨立**：每個遊戲實例（Instance）均為獨立沙盒，從 Mod、光影、存檔到伺服器列表（內建 `servers.dat` 編輯器）皆互不干擾。
* **極客設定調整**：支援為每個實例單獨配置 Java 執行路徑、最大/最小記憶體分配、JVM 啟動參數與自訂圖示。
* **資料夾即時監控**：內建監控功能，當您手動將檔案放入實例資料夾時，啟動器會即時更新狀態，免去手動重整的繁瑣。

### 👕 4. 隨心所欲的「外觀衣櫃」(Wardrobe)
* **3D 皮膚即時預覽**：內建基於 `skinview3d` 的 3D 玩家角色外觀互動式渲染器，支援 Classic (64x64) 與 Slim (Alex) 雙模型展示。
* **本機皮膚收藏庫**：允許在本地收藏無限數量的外觀皮膚（檔案將安全儲存於 `%APPDATA%/focal-craft-launcher/skins`）。
* **一鍵上傳與同步**：支援將選定的外觀一鍵同步上傳至 Mojang 官方伺服器，並支援帳號披風 (Cape) 的快速切換與停用。

### 🛠️ 5. 智慧 Java 環境託管
* **版本精準配對**：自動檢測當前 Minecraft 版本所需的最佳 Java 版本（例如 Java 8, 17, 21 等）。
* **一鍵自動下載**：如果系統缺少對應的 Java 運行環境，啟動器將會自動下載並配置對應的 JRE，徹底擺脫「Java 版本錯誤」導致的無法啟動。

### 📊 6. 即時診斷與發行管理
* **啟動狀態 HUD**：精心設計的啟動進度條與狀態顯示，讓您對遊戲加載進度瞭如指掌。
* **即時日誌系統 (Live Logs)**：內建日誌主控台，即時輸出 Minecraft 執行日誌，讓模組衝突或崩潰原因無所遁形。
* **靈活控制**：支援啟動會話管理，隨時可以取消載入或在遊戲無回應時一鍵強制結束 (Kill)。

---

## 🛠️ 技術架構與優勢

| 技術棧 | 扮演角色 | 優勢說明 |
| :--- | :--- | :--- |
| **Rust (Tauri v2)** | 後端核心 | 安全性高、執行效率極致、原生系統 API 呼叫、超小打包體積。 |
| **React 19 + TypeScript** | 前端界面 | 模組化開發、嚴格的型別檢查，打造流動感、高反應率的 UI。 |
| **Zustand** | 狀態管理 | 輕量且靈活的全域狀態管理，實現流暢的組件間狀態同步。 |
| **skinview3d** | 3D 外觀渲染 | 在前端即時渲染互動式 3D 玩家皮膚，提升用戶視覺體驗。 |
| **CSS Modules** | 視覺樣式 | 避免全域樣式污染，呈現細緻的現代毛玻璃（Glassmorphism）與微動畫效果。 |

---

## 💡 為什麼選擇 FocalCraft Launcher？

* **原版 (Vanilla) 玩家**：乾淨俐落的介面，極速啟動，自動幫您下載合適的 Java。
* **模組 (Mod) 狂熱玩家**：一鍵搜尋並下載 Modrinth/CurseForge 資源，自由開關、測試模組，實例之間井然有序。
* **伺服器管理員與社群**：自訂伺服器列表與特定模組包整合，讓隊友用最簡單的方式加入遊戲。

---

## 🚀 快速開始

### 前置環境準備
在開始開發與編譯前，請確保您的系統已安裝以下工具：
1. **Node.js** (建議 v20.x 或以上版本)
2. **Rust 工具鏈** (rustc, cargo)
3. **Microsoft Edge WebView2** (Windows 系統通常已內建，Tauri 渲染所需)

### 1. 安裝專案依賴
複製本專案至本機後，在專案根目錄執行以下命令安裝前端依賴：
```bash
npm install
```

### 2. 啟動開發模式
執行以下命令以啟動 Tauri 開發者模式，這會自動開啟前端的 Vite 服務與 Rust 後端：
```bash
npm run tauri dev
```

### 3. 編譯打包生產版本
如果您需要打包適用於您系統的可執行檔案：
```bash
npm run tauri build
```
*打包完成後的可執行檔將會輸出於 `src-tauri/target/release/bundle/` 目錄下。*

---

## 📄 授權條款

本專案採用 **MIT License** 進行授權。詳細資訊請參閱 [LICENSE.txt](file:///d:/Users/FocalSalt/Documents/focal-craft-launcher/LICENSE.txt) 檔案。

Copyright (c) 2026 FocalSalt.
