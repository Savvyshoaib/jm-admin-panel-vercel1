import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ListFilter, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { SearchableMultiSelect } from "@/components/admin/SearchableMultiSelect";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { FormSection } from "@/components/admin/FormSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import type { InternalUser, InvitationStatus, Role } from "@/models";
import { inviteUser, resendUserInvite, updateUser } from "@/services/api";
import { roleLabel } from "@/permissions/can";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  ensureUsers,
  invalidateUsers,
  upsertUser,
} from "@/store/slices/usersSlice";
import { isThunkConditionError } from "@/store/thunkUtils";

const USER_ROLES: Role[] = ["super_admin", "agent", "viewer"];
const USER_STATUSES: InternalUser["status"][] = ["active", "inactive", "invited"];
const INVITATION_STATUSES: InvitationStatus[] = [
  "created",
  "sent",
  "delivered",
  "opened",
  "accepted",
  "expired",
  "revoked",
];

type AssignedFilter = "assigned" | "unassigned";

/** Sentinel for users with no invitation status. */
const NONE_FILTER = "__none__";

type UserListFilters = {
  roles: Role[];
  statuses: InternalUser["status"][];
  invitations: Array<InvitationStatus | typeof NONE_FILTER>;
  assigned: AssignedFilter[];
};

const EMPTY_FILTERS: UserListFilters = {
  roles: [],
  statuses: [],
  invitations: [],
  assigned: [],
};

function countActiveFilters(filters: UserListFilters): number {
  return (
    filters.roles.length +
    filters.statuses.length +
    filters.invitations.length +
    filters.assigned.length
  );
}

function isValidCalendarUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateOptionalCalendarUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return "URL is too long.";
  if (!isValidCalendarUrl(trimmed)) return "Enter a valid Calendar URL.";
  return null;
}

/** Agents and super admins can store optional calendar / WhatsApp contact fields. */
function hasContactFields(role: Role): boolean {
  return role === "agent" || role === "super_admin";
}

