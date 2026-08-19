"use client";

// ** core
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";

// ** assets / icons
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  ClipboardCheck,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNotifications } from "@/components/NotificationProvider";
import TheThemes from "@/components/themes";
import { PWAInstallButton } from "@/components/pwa-install-button";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useNavProgress } from "@/lib/navigation-context";
import { cn } from "@/lib/utils";
import { isNavItemActive, NAV_STUCK_FALLBACK_MS } from "@/lib/nav-utils";
import { version } from "@/package.json";

type NavConfig = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const NAV_CONFIGS: NavConfig[] = [
  { href: "/dashboard",            label: "ໜ້າຫຼັກ",       icon: LayoutDashboard },
  { href: "/dashboard/profile",    label: "ຂໍ້ມູນສ່ວນຕົວ", icon: User            },
  { href: "/dashboard/attendance", label: "Check-In/Out",   icon: Clock           },
  { href: "/dashboard/request",    label: "ແບບຟອມ",         icon: FileText        },
  { href: "/dashboard/approv",     label: "ການອະນຸມັດ",     icon: ClipboardCheck  },
  { href: "/dashboard/history",    label: "ປະຫວັດ",         icon: History         },
];

function formatDepartment(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const department = typeof obj.department === "string" ? obj.department : "";
    const title = typeof obj.title === "string" ? obj.title : "";
    if (department && title) return `${department} (${title})`;
    return department || title || "-";
  }
  return String(value);
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { startNavigation } = useNavProgress();
  const { notifications } = useNotifications();

  const canApprove = useMemo(
    () =>
      (user?.rolePermissions?.approveBranch ?? false) ||
      (user?.rolePermissions?.approveDepartment ?? false),
    [user?.rolePermissions?.approveBranch, user?.rolePermissions?.approveDepartment],
  );

  const initials = useMemo(
    () =>
      user
        ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
        : "U",
    [user?.firstName, user?.lastName],
  );

  const profileImage = useMemo(() => {
    if (!user) return "/info/woman.jpg";
    return (
      user.profileImage ||
      user.photo3x4Url ||
      user.avatar ||
      (user.gender?.toLowerCase() === "male" ? "/info/man.jpg" : "/info/woman.jpg")
    );
  }, [user?.profileImage, user?.photo3x4Url, user?.avatar, user?.gender]);

  const fullName = useMemo(
    () => `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
    [user?.firstName, user?.lastName],
  );

  const dept = user?.department;
  const deptString   = typeof dept === "string" ? dept : "";
  const deptObjName  = dept && typeof dept === "object"
    ? ((dept as Record<string, unknown>).department as string | undefined) ?? ""
    : "";
  const deptObjTitle = dept && typeof dept === "object"
    ? ((dept as Record<string, unknown>).title as string | undefined) ?? ""
    : "";

  const departmentLabel = useMemo(
    () => formatDepartment(user?.department),
    [deptString, deptObjName, deptObjTitle],
  );

  const notifCount = notifications.length;

  // Warms the router cache for every nav destination so router.push() below
  // resolves fast enough to beat handleNavClick's 2s stuck-navigation
  // fallback — without this, an un-prefetched route's JS chunk can take
  // longer than 2s to fetch, which was triggering a hard window.location
  // reload on essentially every first visit to a route each session.
  // NOTE: router.prefetch() was tried here to speed up navigation, but on the
  // static-export production build it makes a request Next.js's router
  // expects an RSC-differential response for — something a pure static host
  // never serves — and the aborted prefetch left the router unable to later
  // push() to that same href at all (confirmed: production build, live
  // tested against the actual `out/` export). Do not reintroduce prefetch
  // here without confirming it against a static-export build, not `next dev`.

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const activeHref = pendingHref ?? pathname;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Holds the stuck-navigation fallback timer so a second nav click can
  // cancel the previous click's timer — otherwise clicking two different
  // nav items within 2s left the first click's timer alive; it would fire
  // against its own now-stale href, see the (correctly-updated) pathname
  // no longer matches it, and force a hard window.location reload back to
  // the FIRST destination even though the second navigation had already
  // succeeded.
  const navFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const href = e.currentTarget.dataset.href!;
    if (isNavItemActive(pathnameRef.current, href)) return;
    if (navFallbackTimeoutRef.current) clearTimeout(navFallbackTimeoutRef.current);
    setPendingHref(href);
    startNavigation();
    router.push(href);
    navFallbackTimeoutRef.current = setTimeout(() => {
      if (!isNavItemActive(pathnameRef.current, href)) {
        window.location.href = href;
      }
    }, NAV_STUCK_FALLBACK_MS);
  }, [router, startNavigation]);

  const navItems = useMemo(
    () =>
      NAV_CONFIGS.map((cfg) => ({
        ...cfg,
        show: cfg.href === "/dashboard/approv" ? canApprove : true,
        badge: cfg.href === "/dashboard/approv" ? notifCount : undefined,
      })),
    [canApprove, notifCount],
  );

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg text-sidebar-primary-foreground overflow-hidden">
          <img
            src="/SSMI.svg"
            alt="SSMI Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="font-semibold">HRM Portal</span>
        <div className="ml-auto">
          <TheThemes color="bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground" />
        </div>
      </div>

      {/* User info */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={profileImage}
              alt={fullName}
              className="object-cover"
            />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {fullName}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {departmentLabel}
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          if (!item.show) return null;

          const isActive = isNavItemActive(activeHref, item.href);

          const badgeCount = item.badge ?? 0;

          return (
            <button
              key={item.href}
              type="button"
              data-href={item.href}
              onClick={handleNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </div>
              {badgeCount > 0 && (
                <span className="bg-red-500 text-white font-bold text-[11px] min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-2 flex items-center justify-center">
        <p className="text-xs text-sidebar-foreground/70" suppressHydrationWarning>V {version}</p>
      </div>

      {/* Install App */}
      <div className="px-3 pb-2">
        <PWAInstallButton className="w-full justify-start gap-3" />
      </div>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              <LogOut className="w-5 h-5" />
              ອອກຈາກລະບົບ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>ອອກຈາກລະບົບ</DialogTitle>
              <DialogDescription>
                ທ່ານແນ່ໃຈບໍ່ ທີ່ຈະອອກຈາກລະບົບ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">ຍົກເລີກ</Button>
              </DialogClose>
              <Button onClick={logout}>ອອກຈາກລະບົບ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
