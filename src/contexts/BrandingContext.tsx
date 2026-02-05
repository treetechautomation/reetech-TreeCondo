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
  source: "cache" | "storage" | "fallback";
};

const FALLBACK_LOGO = "/logo-treecondo.jpeg";
const FALLBACK_MENU_LOGO = "/logo-treecondo.jpeg";

const LS_KEY = (condId: string) => `treecondo_branding_${condId}`;
const TTL_MS = 1000 * 60 * 60 * 24; // Cache de 24 horas

// Cache em memória para a sessão atual
const memCache = new Map<
  string,
  { ts: number; data: Omit<BrandingData, "isLoading" | "source"> }
>();

const BrandingContext = React.createContext<BrandingData>({
  logoUrl: FALLBACK_LOGO,
  menuLogoUrl: FALLBACK_MENU_LOGO,
  faviconUrl: null,
  isLoading: true,
  source: "fallback",
});

function setFavicon(url?: string | null) {
  if (typeof window === "undefined" || !url) return;
  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = url;
  } catch {
    // Ignora erros em ambientes onde o DOM não é totalmente acessível
  }
}

async function safeGetUrl(storage: any, path: string): Promise<string | null> {
  try {
    return await getDownloadURL(storageRef(storage, path));
  } catch (error: any) {
    // Ignora o erro "object-not-found" pois é esperado
    if (error.code !== 'storage/object-not-found') {
      console.warn(`[Branding] Erro ao buscar URL para ${path}:`, error);
    }
    return null;
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;

  const [state, setState] = React.useState<BrandingData>({
    logoUrl: FALLBACK_LOGO,
    menuLogoUrl: FALLBACK_MENU_LOGO,
    faviconUrl: null,
    isLoading: true,
    source: "fallback",
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      if (!condId) {
        setState({
          logoUrl: FALLBACK_LOGO,
          menuLogoUrl: FALLBACK_MENU_LOGO,
          faviconUrl: null,
          isLoading: false,
          source: "fallback",
        });
        setFavicon(null); // Reseta favicon
        return;
      }

      // 1. Tenta o cache de memória (mais rápido)
      const mem = memCache.get(condId);
      if (mem && Date.now() - mem.ts < TTL_MS) {
        if (!cancelled) {
          setState({ ...mem.data, isLoading: false, source: "cache" });
          setFavicon(mem.data.faviconUrl);
        }
        return;
      }

      // 2. Tenta o localStorage (persistente)
      try {
        const raw = window.localStorage.getItem(LS_KEY(condId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.ts && parsed?.data && Date.now() - parsed.ts < TTL_MS) {
            memCache.set(condId, { ts: parsed.ts, data: parsed.data });
            if (!cancelled) {
              setState({ ...parsed.data, isLoading: false, source: "cache" });
              setFavicon(parsed.data.faviconUrl);
            }
            return;
          }
        }
      } catch { /* Ignora falhas de parsing do localStorage */ }

      // 3. Busca no Firebase Storage
      if (!cancelled) setState((s) => ({ ...s, isLoading: true }));

      const app = getFirebaseApp();
      const storage = getStorage(app);
      const base = `condominios/${condId}/branding`;

      const [logo, menuLogo, favicon] = await Promise.all([
        safeGetUrl(storage, `${base}/logo.jpeg`),
        safeGetUrl(storage, `${base}/logotreecondo.png`),
        safeGetUrl(storage, `${base}/favicon.png`),
      ]);

      const dataToCache = {
        logoUrl: logo || FALLBACK_LOGO,
        menuLogoUrl: menuLogo || logo || FALLBACK_MENU_LOGO, // Fallback em cascata
        faviconUrl: favicon || null,
      };

      // Atualiza caches
      memCache.set(condId, { ts: Date.now(), data: dataToCache });
      try {
        window.localStorage.setItem(LS_KEY(condId), JSON.stringify({ ts: Date.now(), data: dataToCache }));
      } catch { /* Ignora se o localStorage estiver cheio ou indisponível */ }

      if (!cancelled) {
        setState({ ...dataToCache, isLoading: false, source: "storage" });
        setFavicon(dataToCache.faviconUrl);
      }
    }

    loadBranding();

    return () => { cancelled = true; };
  }, [condId]);

  return (
    <BrandingContext.Provider value={state}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingData {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding deve ser usado dentro de um BrandingProvider.");
  }
  return ctx;
}
