import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime, titleCase } from "@/lib/format";
import {
  mockAssignNotifyMessage,
  mockSignalSaveMessage,
} from "@/lib/signalBoardMock";
import type {
  IntentLevel,
  IntentSignal,
  InternalUser,
  SignalStatus,
} from "@/models";

const STATUS_OPTIONS: SignalStatus[] = [
  "new",
  "open",
  "viewed",
  "contact_planned",
  "contacted",
  "qualified",
  "dismissed",
  "converted",
];

const STRENGTH_OPTIONS: IntentLevel[] = ["low", "medium", "high", "urgent"];

export function SignalDetailSheet({
  open,
  onOpenChange,
  signal,
  investorName,
  assigneeId,
  agents,
  saving,
  demoPersist,
  onSavePatch,
  onAssignAgent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: IntentSignal | null;
  investorName: string;
  assigneeId: string | null;
  agents: InternalUser[];
  saving?: boolean;
  /** When true, saves are local-only (Qiko non-integer ids). */
  demoPersist?: boolean;
  onSavePatch: (
    patch: Partial<Pick<IntentSignal, "status" | "agentNotes" | "intentLevel">>,
  ) => Promise<void>;
  onAssignAgent: (agentId: string | null) => Promise<void>;
}) {
  const [status, setStatus] = useState<SignalStatus>("new");
  const [intentLevel, setIntentLevel] = useState<IntentLevel>("medium");
  const [notes, setNotes] = useState("");
  const [agentId, setAgentId] = useState<string>("none");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!signal) return;
    setStatus((signal.status as SignalStatus) || "new");
    setIntentLevel((signal.intentLevel as IntentLevel) || "medium");
    setNotes(signal.agentNotes || "");
    setAgentId(assigneeId || "none");
    setDirty(false);
  }, [signal, assigneeId, open]);

  if (!signal) return null;

  const handleSave = async () => {
    const patch: Partial<
      Pick<IntentSignal, "status" | "agentNotes" | "intentLevel">
    > = {};
    if (status !== signal.status) patch.status = status;
    if (intentLevel !== signal.intentLevel) patch.intentLevel = intentLevel;
    if (notes !== (signal.agentNotes || "")) patch.agentNotes = notes;

    const nextAgent = agentId === "none" ? null : agentId;
    const agentChanged = nextAgent !== (assigneeId || null);

    try {
      if (Object.keys(patch).length > 0) {
        await onSavePatch(patch);
      }
      if (agentChanged) {
        await onAssignAgent(nextAgent);
        const agentName =
          agents.find((a) => String(a.id) === String(nextAgent))?.name ||
          "agent";
        if (nextAgent) {
          toast.success(mockAssignNotifyMessage(agentName));
        } else {
          toast.success("Agent unassigned (mock notify skipped).");
        }
      } else if (Object.keys(patch).length > 0) {
        toast.success(
          demoPersist
            ? mockSignalSaveMessage("Signal updated")
            : "Signal updated",
        );
      }
      setDirty(false);
      onOpenChange(false);
    } catch {
      // Parent shows error toast
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12">
          <SheetTitle className="truncate">{investorName}</SheetTitle>
          <SheetDescription className="line-clamp-2">
            {signal.signalType || "Intent signal"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={signal.intentLevel} />
            <span className="text-xs text-muted-foreground">
              {formatDateTime(signal.generatedAt)}
            </span>
          </div>

          {signal.triggeringActivity ? (
            <div>
              <p className="label-eyebrow mb-1">Evidence</p>
              <p className="text-sm text-foreground/90">
                {signal.triggeringActivity}
              </p>
            </div>
          ) : null}

          {signal.summary ? (
            <div>
              <p className="label-eyebrow mb-1">Summary</p>
              <p className="text-sm text-muted-foreground">{signal.summary}</p>
            </div>
          ) : null}

          {signal.suggestedNextAction ? (
            <div>
              <p className="label-eyebrow mb-1">Suggested next action</p>
              <p className="text-sm text-foreground/90">
                {signal.suggestedNextAction}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="signal-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as SignalStatus);
                setDirty(true);
              }}
            >
              <SelectTrigger id="signal-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-strength">Strength</Label>
            <Select
              value={intentLevel}
              onValueChange={(v) => {
                setIntentLevel(v as IntentLevel);
                setDirty(true);
              }}
            >
              <SelectTrigger id="signal-strength">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRENGTH_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-agent">Assigned agent</Label>
            <Select
              value={agentId}
              onValueChange={(v) => {
                setAgentId(v);
                setDirty(true);
              }}
            >
              <SelectTrigger id="signal-agent">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Updates investor assignment (API). Email notify is mock until
              backend is ready.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-notes">Agent notes</Label>
            <Textarea
              id="signal-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              rows={4}
              placeholder="Log contact outcome, feedback, next steps…"
            />
          </div>
        </div>

        <SheetFooter className="shrink-0 border-t border-border bg-background px-4 py-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
