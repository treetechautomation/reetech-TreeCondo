import { Home } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Home className="h-6 w-6 text-primary" />
      <h2 className="text-xl font-bold font-headline text-foreground">
        TreeCondo
      </h2>
    </div>
  );
}
