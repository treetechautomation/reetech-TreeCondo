export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center">
        <div className="text-xl font-semibold">Página não encontrada</div>
        <div className="mt-2 text-sm text-muted-foreground">
          O conteúdo que você tentou acessar não existe.
        </div>
      </div>
    </div>
  );
}
