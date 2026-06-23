"use client";

// ** core
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

// ** assets / icons
import {
  LayoutDashboard,
  User,
  Clock,
  FileText,
  History,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
} from "lucide-react";

// ** shared components
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { PWAInstallButton } from "../pwa-install-button";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useNavProgress } from "@/lib/navigation-context";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-utils";
import { version } from "@/package.json";

const NAV_STYLE = {
  WebkitUserSelect: "none" as const,
  WebkitTouchCallout: "none" as const,
};

type NavConfig = {
  href: string;
  label: string;
  menuLabel?: string;
  icon: React.ElementType;
  inBottomBar: boolean;
};

type NavItem = NavConfig & {
  show: boolean;
  badge?: number;
};

const MOBILE_NAV_CONFIGS: NavConfig[] = [
  { href: "/dashboard",            label: "ໜ້າຫຼັກ",       icon: LayoutDashboard, inBottomBar: true  },
  { href: "/dashboard/history",    label: "ປະຫວັດ",        icon: History,         inBottomBar: true  },
  { href: "/dashboard/attendance", label: "Check-In",      menuLabel: "Check-In / Check-Out", icon: Clock, inBottomBar: true  },
  { href: "/dashboard/approv",     label: "ການອະນຸມັດ",    icon: ClipboardCheck,  inBottomBar: true  },
  { href: "/dashboard/profile",    label: "ຂໍ້ມູນສ່ວນຕົວ", icon: User,            inBottomBar: true  },
  { href: "/dashboard/request",    label: "ແບບຟອມ",        icon: FileText,        inBottomBar: false },
];

const MOBILE_PREFETCH_HREFS = MOBILE_NAV_CONFIGS.map((c) => c.href);

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const { startNavigation } = useNavProgress();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const lastScrollYRef = useRef(0);

  const activeHref = pendingHref ?? pathname;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const canApprove = useMemo(
    () =>
      (user?.rolePermissions?.approveBranch ?? false) ||
      (user?.rolePermissions?.approveDepartment ?? false),
    [user?.rolePermissions?.approveBranch, user?.rolePermissions?.approveDepartment],
  );

  const notifCount = notifications.length;

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const href = e.currentTarget.dataset.href!;
    if (isNavItemActive(pathnameRef.current, href)) return;
    setPendingHref(href);
    startNavigation();
    router.push(href);
    setTimeout(() => {
      if (!isNavItemActive(pathnameRef.current, href)) {
        window.location.href = href;
      }
    }, 2000);
  }, [router, startNavigation]);

  const handleMenuClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const href = e.currentTarget.dataset.href!;
    if (!isNavItemActive(pathnameRef.current, href)) {
      setPendingHref(href);
      startNavigation();
      router.push(href);
    }
    setSheetOpen(false);
  }, [router, startNavigation]);

  const allNavItems = useMemo<NavItem[]>(
    () =>
      MOBILE_NAV_CONFIGS.map((cfg) => ({
        ...cfg,
        show: cfg.href === "/dashboard/approv" ? canApprove : true,
        badge: cfg.href === "/dashboard/approv" ? notifCount : undefined,
      })),
    [canApprove, notifCount],
  );

  const bottomBarItems = useMemo(
    () => allNavItems.filter((i) => i.inBottomBar && i.show),
    [allNavItems],
  );

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollYRef.current) {
        setShowNav(true);
      } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
        setShowNav(false);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-60 bg-card border-t border-border select-none transition-transform duration-300",
          showNav ? "translate-y-0" : "translate-y-full",
        )}
        style={NAV_STYLE}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {bottomBarItems.map((item) => {
            const isActive = isNavItemActive(activeHref, item.href);
            return (
              <button
                key={item.href}
                type="button"
                data-href={item.href}
                onClick={handleNavClick}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground focus:text-foreground",
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {(item.badge ?? 0) > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white font-bold text-[9px] min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center border border-card shadow-sm">
                      {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className={cn(
          "fixed lg:hidden top-2 right-2 z-60 select-none flex items-center justify-center min-h-11 min-w-11 transition-opacity duration-300",
          showNav ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] select-none cursor-pointer text-muted-foreground hover:text-foreground focus:text-foreground relative"
            >
              {sheetOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
              {!sheetOpen && notifCount > 0 && canApprove && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border border-background animate-pulse" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>ເມນູ</SheetTitle>
            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-2 px-4">
              <TheThemes />

              {allNavItems.map((item) => {
                if (!item.show) return null;
                const isActive = isNavItemActive(activeHref, item.href);
                return (
                  <button
                    key={item.href}
                    type="button"
                    data-href={item.href}
                    onClick={handleMenuClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.menuLabel ?? item.label}
                    </div>
                    {(item.badge ?? 0) > 0 && (
                      <span className="bg-red-500 text-white font-bold text-[11px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                        {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">V {version}</p>
            </div>
            <div className="px-3 pb-2">
              <PWAInstallButton className="w-full justify-start gap-3" />
            </div>
            <SheetFooter className="pb-20 lg:pb-4">
              <SheetClose asChild>
                <Button variant="outline">ປິດ</Button>
              </SheetClose>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-3 text-destructive hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  >
                    <LogOut className="w-5 h-5" />
                    ອອກຈາກລະບົບ
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>ອອກຈາກລະບົບ</DialogTitle>
                    <DialogDescription>ທ່ານແນ່ໃຈບໍ່ ທີ່ຈະອອກຈາກລະບົບ?</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">ຍົກເລີກ</Button>
                    </DialogClose>
                    <Button onClick={logout}>ອອກຈາກລະບົບ</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
