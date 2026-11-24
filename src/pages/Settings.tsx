import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSection } from "@/components/admin/FormSection";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { updateSettings } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureSettings,
  setSettings,
} from "@/store/slices/settingsSlice";

export function SettingsPage() {
  const { can } = useAuth();
  const canManage = can("manage_settings", "settings");
  const dispatch = useAppDispatch();
  const settingsState = useAppSelector((s) => s.settings);
  const [savingKey, setSavingKey] = useState<
    "maintenanceBanner" | "inviteOnly" | null
  >(null);

  useEffect(() => {
    if (!canManage) return;
    void dispatch(ensureSettings())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load settings.");
      });
  }, [canManage, dispatch, settingsState.invalidated]);

  if (!canManage) {
    return (
      <PageHeader
        title="Settings"
        description="System configuration is restricted to Super Admins."
      />
    );
  }

  const loading =
    (settingsState.status === "loading" || settingsState.status === "idle") &&
    !settingsState.data;

  if (loading) return <LoadingBlock variant="form" />;

  if (settingsState.status === "failed" && !settingsState.data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Settings"
          description="System configuration for the Joseph Mews admin panel."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {settingsState.error ?? "Unable to load settings."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => void dispatch(ensureSettings({ force: true }))}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const settings = settingsState.data ?? {
    maintenanceBanner: false,
    inviteOnly: true,
  };

  const toggle = async (
    key: "maintenanceBanner" | "inviteOnly",
    next: boolean,
  ) => {
    const previous = settings;
    const optimistic = { ...previous, [key]: next };
    dispatch(setSettings(optimistic));
    setSavingKey(key);
    try {
      const saved = await updateSettings({ [key]: next });
      dispatch(setSettings({ ...optimistic, ...saved }));
      toast.success(
        key === "maintenanceBanner"
          ? next
            ? "Maintenance banner enabled"
            : "Maintenance banner disabled"
          : next
            ? "Invite-only onboarding enabled"
            : "Invite-only onboarding disabled",
      );
    } catch (err) {
      dispatch(setSettings(previous));
      toast.error(
        err instanceof ApiError ? err.message : "Unable to update settings.",
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="System configuration for the Joseph Mews admin panel."
      />
      <div className="space-y-4">
        <FormSection title="Platform">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <div className="min-w-0">
              <Label htmlFor="maintenance-banner">Maintenance banner</Label>
              <p className="text-xs text-muted-foreground">
                Show a global notice in the investor app.
              </p>
            </div>
            <Switch
              id="maintenance-banner"
              className="shrink-0"
              checked={settings.maintenanceBanner}
              disabled={savingKey !== null}
              onCheckedChange={(v) => void toggle("maintenanceBanner", v)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <div className="min-w-0">
              <Label htmlFor="invite-only">Require invite for new investors</Label>
              <p className="text-xs text-muted-foreground">
                Invitation-only onboarding policy.
              </p>
            </div>
            <Switch
              id="invite-only"
              className="shrink-0"
              checked={settings.inviteOnly}
              disabled={savingKey !== null}
              onCheckedChange={(v) => void toggle("inviteOnly", v)}
            />
          </div>
        </FormSection>
      </div>
    </div>
  );
}
