import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  MessageCircle,
  PhoneCall,
  Megaphone,
  Globe,
  Webhook,
  Plug,
  Settings2,
  Unplug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fmtDateTime, label } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — MotorFlow CRM" },
      { name: "description", content: "Connect WhatsApp, telephony and ad platforms." },
      { property: "og:title", content: "Integrations — MotorFlow CRM" },
      { property: "og:description", content: "Connect WhatsApp, telephony and ad platforms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

type Integration = {
  id: string;
  provider: string;
  display_name: string;
  status: string;
  config: Record<string, string>;
  connected_at: string | null;
  updated_at: string;
};

const PROVIDER_META: Record<
  string,
  { icon: typeof Plug; description: string; fields: { key: string; label: string; secret?: boolean }[] }
> = {
  whatsapp: {
    icon: MessageCircle,
    description: "Send and receive WhatsApp messages with leads from the CRM.",
    fields: [
      { key: "phone_number_id", label: "Phone number ID" },
      { key: "business_account_id", label: "Business account ID" },
      { key: "access_token", label: "Access token", secret: true },
      { key: "webhook_verify_token", label: "Webhook verify token", secret: true },
    ],
  },
  telephony: {
    icon: PhoneCall,
    description: "Power AI calling and agent click-to-call with your telephony provider.",
    fields: [
      { key: "provider_name", label: "Provider (e.g. Exotel, Twilio)" },
      { key: "account_sid", label: "Account SID" },
      { key: "auth_token", label: "Auth token", secret: true },
      { key: "caller_id", label: "Caller ID number" },
    ],
  },
  meta_ads: {
    icon: Megaphone,
    description: "Pull leads from Facebook & Instagram lead ads straight into the pipeline.",
    fields: [
      { key: "ad_account_id", label: "Ad account ID" },
      { key: "page_id", label: "Facebook page ID" },
      { key: "access_token", label: "Access token", secret: true },
    ],
  },
  google_ads: {
    icon: Globe,
    description: "Import leads from Google Ads lead-form extensions and track campaigns.",
    fields: [
      { key: "customer_id", label: "Customer ID" },
      { key: "developer_token", label: "Developer token", secret: true },
      { key: "client_id", label: "OAuth client ID" },
    ],
  },
  webhooks: {
    icon: Webhook,
    description: "Receive events from your website, landing pages and partner APIs.",
    fields: [
      { key: "endpoint_url", label: "Callback URL" },
      { key: "signing_secret", label: "Signing secret", secret: true },
    ],
  },
};

async function logAudit(action: string, entityId: string, metadata: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    user_id: auth.user?.id ?? null,
    action,
    entity: "integration_settings",
    entity_id: entityId,
    metadata,
  } as never);
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const [configuring, setConfiguring] = useState<Integration | null>(null);

  const { data: me } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { id: "", roles: [] as string[] };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      return { id: auth.user.id, roles: (data ?? []).map((r) => r.role as string) };
    },
  });
  const isAdmin = !!me && (me.roles.includes("super_admin") || me.roles.includes("admin"));

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .order("provider");
      if (error) throw error;
      return (data ?? []) as unknown as Integration[];
    },
  });

  const disconnect = useMutation({
    mutationFn: async (i: Integration) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("integration_settings")
        .update({
          status: "not_configured",
          config: {},
          connected_at: null,
          updated_by: auth.user?.id ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", i.id);
      if (error) throw error;
      await logAudit("integration_disconnected", i.id, { provider: i.provider });
    },
    onSuccess: () => {
      toast.success("Integration disconnected");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (me && !isAdmin) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Integrations hold API credentials, so only Admins and Super Admins can view or change
          them. Ask your admin to connect a provider.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect WhatsApp, telephony and ad platforms. Credentials are stored privately — only
          admins can see them.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading integrations…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((i) => {
            const meta = PROVIDER_META[i.provider] ?? {
              icon: Plug,
              description: "External service connection.",
              fields: [],
            };
            const Icon = meta.icon;
            const connected = i.status === "connected";
            return (
              <div
                key={i.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      connected
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {connected ? "Connected" : "Not configured"}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{i.display_name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {meta.description}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {connected && i.connected_at
                    ? `Connected ${fmtDateTime(i.connected_at)}`
                    : `Last updated ${fmtDateTime(i.updated_at)}`}
                </p>
                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    onClick={() => setConfiguring(i)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {connected ? "Reconfigure" : "Configure"}
                  </button>
                  {connected && (
                    <button
                      onClick={() => disconnect.mutate(i)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {configuring && (
        <ConfigureDialog
          integration={configuring}
          onClose={() => setConfiguring(null)}
          onDone={() => qc.invalidateQueries({ queryKey: ["integrations"] })}
        />
      )}
    </div>
  );
}

function ConfigureDialog({
  integration,
  onClose,
  onDone,
}: {
  integration: Integration;
  onClose: () => void;
  onDone: () => void;
}) {
  const meta = PROVIDER_META[integration.provider];
  const [values, setValues] = useState<Record<string, string>>({ ...integration.config });

  const save = useMutation({
    mutationFn: async (connect: boolean) => {
      const missing = (meta?.fields ?? []).filter((f) => !values[f.key]?.trim());
      if (connect && missing.length > 0) {
        throw new Error(`Fill in: ${missing.map((f) => f.label).join(", ")}`);
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("integration_settings")
        .update({
          config: values,
          status: connect ? "connected" : integration.status,
          connected_at: connect ? new Date().toISOString() : integration.connected_at,
          updated_by: auth.user?.id ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", integration.id);
      if (error) throw error;
      await logAudit(connect ? "integration_connected" : "integration_updated", integration.id, {
        provider: integration.provider,
      });
    },
    onSuccess: (_d, connect) => {
      toast.success(connect ? `${integration.display_name} connected` : "Settings saved");
      onClose();
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Configure {integration.display_name}</h2>
        <div className="space-y-3">
          {(meta?.fields ?? []).map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm font-medium">{f.label}</label>
              <input
                type={f.secret ? "password" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={label(f.key)}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Saved credentials are visible only to admins. Connecting marks the integration active for
          automations and lead imports.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => save.mutate(false)}
            disabled={save.isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={() => save.mutate(true)}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save & connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
