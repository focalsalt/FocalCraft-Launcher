import { useState, useEffect, useRef } from 'react';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { MojangProfile, MojangCape } from '../../types';
import {
  Loader2,
  Upload,
  Check,
  X,
  AlertTriangle,
  Shirt,
  Trash2,
  Copy,
  WifiOff
} from 'lucide-react';
import { SkinViewer, WalkingAnimation, IdleAnimation } from 'skinview3d';
import styles from './AccountInfoView.module.css';


// 9款官方預設外觀資訊，包含名稱、變體模型、本機材質路徑與可靠的 CDN 材質 URL
const DEFAULT_SKINS = [
  {
    name: "Steve",
    variant: "CLASSIC" as const,
    localUrl: "/Steve.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/wide/steve.png"
  },
  {
    name: "Alex",
    variant: "SLIM" as const,
    localUrl: "/Alex.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/slim/alex.png"
  },
  {
    name: "Noor",
    variant: "SLIM" as const,
    localUrl: "/Noor.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/slim/noor.png"
  },
  {
    name: "Sunny",
    variant: "CLASSIC" as const,
    localUrl: "/Sunny.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/wide/sunny.png"
  },
  {
    name: "Ari",
    variant: "CLASSIC" as const,
    localUrl: "/Ari.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/wide/ari.png"
  },
  {
    name: "Zuri",
    variant: "CLASSIC" as const,
    localUrl: "/Zuri.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/wide/zuri.png"
  },
  {
    name: "Makena",
    variant: "SLIM" as const,
    localUrl: "/Makena.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/slim/makena.png"
  },
  {
    name: "Kai",
    variant: "CLASSIC" as const,
    localUrl: "/Kai.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/wide/kai.png"
  },
  {
    name: "Efe",
    variant: "SLIM" as const,
    localUrl: "/Efe.png",
    url: "https://mcasset.cloud/1.21/assets/minecraft/textures/entity/player/slim/efe.png"
  }
];

// 非同步渲染 3D 披風/鞘翅靜態圖，生成完成後自動 dispose 釋放 WebGL 資源
function renderCape3D(capeB64: string, showElytra: boolean): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 240;
    const viewer = new SkinViewer({
      canvas: canvas,
      width: 180,
      height: 240,
      enableControls: false
    });

    // 設定 3D 相機位置及視角，如果顯示鞘翅，相機需向後拉遠以避免翅膀被切割
    if (showElytra) {
      viewer.camera.position.set(14, 1.5, -34);
      viewer.controls.target.set(0, -1, -2);
    } else {
      viewer.camera.position.set(8, 2.5, -22);
      viewer.controls.target.set(0, 0, -2);
    }
    viewer.controls.update();

    const img = new Image();
    img.src = capeB64;
    img.onload = () => {
      viewer.loadCape(img, { backEquipment: showElytra ? "elytra" : "cape" });
      viewer.render();

      // 在下一個畫格獲取 Data URL，確保 WebGL 已渲染完畢
      requestAnimationFrame(() => {
        try {
          const dataUrl = canvas.toDataURL();
          viewer.dispose();
          resolve(dataUrl);
        } catch (err) {
          viewer.dispose();
          resolve('');
        }
      });
    };
    img.onerror = () => {
      viewer.dispose();
      resolve('');
    };
  });
}

// 非同步渲染 3D 皮膚靜態圖，生成完成後自動 dispose 釋放 WebGL 資源
function renderSkin3D(skinB64: string, variant: 'CLASSIC' | 'SLIM'): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 240;
    const viewer = new SkinViewer({
      canvas: canvas,
      width: 180,
      height: 240,
      enableControls: false
    });

    // 設定 3D 相機位置及視角：面向左前方 45 度，俯角 20 度，人物整體更往上且縮小一點
    viewer.playerObject.rotation.y = -0.785; // 面向左前方 (45 度)
    viewer.camera.position.set(0, 17.8, 38.0); // 增加 Z 軸距離 (38.0) 縮小人物，維持 20 度俯角
    viewer.controls.target.set(0, 2, 0); // 焦點下移 (y=4.0) 使人物在畫面中更偏上
    viewer.controls.update();

    const img = new Image();
    img.src = skinB64;
    img.onload = () => {
      viewer.loadSkin(img, { model: variant === 'SLIM' ? 'slim' : 'default' });
      viewer.render();

      // 在下一個畫格獲取 Data URL，確保 WebGL 已渲染完畢
      requestAnimationFrame(() => {
        try {
          const dataUrl = canvas.toDataURL();
          viewer.dispose();
          resolve(dataUrl);
        } catch (err) {
          viewer.dispose();
          resolve('');
        }
      });
    };
    img.onerror = () => {
      viewer.dispose();
      resolve('');
    };
  });
}

