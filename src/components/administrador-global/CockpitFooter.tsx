export function CockpitFooter() {
  const env = process.env.NODE_ENV === "production" ? "produção" : "desenvolvimento";

  return (
    <footer className="border-t border-black/5 bg-white/40 px-4 py-3 text-center text-xs text-slate-400 backdrop-blur-xl">
      Treetech Automation · Painel Global · Ambiente {env}
    </footer>
  );
}
