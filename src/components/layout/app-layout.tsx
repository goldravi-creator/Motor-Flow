import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  IndianRupee,
  CalendarClock,
  Contact,
  LogOut,
  Search,
  Car,
  Bot,
  FileText,
  ClipboardList,
  FileStack,
  Wallet,
  BarChart3,
  UsersRound,
  Plug,
  ScrollText,
  Building2,
  Lock,
} from "lucide-react";
import { NotificationBell } from "@/lib/notifications";
import { useProduct, type Product } from "@/lib/product";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  product?: Product;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/insurance", label: "Insurance", icon: ShieldCheck, product: "insurance" },
  { to: "/loans", label: "Car Loan", icon: IndianRupee, product: "loan" },
  { to: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { to: "/automation", label: "AI Automation", icon: Bot },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/applications", label: "Applications", icon: ClipboardList, product: "loan" },
  { to: "/documents", label: "Documents", icon: FileStack },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/customers", label: "Customers", icon: Contact },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText },
] as const;

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/admin/organizations", label: "Organizations", icon: Building2, adminOnly: true },
  { to: "/admin/users", label: "All Users", icon: Users, adminOnly: true },
  { to: "/admin/leads", label: "All Leads", icon: Users, adminOnly: true },
  { to: "/admin/payments", label: "All Payments", icon: Wallet, adminOnly: true },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, adminOnly: true },
] as const;

function LockedTab({ product, label }: { product: Product; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/40 cursor-not-allowed opacity-60">
      <Lock className="h-4 w-4 text-destructive/50" />
      <span>{label}</span>
      <span className="ml-auto text-xs text-destructive/50 font-medium">LOCKED</span>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { product, setProduct } = useProduct();
  const { 
    isSuperAdmin, 
    isClientAdmin, 
    isTeamLeader, 
    organizationId, 
    loading: authLoading,
    hasInsuranceAccess,
    hasLoanAccess,
  } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    navigate({ to: "/leads", search: { q } });
  }

  const { data: orgName } = useQuery({
    queryKey: ["my-organization", organizationId],
    enabled: !!organizationId && !authLoading,
    queryFn: async () => {
      if (!organizationId) return null;
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();
      return data?.name ?? null;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Filter navigation based on product access
  const getFilteredNav = (nav: NavItem[]) => {
    if (isSuperAdmin) return nav;
    return nav.filter(item => {
      // Hide Team menu for telecallers
      if (item.to === "/team" && !isClientAdmin && !isTeamLeader) return false;
      // Filter by product access
      if (item.product === "insurance" && !hasInsuranceAccess) return false;
      if (item.product === "loan" && !hasLoanAccess) return false;
      // Admin only items
      if (item.adminOnly && !isSuperAdmin) return false;
      return true;
    });
  };

  const currentNav = isSuperAdmin && pathname.startsWith("/admin") 
    ? getFilteredNav(ADMIN_NAV) 
    : getFilteredNav(NAV);
  const isAdminRoute = pathname.startsWith("/admin");

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="flex h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Determine available products for switcher
  const availableProducts: Product[] = [];
  if (hasInsuranceAccess) availableProducts.push("insurance");
  if (hasLoanAccess) availableProducts.push("loan");

  // Auto-switch product if current product not available
  if (!availableProducts.includes(product)) {
    setProduct(availableProducts[0] || "insurance");
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Car className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">
              {isAdminRoute ? "MotorFlow Admin" : "MotorFlow"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">
              {isAdminRoute ? "Superadmin Panel" : "Insurance & Loans CRM"}
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {currentNav.map((item) => {
            const active =
              item.to === "/dashboard" || item.to === "/admin"
                ? pathname === "/dashboard" || pathname === "/" || pathname === "/admin"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Locked tabs for unauthorized products */}
          {!isSuperAdmin && !isAdminRoute && (
            <>
              {!hasInsuranceAccess && (
                <LockedTab product="insurance" label="Insurance" />
              )}
              {!hasLoanAccess && (
                <LockedTab product="loan" label="Car Loan" />
              )}
              {!hasLoanAccess && (
                <LockedTab product="loan" label="Applications" />
              )}
            </>
          )}
        </nav>
        {!isAdminRoute && (
          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
        {isAdminRoute && (
          <div className="border-t border-sidebar-border p-3">
            <Link
              to="/dashboard"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <Car className="h-4 w-4" />
              Back to CRM
            </Link>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
          {/* Business switcher - only show available products */}
          {!isAdminRoute && availableProducts.length > 1 && (
            <div className="flex rounded-lg border border-border bg-muted p-1">
              {availableProducts.map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                    product === p
                      ? p === "insurance"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-success text-success-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "insurance" ? "CAR INSURANCE" : "CAR LOAN"}
                </button>
              ))}
            </div>
          )}

          {!isAdminRoute && availableProducts.length === 1 && (
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              {availableProducts[0] === "insurance" ? "CAR INSURANCE" : "CAR LOAN"}
            </span>
          )}

          {orgName && (
            <span className="hidden max-w-48 truncate text-sm font-medium text-muted-foreground sm:block">
              {orgName}
            </span>
          )}
          
          {isAdminRoute && (
            <span className="hidden max-w-48 truncate text-sm font-medium text-destructive sm:block">
              SUPERADMIN MODE
            </span>
          )}

          {!isAdminRoute && (
            <form onSubmit={submitSearch} className="relative ml-auto hidden w-80 md:flex">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search leads, phone, vehicle…"
                className="h-9 w-full rounded-l-lg border border-r-0 border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                aria-label="Search leads"
                title="Search leads"
                className="flex h-9 items-center rounded-r-lg border border-input bg-primary px-3 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          )}
          <NotificationBell />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {isSuperAdmin ? "SA" : "RS"}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}