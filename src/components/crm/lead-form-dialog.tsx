import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Profile } from "@/lib/crm-types";
import type { Product } from "@/lib/product";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { label } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SOURCES = ["manual", "meta", "google", "website", "referral", "csv", "excel", "api"];
const PRIORITIES = ["low", "medium", "high"];
const FUELS = ["petrol", "diesel", "cng", "electric", "hybrid"];
const COVERAGES = ["comprehensive", "third_party", "own_damage"];
const EMPLOYMENT = ["salaried", "self_employed", "business"];

interface FormState {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  source: string;
  campaign: string;
  priority: string;
  assigned_to: string;
  vehicle_reg: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant: string;
  vehicle_year: string;
  fuel_type: string;
  current_insurer: string;
  policy_expiry: string;
  coverage_type: string;
  employment_type: string;
  monthly_income: string;
  loan_amount: string;
  down_payment: string;
  tenure_months: string;
}

const EMPTY: FormState = {
  full_name: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  source: "manual",
  campaign: "",
  priority: "medium",
  assigned_to: "",
  vehicle_reg: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_variant: "",
  vehicle_year: "",
  fuel_type: "",
  current_insurer: "",
  policy_expiry: "",
  coverage_type: "",
  employment_type: "",
  monthly_income: "",
  loan_amount: "",
  down_payment: "",
  tenure_months: "",
};

interface FormErrors {
  phone?: string;
  email?: string;
}

function fromLead(l: Lead): FormState {
  return {
    full_name: l.full_name,
    phone: l.phone,
    email: l.email ?? "",
    city: l.city ?? "",
    state: l.state ?? "",
    source: l.source,
    campaign: l.campaign ?? "",
    priority: l.priority,
    assigned_to: l.assigned_to ?? "",
    vehicle_reg: l.vehicle_reg ?? "",
    vehicle_make: l.vehicle_make ?? "",
    vehicle_model: l.vehicle_model ?? "",
    vehicle_variant: l.vehicle_variant ?? "",
    vehicle_year: l.vehicle_year?.toString() ?? "",
    fuel_type: l.fuel_type ?? "",
    current_insurer: l.current_insurer ?? "",
    policy_expiry: l.policy_expiry ?? "",
    coverage_type: l.coverage_type ?? "",
    employment_type: l.employment_type ?? "",
    monthly_income: l.monthly_income?.toString() ?? "",
    loan_amount: l.loan_amount?.toString() ?? "",
    down_payment: l.down_payment?.toString() ?? "",
    tenure_months: l.tenure_months?.toString() ?? "",
  };
}

