import {
  CircleCheck,
  Clock,
  HandHelping,
  MessageCircle,
  Sparkles,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CampaignStatus, LeadStatus } from "@/data/whatsappWorkerMock";
import { cn } from "@/lib/utils";

const leadTone: Record<
  LeadStatus,
  { className: string; icon?: LucideIcon }
> = {
  New: {
    className: "border-primary/40 bg-gold-soft text-primary font-medium",
    icon: Sparkles,
  },
  "Not Contacted": {
    className: "border-border bg-muted text-muted-foreground",
    icon: Clock,
  },
  Contacted: {
    className: "border-primary/25 bg-primary/5 text-primary",
    icon: MessageCircle,
  },
  "Active Conversation": {
    className: "border-border bg-foreground/10 text-foreground font-medium",
    icon: MessageCircle,
  },
  Qualified: {
    className: "border-border bg-foreground/10 text-foreground font-medium",
    icon: CircleCheck,
  },
  Nurture: {
    className: "border-primary/25 bg-primary/5 text-primary",
    icon: Clock,
  },
  "High Intent": {
    className: "border-primary/40 bg-gold-soft text-primary font-medium",
    icon: Sparkles,
  },
  "Human Handoff": {
    className:
      "border-transparent bg-destructive text-destructive-foreground font-semibold",
    icon: HandHelping,
  },
  "No Response": {
    className: "border-border bg-muted text-muted-foreground",
    icon: Clock,
  },
  Closed: {
    className: "border-border bg-muted text-muted-foreground",
    icon: CircleCheck,
  },
  "Opted Out": {
    className: "border-border bg-muted text-muted-foreground",
    icon: UserMinus,
  },
};

const campaignTone: Record<CampaignStatus, string> = {
  Draft: "border-border bg-muted text-muted-foreground",
  Scheduled: "border-primary/25 bg-primary/5 text-primary",
  Active: "border-border bg-foreground/10 text-foreground font-medium",
  Completed: "border-border bg-muted text-muted-foreground",
  Cancelled: "border-border bg-muted text-muted-foreground",
};

export function LeadStatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  const tone = leadTone[status];
  const Icon = tone?.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg font-normal",
        tone?.className ?? "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {Icon ? <Icon /> : null}
      {status}
    </Badge>
  );
}

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg font-normal",
        campaignTone[status] ?? "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {status}
    </Badge>
  );
}
