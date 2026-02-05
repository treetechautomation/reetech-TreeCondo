"use client";

import * as React from "react";
import { getDownloadURL, ref as storageRef, getStorage } from "firebase/storage";
import { getFirebaseApp } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";

type BrandingData = {
  logoUrl: string;       // painel (condomínio)
  menuLogoUrl: string;   // menu (TreeCondo)
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
    // Debug controlado (temporário). Mantém logs úteis sem poluir.
    const code = error?.code;
    // object-not-found pode acontecer (ex: favicon opcional). Mas para logo-painel isso é importante.
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

      // Debug (temporário): confirma condId ativo
      console.warn("[BrandingContext] activeCondominioId:", condId || "(none)");

      // 1) tenta usar cache global (menu)
      let globalEntry = globalCache.current;
      if (!globalEntry || now - globalEntry.ts > TTL_MS) {
        const menuLogoUrl =
          (await safeGet(storage, "branding/global/logo-menu.jpeg")) || FALLBACK_MENU_LOGO;
        const globalFavicon = await safeGet(storage, "branding/global/favicon.jpeg");

        globalEntry = {
          ts: now,
          logoUrl: FALLBACK_LOGO, // global não define logo do painel
          menuLogoUrl,
          faviconUrl: globalFavicon || null,
        };
        globalCache.current = globalEntry;
      }

      // 2) cache por condomínio (painel)
      let condoEntry: CacheEntry | null = null;
      if (condId) {
        const cached = condoCache.get(condId);
        if (cached && now - cached.ts <= TTL_MS) {
          condoEntry = cached;
        } else {
          const logoUrl =
            (await safeGet(storage, `branding/${condId}/logo-painel.jpeg`)) || FALLBACK_LOGO; // ✅ NÃO cai pro menu
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
          logoUrl: condId ? final.logoUrl : FALLBACK_LOGO,
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
