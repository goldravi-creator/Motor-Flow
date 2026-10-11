import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isSuperAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <AdminSidebar>
      <Outlet />
    </AdminSidebar>
  );
}

function AdminSidebar({ children }: { children: React.ReactNode }) {
  const NAV = [
    { to: "/admin", label: "Overview", icon: "LayoutDashboard" },
    { to: "/admin/organizations", label: "Organizations", icon: "Building2" },
    { to: "/admin/users", label: "All Users", icon: "Users" },
    { to: "/admin/leads", label: "All Leads", icon: "Users" },
    { to: "/admin/payments", label: "All Payments", icon: "Wallet" },
    { to: "/admin/audit-logs", label: "Audit Logs", icon: "ScrollText" },
  ] as const;

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive">
            <svg className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">MotorFlow Admin</p>
            <p className="text-[11px] text-sidebar-foreground/60">Superadmin Panel</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <a
              key={item.to}
              href={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <span className="h-4 w-4">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
          <span className="text-lg font-semibold">Superadmin Dashboard</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}