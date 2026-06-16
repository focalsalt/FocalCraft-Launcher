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
import { useI18n } from '../../utils/i18n';
import styles from './AccountInfoView.module.css';


// 官方預設外觀
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

// 渲染 3D 披風與鞘翅靜態圖
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

    // 設定 3D 相機與視角
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

      // 獲取 Data URL
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

// 渲染 3D 皮膚靜態圖
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

    // 設定 3D 相機與視角
    viewer.playerObject.rotation.y = -0.785;
    viewer.camera.position.set(0, 17.8, 38.0);
    viewer.controls.target.set(0, 2, 0);
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

// 檢測皮膚模型變體
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
        // 檢測右手臂像素
        for (let y = 20; y < 32; y++) {
          if (getAlpha(55, y) > 0) {
            isSlim = false;
            break;
          }
        }
        // 檢測左手臂像素
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
  const { t } = useI18n();

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  const [profile, setProfile] = useState<MojangProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Base64 快取
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

  // 預設外觀狀態
  const [defaultSkinsB64, setDefaultSkinsB64] = useState<Record<string, string>>({});
  const [defaultSkins3D, setDefaultSkins3D] = useState<Record<string, string>>({});
  const [isApplyingDefaultSkin, setIsApplyingDefaultSkin] = useState<string | null>(null);

  // 錯誤狀態追蹤
  const [avatarError, setAvatarError] = useState(false);
  const [capeLoadErrors, setCapeLoadErrors] = useState<Record<string, boolean>>({});
  const [defaultSkinErrors, setDefaultSkinErrors] = useState<Record<string, boolean>>({});
  const [wardrobeErrors, setWardrobeErrors] = useState<Record<string, boolean>>({});

  // 3D 控制狀態
  const [animationType, setAnimationType] = useState<'none' | 'idle' | 'walk'>('idle');
  const [autoRotate, setAutoRotate] = useState(false);

  // 上傳皮膚狀態
  const [selectedVariant, setSelectedVariant] = useState<'CLASSIC' | 'SLIM'>('CLASSIC');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // 披風預覽狀態
  const [isUpdatingCape, setIsUpdatingCape] = useState(false);
  const [selectedCapeId, setSelectedCapeId] = useState<string | null>(null);
  const [showElytra, setShowElytra] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const latestLoadIdRef = useRef<number>(0);

  // 獲取 Mojang 設定與貼圖
  const fetchProfileData = async () => {
    if (!activeAccount) {
      setErrorMsg(t('account.err.login_first'));
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
      // 刷新 Token
      let currentToken = activeAccount.mcAccessToken;
      if (activeAccount.tokenExpiresAt < Date.now()) {
        const refreshed = await refreshAccountToken(activeAccount.id);
        if (refreshed) {
          currentToken = refreshed.mcAccessToken;
        } else {
          throw new Error(t('account.err.session_expired'));
        }
      }

      // 取得 Profile 資訊
      const profileData = await invoke<MojangProfile>('get_minecraft_profile', {
        mcAccessToken: currentToken
      });
      setProfile(profileData);

      // 下載目前皮膚
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
        // 無皮膚時載入 Steve
        setSkinBase64('/Steve.png');
        setSkinVariant('CLASSIC');
      }

      // 下載所有披風
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

      // 格式化皮膚櫃資料
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

  // 套用皮膚櫃皮膚
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
        title: t('account.notification.skin_used.title'),
        message: t('account.notification.skin_used.msg', { name: skin.name })
      });

      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('account.notification.skin_use_failed.title'),
        message: String(err)
      });
    } finally {
      setIsApplyingSkinId(null);
    }
  };

  // 套用官方預設外觀
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
        title: t('account.notification.skin_used.title'),
        message: t('account.notification.skin_used.msg', { name: 'Default' })
      });

      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('account.notification.skin_use_failed.title'),
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
        title: t('account.notification.skin_deleted.title'),
        message: t('account.notification.skin_deleted.msg', { name: '' })
      });
      await fetchWardrobeSkins();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('account.notification.skin_delete_failed.title'),
        message: String(err)
      });
    } finally {
      setConfirmDeletePath(null);
    }
  };

  // 分頁切換加載皮膚櫃
  useEffect(() => {
    if (activeDetailTab === 'skin_wardrobe') {
      fetchWardrobeSkins();
    }
  }, [activeDetailTab]);

  // 監聽拖放上傳
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWebview().onDragDropEvent((event) => {
      // 僅在皮膚分頁處理
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
              title: t('account.notification.skin_import_invalid.title'),
              message: t('account.notification.skin_import_invalid.msg')
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

  // 生成皮膚櫃 3D 縮圖
  useEffect(() => {
    let active = true;

    const generatePreviews = async () => {
      if (wardrobeSkins.length === 0) return;

      const newPreviews: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};

      for (const skin of wardrobeSkins) {
        if (!active) return;

        // 暫存快取
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

  // 讀取預設皮膚 Base64
  useEffect(() => {
    let active = true;
    const loadDefaultSkins = async () => {
      const b64Map: Record<string, string> = {};
      const errorsMap: Record<string, boolean> = {};
      for (const skin of DEFAULT_SKINS) {
        if (!active) return;
        try {
          // 離線自本機讀取
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

  // 渲染預設外觀 3D 人偶
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
    // 切換帳號時重新整理
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

    // 設定相機視角
    viewer.camera.position.set(0, 2.5, 50);
    viewer.controls.target.set(0, 2.5, 0);
    viewer.controls.update();

    viewerRef.current = viewer;

    // 監聽 Canvas 尺寸調整大小
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          viewer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 載入 Steve 佔位符
    viewer.loadSkin('/Steve.png');

    // 載入鞘翅貼圖
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

  // 更新 3D 皮膚模型
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

  // 生成 3D 披風縮圖
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

  // 更新 3D 動畫與旋轉
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
      walkAnim.speed = 0.65;
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

  // 複製至剪貼簿
  const handleCopyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addNotification({
        type: 'success',
        title: t('tabs.log.notification.copied.title'),
        message: t('account.notification.copied_to_clipboard', { label, text })
      });
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('detail.notification.copy_failed'),
        message: t('account.err.clipboard_access')
      });
    }
  };

  // 選擇皮膚檔案
  const handleSelectSkinFile = async () => {
    try {
      const path = await invoke<string>('select_single_file', {
        title: t('account.select.skin_title'),
        filter: t('account.select.skin_filter')
      });
      if (path === 'CANCELLED') return;
      setSelectedFilePath(path);
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('create.notification.select_file_failed'),
        message: String(err)
      });
    }
  };

  // 上傳皮膚
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

      // 儲存至皮膚櫃
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
        title: t('account.notification.skin_used.title'),
        message: t('account.notification.skin_updated_backup')
      });

      setSelectedFilePath('');
      // 重新載入資料
      await fetchProfileData();
      // 重新讀取皮膚櫃
      await fetchWardrobeSkins();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('account.notification.skin_use_failed.title'),
        message: String(err)
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 啟用或停用披風
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
          title: t('account.notification.cape_deactivated'),
          message: t('account.notification.cape_deactivated')
        });
      } else {
        // 啟用披風
        await invoke('set_active_cape', {
          mcAccessToken: currentToken,
          capeId: cape.id
        });
        addNotification({
          type: 'success',
          title: t('account.notification.cape_activated', { name: cape.alias }),
          message: t('account.notification.cape_activated', { name: cape.alias })
        });
      }

      // 重新整理資訊
      await fetchProfileData();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('account.notification.skin_use_failed.title'),
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
        <span className={styles.errorTitle}>{t('account.error.cannot_display')}</span>
        <span className={styles.errorMessage}>{t('account.error.network_retry')}</span>
        <button className={styles.retryButton} onClick={fetchProfileData}>
          {t('account.btn.retry')}
        </button>
      </div>
    );
  }

  const activeCape = profile?.capes?.find(c => c.state === 'ACTIVE');

  return (
    <div className={styles.container}>
      {/* 左側：3D 預覽區 */}
      <div className={styles.previewPanel}>
        <div className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.canvas} />
          {selectedCapeId && (
            <div className={styles.previewBadge}>
              {t('account.preview.cape_previewing')}
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
              <span className={styles.switchLabel}>{t('account.preview.auto_rotate')}</span>
            </div>

            <div
              className={styles.switchContainer}
              onClick={() => setShowElytra(!showElytra)}
            >
              <div className={`${styles.switchTrack} ${showElytra ? styles.switchTrackActive : ''}`}>
                <div className={`${styles.switchThumb} ${showElytra ? styles.switchThumbActive : ''}`} />
              </div>
              <span className={styles.switchLabel}>{t('account.preview.show_elytra')}</span>
            </div>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>{t('account.preview.model_animation')}</span>
            <div className={styles.btnGroup}>
              <button
                className={`${styles.controlBtn} ${animationType === 'none' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('none')}
              >
                {t('account.preview.anim.none')}
              </button>
              <button
                className={`${styles.controlBtn} ${animationType === 'idle' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('idle')}
              >
                {t('account.preview.anim.idle')}
              </button>
              <button
                className={`${styles.controlBtn} ${animationType === 'walk' ? styles.controlBtnActive : ''}`}
                onClick={() => setAnimationType('walk')}
              >
                {t('account.preview.anim.walk')}
              </button>
            </div>
          </div>

          <button className={styles.resetBtn} onClick={resetCamera}>
            {t('account.preview.reset_camera')}
          </button>
        </div>
      </div>

      {/* 右側：資訊管理 */}
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
                onClick={() => handleCopyText(profile.name, t('account.label.player_name'))}
                title={t('account.tooltip.copy_name')}
              >
                <span className={styles.profileName}>{profile.name}</span>
                <Copy className={styles.copyIcon} size={14} />
              </div>
            ) : (
              <span className={styles.profileName}>
                {isLoading ? t('account.status.loading') : activeAccount?.mcId}
              </span>
            )}

            {profile ? (
              <div
                className={styles.copyWrapper}
                onClick={() => handleCopyText(profile.id, 'UUID')}
                title={t('account.tooltip.copy_uuid')}
              >
                <span className={styles.profileUuid}>{profile.id}</span>
                <Copy className={styles.copyIcon} size={12} />
              </div>
            ) : (
              <span className={styles.profileUuid}>
                {isLoading ? t('account.status.loading_uuid') : ''}
              </span>
            )}
          </div>
        </div>

        {/* 載入中狀態 */}
        {isLoading && !profile ? (
          <div className={styles.loadingContainer} style={{ minHeight: '200px' }}>
            <Loader2 className={`${styles.spin} animate-spin`} size={32} />
            <span>{t('account.status.syncing_mojang')}</span>
          </div>
        ) : !profile ? (
          <div className={styles.emptyMessage}>
            {t('account.status.no_account_info')}
          </div>
        ) : (
          <>
            {/* 皮膚管理分頁 */}
            {activeDetailTab === 'skins' && (
              <>
                <div className={styles.sectionCard}>
                  <span className={styles.sectionTitle}>{t('account.skins.upload_title')}</span>

                  {!selectedFilePath ? (
                    <div
                      className={`${styles.uploadArea} ${isDragActive ? styles.uploadAreaDragActive : ''}`}
                      onClick={handleSelectSkinFile}
                    >
                      <Upload className={styles.uploadIcon} size={28} />
                      <span className={styles.uploadText}>
                        {isDragActive ? t('account.skins.drag_active') : t('account.skins.drag_placeholder')}
                      </span>
                      <span className={styles.uploadSubtext}>{t('account.skins.dimensions_help')}</span>
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
                        title={t('account.skins.clear_selection')}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <div className={styles.variantSelector}>
                    <span className={styles.variantTitle}>{t('account.skins.select_model')}</span>
                    <div className={styles.variantOptions}>
                      <div
                        className={`${styles.variantOption} ${selectedVariant === 'CLASSIC' ? styles.variantOptionActive : ''}`}
                        onClick={() => setSelectedVariant('CLASSIC')}
                      >
                        <span className={styles.variantName}>{t('account.skins.model.classic')}</span>
                        <span className={styles.variantDesc}>{t('account.skins.model.classic_desc')}</span>
                      </div>
                      <div
                        className={`${styles.variantOption} ${selectedVariant === 'SLIM' ? styles.variantOptionActive : ''}`}
                        onClick={() => setSelectedVariant('SLIM')}
                      >
                        <span className={styles.variantName}>{t('account.skins.model.slim')}</span>
                        <span className={styles.variantDesc}>{t('account.skins.model.slim_desc')}</span>
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
                        <Loader2 className={`${styles.spin} animate-spin`} size={16} />
                        <span>{t('account.skins.status.uploading')}</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>{t('account.skins.btn.confirm_upload')}</span>
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
                    <span className={styles.sectionTitle}>{t('account.skins.default_skins_title')}</span>
                  </div>
                  <div className={styles.capeGrid}>
                    {DEFAULT_SKINS.map((skin) => {
                      const isApplying = isApplyingDefaultSkin === skin.url;
                      const preview3d = defaultSkins3D[skin.url];

                      return (
                        <div
                          key={skin.url}
                          className={styles.capeCard}
                          title={`${t('account.skins.default_skins_title')}: ${skin.name}`}
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
                              <Loader2 className={`${styles.spin} animate-spin`} size={24} />
                            )}
                          </div>

                          <div className={styles.capeMeta}>
                            <span className={styles.capeName}>{skin.name}</span>
                            <span className={styles.variantTag}>
                              {skin.variant === 'SLIM' ? t('account.skins.model.tag_slim') : t('account.skins.model.tag_classic')}
                            </span>
                          </div>

                          <div className={styles.wardrobeBtns}>
                            <button
                              className={`${styles.capeBtn} ${styles.equipBtn}`}
                              onClick={() => handleApplyDefaultSkin(skin.url, skin.variant)}
                              disabled={isApplying || isApplyingDefaultSkin !== null}
                            >
                              {isApplying ? (
                                <Loader2 className={`${styles.spin} animate-spin`} size={14} />
                              ) : (
                                <>
                                  <Shirt size={14} />
                                  <span>{t('account.skins.btn.apply')}</span>
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
                    <span className={styles.sectionTitle}>{t('account.wardrobe.title')}</span>
                    <span className={styles.statusLabel} style={{ color: 'var(--text-secondary)' }}>
                      {t('account.wardrobe.count_label')}<strong>{wardrobeSkins.length}</strong>
                    </span>
                  </div>

                  {wardrobeSkins.length === 0 ? (
                    <div className={styles.emptyMessage}>
                      {t('account.wardrobe.empty')}
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
                            title={`${t('account.wardrobe.title')}: ${skin.name}`}
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
                                <Loader2 className={`${styles.spin} animate-spin`} size={24} />
                              )}
                            </div>

                            <div className={styles.capeMeta}>
                              <span className={styles.capeName}>{skin.name}</span>
                              <span className={styles.variantTag}>
                                {skin.variant === 'SLIM' ? t('account.skins.model.tag_slim') : t('account.skins.model.tag_classic')}
                              </span>
                            </div>

                            {isConfirmingDelete ? (
                              <div className={styles.confirmDeleteGroup}>
                                <span className={styles.confirmDeleteText}>{t('account.wardrobe.confirm_delete')}</span>
                                <div className={styles.confirmDeleteBtns}>
                                  <button
                                    className={styles.confirmDeleteBtnYes}
                                    onClick={() => handleDeleteWardrobeSkin(skin.file_path)}
                                  >
                                    {t('account.wardrobe.btn.confirm_delete')}
                                  </button>
                                  <button
                                    className={styles.confirmDeleteBtnNo}
                                    onClick={() => setConfirmDeletePath(null)}
                                  >
                                    {t('account.wardrobe.btn.cancel_delete')}
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
                                    <Loader2 className={`${styles.spin} animate-spin`} size={14} />
                                  ) : (
                                    <>
                                      <Shirt size={14} />
                                      <span>{t('account.skins.btn.apply')}</span>
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
                                  <span>{t('account.wardrobe.btn.delete')}</span>
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
                  <span className={styles.sectionTitle}>{t('account.capes.title')}</span>
                  {activeCape && (
                    <span className={styles.statusLabel} style={{ color: 'var(--text-secondary)' }}>
                      {t('account.capes.current_wear')}<strong>{activeCape.alias}</strong>
                    </span>
                  )}
                </div>

                {!profile.capes || profile.capes.length === 0 ? (
                  <div className={styles.emptyMessage}>
                    {t('account.capes.empty')}
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
                          title={isCapeActive ? t('account.capes.status_active') : t('account.capes.click_preview')}
                        >
                          {/* 預覽與穿戴狀態 */}
                          {isCapeActive ? (
                            <div className={styles.activeBadge}>
                              {t('account.capes.badge_wearing')}
                            </div>
                          ) : (
                            isSelected && (
                              <div className={styles.cardPreviewBadge}>
                                {t('account.capes.badge_previewing')}
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
                              <Loader2 className={`${styles.spin} animate-spin`} size={24} />
                            )}
                          </div>

                          <div className={styles.capeMeta}>
                            <span className={styles.capeName}>{cape.alias}</span>
                          </div>

                          <button
                            className={`${styles.capeBtn} ${isCapeActive ? styles.unequipBtn : styles.equipBtn}`}
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止冒泡事件
                              handleToggleCape(cape);
                            }}
                            disabled={isUpdatingCape}
                          >
                            {isUpdatingCape ? (
                              <Loader2 className={`${styles.spin} animate-spin`} size={14} />
                            ) : isCapeActive ? (
                              <>
                                <X size={14} />
                                <span>{t('account.capes.btn.unequip')}</span>
                              </>
                            ) : (
                              <>
                                <Shirt size={14} />
                                <span>{t('account.capes.btn.equip')}</span>
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