// 非同步檢測皮膚模型變體 (Classic / Slim)
function detectSkinVariant(skinB64: string): Promise<'CLASSIC' | 'SLIM'> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = skinB64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 64;
      canvas.height = img.height || 64;
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.height === 32) {
        resolve('CLASSIC');
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const getAlpha = (x: number, y: number) => {
          const idx = (y * canvas.width + x) * 4 + 3;
          return data[idx];
        };

        let isSlim = true;
        // 檢測右手臂區塊最外側的像素列 X: 55, Y: 20-31
        for (let y = 20; y < 32; y++) {
          if (getAlpha(55, y) > 0) {
            isSlim = false;
            break;
          }
        }
        // 檢測左手臂區塊最外側的像素列 X: 47, Y: 52-63
        if (isSlim) {
          for (let y = 52; y < 64; y++) {
            if (getAlpha(47, y) > 0) {
              isSlim = false;
              break;
            }
          }
        }
        resolve(isSlim ? 'SLIM' : 'CLASSIC');
      } catch (err) {
        resolve('CLASSIC');
      }
    };
    img.onerror = () => {
      resolve('CLASSIC');
    };
  });
}

export function AccountInfoView() {
  const { accounts, selectedAccountId, refreshAccountToken } = useAccountStore();
  const { activeDetailTab, addNotification } = useAppStore();

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  const [profile, setProfile] = useState<MojangProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 紋理 Base64 快取
  const [skinBase64, setSkinBase64] = useState<string>('');
  const [skinVariant, setSkinVariant] = useState<'CLASSIC' | 'SLIM'>('CLASSIC');
  const [capeBase64Map, setCapeBase64Map] = useState<Record<string, string>>({});
  const [defaultElytraB64, setDefaultElytraB64] = useState<string>('');
  const [cape3DPreviewMap, setCape3DPreviewMap] = useState<Record<string, string>>({});

  // 皮膚櫃狀態
  const [wardrobeSkins, setWardrobeSkins] = useState<any[]>([]);
  const [wardrobe3DMap, setWardrobe3DMap] = useState<Record<string, string>>({});
  const [isApplyingSkinId, setIsApplyingSkinId] = useState<string | null>(null);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);

  // 官方預設外觀狀態
  const [defaultSkinsB64, setDefaultSkinsB64] = useState<Record<string, string>>({});
  const [defaultSkins3D, setDefaultSkins3D] = useState<Record<string, string>>({});
  const [isApplyingDefaultSkin, setIsApplyingDefaultSkin] = useState<string | null>(null);

  // 錯誤狀態追蹤
  const [avatarError, setAvatarError] = useState(false);
  const [capeLoadErrors, setCapeLoadErrors] = useState<Record<string, boolean>>({});
  const [defaultSkinErrors, setDefaultSkinErrors] = useState<Record<string, boolean>>({});
  const [wardrobeErrors, setWardrobeErrors] = useState<Record<string, boolean>>({});

  // 3D 渲染控制狀態
  const [animationType, setAnimationType] = useState<'none' | 'idle' | 'walk'>('idle');
  const [autoRotate, setAutoRotate] = useState(false);

  // 皮膚變體選擇與上傳檔案狀態
  const [selectedVariant, setSelectedVariant] = useState<'CLASSIC' | 'SLIM'>('CLASSIC');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // 披風操作與預覽狀態
  const [isUpdatingCape, setIsUpdatingCape] = useState(false);
  const [selectedCapeId, setSelectedCapeId] = useState<string | null>(null); // 手動選取預覽用
  const [showElytra, setShowElytra] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const latestLoadIdRef = useRef<number>(0);

  // 載入 Mojang 資訊與下載 Base64 貼圖
  const fetchProfileData = async () => {
    if (!activeAccount) {
      setErrorMsg("請先登入帳號");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setProfile(null);
    setSkinBase64('');
    setCapeBase64Map({});
    setSelectedCapeId(null);
    setAvatarError(false);
    setCapeLoadErrors({});
    setDefaultSkinErrors({});
    setWardrobeErrors({});

    try {
      // 確保 Token 在有效期內，如果快過期會自動刷新
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) {
          currentToken = refreshed.mcAccessToken;
        } else {
          throw new Error("帳號認證已過期且自動重新整理失敗，請點選登入頭像重新登入。");
        }
      }

      // 1. 取得 Mojang Profile 資訊
      const profileData = await invoke<MojangProfile>('get_minecraft_profile', {
        mcAccessToken: currentToken
      });
      setProfile(profileData);

      // 2. 取得 active 的皮膚並下載 base64
      const activeSkin = profileData.skins?.find(s => s.state === 'ACTIVE');
      if (activeSkin) {
        try {
          const skinB64 = await invoke<string>('get_image_base64', { url: activeSkin.url });
          setSkinBase64(skinB64);
          setSkinVariant(activeSkin.variant);
          setSelectedVariant(activeSkin.variant); // 預設跟隨目前皮膚變體
        } catch (skinErr) {
          console.error("Failed to load skin image:", skinErr);
          setSkinBase64('/Steve.png');
          setSkinVariant('CLASSIC');
        }
      } else {
        // 沒有 active 皮膚，載入 Steve
        setSkinBase64('/Steve.png');
        setSkinVariant('CLASSIC');
      }

      // 3. 取得所有披風並下載 base64
      const capeMap: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};
      if (profileData.capes && profileData.capes.length > 0) {
        for (const cape of profileData.capes) {
          try {
            const capeB64 = await invoke<string>('get_image_base64', { url: cape.url });
            capeMap[cape.id] = capeB64;
          } catch (capeErr) {
            console.error(`Failed to load cape image for ${cape.alias}:`, capeErr);
            errorsMap[cape.id] = true;
          }
        }
      }
      setCapeBase64Map(capeMap);
      setCapeLoadErrors(prev => ({ ...prev, ...errorsMap }));

    } catch (err) {
      console.error("Failed to fetch Mojang profile:", err);
      setErrorMsg(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // 讀取皮膚櫃清單
  const fetchWardrobeSkins = async () => {
    try {
      const skins = await invoke<any[]>('get_wardrobe_skins');

      // 自動檢測 variant 並格式化名稱（若是純數字，即為 timestamp 檔案，格式化為日期時間）
      const processedSkins = await Promise.all(
        skins.map(async (skin) => {
          let detectedVariant = skin.variant;
          try {
            detectedVariant = await detectSkinVariant(skin.texture_base64);
          } catch (err) {
            console.error("Failed to auto-detect skin variant:", err);
          }

          let formattedName = skin.name;
          if (skin.timestamp && !isNaN(Number(skin.name))) {
            const date = new Date(skin.timestamp * 1000);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            formattedName = `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
          }

          return {
            ...skin,
            variant: detectedVariant,
            name: formattedName
          };
        })
      );

      setWardrobeSkins(processedSkins);
    } catch (err) {
      console.error("Failed to fetch wardrobe skins:", err);
    }
  };

  // 點擊套用皮膚櫃皮膚
  const handleApplyWardrobeSkin = async (skin: any) => {
    if (!activeAccount) return;
    setIsApplyingSkinId(skin.file_path);

    try {
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) currentToken = refreshed.mcAccessToken;
      }

      await invoke('upload_minecraft_skin', {
        mcAccessToken: currentToken,
        variant: skin.variant,
        filePath: skin.file_path
      });

      addNotification({
        type: 'success',
        title: '更換皮膚成功',
        message: `成功套用皮膚 "${skin.name}"！`
      });

      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '套用皮膚失敗',
        message: String(err)
      });
    } finally {
      setIsApplyingSkinId(null);
    }
  };

  // 點擊套用官方預設外觀
  const handleApplyDefaultSkin = async (skinUrl: string, variant: 'CLASSIC' | 'SLIM') => {
    if (!activeAccount) return;
    setIsApplyingDefaultSkin(skinUrl);

    try {
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) currentToken = refreshed.mcAccessToken;
      }

      await invoke('upload_minecraft_skin', {
        mcAccessToken: currentToken,
        variant: variant === 'SLIM' ? 'slim' : 'classic',
        filePath: skinUrl
      });

      addNotification({
        type: 'success',
        title: '更換預設外觀成功',
        message: `成功將預設外觀套用至您的 Mojang 帳號！`
      });

      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '套用預設外觀失敗',
        message: String(err)
      });
    } finally {
      setIsApplyingDefaultSkin(null);
    }
  };

  // 刪除皮膚櫃皮膚
  const handleDeleteWardrobeSkin = async (filePath: string) => {
    try {
      await invoke('delete_skin_from_wardrobe', { filePath });
      addNotification({
        type: 'success',
        title: '刪除成功',
        message: '已從皮膚櫃中移除該皮膚。'
      });
      await fetchWardrobeSkins();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '刪除失敗',
        message: String(err)
      });
    } finally {
      setConfirmDeletePath(null);
    }
  };

  // 監聽分頁切換以加載皮膚櫃
  useEffect(() => {
    if (activeDetailTab === 'skin_wardrobe') {
      fetchWardrobeSkins();
    }
  }, [activeDetailTab]);

  // 監聽拖放上傳與高亮樣式
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWebview().onDragDropEvent((event) => {
      // 僅在「皮膚」分頁時處理拖曳檔案
      if (activeDetailTab !== 'skins') return;

      if (event.payload.type === 'enter') {
        setIsDragActive(true);
      } else if (event.payload.type === 'leave') {
        setIsDragActive(false);
      } else if (event.payload.type === 'drop') {
        setIsDragActive(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          const path = paths[0];
          if (path.toLowerCase().endsWith('.png')) {
            setSelectedFilePath(path);
          } else {
            addNotification({
              type: 'error',
              title: '不支援的檔案格式',
              message: '請拖放 PNG 格式的皮膚檔案。'
            });
          }
        }
      }
    }).then(unlistenFn => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeDetailTab]);

  // 當皮膚櫃清單有變時，非同步生成皮膚 3D 靜態縮圖
  useEffect(() => {
    let active = true;

    const generatePreviews = async () => {
      if (wardrobeSkins.length === 0) return;

      const newPreviews: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};

      for (const skin of wardrobeSkins) {
        if (!active) return;

        // 用 file_path 作為快取鍵
        const cacheKey = skin.file_path;
        if (wardrobe3DMap[cacheKey]) {
          newPreviews[cacheKey] = wardrobe3DMap[cacheKey];
          continue;
        }

        try {
          const renderedB64 = await renderSkin3D(skin.texture_base64, skin.variant);
          if (renderedB64) {
            newPreviews[cacheKey] = renderedB64;
          } else {
            errorsMap[cacheKey] = true;
          }
        } catch (err) {
          console.error("Failed to render 3D preview for wardrobe skin:", skin.name, err);
          errorsMap[cacheKey] = true;
        }
      }

      if (active) {
        setWardrobe3DMap(prev => ({
          ...prev,
          ...newPreviews
        }));
        setWardrobeErrors(prev => ({
          ...prev,
          ...errorsMap
        }));
      }
    };

    generatePreviews();

    return () => {
      active = false;
    };
  }, [wardrobeSkins]);

  // 異步讀取本機 9 款預設皮膚的 Base64 數據
  useEffect(() => {
    let active = true;
    const loadDefaultSkins = async () => {
      const b64Map: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};
      for (const skin of DEFAULT_SKINS) {
        if (!active) return;
        try {
          // 直接從本機 public 目錄讀取，100% 離線可用且無 CORS 限制
          const res = await fetch(skin.localUrl);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const blob = await res.blob();
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          b64Map[skin.url] = b64;
        } catch (err) {
          console.error(`Failed to prefetch default skin base64 for ${skin.name}:`, err);
          errorsMap[skin.url] = true;
        }
      }
      if (active) {
        setDefaultSkinsB64(b64Map);
        setDefaultSkinErrors(prev => ({ ...prev, ...errorsMap }));
      }
    };
    loadDefaultSkins();
    return () => {
      active = false;
    };
  }, []);

  // 根據快取的 Base64 異步渲染 9 款預設皮膚的 3D 靜態人偶
  useEffect(() => {
    let active = true;
    const renderDefaultPreviews = async () => {
      const previews: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};
      for (const skin of DEFAULT_SKINS) {
        if (!active) return;
        const b64 = defaultSkinsB64[skin.url];
        if (b64) {
          try {
            const preview = await renderSkin3D(b64, skin.variant);
            if (preview) {
              previews[skin.url] = preview;
            } else {
              errorsMap[skin.url] = true;
            }
          } catch (err) {
            console.error(`Failed to render default preview for ${skin.name}:`, err);
            errorsMap[skin.url] = true;
          }
        } else if (defaultSkinsB64[skin.url] === undefined && defaultSkinErrors[skin.url]) {
          errorsMap[skin.url] = true;
        }
      }
      if (active) {
        setDefaultSkins3D(previews);
        if (Object.keys(errorsMap).length > 0) {
          setDefaultSkinErrors(prev => {
            const hasNewError = Object.keys(errorsMap).some(key => !prev[key]);
            if (hasNewError) {
              return { ...prev, ...errorsMap };
            }
            return prev;
          });
        }
      }
    };
    renderDefaultPreviews();
    return () => {
      active = false;
    };
  }, [defaultSkinsB64]);

  useEffect(() => {
    fetchProfileData();
    // 切換帳號時重新讀取
  }, [selectedAccountId]);

  // 初始化 skinview3d
  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current.parentElement;
    if (!container) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: container.clientWidth || 320,
      height: container.clientHeight || 380
    });

    viewer.controls.enableZoom = true;
    viewer.controls.enableRotate = true;
    viewer.controls.enablePan = false;

    // 設定適當的視角與相機距離 (中心點設定在 y=10 胸腔位置，z=50 全身最佳視野)
    viewer.camera.position.set(0, 2.5, 50);
    viewer.controls.target.set(0, 2.5, 0);
    viewer.controls.update();

    viewerRef.current = viewer;

    // 使用 ResizeObserver 動態監聽並同步 Canvas 的解析度尺寸，防止拉伸與像素切割
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          viewer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 載入預設本機 Steve 皮膚作為初始佔位符
    viewer.loadSkin('/Steve.png');

    // 載入預設灰色鞘翅貼圖以防 CORS，存入 State 快取
    invoke<string>('get_image_base64', {
      url: "https://textures.minecraft.net/texture/c52865c3b17d0c345f8f8b809a7b975e5be2ad7f742217cde6c57f9ed5ad5"
    })
      .then(b64 => {
        setDefaultElytraB64(b64);
      })
      .catch(err => {
        console.error("Failed to load default elytra:", err);
      });

    return () => {
      resizeObserver.disconnect();
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  // 當皮膚有更新時重新載入 3D 模型
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (skinBase64) {
      viewer.loadSkin(skinBase64, {
        model: skinVariant === 'SLIM' ? 'slim' : 'default'
      });
    } else {
      viewer.loadSkin('/Steve.png', {
        model: 'default'
      });
    }
  }, [skinBase64, skinVariant]);

  // 動態套用披風與鞘翅預覽
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // 披風載入邏輯順序：
    // 1. 使用者在清單中點擊選取的披風 (Selected)
    // 2. 帳號當前正在穿戴的活躍披風 (Active)
    let targetCapeId: string | null = null;

    if (selectedCapeId) {
      targetCapeId = selectedCapeId;
    } else if (profile) {
      const activeCape = profile.capes?.find(c => c.state === 'ACTIVE');
      targetCapeId = activeCape ? activeCape.id : null;
    }

    let sourceToLoad: string | null = null;
    let equipmentType: 'cape' | 'elytra' = showElytra ? 'elytra' : 'cape';

    if (targetCapeId && capeBase64Map[targetCapeId]) {
      sourceToLoad = capeBase64Map[targetCapeId];
    } else if (showElytra && defaultElytraB64) {
      sourceToLoad = defaultElytraB64;
      equipmentType = 'elytra';
    }

    const loadId = ++latestLoadIdRef.current;

    if (sourceToLoad) {
      const img = new Image();
      img.src = sourceToLoad;
      img.onload = () => {
        if (latestLoadIdRef.current === loadId && viewerRef.current) {
          viewerRef.current.loadCape(img, { backEquipment: equipmentType });
        }
      };
      img.onerror = (err) => {
        console.error("Failed to load cape/elytra image:", err);
      };
    } else {
      viewer.loadCape(null);
    }
  }, [selectedCapeId, profile, capeBase64Map, showElytra, defaultElytraB64]);

  // 當 2D 披風貼圖載入或「顯示鞘翅」切換時，非同步生成 3D 靜態縮圖
  useEffect(() => {
    let active = true;

    const generatePreviews = async () => {
      const capesInProfile = profile?.capes || [];
      if (capesInProfile.length === 0) return;

      const newPreviews: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};

      for (const cape of capesInProfile) {
        if (!active) return;
        const id = cape.id;
        const cacheKey = `${id}_${showElytra ? 'elytra' : 'cape'}`;

        if (cape3DPreviewMap[cacheKey]) {
          newPreviews[cacheKey] = cape3DPreviewMap[cacheKey];
          continue;
        }

        const b64 = capeBase64Map[id];
        if (!b64) {
          if (capeLoadErrors[id]) {
            errorsMap[cacheKey] = true;
          }
          continue;
        }

        try {
          const renderedB64 = await renderCape3D(b64, showElytra);
          if (renderedB64) {
            newPreviews[cacheKey] = renderedB64;
          } else {
            errorsMap[cacheKey] = true;
          }
        } catch (err) {
          console.error("Failed to render 3D preview for cape:", id, err);
          errorsMap[cacheKey] = true;
        }
      }

      if (active) {
        setCape3DPreviewMap(prev => ({
          ...prev,
          ...newPreviews
        }));
        if (Object.keys(errorsMap).length > 0) {
          setCapeLoadErrors(prev => {
            const hasNewError = Object.keys(errorsMap).some(key => !prev[key]);
            if (hasNewError) {
              return { ...prev, ...errorsMap };
            }
            return prev;
          });
        }
      }
    };

    generatePreviews();

    return () => {
      active = false;
    };
  }, [capeBase64Map, showElytra, profile]);

  // 動態更新動畫與旋轉
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.animation = null;
    viewer.autoRotate = autoRotate;
    viewer.autoRotateSpeed = 0.6;

    if (animationType === 'idle') {
      viewer.animation = new IdleAnimation();
    } else if (animationType === 'walk') {
      const walkAnim = new WalkingAnimation();
      walkAnim.speed = 0.65; // 走路速度調慢為 0.65
      viewer.animation = walkAnim;
    }
  }, [animationType, autoRotate]);

  // 重設相機視角
  const resetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.position.set(0, 2.5, 50);
    viewer.controls.target.set(0, 2.5, 0);
    viewer.controls.update();
  };

  // 複製文字至剪貼簿
  const handleCopyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addNotification({
        type: 'success',
        title: '複製成功',
        message: `已複製 ${label} 至剪貼簿：${text}`
      });
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '複製失敗',
        message: '無法存取剪貼簿'
      });
    }
  };

  // 更換皮膚：選擇檔案
  const handleSelectSkinFile = async () => {
    try {
      const path = await invoke<string>('select_single_file', {
        title: "選擇 Minecraft 皮膚檔案 (*.png)",
        filter: "PNG 圖片 (*.png)|*.png"
      });
      if (path === 'CANCELLED') return;
      setSelectedFilePath(path);
    } catch (err) {
      addNotification({
        type: 'error',
        title: '選擇檔案失敗',
        message: String(err)
      });
    }
  };

  // 更換皮膚：執行上傳
  const handleUploadSkin = async () => {
    if (!activeAccount || !selectedFilePath) return;

    setIsUploading(true);
    try {
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) currentToken = refreshed.mcAccessToken;
      }

      await invoke('upload_minecraft_skin', {
        mcAccessToken: currentToken,
        variant: selectedVariant,
        filePath: selectedFilePath
      });

      // 自動儲存至皮膚櫃
      try {
        await invoke('save_skin_to_wardrobe', {
          filePath: selectedFilePath,
          variant: selectedVariant
        });
      } catch (backupErr) {
        console.error("Failed to backup skin to wardrobe:", backupErr);
      }

      addNotification({
        type: 'success',
        title: '更換皮膚成功',
        message: '您的 Minecraft 角色皮膚已更新，且已自動備份至皮膚櫃。'
      });

      setSelectedFilePath('');
      // 重新讀取 Profile 以更新 3D 預覽
      await fetchProfileData();
      // 重新讀取皮膚櫃
      await fetchWardrobeSkins();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '更換皮膚失敗',
        message: String(err)
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 披風：啟用 / 停用
  const handleToggleCape = async (cape: MojangCape) => {
    if (!activeAccount || isUpdatingCape) return;

    setIsUpdatingCape(true);
    const isActive = cape.state === 'ACTIVE';

    try {
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) currentToken = refreshed.mcAccessToken;
      }

      if (isActive) {
        // 停用披風
        await invoke('deactivate_cape', { mcAccessToken: currentToken });
        addNotification({
          type: 'success',
          title: '卸下披風成功',
          message: '已成功卸下目前穿戴的披風。'
        });
      } else {
        // 啟用披風
        await invoke('set_active_cape', {
          mcAccessToken: currentToken,
          capeId: cape.id
        });
        addNotification({
          type: 'success',
          title: '穿戴披風成功',
          message: `已成功套用 "${cape.alias}" 披風！`
        });
      }

      // 重新整理資訊
      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: '操作披風失敗',
        message: String(err)
      });
    } finally {
      setIsUpdatingCape(false);
    }
  };

  // 錯誤狀態
  if (errorMsg) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} style={{ color: '#ff4d4d' }} />
        <span className={styles.errorTitle}>無法顯示資訊</span>
        <span className={styles.errorMessage}>請確認您的網路連線或重試。</span>
        <button className={styles.retryButton} onClick={fetchProfileData}>
          重新整理
        </button>
      </div>
    );
  }

  const activeCape = profile?.capes?.find(c => c.state === 'ACTIVE');

  return (
    <div className={styles.container}>
      {/* ── 左側：3D 預覽區 ── */}
      <div className={styles.previewPanel}>
        <div className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.canvas} />
          {selectedCapeId && (
            <div className={styles.previewBadge}>
              披風預覽中
            </div>
          )}
        </div>

        <div className={styles.previewControls}>
          <div className={styles.controlRow}>
            <div
              className={styles.switchContainer}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              <div className={`${styles.switchTrack} ${autoRotate ? styles.switchTrackActive : ''}`}>
                <div className={`${styles.switchThumb} ${autoRotate ? styles.switchThumbActive : ''}`} />
              </div>
              <span className={styles.switchLabel}>自動旋轉</span>
            </div>

            <div
              className={styles.switchContainer}
              onClick={() => setShowElytra(!showElytra)}
            >
              <div className={`${styles.switchTrack} ${showElytra ? styles.switchTrackActive : ''}`}>
                <div className={`${styles.switchThumb} ${showElytra ? styles.switchThumbActive : ''}`} />
              </div>
              <span className={styles.switchLabel}>顯示鞘翅</span>
            </div>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>動作模型</span>
            <div className={styles.btnGroup}>
              <button
                className={`${styles.controlBtn} ${animationType === 'none' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('none')}
              >
                靜止
              </button>
              <button
                className={`${styles.controlBtn} ${animationType === 'idle' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('idle')}
              >
                呼吸
              </button>
              <button
                className={`${styles.controlBtn} ${animationType === 'walk' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('walk')}
              >
                走路
              </button>
            </div>
          </div>

          <button className={styles.resetBtn} onClick={resetCamera}>
            重設視角
          </button>
        </div>
      </div>

      {/* ── 右側：資訊及管理面板 ── */}
      <div className={styles.contentPanel}>
        {/* 玩家帳號卡片 */}
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            {activeAccount?.avatarUrl && !avatarError ? (
              <img 
                src={activeAccount.avatarUrl} 
                alt="Avatar" 
                onError={() => setAvatarError(true)} 
              />
            ) : (
              <img src="/Offline_Avatar.png" alt="Avatar" />
            )}
          </div>
          <div className={styles.profileInfo}>
            {profile ? (
              <div
                className={styles.copyWrapper}
                onClick={() => handleCopyText(profile.name, '玩家名稱')}
                title="點擊複製玩家名稱"
              >
                <span className={styles.profileName}>{profile.name}</span>
                <Copy className={styles.copyIcon} size={14} />
              </div>
            ) : (
              <span className={styles.profileName}>
                {isLoading ? '正在載入...' : activeAccount?.mcId}
              </span>
            )}

            {profile ? (
              <div
                className={styles.copyWrapper}
                onClick={() => handleCopyText(profile.id, 'UUID')}
                title="點擊複製 UUID"
              >
                <span className={styles.profileUuid}>{profile.id}</span>
                <Copy className={styles.copyIcon} size={12} />
              </div>
            ) : (
              <span className={styles.profileUuid}>
                {isLoading ? '正在取得 UUID...' : ''}
              </span>
            )}
          </div>
        </div>

        {/* 載入中狀態 */}
        {isLoading && !profile ? (
          <div className={styles.loadingContainer} style={{ minHeight: '200px' }}>
            <Loader2 className={styles.spin} size={32} />
            <span>正在取得 Mojang 伺服器同步資料...</span>
          </div>
        ) : !profile ? (
          <div className={styles.emptyMessage}>
            無帳號資訊，請確認網路連線。
          </div>
        ) : (
          <>
            {/* 皮膚管理分頁 */}
            {activeDetailTab === 'skins' && (
              <>
                <div className={styles.sectionCard}>
                  <span className={styles.sectionTitle}>上傳新皮膚 (PNG 格式)</span>

                  {!selectedFilePath ? (
                    <div
                      className={`${styles.uploadArea} ${isDragActive ? styles.uploadAreaDragActive : ''}`}
                      onClick={handleSelectSkinFile}
                    >
                      <Upload className={styles.uploadIcon} size={28} />
                      <span className={styles.uploadText}>
                        {isDragActive ? '放開滑鼠以選擇檔案' : '點選選擇或拖放皮膚 PNG 檔案'}
                      </span>
                      <span className={styles.uploadSubtext}>支援標準 64x64 或 64x32 像素皮膚圖片</span>
                    </div>
                  ) : (
                    <div className={styles.selectedFileCard}>
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>
                          {selectedFilePath.split(/[\\/]/).pop()}
                        </span>
                        <span className={styles.filePath}>{selectedFilePath}</span>
                      </div>
                      <button
                        className={styles.clearFileBtn}
                        onClick={() => setSelectedFilePath('')}
                        title="清除選取"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <div className={styles.variantSelector}>
                    <span className={styles.variantTitle}>選擇皮膚剪裁模型</span>
                    <div className={styles.variantOptions}>
                      <div
                        className={`${styles.variantOption} ${selectedVariant === 'CLASSIC' ? styles.variantOptionActive : ''}`}
                        onClick={() => setSelectedVariant('CLASSIC')}
                      >
                        <span className={styles.variantName}>經典 (Classic)</span>
                        <span className={styles.variantDesc}>適用 4 像素寬度的標準雙臂模型 (Steve)</span>
                      </div>
                      <div
                        className={`${styles.variantOption} ${selectedVariant === 'SLIM' ? styles.variantOptionActive : ''}`}
                        onClick={() => setSelectedVariant('SLIM')}
                      >
                        <span className={styles.variantName}>纖細 (Slim)</span>
                        <span className={styles.variantDesc}>適用 3 像素寬度的細手臂模型 (Alex)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className={styles.submitButton}
                    onClick={handleUploadSkin}
                    disabled={!selectedFilePath || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className={styles.spin} size={16} />
                        <span>正在上傳更換...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>確認上傳更換皮膚</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* 皮膚櫃管理分頁 */}
            {activeDetailTab === 'skin_wardrobe' && (
              <>
                <div className={styles.sectionCard} style={{ marginBottom: '1.25rem' }}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>官方預設外觀</span>
                  </div>
                  <div className={styles.capeGrid}>
                    {DEFAULT_SKINS.map((skin) => {
                      const isApplying = isApplyingDefaultSkin === skin.url;
                      const preview3d = defaultSkins3D[skin.url];

                      return (
                        <div
                          key={skin.url}
                          className={styles.capeCard}
                          title={`外觀名稱: ${skin.name}`}
                        >
                          <div className={styles.capeTextureContainer}>
                            {preview3d ? (
                              <img
                                src={preview3d}
                                alt={skin.name}
                                className={styles.capeImage}
                              />
                            ) : defaultSkinErrors[skin.url] ? (
                              <div className={styles.fallbackIconContainer}>
                                <WifiOff className={styles.fallbackIcon} size={24} />
                              </div>
                            ) : (
                              <Loader2 className={styles.spin} size={24} />
                            )}
                          </div>

                          <div className={styles.capeMeta}>
                            <span className={styles.capeName}>{skin.name}</span>
                            <span className={styles.variantTag}>
                              {skin.variant === 'SLIM' ? '細手臂 (Slim)' : '標準 (Classic)'}
                            </span>
                          </div>

                          <div className={styles.wardrobeBtns}>
                            <button
                              className={`${styles.capeBtn} ${styles.equipBtn}`}
                              onClick={() => handleApplyDefaultSkin(skin.url, skin.variant)}
                              disabled={isApplying || isApplyingDefaultSkin !== null}
                            >
                              {isApplying ? (
                                <Loader2 className={styles.spin} size={14} />
                              ) : (
                                <>
                                  <Shirt size={14} />
                                  <span>套用</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>個人皮膚櫃 (快速切換)</span>
                    <span className={styles.statusLabel} style={{ color: 'var(--text-secondary)' }}>
                      儲存數量：<strong>{wardrobeSkins.length}</strong>
                    </span>
                  </div>

                  {wardrobeSkins.length === 0 ? (
                    <div className={styles.emptyMessage}>
                      目前您的皮膚櫃中沒有任何記錄。上傳新皮膚時會自動備份至此。
                    </div>
                  ) : (
                    <div className={styles.capeGrid}>
                      {wardrobeSkins.map((skin) => {
                        const isApplying = isApplyingSkinId === skin.file_path;
                        const isConfirmingDelete = confirmDeletePath === skin.file_path;

                        return (
                          <div
                            key={skin.file_path}
                            className={styles.capeCard}
                            title={`皮膚名稱: ${skin.name}`}
                          >
                            <div className={styles.capeTextureContainer}>
                              {wardrobe3DMap[skin.file_path] ? (
                                <img
                                  src={wardrobe3DMap[skin.file_path]}
                                  alt={skin.name}
                                  className={styles.capeImage}
                                />
                              ) : wardrobeErrors[skin.file_path] ? (
                                <div className={styles.fallbackIconContainer}>
                                  <AlertTriangle className={styles.fallbackIcon} size={24} />
                                </div>
                              ) : (
                                <Loader2 className={styles.spin} size={24} />
                              )}
                            </div>

                            <div className={styles.capeMeta}>
                              <span className={styles.capeName}>{skin.name}</span>
                              <span className={styles.variantTag}>
                                {skin.variant === 'SLIM' ? '細手臂 (Slim)' : '標準 (Classic)'}
                              </span>
                            </div>

                            {isConfirmingDelete ? (
                              <div className={styles.confirmDeleteGroup}>
                                <span className={styles.confirmDeleteText}>確定刪除？</span>
                                <div className={styles.confirmDeleteBtns}>
                                  <button
                                    className={styles.confirmDeleteBtnYes}
                                    onClick={() => handleDeleteWardrobeSkin(skin.file_path)}
                                  >
                                    確認
                                  </button>
                                  <button
                                    className={styles.confirmDeleteBtnNo}
                                    onClick={() => setConfirmDeletePath(null)}
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.wardrobeBtns}>
                                <button
                                  className={`${styles.capeBtn} ${styles.equipBtn}`}
                                  onClick={() => handleApplyWardrobeSkin(skin)}
                                  disabled={isApplying}
                                >
                                  {isApplying ? (
                                    <Loader2 className={styles.spin} size={14} />
                                  ) : (
                                    <>
                                      <Shirt size={14} />
                                      <span>套用</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  className={`${styles.capeBtn} ${styles.unequipBtn}`}
                                  style={{ marginTop: '0.375rem' }}
                                  onClick={() => setConfirmDeletePath(skin.file_path)}
                                  disabled={isApplying}
                                >
                                  <Trash2 size={14} />
                                  <span>刪除</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 披風管理分頁 */}
            {activeDetailTab === 'capes' && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>擁有的披風列表</span>
                  {activeCape && (
                    <span className={styles.statusLabel} style={{ color: 'var(--text-secondary)' }}>
                      目前穿戴：<strong>{activeCape.alias}</strong>
                    </span>
                  )}
                </div>

                {!profile.capes || profile.capes.length === 0 ? (
                  <div className={styles.emptyMessage}>
                    目前您的帳號中沒有擁有的 Minecraft 官方披風。
                  </div>
                ) : (
                  <div className={styles.capeGrid}>
                    {profile.capes.map((cape) => {
                      const isCapeActive = cape.state === 'ACTIVE';
                      const isSelected = selectedCapeId === cape.id && !isCapeActive;

                      return (
                        <div
                          key={cape.id}
                          className={`${styles.capeCard} ${isSelected ? styles.capeCardPreviewActive : ''} ${isCapeActive ? styles.capeCardActive : ''}`}
                          onClick={() => {
                            if (isCapeActive) return;
                            setSelectedCapeId(isSelected ? null : cape.id);
                          }}
                          title={isCapeActive ? "目前穿戴中" : "點擊可在左側角色 3D 模型上預覽此披風"}
                        >
                          {/* 預覽與穿戴提示：置於左上角 */}
                          {isCapeActive ? (
                            <div className={styles.activeBadge}>
                              穿戴中
                            </div>
                          ) : (
                            isSelected && (
                              <div className={styles.cardPreviewBadge}>
                                預覽中
                              </div>
                            )
                          )}

                          <div className={styles.capeTextureContainer}>
                            {cape3DPreviewMap[`${cape.id}_${showElytra ? 'elytra' : 'cape'}`] ? (
                              <img
                                src={cape3DPreviewMap[`${cape.id}_${showElytra ? 'elytra' : 'cape'}`]}
                                alt={cape.alias}
                                className={styles.capeImage}
                              />
                            ) : (capeLoadErrors[`${cape.id}_${showElytra ? 'elytra' : 'cape'}`] || capeLoadErrors[cape.id]) ? (
                              <div className={styles.fallbackIconContainer}>
                                <WifiOff className={styles.fallbackIcon} size={24} />
                              </div>
                            ) : (
                              <Loader2 className={styles.spin} size={24} />
                            )}
                          </div>

                          <div className={styles.capeMeta}>
                            <span className={styles.capeName}>{cape.alias}</span>
                          </div>

                          <button
                            className={`${styles.capeBtn} ${isCapeActive ? styles.unequipBtn : styles.equipBtn}`}
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止觸發卡片點擊預覽
                              handleToggleCape(cape);
                            }}
                            disabled={isUpdatingCape}
                          >
                            {isUpdatingCape ? (
                              <Loader2 className={styles.spin} size={14} />
                            ) : isCapeActive ? (
                              <>
                                <X size={14} />
                                <span>卸下</span>
                              </>
                            ) : (
                              <>
                                <Shirt size={14} />
                                <span>穿戴</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