export function UsersPage() {
  const { can } = useAuth();
  const canManage = can("manage_roles", "users");
  const dispatch = useAppDispatch();
  const usersState = useAppSelector((s) => s.users);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [calendlyUrlError, setCalendlyUrlError] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("agent");
  const [editStatus, setEditStatus] = useState<InternalUser["status"]>("active");
  const [editCalendlyUrl, setEditCalendlyUrl] = useState("");
  const [editCalendlyUrlError, setEditCalendlyUrlError] = useState<string | null>(
    null,
  );
  const [editWhatsappNumber, setEditWhatsappNumber] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] =
    useState<UserListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<UserListFilters>(EMPTY_FILTERS);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<
    Record<string, number>
  >({});
  const [, setResendTick] = useState(0);

  useEffect(() => {
    if (!canManage) return;
    void dispatch(ensureUsers())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load users.");
      });
  }, [canManage, dispatch]);

  useEffect(() => {
    const hasActive = Object.values(resendCooldownUntil).some(
      (until) => until > Date.now(),
    );
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      setResendTick((n) => n + 1);
      setResendCooldownUntil((prev) => {
        const next: Record<string, number> = {};
        const now = Date.now();
        for (const [id, until] of Object.entries(prev)) {
          if (until > now) next[id] = until;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldownUntil]);

  const resendCooldownSeconds = (userId: string) => {
    const until = resendCooldownUntil[userId] ?? 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  };

  const handleResendInvite = (user: InternalUser) => {
    if (user.status !== "invited") return;
    if (resendingId || resendCooldownSeconds(user.id) > 0) return;
    setResendingId(user.id);
    const toastId = `resend-invite-${user.id}`;
    toast.loading("Resending…", { id: toastId });
    void (async () => {
      try {
        const message = await resendUserInvite(user.id);
        toast.success(message || "Invitation resent.", { id: toastId });
        setResendCooldownUntil((prev) => ({
          ...prev,
          [user.id]: Date.now() + 60_000,
        }));
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Unable to resend invitation.",
          { id: toastId },
        );
      } finally {
        setResendingId(null);
      }
    })();
  };

  const rows = usersState.items;
  const activeFilterCount = countActiveFilters(appliedFilters);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((u) => {
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (appliedFilters.roles.length > 0 && !appliedFilters.roles.includes(u.role)) {
        return false;
      }

      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(u.status)
      ) {
        return false;
      }

      if (appliedFilters.invitations.length > 0) {
        const hasNone = u.invitationStatus == null;
        const matchesNone =
          appliedFilters.invitations.includes(NONE_FILTER) && hasNone;
        const matchesStatus =
          !hasNone &&
          appliedFilters.invitations.includes(u.invitationStatus as InvitationStatus);
        if (!matchesNone && !matchesStatus) return false;
      }

      if (appliedFilters.assigned.length > 0) {
        const key: AssignedFilter =
          u.assignedInvestorIds.length > 0 ? "assigned" : "unassigned";
        if (!appliedFilters.assigned.includes(key)) return false;
      }

      return true;
    });
  }, [rows, search, appliedFilters]);

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setOpenFilterKey(null);
    setFiltersOpen(true);
  };

  const applyDraftFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(1);
    setOpenFilterKey(null);
    setFiltersOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
  };

  const clearAppliedFilters = () => {
    setAppliedFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const roleOptions = USER_ROLES.map((r) => ({
    value: r,
    label: roleLabel(r),
  }));

  const statusOptions = USER_STATUSES.map((s) => ({
    value: s,
    label: titleCase(s),
  }));

  const invitationOptions = [
    { value: NONE_FILTER, label: "None" },
    ...INVITATION_STATUSES.map((s) => ({
      value: s,
      label: titleCase(s),
    })),
  ];

  const assignedOptions = [
    { value: "assigned", label: "Has assigned investors" },
    { value: "unassigned", label: "No assigned investors" },
  ];

  if (!canManage) {
    return (
      <PageHeader
        title="Users & Roles"
        description="Only Super Admins can manage internal users and roles."
      />
    );
  }

  const setUserRole = async (userId: string, nextRole: Role) => {
    try {
      const updated = await updateUser(userId, { role: nextRole });
      dispatch(upsertUser(updated));
      dispatch(invalidateUsers());
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update role.");
    }
  };

  const toggleStatus = async (user: InternalUser) => {
    try {
      const updated = await updateUser(user.id, {
        status: user.status === "active" ? "inactive" : "active",
      });
      dispatch(upsertUser(updated));
      dispatch(invalidateUsers());
      toast.success(user.status === "active" ? "User deactivated" : "User activated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update status.");
    }
  };

  const openEditUser = (user: InternalUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditCalendlyUrl(user.calendlyUrl ?? "");
    setEditCalendlyUrlError(null);
    setEditWhatsappNumber(user.whatsappNumber ?? "");
  };

  const closeEditUser = () => {
    if (savingEdit) return;
    setEditingUser(null);
    setEditCalendlyUrlError(null);
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    const nextName = editName.trim();
    const nextEmail = editEmail.trim();
    if (!nextName || !nextEmail) {
      toast.error("Name and email are required.");
      return;
    }
    if (hasContactFields(editRole)) {
      const calendarError = validateOptionalCalendarUrl(editCalendlyUrl);
      if (calendarError) {
        setEditCalendlyUrlError(calendarError);
        return;
      }
    }

    setSavingEdit(true);
    try {
      const updated = await updateUser(editingUser.id, {
        name: nextName,
        email: nextEmail,
        role: editRole,
        status: editStatus,
        ...(hasContactFields(editRole)
          ? {
              calendlyUrl: editCalendlyUrl.trim(),
              whatsappNumber: editWhatsappNumber.trim(),
            }
          : {
              calendlyUrl: "",
              whatsappNumber: "",
            }),
      });
      dispatch(
        upsertUser({
          ...updated,
          ...(hasContactFields(editRole)
            ? {
                calendlyUrl:
                  updated.calendlyUrl || editCalendlyUrl.trim() || undefined,
                whatsappNumber:
                  updated.whatsappNumber ||
                  editWhatsappNumber.trim() ||
                  undefined,
              }
            : {
                calendlyUrl: undefined,
                whatsappNumber: undefined,
              }),
        }),
      );
      dispatch(invalidateUsers());
      setEditingUser(null);
      toast.success("User updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update user.");
    } finally {
      setSavingEdit(false);
    }
  };

  const columns: Column<InternalUser>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground md:hidden">{r.email}</p>
        </div>
      ),
    },
    { key: "email", header: "Email", cell: (r) => r.email, mobileHidden: true },
    { key: "role", header: "Role", cell: (r) => roleLabel(r.role) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "assigned",
      header: "Assigned investors",
      cell: (r) => r.assignedInvestorIds.length,
      mobileHidden: true,
    },
    {
      key: "login",
      header: "Last login",
      cell: (r) => formatDateTime(r.lastLoginAt),
      mobileHidden: true,
    },
    {
      key: "invite",
      header: "Invitation",
      cell: (r) =>
        r.invitationStatus ? (
          <StatusBadge value={r.invitationStatus} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      cell: (r) => (
        <>
          <span className="md:hidden">{formatDate(r.createdAt)}</span>
          <span className="hidden md:inline">{formatDateTime(r.createdAt)}</span>
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => {
        const cooldown = resendCooldownSeconds(r.id);
        const resendBusy = resendingId === r.id;
        const resendDisabled = resendBusy || cooldown > 0;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 w-full gap-2 sm:min-h-8 sm:w-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                Manage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => openEditUser(r)}>
                Edit
              </DropdownMenuItem>
              {r.status === "invited" ? (
                <DropdownMenuItem
                  disabled={resendDisabled}
                  onSelect={(e) => {
                    if (resendDisabled) {
                      e.preventDefault();
                      return;
                    }
                    handleResendInvite(r);
                  }}
                >
                  {resendBusy
                    ? "Resending…"
                    : cooldown > 0
                      ? `Resend Invite (${cooldown}s)`
                      : "Resend Invite"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setUserRole(r.id, "super_admin")}>
                Role: Super Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUserRole(r.id, "agent")}>
                Role: Agent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUserRole(r.id, "viewer")}>
                Role: Viewer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={r.status === "active" ? "destructive" : "default"}
                onClick={() => toggleStatus(r)}
              >
                {r.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const loading =
    (usersState.status === "loading" || usersState.status === "idle") &&
    usersState.items.length === 0;

  if (loading) return <LoadingBlock variant="table" />;

  if (usersState.status === "failed" && usersState.items.length === 0) {
    return (
      <div className="w-full space-y-4">
        <PageHeader
          title="Users & Roles"
          description="Internal staff access. Agents only see assigned investors."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {usersState.error ?? "Unable to load users."}
          <div className="mt-3">
            <Button variant="outline" onClick={() => dispatch(ensureUsers({ force: true }))}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Users & Roles"
        description="Internal staff access. Agents only see assigned investors."
      />
      <FormSection title="Invite internal user">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={role}
            onValueChange={(v) => {
              const nextRole = v as Role;
              setRole(nextRole);
              if (!hasContactFields(nextRole)) {
                setCalendlyUrl("");
                setCalendlyUrlError(null);
                setWhatsappNumber("");
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasContactFields(role) ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="invite-calendly-url">Calendar URL</Label>
              <Input
                id="invite-calendly-url"
                type="url"
                placeholder="https://calendly.com/…"
                value={calendlyUrl}
                aria-invalid={!!calendlyUrlError}
                onChange={(e) => {
                  setCalendlyUrl(e.target.value);
                  if (calendlyUrlError) setCalendlyUrlError(null);
                }}
              />
              {calendlyUrlError ? (
                <p className="text-xs text-error" role="alert">
                  {calendlyUrlError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-whatsapp-number">WhatsApp Number</Label>
              <Input
                id="invite-whatsapp-number"
                type="tel"
                placeholder="+44…"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="flex items-end">
          <Button
            className="min-h-10 w-full sm:w-auto"
            disabled={!name.trim() || !email.trim() || inviting}
            onClick={async () => {
              if (hasContactFields(role)) {
                const calendarError = validateOptionalCalendarUrl(calendlyUrl);
                if (calendarError) {
                  setCalendlyUrlError(calendarError);
                  return;
                }
              }

              setInviting(true);
              try {
                const user = await inviteUser({
                  name: name.trim(),
                  email: email.trim(),
                  role,
                  ...(hasContactFields(role)
                    ? {
                        ...(calendlyUrl.trim()
                          ? { calendlyUrl: calendlyUrl.trim() }
                          : {}),
                        ...(whatsappNumber.trim()
                          ? { whatsappNumber: whatsappNumber.trim() }
                          : {}),
                      }
                    : {}),
                });
                dispatch(upsertUser(user));
                dispatch(invalidateUsers());
                setName("");
                setEmail("");
                setCalendlyUrl("");
                setCalendlyUrlError(null);
                setWhatsappNumber("");
                toast.success("Internal user invited");
              } catch (err) {
                toast.error(
                  err instanceof ApiError ? err.message : "Unable to send invite.",
                );
              } finally {
                setInviting(false);
              }
            }}
          >
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </FormSection>

      <div className="mt-6 w-full">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search name, email…"
          searchActions={
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openFilters}
              aria-label={
                activeFilterCount > 0
                  ? `Filters, ${activeFilterCount} applied`
                  : "Open filters"
              }
            >
              <ListFilter className="size-4" />
              Filters
              {activeFilterCount > 0 ? (
                <Badge variant="default" className="h-5 min-w-5 px-1.5 tabular-nums">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          }
        />

        {activeFilterCount > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} applied
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={clearAppliedFilters}
            >
              Clear all
            </Button>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          page={page}
          onPageChange={setPage}
          pageSize={10}
        />
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={(open) => {
          setFiltersOpen(open);
          if (open) {
            setDraftFilters(appliedFilters);
            setOpenFilterKey(null);
          } else {
            setOpenFilterKey(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border pr-12">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Use search inside each dropdown. Select multiple values per group.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-5">
              <SearchableMultiSelect
                id="user-filter-role"
                label="Role"
                values={draftFilters.roles}
                onValuesChange={(roles) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    roles: roles as Role[],
                  }))
                }
                options={roleOptions}
                placeholder="All roles"
                searchPlaceholder="Search role…"
                open={openFilterKey === "role"}
                onOpenChange={(open) => setOpenFilterKey(open ? "role" : null)}
              />

              <SearchableMultiSelect
                id="user-filter-status"
                label="Status"
                values={draftFilters.statuses}
                onValuesChange={(statuses) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    statuses: statuses as InternalUser["status"][],
                  }))
                }
                options={statusOptions}
                placeholder="All statuses"
                searchPlaceholder="Search status…"
                open={openFilterKey === "status"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "status" : null)
                }
              />

              <SearchableMultiSelect
                id="user-filter-invitation"
                label="Invitation"
                values={draftFilters.invitations}
                onValuesChange={(invitations) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    invitations: invitations as UserListFilters["invitations"],
                  }))
                }
                options={invitationOptions}
                placeholder="All invitations"
                searchPlaceholder="Search invitation…"
                open={openFilterKey === "invitation"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "invitation" : null)
                }
              />

              <SearchableMultiSelect
                id="user-filter-assigned"
                label="Assigned investors"
                values={draftFilters.assigned}
                onValuesChange={(assigned) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    assigned: assigned as AssignedFilter[],
                  }))
                }
                options={assignedOptions}
                placeholder="All assignment states"
                searchPlaceholder="Search assignment…"
                open={openFilterKey === "assigned"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "assigned" : null)
                }
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t border-border bg-background sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={clearDraftFilters}
              disabled={countActiveFilters(draftFilters) === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={applyDraftFilters}
            >
              Apply
              {countActiveFilters(draftFilters) > 0
                ? ` (${countActiveFilters(draftFilters)})`
                : ""}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editingUser != null}
        onOpenChange={(open) => {
          if (!open) closeEditUser();
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border pr-12">
            <SheetTitle>Edit user</SheetTitle>
            <SheetDescription>
              Update name, email, role, and agent contact details.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                value={editName}
                disabled={savingEdit}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={editEmail}
                disabled={savingEdit}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                disabled={savingEdit}
                onValueChange={(v) => {
                  const nextRole = v as Role;
                  setEditRole(nextRole);
                  if (!hasContactFields(nextRole)) {
                    setEditCalendlyUrl("");
                    setEditCalendlyUrlError(null);
                    setEditWhatsappNumber("");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editStatus}
                disabled={savingEdit}
                onValueChange={(v) =>
                  setEditStatus(v as InternalUser["status"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasContactFields(editRole) ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-calendly-url">Calendar URL</Label>
                  <Input
                    id="edit-user-calendly-url"
                    type="url"
                    placeholder="https://calendly.com/…"
                    value={editCalendlyUrl}
                    disabled={savingEdit}
                    aria-invalid={!!editCalendlyUrlError}
                    onChange={(e) => {
                      setEditCalendlyUrl(e.target.value);
                      if (editCalendlyUrlError) setEditCalendlyUrlError(null);
                    }}
                  />
                  {editCalendlyUrlError ? (
                    <p className="text-xs text-error" role="alert">
                      {editCalendlyUrlError}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-whatsapp">WhatsApp Number</Label>
                  <Input
                    id="edit-user-whatsapp"
                    type="tel"
                    placeholder="+44…"
                    value={editWhatsappNumber}
                    disabled={savingEdit}
                    onChange={(e) => setEditWhatsappNumber(e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-t border-border bg-background sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={closeEditUser}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void saveEditUser()}
              disabled={
                savingEdit || !editName.trim() || !editEmail.trim()
              }
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
