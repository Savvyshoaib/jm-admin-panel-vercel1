import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import logoMewsOne from "../../../assets/images/mews-one-logo.png";
import {
  Activity,
  Building2,
  Calculator,
  CalendarDays,
  ChevronDown,
  Kanban,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Radar,
  Layers,
  Users,
  UserCircle2,
  LogOut,
  Landmark,
  Clock,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useWorkspaceMode,
  type WorkspaceMode,
} from "@/contexts/WorkspaceModeContext";
import { roleLabel } from "@/permissions/can";
import type { Resource } from "@/permissions/can";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import mewsOneMark from "../../../assets/images/mews-one-mark.png";
import { ThemeSwitcher } from "@/components/admin/ThemeSwitcher";

const SIDEBAR_COLLAPSED_KEY = "jm-admin-sidebar-collapsed";

function SidebarBrand({
  collapsed,
  mode,
}: {
  collapsed?: boolean;
  mode: WorkspaceMode;
}) {
  const homeHref = mode === "whatsapp" ? "/whatsapp" : "/";
  if (collapsed) {
    return (
      <Link
        href={homeHref}
        aria-label="Mews One home"
        className="flex size-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-sidebar-accent"
      >
        <img
          src={mewsOneMark}
          alt="Mews One — by Joseph Mews Property"
          className="h-16 w-auto max-w-[13.5rem] object-contain object-left sm:h-10"
        />
      </Link>
    );
  }

  return (
    <Link href={homeHref} className="min-w-0 space-y-1" aria-label="Mews One home">
      <img
        src={logoMewsOne}
        alt="Mews One — by Joseph Mews Property"
        className="mb-5 h-16 w-auto max-w-[13.5rem] object-contain object-left sm:h-16"
      />
      <p className="label-eyebrow">
        {mode === "whatsapp" ? "WhatsApp Worker" : "Admin"}
      </p>
    </Link>
  );
}

type AdminNavChild = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Exact match only (e.g. dashboard at /signals). */
  exact?: boolean;
};

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  resource: Resource;
  children?: AdminNavChild[];
};

const adminNavItems: AdminNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { href: "/investors", label: "Investors", icon: UserCircle2, resource: "investors" },
  { href: "/properties", label: "Properties", icon: Building2, resource: "properties" },
  { href: "/developments", label: "Developments", icon: Landmark, resource: "developments" },
  { href: "/coming-soon", label: "Coming soon", icon: Clock, resource: "content" },
  { href: "/enquiries", label: "Enquiries", icon: MessageSquare, resource: "enquiries" },
  {
    href: "/signals",
    label: "Intent Signals",
    icon: Radar,
    resource: "signals",
    children: [
      {
        href: "/signals",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      { href: "/signals/board", label: "Board", icon: Kanban },
    ],
  },
  { href: "/mail", label: "Mail", icon: Mail, resource: "mailing" },
  { href: "/assumptions", label: "Calculations & Assumptions", icon: Calculator, resource: "assumptions" },
  { href: "/calculator", label: "Calculator", icon: Layers, resource: "investor_journey" },
  { href: "/users", label: "Users & Roles", icon: Users, resource: "users" },
  { href: "/activity", label: "Activity Log", icon: Activity, resource: "activity" },
];

const whatsappNavSections: {
  label: string;
  items: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
  }[];
}[] = [
  {
    label: "Workspace",
    items: [
      { href: "/whatsapp", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/whatsapp/leads", label: "Leads", icon: UserCircle2 },
      { href: "/whatsapp/webinars", label: "Webinars", icon: CalendarDays },
      { href: "/whatsapp/data", label: "Data", icon: Upload },
    ],
  },
];

function WorkspaceModeToggle({
  collapsed,
  mode,
  onChange,
}: {
  collapsed?: boolean;
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-1.5 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-xl",
                mode === "admin" && "bg-primary/15 text-primary ring-1 ring-primary/25",
              )}
              aria-label="Admin workspace"
              aria-pressed={mode === "admin"}
              onClick={() => onChange("admin")}
            >
              <LayoutDashboard className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Admin</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-xl",
                mode === "whatsapp" && "bg-primary/15 text-primary ring-1 ring-primary/25",
              )}
              aria-label="WhatsApp Worker"
              aria-pressed={mode === "whatsapp"}
              onClick={() => onChange("whatsapp")}
            >
              <MessageSquare className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">WhatsApp Worker</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-2 pb-3">
      <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      <div className="glass inline-flex w-full rounded-xl p-0.5">
        <button
          type="button"
          onClick={() => onChange("admin")}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
            mode === "admin"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => onChange("whatsapp")}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
            mode === "whatsapp"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          WhatsApp
        </button>
      </div>
      {mode === "whatsapp" ? (
        <div className="mt-2 rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/8">
          <p className="truncate text-xs font-medium text-foreground">
            Joseph Mews
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            WhatsApp Sales · Joe
          </p>
        </div>
      ) : null}
    </div>
  );
}

function NavLinkItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center rounded-xl text-sm transition-all duration-200",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
        active
          ? "bg-primary/12 text-foreground shadow-[inset_0_1px_0_rgba(255,245,233,0.08)] ring-1 ring-primary/25"
          : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
      )}
    >
      {active && !collapsed ? (
        <span
          aria-hidden
          className="absolute left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(252,193,29,0.55)]"
        />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-opacity",
          active ? "opacity-100 text-primary" : "opacity-75",
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (!collapsed) return <div key={href}>{link}</div>;

  return (
    <Tooltip key={href}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function pathActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (href === "/") return pathname === "/" || pathname === "";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  const sectionActive = pathActive(pathname, item.href);
  const [open, setOpen] = useState(sectionActive);

  useEffect(() => {
    setOpen(sectionActive);
  }, [sectionActive]);

  if (!children.length) {
    return (
      <NavLinkItem
        href={item.href}
        label={item.label}
        icon={item.icon}
        active={pathActive(pathname, item.href, item.href === "/")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    );
  }

  if (collapsed) {
    return (
      <NavLinkItem
        href={item.href}
        label={item.label}
        icon={item.icon}
        active={sectionActive}
        collapsed
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
          sectionActive
            ? "bg-primary/12 text-foreground shadow-[inset_0_1px_0_rgba(255,245,233,0.08)] ring-1 ring-primary/25"
            : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
        )}
      >
        {sectionActive ? (
          <span
            aria-hidden
            className="absolute left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(252,193,29,0.55)]"
          />
        ) : null}
        <item.icon
          className={cn(
            "size-4 shrink-0",
            sectionActive ? "text-primary opacity-100" : "opacity-75",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="ml-3 space-y-0.5 border-l border-white/8 pl-2">
          {children.map((child) => {
            const active = pathActive(pathname, child.href, child.exact);
            return (
              <NavLinkItem
                key={child.href}
                href={child.href}
                label={child.label}
                icon={child.icon}
                active={active}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavLinks({
  onNavigate,
  pathname,
  collapsed,
  mode,
}: {
  onNavigate?: () => void;
  pathname: string;
  collapsed?: boolean;
  mode: WorkspaceMode;
}) {
  const { canAccessNav } = useAuth();

  if (mode === "whatsapp") {
    return (
      <nav className={cn("flex flex-col gap-3", collapsed ? "px-1.5" : "px-2")}>
        {whatsappNavSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {!collapsed ? (
              <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const active =
                item.href === "/whatsapp"
                  ? pathname === "/whatsapp"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <NavLinkItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-1", collapsed ? "px-1.5" : "px-2")}>
      {adminNavItems
        .filter((item) => canAccessNav(item.resource))
        .map((item) => (
          <NavGroup
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
    </nav>
  );
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, canAccessNav } = useAuth();
  const { mode, setMode } = useWorkspaceMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const canWhatsapp = canAccessNav("whatsapp_worker");

  useEffect(() => {
    void import("@/lib/playableVideo")
      .then(({ ensurePlaybackWorker }) => ensurePlaybackWorker())
      .catch(() => {
        /* Optional: video thumbnails fall back without the worker. */
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Keep mode ↔ URL aligned (deep links, refresh, browser back).
  useEffect(() => {
    const onWhatsappRoute =
      location === "/whatsapp" || location.startsWith("/whatsapp/");
    if (!canWhatsapp) {
      if (mode === "whatsapp") setMode("admin");
      if (onWhatsappRoute) setLocation("/");
      return;
    }
    if (onWhatsappRoute && mode !== "whatsapp") {
      setMode("whatsapp");
      return;
    }
    if (mode === "whatsapp" && !onWhatsappRoute) {
      setLocation("/whatsapp");
    }
  }, [location, mode, setMode, setLocation, canWhatsapp]);

  const switchMode = (next: WorkspaceMode) => {
    if (next === mode) return;
    if (next === "whatsapp" && !canWhatsapp) return;
    setMode(next);
    if (next === "whatsapp") {
      if (!(location === "/whatsapp" || location.startsWith("/whatsapp/"))) {
        setLocation("/whatsapp");
      }
    } else if (location === "/whatsapp" || location.startsWith("/whatsapp/")) {
      setLocation("/");
    }
    setMobileOpen(false);
  };

  const signOut = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <div className="admin-ambient flex min-h-dvh text-foreground">
      {/*
        Desktop sidebar is `fixed` (not sticky). Radix Dialog scroll-lock on
        <body> breaks sticky sidebars and leaves an empty gap on the left.
        A matching spacer keeps the main column aligned.
      */}
      <div
        aria-hidden
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-16" : "w-68",
        )}
      />
      <aside
        data-admin-sidebar
        className={cn(
          "glass-sidebar fixed inset-y-0 left-0 z-[60] hidden h-dvh flex-col transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-16" : "w-68",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 border-b border-white/8",
            collapsed
              ? "flex-col items-center gap-2 px-2 py-3"
              : "items-center justify-between gap-2 px-4 py-4",
          )}
        >
          <SidebarBrand collapsed={collapsed} mode={mode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-xl"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <PanelLeft className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {canWhatsapp ? (
            <WorkspaceModeToggle
              collapsed={collapsed}
              mode={mode}
              onChange={switchMode}
            />
          ) : null}
          <NavLinks
            pathname={location}
            collapsed={collapsed}
            mode={canWhatsapp ? mode : "admin"}
          />
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-white/8",
            collapsed ? "space-y-2 p-2" : "space-y-3 p-4",
          )}
        >
          {!collapsed && (
            <>
              <div className="rounded-xl bg-white/4 px-3 py-2.5 ring-1 ring-white/8">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user ? roleLabel(user.role) : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 rounded-xl"
                onClick={signOut}
              >
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </>
          )}
          {collapsed && (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-xl"
                    onClick={signOut}
                    aria-label="Sign out"
                  >
                    <LogOut className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Sign out
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/55 backdrop-blur-sm transition-opacity"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="glass-sidebar absolute inset-y-0 left-0 z-10 flex w-[min(18rem,85vw)] flex-col overflow-hidden shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-4">
              <SidebarBrand mode={mode} />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
              {canWhatsapp ? (
                <WorkspaceModeToggle mode={mode} onChange={switchMode} />
              ) : null}
              <NavLinks
                pathname={location}
                onNavigate={() => setMobileOpen(false)}
                mode={canWhatsapp ? mode : "admin"}
              />
            </div>
            <div className="shrink-0 space-y-3 border-t border-white/8 p-4">
              <div className="min-w-0 rounded-xl bg-white/4 px-3 py-2.5 ring-1 ring-white/8">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user ? roleLabel(user.role) : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 rounded-xl"
                onClick={signOut}
              >
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="relative z-[1] flex min-w-0 w-full flex-1 flex-col">
        <header className="glass-header sticky top-0 z-40 flex w-full items-center gap-3 px-4 py-3 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {mode === "whatsapp" ? (
                <>
                  <span className="sm:hidden">Joe · WhatsApp Sales</span>
                  <span className="hidden sm:inline">
                    Joseph Mews · WhatsApp Sales Worker
                  </span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Joseph Mews Admin</span>
                  <span className="hidden sm:inline">
                    Operational control for the Joseph Mews Investor Platform
                  </span>
                </>
              )}
            </p>
          </div>
          <ThemeSwitcher />
          <div className="hidden min-w-0 rounded-xl bg-white/4 px-3 py-1.5 text-right ring-1 ring-white/8 sm:block">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </header>
        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
