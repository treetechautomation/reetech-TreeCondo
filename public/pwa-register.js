(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[PWA] SW registered:", reg.scope);

      // se não controlar nessa primeira carga, na próxima normalmente controla
      console.log("[PWA] controller?", !!navigator.serviceWorker.controller);
    } catch (e) {
      console.error("[PWA] SW register failed:", e);
    }
  });
})();
