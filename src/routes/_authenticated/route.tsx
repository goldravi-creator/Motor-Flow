import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductProvider } from "@/lib/product";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationProvider } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
      } else {
        setReady(true);
      }
    });
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <ProductProvider>
          <AppLayout>
            <Outlet />
          </AppLayout>
        </ProductProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}