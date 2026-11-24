import { CircleCheck, Clock, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

// The brand palette has no red/green — statuses are told apart by icon and
// fill weight (solid vs. tinted vs. muted) rather than by hue.
const toneMap: Record<string, { className: string; icon?: LucideIcon }> = {
  active: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  available: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  published: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  paid: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  converted: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  accepted: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  new: { className: "border-primary/40 bg-gold-soft text-primary font-medium", icon: Sparkles },
  sent: { className: "border-primary/40 bg-gold-soft text-primary font-medium", icon: Sparkles },
  high: { className: "border-primary/40 bg-gold-soft text-primary font-medium", icon: Sparkles },
  urgent: { className: "border-transparent bg-destructive text-destructive-foreground font-semibold", icon: TriangleAlert },
  updated: { className: "border-border bg-foreground/10 text-foreground font-medium", icon: CircleCheck },
  skipped: { className: "border-border bg-muted text-muted-foreground", icon: Clock },
  error: { className: "border-transparent bg-destructive text-destructive-foreground font-semibold", icon: TriangleAlert },
  overdue: { className: "border-transparent bg-destructive text-destructive-foreground font-semibold", icon: TriangleAlert },
  reserved: { className: "border-primary/25 bg-primary/5 text-primary", icon: Clock },
  due: { className: "border-primary/25 bg-primary/5 text-primary", icon: Clock },
  inactive: { className: "border-border bg-muted text-muted-foreground" },
  draft: { className: "border-border bg-muted text-muted-foreground" },
  expired: { className: "border-border bg-muted text-muted-foreground" },
  revoked: { className: "border-border bg-muted text-muted-foreground" },
  pending: { className: "border-border bg-muted text-muted-foreground" },
};

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const key = value.toLowerCase();
  const tone = toneMap[key];
  const Icon = tone?.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg font-normal capitalize",
        tone?.className ?? "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {Icon && <Icon />}
      {titleCase(value)}
    </Badge>
  );
}
