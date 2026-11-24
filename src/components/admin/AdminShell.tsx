import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import logoMewsOne from "../../../assets/images/mews-one-logo.png";
import {
  Activity,
  Building2,
  Calculator,
  LayoutDashboard,
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
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

function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <Link
        href="/"
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
    <Link href="/" className="min-w-0 space-y-1" aria-label="Mews One home">
      <img
        src={logoMewsOne}
        alt="Mews One — by Joseph Mews Property"
        className="mb-5 h-16 w-auto max-w-[13.5rem] object-contain object-left sm:h-16"
      />
      <p className="label-eyebrow">Admin</p>
    </Link>
  );
}

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  resource: Resource;
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { href: "/investors", label: "Investors", icon: UserCircle2, resource: "investors" },
  { href: "/properties", label: "Properties", icon: Building2, resource: "properties" },
  { href: "/developments", label: "Developments", icon: Landmark, resource: "developments" },
  { href: "/coming-soon", label: "Coming soon", icon: Clock, resource: "content" },
  { href: "/enquiries", label: "Enquiries", icon: MessageSquare, resource: "enquiries" },
  { href: "/signals", label: "Intent Signals", icon: Radar, resource: "signals" },
  { href: "/assumptions", label: "Calculations & Assumptions", icon: Calculator, resource: "assumptions" },
  { href: "/calculator", label: "Calculator", icon: Layers, resource: "investor_journey" },
  { href: "/users", label: "Users & Roles", icon: Users, resource: "users" },
  { href: "/activity", label: "Activity Log", icon: Activity, resource: "activity" },
];

function NavLinks({
  onNavigate,
  pathname,
  collapsed,
}: {
  onNavigate?: () => void;
  pathname: string;
  collapsed?: boolean;
}) {
  const { canAccessNav } = useAuth();
  return (
    <nav className={cn("flex flex-col gap-1", collapsed ? "px-1.5" : "px-2")}>
      {navItems
        .filter((item) => canAccessNav(item.resource))
        .map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-label={item.label}
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
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!collapsed) return <div key={item.href}>{link}</div>;

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
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
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

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
          <SidebarBrand collapsed={collapsed} />
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
          <NavLinks pathname={location} collapsed={collapsed} />
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
              <SidebarBrand />
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
              <NavLinks pathname={location} onNavigate={() => setMobileOpen(false)} />
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
              <span className="sm:hidden">Joseph Mews Admin</span>
              <span className="hidden sm:inline">
                Operational control for the Joseph Mews Investor Platform
              </span>
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
