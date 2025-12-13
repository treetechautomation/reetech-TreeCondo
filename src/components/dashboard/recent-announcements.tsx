import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export function RecentAnnouncements() {
  return (
    <div className="space-y-8">
      <div className="flex items-start">
        <Avatar className="h-9 w-9">
          <AvatarImage src="https://picsum.photos/seed/admin-1/40/40" alt="Avatar" data-ai-hint="person face" />
          <AvatarFallback>OM</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Manutenção da Piscina</p>
          <p className="text-sm text-muted-foreground">
            A piscina estará fechada para manutenção no dia 25 de julho.
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">há 2d</div>
      </div>
      <div className="flex items-start">
        <Avatar className="flex h-9 w-9 items-center justify-center space-y-0 border">
          <AvatarImage src="https://picsum.photos/seed/admin-2/40/40" alt="Avatar" data-ai-hint="person face" />
          <AvatarFallback>JL</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Controle de Pragas Trimestral</p>
          <p className="text-sm text-muted-foreground">
            Agendado para 1º de agosto. Garanta que suas unidades estejam acessíveis.
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">há 5d</div>
      </div>
      <div className="flex items-start">
        <Avatar className="h-9 w-9">
          <AvatarImage src="https://picsum.photos/seed/admin-1/40/40" alt="Avatar" data-ai-hint="person face" />
          <AvatarFallback>OM</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Comemoração do Dia Nacional</p>
          <p className="text-sm text-muted-foreground">
            Junte-se a nós para um churrasco no salão de festas no Dia Nacional!
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">há 1s</div>
      </div>
    </div>
  )
}
