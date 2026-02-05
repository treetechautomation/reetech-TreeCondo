
"use client";

import * as React from "react";
import { getDownloadURL, ref as storageRef, getStorage } from "firebase/storage";
import { getFirebaseApp } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";

type BrandingData = {
  logoUrl: string;
  menuLogoUrl: string;
  faviconUrl: string | null;
  isLoading: boolean;
};

const FALLBACK_LOGO = "/logo-treecondo.jpeg";
const FALLBACK_MENU_LOGO = "/logo-treecondo.jpeg";

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
    // TODO: remove (depuração temporária)
    // Não falha se for "object-not-found", que é esperado.
    if (error.code !== "storage/object-not-found") {
      console.warn(`[BrandingContext] Falha ao buscar ${path}:`, error.code);
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
    logoUrl: FALLBACK_LOGO,
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
      
      const key = condId || "global";
      const cache = condId ? condoCache : new Map([['global', globalCache.current]]);
      let entry = cache.get(key);

      if (!entry || now - entry.ts > TTL_MS) {
        const menuLogoUrl = await safeGet(storage, "branding/global/logo-menu.png") || FALLBACK_MENU_LOGO;
        const globalFavicon = await safeGet(storage, "branding/global/favicon.png");

        let logoUrl = FALLBACK_LOGO;
        let condoFavicon: string | null = null;
        
        if (condId) {
          logoUrl = await safeGet(storage, `branding/${condId}/logo-painel.png`) || menuLogoUrl;
          condoFavicon = await safeGet(storage, `branding/${condId}/favicon.png`);
        }

        entry = {
          ts: now,
          logoUrl,
          menuLogoUrl,
          faviconUrl: condoFavicon || globalFavicon,
        };

        if (condId) {
          condoCache.set(condId, entry);
        } else {
          globalCache.current = entry;
        }
      }

      if (!cancelled) {
        setState({
          logoUrl: entry.logoUrl,
          menuLogoUrl: entry.menuLogoUrl,
          faviconUrl: entry.faviconUrl,
          isLoading: false,
        });
        setFavicon(entry.faviconUrl);
      }
    }

    loadBranding();

    return () => {
      cancelled = true;
    };
  }, [condId]);

  return (
    <BrandingContext.Provider value={state}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): BrandingData {
  const ctx = React.useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding deve ser usado dentro de um BrandingProvider.");
  }
  return ctx;
}
