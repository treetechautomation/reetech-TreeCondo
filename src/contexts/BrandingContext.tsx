"use client";

import * as React from "react";
import { getDownloadURL, ref as storageRef, getStorage } from "firebase/storage";
import { getFirebaseApp } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";

type BrandingData = {
  logoUrl: string; // painel (condomínio)
  menuLogoUrl: string; // menu (TreeCondo)
  faviconUrl: string | null;
  isLoading: boolean;
};

// ✅ Fallback local do menu da TreeCondo (também serve de fallback do painel quando condomínio não tem logo)
const FALLBACK_MENU_LOGO = "/logo.png";
const TTL_MS = 1000 * 60 * 30; // 30 minutos

type CacheEntry = {
  ts: number;
  logoUrl: string;
  menuLogoUrl: string;
  faviconUrl: string | null;
};

const globalCache: { current: CacheEntry | null } = { current: null };
const condoCache = new Map<string, CacheEntry>();

async function safeGet(storage: any, path: string): Promise<string | null> {
  try {
    return await getDownloadURL(storageRef(storage, path));
  } catch (error: any) {
    const code = error?.code;
    if (code !== "storage/object-not-found") {
      console.warn("[BrandingContext] FAIL", { path, code });
    } else if (path.includes("logo-painel") || path.includes("logo-menu")) {
      console.warn("[BrandingContext] NOT_FOUND", { path, code });
    }
    return null;
  }
}

function setFavicon(url?: string | null) {
  if (typeof window === "undefined" || !url) return;
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

const BrandingContext = React.createContext<BrandingData | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSessionCtx();
  const condId = session?.activeCondominioId;

  const [state, setState] = React.useState<BrandingData>({
    // ✅ inicia com TreeCondo no painel e no menu (até carregar)
    logoUrl: FALLBACK_MENU_LOGO,
    menuLogoUrl: FALLBACK_MENU_LOGO,
    faviconUrl: null,
    isLoading: true,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      if (cancelled) return;
      setState((prev) => ({ ...prev, isLoading: true }));

      const storage = getStorage(getFirebaseApp());
      const now = Date.now();

      console.warn("[BrandingContext] activeCondominioId:", condId || "(none)");

      // 1) Cache global (menu TreeCondo)
      let globalEntry = globalCache.current;
      if (!globalEntry || now - globalEntry.ts > TTL_MS) {
        const menuLogoUrl =
          (await safeGet(storage, "branding/global/logo-menu.jpeg")) || FALLBACK_MENU_LOGO;

        const globalFavicon = await safeGet(storage, "branding/global/favicon.jpeg");

        globalEntry = {
          ts: now,
          // ✅ global não define logo do painel; mas a gente usa o menu como fallback do painel também
          logoUrl: menuLogoUrl,
          menuLogoUrl,
          faviconUrl: globalFavicon || null,
        };
        globalCache.current = globalEntry;
      }

      // 2) Cache por condomínio (logo do painel)
      let condoEntry: CacheEntry | null = null;

      if (condId) {
        const cached = condoCache.get(condId);
        if (cached && now - cached.ts <= TTL_MS) {
          condoEntry = cached;
        } else {
          const fetchedLogo = await safeGet(storage, `branding/${condId}/logo-painel.jpeg`);

          // ✅ se condomínio não tiver logo, usa TreeCondo (menuLogo global)
          const logoUrl = fetchedLogo || globalEntry.menuLogoUrl;

          const condoFavicon = await safeGet(storage, `branding/${condId}/favicon.jpeg`);

          condoEntry = {
            ts: now,
            logoUrl,
            menuLogoUrl: globalEntry.menuLogoUrl,
            faviconUrl: condoFavicon || globalEntry.faviconUrl || null,
          };

          condoCache.set(condId, condoEntry);
        }
      }

      const final = condoEntry || globalEntry;

      if (!cancelled) {
        setState({
          // ✅ painel: se tem condId usa final.logoUrl (condo ou fallback TreeCondo)
          // ✅ se não tem condId (sem condo ativo), usa TreeCondo
          logoUrl: final.logoUrl,
          menuLogoUrl: final.menuLogoUrl,
          faviconUrl: final.faviconUrl,
          isLoading: false,
        });

        setFavicon(final.faviconUrl);
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, [condId]);

  return <BrandingContext.Provider value={state}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingData {
  const ctx = React.useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding deve ser usado dentro de um BrandingProvider.");
  return ctx;
}
