export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  active: boolean;
}

export interface Lead {
  id: string;
  lead_uid: string;
  product: "insurance" | "loan";
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  source: string;
  campaign: string | null;
  status: string;
  ai_status: string;
  whatsapp_status: string;
  call_status: string;
  automation_status: string;
  priority: string;
  lead_score: number;
  assigned_to: string | null;
  customer_id: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vehicle_year: number | null;
  fuel_type: string | null;
  current_insurer: string | null;
  policy_expiry: string | null;
  coverage_type: string | null;
  employment_type: string | null;
  monthly_income: number | null;
  loan_amount: number | null;
  down_payment: number | null;
  tenure_months: number | null;
  whatsapp_consent: boolean;
  call_consent: boolean;
  do_not_contact: boolean;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  actor: string;
  created_at: string;
}

export interface Note {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string | null;
  title: string;
  task_type: string;
  assigned_to: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

export const INSURANCE_STATUSES = [
  "new",
  "ai_contacting",
  "contacted",
  "follow_up",
  "qualified",
  "quotation_required",
  "quotation_sent",
  "negotiation",
  "documents_required",
  "payment_pending",
  "converted",
  "policy_issued",
] as const;

export const LOAN_STATUSES = [
  "new",
  "ai_contacting",
  "contacted",
  "follow_up",
  "qualified",
  "eligibility_check",
  "documents_required",
  "application_created",
  "application_submitted",
  "bank_review",
  "approved",
  "sanctioned",
  "disbursement_pending",
  "disbursed",
  "converted",
] as const;

export const CLOSED_STATUSES = ["not_interested", "invalid", "duplicate", "lost"];
