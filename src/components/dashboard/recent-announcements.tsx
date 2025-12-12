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
          <p className="text-sm font-medium leading-none">Pool Maintenance</p>
          <p className="text-sm text-muted-foreground">
            The swimming pool will be closed for maintenance on July 25th.
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">2d ago</div>
      </div>
      <div className="flex items-start">
        <Avatar className="flex h-9 w-9 items-center justify-center space-y-0 border">
          <AvatarImage src="https://picsum.photos/seed/admin-2/40/40" alt="Avatar" data-ai-hint="person face" />
          <AvatarFallback>JL</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Quarterly Pest Control</p>
          <p className="text-sm text-muted-foreground">
            Scheduled for August 1st. Please ensure your units are accessible.
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">5d ago</div>
      </div>
      <div className="flex items-start">
        <Avatar className="h-9 w-9">
          <AvatarImage src="https://picsum.photos/seed/admin-1/40/40" alt="Avatar" data-ai-hint="person face" />
          <AvatarFallback>OM</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">National Day Celebration</p>
          <p className="text-sm text-muted-foreground">
            Join us for a BBQ at the function hall on National Day!
          </p>
        </div>
        <div className="ml-auto font-medium text-xs text-muted-foreground">1w ago</div>
      </div>
    </div>
  )
}
