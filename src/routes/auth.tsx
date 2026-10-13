import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, IndianRupee, Check } from "lucide-react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MotorFlow CRM" },
      { name: "description", content: "Sign in to the MotorFlow car insurance and car loan CRM." },
      { property: "og:title", content: "Sign in — MotorFlow CRM" },
      { property: "og:description", content: "Sign in to the MotorFlow car insurance and car loan CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [productAccess, setProductAccess] = useState<"insurance" | "loan" | "both" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const productOptions = [
    { value: "insurance", label: "Car Insurance", icon: Shield, desc: "Car insurance leads, quotations, policies" },
    { value: "loan", label: "Car Loan", icon: IndianRupee, desc: "Car loan leads, applications, disbursements" },
    { value: "both", label: "Both Products", icon: Check, desc: "Full access to Insurance & Car Loan" },
  ] as const;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    
    if (mode === "signup" && !productAccess) {
      setError("Please select a product");
      return;
    }
    
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        // Sign up: create auth user, then create organization + member
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        
        if (authData.user) {
          // Create organization and member via RPC (bypasses RLS)
          const { error: orgError } = await supabase.rpc('create_organization_for_user', {
            p_user_id: authData.user.id,
            p_org_name: companyName.trim() || `${fullName}'s Workspace`,
            p_user_full_name: fullName,
            p_user_email: email,
            p_product_access: productAccess,
          });
          if (orgError) throw orgError;
        }
        
        setNotice("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err?.message || err?.details || typeof err === 'string' ? err : JSON.stringify(err)) || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary">
            <Car className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-sidebar-foreground">MotorFlow CRM</h1>
          <p className="mt-1 text-sm text-sidebar-foreground/60">
            Car Insurance & Car Loan sales platform
          </p>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex rounded-lg bg-muted p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Full name</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ravi Sharma"
              />
            </label>
          )}
          {mode === "signup" && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Company name</span>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your company — gets its own private workspace"
              />
            </label>
          )}
          {mode === "signup" && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Product</span>
              <Select value={productAccess} onValueChange={setProductAccess as any}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product access" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Password</span>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {notice && (
            <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}