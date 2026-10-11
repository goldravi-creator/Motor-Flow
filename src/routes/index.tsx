import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MotorFlow CRM — Car Insurance & Car Loan Sales Platform" },
      {
        name: "description",
        content:
          "AI-powered CRM for car insurance and car loan sales teams: lead capture, qualification, WhatsApp, calling, follow-ups, quotations and conversions.",
      },
      { property: "og:title", content: "MotorFlow CRM — Car Insurance & Car Loan Sales Platform" },
      {
        property: "og:description",
        content:
          "AI-powered CRM for car insurance and car loan sales teams: lead capture, qualification, WhatsApp, calling, follow-ups, quotations and conversions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
