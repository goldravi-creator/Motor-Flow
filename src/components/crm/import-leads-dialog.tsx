"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { read, utils } from "xlsx";
import { Upload, FileSpreadsheet, Users, User, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/product";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

// Maps accepted spreadsheet headers (lowercased, stripped) to lead columns.
const HEADER_MAP: Record<string, string> = {
  name: "full_name",
  fullname: "full_name",
  customername: "full_name",
  phone: "phone",
  mobile: "phone",
  phonenumber: "phone",
  email: "email",
  city: "city",
  state: "state",
  source: "source",
  campaign: "campaign",
  priority: "priority",
  reg: "vehicle_reg",
  registration: "vehicle_reg",
  vehiclereg: "vehicle_reg",
  make: "vehicle_make",
  vehiclemake: "vehicle_make",
  model: "vehicle_model",
  vehiclemodel: "vehicle_model",
  variant: "vehicle_variant",
  year: "vehicle_year",
  fuel: "fuel_type",
  fueltype: "fuel_type",
  insurer: "current_insurer",
  currentinsurer: "current_insurer",
  policyexpiry: "policy_expiry",
  expiry: "policy_expiry",
  coverage: "coverage_type",
  coveragetype: "coverage_type",
  employment: "employment_type",
  employmenttype: "employment_type",
  income: "monthly_income",
  monthlyincome: "monthly_income",
  loanamount: "loan_amount",
  amount: "loan_amount",
  downpayment: "down_payment",
  tenure: "tenure_months",
  tenurermonths: "tenure_months",
};

const NUMERIC = new Set(["vehicle_year", "monthly_income", "loan_amount", "down_payment", "tenure_months"]);

interface ParsedRow {
  values: Record<string, string>;
  error?: string;
  assignedTo?: string; // member_id to assign to
}

interface TeamMember {
  id: string;
  profile_id: string;
  full_name: string;
  org_role: string;
}

function parseRows(json: Record<string, unknown>[]): { rows: ParsedRow[]; mappedHeaders: string[] } {
  const mapped = new Set<string>();
  const rows: ParsedRow[] = json.map((raw) => {
    const values: Record<string, string> = {};
    for (const [header, val] of Object.entries(raw)) {
      const key = header.toLowerCase().replace(/[^a-z]/g, "");
      const col = HEADER_MAP[key];
      if (!col || val == null || String(val).trim() === "") continue;
      mapped.add(col);
      values[col] = String(val).trim();
    }
    if (!values["full_name"] || !values["phone"]) {
      return { values, error: "Missing name or phone" };
    }
    // Validate phone
    const phone = values["phone"].replace(/\D/g, "");
    if (phone.length !== 10) {
      return { values, error: "Phone must be 10 digits" };
    }
    values["phone"] = phone;
    // Validate email if provided
    if (values["email"] && !isValidEmail(values["email"])) {
      return { values, error: "Invalid email format" };
    }
    return { values };
  });
  return { rows, mappedHeaders: [...mapped] };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10;
}

export function ImportLeadsDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { isClientAdmin, isTeamLeader, orgMemberId, organizationId, userId } = useAuth();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [defaultAssignee, setDefaultAssignee] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignMode, setAssignMode] = useState<"round_robin" | "single" | "self">("round_robin");

  const canAssign = isClientAdmin || isTeamLeader;

  // Fetch team members for assignment
  useState(() => {
    if (canAssign && organizationId) {
      supabase
        .from("organization_members")
        .select("id, profile_id, profiles!inner(full_name), org_role")
        .eq("organization_id", organizationId)
        .in("org_role", ["team_leader", "telecaller"])
        .then(({ data }) => {
          if (data) setTeamMembers(data as unknown as TeamMember[]);
        });
    }
  }, [canAssign, organizationId]);

  const valid = rows.filter((r) => !r.error);
  const skipped = rows.filter((r) => r.error);

  async function handleFile(file: File) {
    setDone(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("empty sheet");
      const json = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const { rows: parsed } = parseRows(json);
      setRows(parsed);
      if (parsed.length === 0) toast.error("No rows found in the first sheet.");
    } catch {
      toast.error("Could not read that file. Use .csv or .xlsx.");
      setRows([]);
    }
  }

  async function importRows() {
    setImporting(true);
    try {
      const prefix = product === "insurance" ? "INS-" : "LON-";
      const { data: existing } = await supabase.from("leads").select("lead_uid").eq("product", product);
      let next = (existing ?? []).reduce((m, r) => {
        const n = parseInt(String(r.lead_uid).replace(prefix, ""), 10);
        return Number.isNaN(n) ? m : Math.max(m, n);
      }, product === "insurance" ? 1000 : 2000);

      const source = fileName.toLowerCase().endsWith(".csv") ? "csv" : "excel";
      const payload = valid.map((r, index) => {
        next += 1;
        
        // Determine assignee
        let assigneeId = userId; // default to self
        if (canAssign) {
          if (assignMode === "single" && defaultAssignee) {
            const member = teamMembers.find(m => m.id === defaultAssignee);
            assigneeId = member?.profile_id || userId;
          } else if (assignMode === "round_robin" && teamMembers.length > 0) {
            const member = teamMembers[index % teamMembers.length];
            assigneeId = member.profile_id;
          }
        }

        const row: Record<string, unknown> = {
          lead_uid: `${prefix}${next}`,
          product,
          status: "new",
          source: r.values["source"]?.toLowerCase() || source,
          full_name: r.values["full_name"],
          phone: r.values["phone"],
          assigned_to: assigneeId,
          organization_id: organizationId,
        };
        for (const [col, val] of Object.entries(r.values)) {
          if (["full_name", "phone", "source"].includes(col)) continue;
          row[col] = NUMERIC.has(col) ? Number(val.replace(/[^0-9.]/g, "")) || null : val;
        }
        return row;
      });

      const { error } = await supabase.from("leads").insert(payload as never);
      if (error) throw error;
      
      const assignedCount = payload.filter(p => p.assigned_to !== userId).length;
      const selfCount = payload.length - assignedCount;
      
      let message = `Imported ${valid.length} leads`;
      if (assignedCount > 0) message += ` (${assignedCount} assigned to team)`;
      if (selfCount > 0) message += ` (${selfCount} to you)`;
      
      setDone(message);
      setRows([]);
      setFileName("");
      queryClient.invalidateQueries({ queryKey: ["leads", product] });
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setDone(null);
    setDefaultAssignee("");
    setAssignMode("round_robin");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {product === "insurance" ? "insurance" : "loan"} leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. Recognised columns include
            name, phone, email, city, state, source, reg, make, model, year, fuel
            {product === "insurance"
              ? ", insurer, policy expiry, coverage"
              : ", employment, income, loan amount, down payment, tenure"}
            . Name and phone are required. Phone must be 10 digits. Email must be valid format.
          </p>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/40">
            <Upload className="h-6 w-6" />
            {fileName ? (
              <span className="flex items-center gap-2 font-medium text-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {fileName}
              </span>
            ) : (
              "Click to choose a file"
            )}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>

          {canAssign && teamMembers.length > 0 && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <Label className="font-medium">Assign leads to team</Label>
              <Select value={assignMode} onValueChange={v => setAssignMode(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Round-robin (distribute evenly)
                    </span>
                  </SelectItem>
                  <SelectItem value="single">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Assign all to one member
                    </span>
                  </SelectItem>
                  <SelectItem value="self">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Keep all for yourself
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {assignMode === "single" && (
                <Select value={defaultAssignee} onValueChange={v => setDefaultAssignee(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} ({m.org_role === "team_leader" ? "TL" : "TC"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <p className="text-xs text-muted-foreground">
                {assignMode === "round_robin" 
                  ? `Leads will be distributed evenly among ${teamMembers.length} team member(s)`
                  : assignMode === "single" && defaultAssignee
                    ? `All leads will be assigned to ${teamMembers.find(m => m.id === defaultAssignee)?.full_name}`
                    : "You will handle all imported leads yourself"
                }
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <p>
                  <strong>{valid.length}</strong> valid rows
                  {skipped.length > 0 && (
                    <span className="text-destructive ml-2"> · {skipped.length} skipped</span>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[600px] text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">City</th>
                      <th className="px-3 py-2 font-medium">Vehicle</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.values["full_name"] ?? "—"}</td>
                        <td className="px-3 py-2">{r.values["phone"] ?? "—"}</td>
                        <td className="px-3 py-2">{r.values["email"] ?? "—"}</td>
                        <td className="px-3 py-2">{r.values["city"] ?? "—"}</td>
                        <td className="px-3 py-2">
                          {[r.values["vehicle_make"], r.values["vehicle_model"]].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.error ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" /> {r.error}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle className="h-3 w-3" /> Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">…and {rows.length - 10} more rows</p>
                )}
              </div>
            </>
          )}

          {done && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">{done}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
            >
              Close
            </Button>
            <Button
              disabled={valid.length === 0 || importing}
              onClick={importRows}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importing…
                </>
              ) : (
                `Import ${valid.length} leads`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}