async function nextLeadUid(product: Product): Promise<string> {
  const prefix = product === "insurance" ? "INS-" : "LON-";
  const { data } = await supabase.from("leads").select("lead_uid").eq("product", product);
  const max = (data ?? []).reduce((m, r) => {
    const n = parseInt(String(r.lead_uid).replace(prefix, ""), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, product === "insurance" ? 1000 : 2000);
  return `${prefix}${max + 1}`;
}

function validatePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return undefined;
  if (digits.length !== 10) return "Phone must be 10 digits";
  if (!/^\d{10}$/.test(digits)) return "Phone must contain only numbers";
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return undefined;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Invalid email format";
  return undefined;
}

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function LeadFormDialog({
  product,
  lead,
  open,
  onOpenChange,
}: {
  product: Product;
  lead?: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const isEdit = Boolean(lead);

  useEffect(() => {
    if (open) setForm(lead ? fromLead(lead) : EMPTY);
    setErrors({});
  }, [open, lead]);

  const { data: agents = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("active", true);
      return (data ?? []) as Profile[];
    },
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    if (key === "phone") value = formatPhone(value);
    setForm((f) => ({ ...f, [key]: value }));
    
    // Clear error on change
    if (key === "phone" || key === "email") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const phoneError = validatePhone(form.phone);
    const emailError = validateEmail(form.email);
    if (phoneError) newErrors.phone = phoneError;
    if (emailError) newErrors.email = emailError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.phone.trim()) {
        throw new Error("Name and phone are required.");
      }
      if (!validateForm()) {
        throw new Error("Please fix validation errors");
      }
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        source: form.source,
        campaign: form.campaign.trim() || null,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        vehicle_reg: form.vehicle_reg.trim().toUpperCase() || null,
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_variant: form.vehicle_variant.trim() || null,
        vehicle_year: num(form.vehicle_year),
        fuel_type: form.fuel_type || null,
        current_insurer: product === "insurance" ? form.current_insurer.trim() || null : null,
        policy_expiry: product === "insurance" ? form.policy_expiry || null : null,
        coverage_type: product === "insurance" ? form.coverage_type || null : null,
        employment_type: product === "loan" ? form.employment_type || null : null,
        monthly_income: product === "loan" ? num(form.monthly_income) : null,
        loan_amount: product === "loan" ? num(form.loan_amount) : null,
        down_payment: product === "loan" ? num(form.down_payment) : null,
        tenure_months: product === "loan" ? num(form.tenure_months) : null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && lead) {
        const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
        if (error) throw error;
        await supabase.from("lead_activities").insert({
          lead_id: lead.id,
          activity_type: "updated",
          description: "Lead details updated",
          actor: "agent",
        });
        return lead.id;
      }

      const lead_uid = await nextLeadUid(product);
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...payload, lead_uid, product, status: "new" })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: data.id,
        activity_type: "created",
        description: `Lead ${lead_uid} created manually`,
        actor: "agent",
      });
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Lead updated" : "Lead added");
      queryClient.invalidateQueries({ queryKey: ["leads", product] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      if (lead) queryClient.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${lead!.lead_uid}` : `Add ${product === "insurance" ? "insurance" : "loan"} lead`}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Full name *</label>
                <Input value={form.full_name} onChange={set("full_name")} required placeholder="John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone *</label>
                <Input
                  value={form.phone}
                  onChange={set("phone")}
                  required
                  placeholder="9876543210"
                  maxLength={10}
                  onBlur={() => validateForm()}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.phone}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="john@example.com"
                  onBlur={() => validateForm()}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.email}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
                <Input value={form.city} onChange={set("city")} placeholder="Mumbai" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">State</label>
                <Input value={form.state} onChange={set("state")} placeholder="Maharashtra" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to</label>
                <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Campaign</label>
                <Input value={form.campaign} onChange={set("campaign")} placeholder="Diwali Campaign" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{label(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Registration</label>
                <Input value={form.vehicle_reg} onChange={set("vehicle_reg")} placeholder="MH12AB1234" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Make</label>
                <Input value={form.vehicle_make} onChange={set("vehicle_make")} placeholder="Maruti" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Model</label>
                <Input value={form.vehicle_model} onChange={set("vehicle_model")} placeholder="Swift" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Variant</label>
                <Input value={form.vehicle_variant} onChange={set("vehicle_variant")} placeholder="ZXI" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
                <Input type="number" value={form.vehicle_year} onChange={set("vehicle_year")} placeholder="2022" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Fuel</label>
                <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {FUELS.map((f) => (
                      <SelectItem key={f} value={f}>{label(f)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {product === "insurance" ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Policy</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Current insurer</label>
                  <Input value={form.current_insurer} onChange={set("current_insurer")} placeholder="HDFC Ergo" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Policy expiry</label>
                  <Input type="date" value={form.policy_expiry} onChange={set("policy_expiry")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Coverage sought</label>
                  <Select value={form.coverage_type} onValueChange={v => setForm(f => ({ ...f, coverage_type: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {COVERAGES.map((c) => (
                        <SelectItem key={c} value={c}>{label(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Employment</label>
                  <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {EMPLOYMENT.map((e2) => (
                        <SelectItem key={e2} value={e2}>{label(e2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Monthly income (₹)</label>
                  <Input type="number" value={form.monthly_income} onChange={set("monthly_income")} placeholder="50000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Loan amount (₹)</label>
                  <Input type="number" value={form.loan_amount} onChange={set("loan_amount")} placeholder="500000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Down payment (₹)</label>
                  <Input type="number" value={form.down_payment} onChange={set("down_payment")} placeholder="100000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tenure (months)</label>
                  <Input type="number" value={form.tenure_months} onChange={set("tenure_months")} placeholder="60" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add lead"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}