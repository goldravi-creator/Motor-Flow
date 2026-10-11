create type public.app_role as enum ('super_admin', 'admin', 'sales_manager', 'sales_agent', 'telecaller');
create type public.product_type as enum ('insurance', 'loan');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "authenticated_all" on public.profiles for all to authenticated using (true) with check (true);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "read own or admins" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'sales_agent')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product public.product_type not null,
  source text not null,
  status text not null default 'active',
  spend numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "authenticated_all" on public.campaigns for all to authenticated using (true) with check (true);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "authenticated_all" on public.customers for all to authenticated using (true) with check (true);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_uid text not null unique,
  product public.product_type not null,
  full_name text not null,
  phone text not null,
  email text,
  city text,
  state text,
  source text not null default 'manual',
  campaign text,
  status text not null default 'new',
  ai_status text not null default 'not_started',
  whatsapp_status text not null default 'not_sent',
  call_status text not null default 'not_called',
  automation_status text not null default 'AI NOT STARTED',
  priority text not null default 'medium',
  lead_score int not null default 0,
  assigned_to uuid references public.profiles(id),
  customer_id uuid references public.customers(id),
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  vehicle_year int,
  fuel_type text,
  current_insurer text,
  policy_expiry date,
  coverage_type text,
  employment_type text,
  monthly_income numeric,
  loan_amount numeric,
  down_payment numeric,
  tenure_months int,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  whatsapp_consent boolean not null default false,
  call_consent boolean not null default false,
  do_not_contact boolean not null default false,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "authenticated_all" on public.leads for all to authenticated using (true) with check (true);
create index leads_product_idx on public.leads (product);
create index leads_status_idx on public.leads (status);
create index leads_assigned_idx on public.leads (assigned_to);
create index leads_phone_idx on public.leads (phone);
create index leads_created_idx on public.leads (created_at desc);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  activity_type text not null,
  description text not null,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lead_activities to authenticated;
grant all on public.lead_activities to service_role;
alter table public.lead_activities enable row level security;
create policy "authenticated_all" on public.lead_activities for all to authenticated using (true) with check (true);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "authenticated_all" on public.notes for all to authenticated using (true) with check (true);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  task_type text not null default 'follow_up',
  assigned_to uuid references public.profiles(id),
  priority text not null default 'medium',
  due_date timestamptz,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "authenticated_all" on public.tasks for all to authenticated using (true) with check (true);
create index tasks_status_idx on public.tasks (status, due_date);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  direction text not null,
  body text not null,
  status text not null default 'sent',
  sender_type text not null default 'ai',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.whatsapp_messages to authenticated;
grant all on public.whatsapp_messages to service_role;
alter table public.whatsapp_messages enable row level security;
create policy "authenticated_all" on public.whatsapp_messages for all to authenticated using (true) with check (true);
create index whatsapp_messages_lead_idx on public.whatsapp_messages (lead_id, created_at);

create table public.call_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  agent_id uuid references public.profiles(id),
  call_type text not null default 'ai',
  status text not null default 'completed',
  duration_seconds int not null default 0,
  outcome text,
  summary text,
  sentiment text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.call_records to authenticated;
grant all on public.call_records to service_role;
alter table public.call_records enable row level security;
create policy "authenticated_all" on public.call_records for all to authenticated using (true) with check (true);
create index call_records_lead_idx on public.call_records (lead_id, created_at);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  product public.product_type not null,
  provider text,
  coverage text,
  premium numeric,
  idv numeric,
  loan_amount numeric,
  interest_rate numeric,
  tenure_months int,
  emi numeric,
  status text not null default 'draft',
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotations to authenticated;
grant all on public.quotations to service_role;
alter table public.quotations enable row level security;
create policy "authenticated_all" on public.quotations for all to authenticated using (true) with check (true);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  lender text,
  loan_amount numeric,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "authenticated_all" on public.applications for all to authenticated using (true) with check (true);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  doc_type text not null,
  file_name text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "authenticated_all" on public.documents for all to authenticated using (true) with check (true);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  amount numeric not null,
  method text,
  transaction_ref text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "authenticated_all" on public.payments for all to authenticated using (true) with check (true);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "authenticated_read" on public.audit_logs for select to authenticated using (true);
create policy "authenticated_insert" on public.audit_logs for insert to authenticated with check (true);

insert into public.profiles (id, full_name, email, phone, title) values
  ('a0000000-0000-4000-8000-000000000001', 'Ravi Sharma', 'ravi.sharma@motorflow.in', '+91 98200 10001', 'Sales Manager'),
  ('a0000000-0000-4000-8000-000000000002', 'Anjali Verma', 'anjali.verma@motorflow.in', '+91 98200 10002', 'Senior Sales Agent'),
  ('a0000000-0000-4000-8000-000000000003', 'Vikram Singh', 'vikram.singh@motorflow.in', '+91 98200 10003', 'Sales Agent'),
  ('a0000000-0000-4000-8000-000000000004', 'Priya Nair', 'priya.nair@motorflow.in', '+91 98200 10004', 'Telecaller'),
  ('a0000000-0000-4000-8000-000000000005', 'Amit Kulkarni', 'amit.kulkarni@motorflow.in', '+91 98200 10005', 'Sales Agent');

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'sales_manager'),
  ('a0000000-0000-4000-8000-000000000002', 'sales_agent'),
  ('a0000000-0000-4000-8000-000000000003', 'sales_agent'),
  ('a0000000-0000-4000-8000-000000000004', 'telecaller'),
  ('a0000000-0000-4000-8000-000000000005', 'sales_agent');

insert into public.campaigns (id, name, product, source, status, spend) values
  ('c0000000-0000-4000-8000-000000000001', 'Meta — Car Insurance Renewal Oct', 'insurance', 'meta', 'active', 45000),
  ('c0000000-0000-4000-8000-000000000002', 'Google — New Car Insurance', 'insurance', 'google', 'active', 62000),
  ('c0000000-0000-4000-8000-000000000003', 'Meta — Used Car Loan Fest', 'loan', 'meta', 'active', 38000),
  ('c0000000-0000-4000-8000-000000000004', 'Google — Instant Car Loan', 'loan', 'google', 'active', 54000),
  ('c0000000-0000-4000-8000-000000000005', 'Website — Organic Enquiries', 'insurance', 'website', 'active', 0);

insert into public.customers (id, full_name, phone, email, city, state) values
  ('ce000000-0000-4000-8000-000000000001', 'Suresh Menon', '+91 98450 22001', 'suresh.menon@gmail.com', 'Bengaluru', 'Karnataka'),
  ('ce000000-0000-4000-8000-000000000002', 'Lakshmi Iyer', '+91 98450 22002', 'lakshmi.iyer@gmail.com', 'Chennai', 'Tamil Nadu'),
  ('ce000000-0000-4000-8000-000000000003', 'Rajesh Khanna', '+91 98450 22003', 'rajesh.khanna@gmail.com', 'Mumbai', 'Maharashtra'),
  ('ce000000-0000-4000-8000-000000000004', 'Farah Khan', '+91 98450 22004', 'farah.khan@gmail.com', 'Hyderabad', 'Telangana'),
  ('ce000000-0000-4000-8000-000000000005', 'Manoj Tiwari', '+91 98450 22005', 'manoj.tiwari@gmail.com', 'Pune', 'Maharashtra'),
  ('ce000000-0000-4000-8000-000000000006', 'Geeta Reddy', '+91 98450 22006', 'geeta.reddy@gmail.com', 'Hyderabad', 'Telangana'),
  ('ce000000-0000-4000-8000-000000000007', 'Arun Prakash', '+91 98450 22007', 'arun.prakash@gmail.com', 'Kochi', 'Kerala'),
  ('ce000000-0000-4000-8000-000000000008', 'Simran Kaur', '+91 98450 22008', 'simran.kaur@gmail.com', 'Delhi', 'Delhi'),
  ('ce000000-0000-4000-8000-000000000009', 'Nitin Agarwal', '+91 98450 22009', 'nitin.agarwal@gmail.com', 'Jaipur', 'Rajasthan'),
  ('ce000000-0000-4000-8000-000000000010', 'Rekha Nair', '+91 98450 22010', 'rekha.nair@gmail.com', 'Kochi', 'Kerala');

insert into public.leads (id, lead_uid, product, full_name, phone, email, city, state, source, campaign, status, ai_status, whatsapp_status, call_status, automation_status, priority, lead_score, assigned_to, customer_id, vehicle_reg, vehicle_make, vehicle_model, vehicle_variant, vehicle_year, fuel_type, current_insurer, policy_expiry, coverage_type, whatsapp_consent, call_consent, last_contacted_at, next_follow_up_at, created_at) values
  ('1e000000-0000-4000-8000-000000000001', 'INS-1001', 'insurance', 'Aarav Mehta', '+91 98110 31001', 'aarav.mehta@gmail.com', 'Mumbai', 'Maharashtra', 'meta', 'Meta — Car Insurance Renewal Oct', 'converted', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 92, 'a0000000-0000-4000-8000-000000000002', 'ce000000-0000-4000-8000-000000000001', 'MH02 AB 1234', 'Hyundai', 'Creta', 'SX(O)', 2022, 'Petrol', 'HDFC Ergo', '2026-11-12', 'Comprehensive + Zero Dep', true, true, now() - interval '1 day', null, now() - interval '12 days'),
  ('1e000000-0000-4000-8000-000000000002', 'INS-1002', 'insurance', 'Priya Nair', '+91 98110 31002', 'priya.n@gmail.com', 'Kochi', 'Kerala', 'google', 'Google — New Car Insurance', 'policy_issued', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 88, 'a0000000-0000-4000-8000-000000000002', 'ce000000-0000-4000-8000-000000000002', 'KL07 CD 5678', 'Maruti Suzuki', 'Baleno', 'Zeta', 2023, 'Petrol', 'ICICI Lombard', '2026-10-28', 'Comprehensive', true, true, now() - interval '2 days', null, now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000003', 'INS-1003', 'insurance', 'Rohan Kulkarni', '+91 98110 31003', 'rohan.k@gmail.com', 'Pune', 'Maharashtra', 'meta', 'Meta — Car Insurance Renewal Oct', 'payment_pending', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 84, 'a0000000-0000-4000-8000-000000000003', null, 'MH12 EF 9012', 'Tata', 'Nexon', 'XZ+', 2021, 'Diesel', 'Bajaj Allianz', '2026-10-20', 'Comprehensive + Zero Dep', true, true, now() - interval '3 hours', now() + interval '4 hours', now() - interval '9 days'),
  ('1e000000-0000-4000-8000-000000000004', 'INS-1004', 'insurance', 'Sneha Iyer', '+91 98110 31004', 'sneha.iyer@gmail.com', 'Chennai', 'Tamil Nadu', 'website', 'Website — Organic Enquiries', 'documents_required', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 78, 'a0000000-0000-4000-8000-000000000002', null, 'TN09 GH 3456', 'Honda', 'City', 'VX', 2020, 'Petrol', 'New India Assurance', '2026-11-02', 'Comprehensive', true, true, now() - interval '1 day', now() + interval '1 day', now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000005', 'INS-1005', 'insurance', 'Vikram Malhotra', '+91 98110 31005', 'vikram.m@gmail.com', 'Delhi', 'Delhi', 'google', 'Google — New Car Insurance', 'negotiation', 'human_handoff', 'read', 'connected', 'HUMAN HANDOFF', 'high', 74, 'a0000000-0000-4000-8000-000000000003', null, 'DL01 IJ 7890', 'Kia', 'Seltos', 'HTX', 2022, 'Diesel', 'Go Digit', '2026-10-25', 'Comprehensive', true, true, now() - interval '5 hours', now() + interval '2 hours', now() - interval '7 days'),
  ('1e000000-0000-4000-8000-000000000006', 'INS-1006', 'insurance', 'Ananya Rao', '+91 98110 31006', 'ananya.rao@gmail.com', 'Bengaluru', 'Karnataka', 'meta', 'Meta — Car Insurance Renewal Oct', 'quotation_sent', 'completed', 'delivered', 'connected', 'AUTOMATION COMPLETED', 'high', 70, 'a0000000-0000-4000-8000-000000000005', null, 'KA03 KL 2345', 'Toyota', 'Innova Crysta', 'GX', 2021, 'Diesel', 'Tata AIG', '2026-11-15', 'Comprehensive', true, true, now() - interval '6 hours', now() + interval '1 day', now() - interval '6 days'),
  ('1e000000-0000-4000-8000-000000000007', 'INS-1007', 'insurance', 'Karan Malhotra', '+91 98110 31007', 'karan.m@gmail.com', 'Delhi', 'Delhi', 'google', 'Google — New Car Insurance', 'quotation_required', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'medium', 65, 'a0000000-0000-4000-8000-000000000003', null, 'DL03 MN 6789', 'Mahindra', 'XUV700', 'AX7', 2023, 'Diesel', 'ACKO', '2026-12-01', 'Comprehensive', true, true, now() - interval '1 day', now() + interval '3 hours', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000008', 'INS-1008', 'insurance', 'Divya Pillai', '+91 98110 31008', 'divya.p@gmail.com', 'Chennai', 'Tamil Nadu', 'referral', null, 'qualified', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'medium', 62, 'a0000000-0000-4000-8000-000000000002', null, 'TN10 OP 1122', 'Hyundai', 'i20', 'Asta', 2021, 'Petrol', 'HDFC Ergo', '2026-11-08', 'Comprehensive', true, true, now() - interval '2 days', now() + interval '5 hours', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000009', 'INS-1009', 'insurance', 'Arjun Deshmukh', '+91 98110 31009', 'arjun.d@gmail.com', 'Nagpur', 'Maharashtra', 'meta', 'Meta — Car Insurance Renewal Oct', 'qualified', 'human_handoff', 'read', 'connected', 'HUMAN HANDOFF', 'medium', 58, 'a0000000-0000-4000-8000-000000000005', null, 'MH31 QR 3344', 'Maruti Suzuki', 'Brezza', 'VXi', 2022, 'Petrol', 'ICICI Lombard', '2026-10-30', 'Third Party + OD', true, true, now() - interval '4 hours', now() + interval '1 day', now() - interval '4 days'),
  ('1e000000-0000-4000-8000-000000000010', 'INS-1010', 'insurance', 'Meera Joshi', '+91 98110 31010', 'meera.j@gmail.com', 'Ahmedabad', 'Gujarat', 'website', 'Website — Organic Enquiries', 'contacted', 'active', 'read', 'not_called', 'WAITING FOR CUSTOMER', 'medium', 45, 'a0000000-0000-4000-8000-000000000004', null, 'GJ01 ST 5566', 'Tata', 'Punch', 'Adventure', 2023, 'Petrol', null, null, null, true, false, now() - interval '2 hours', now() + interval '6 hours', now() - interval '3 days'),
  ('1e000000-0000-4000-8000-000000000011', 'INS-1011', 'insurance', 'Rahul Verma', '+91 98110 31011', 'rahul.v@gmail.com', 'Lucknow', 'Uttar Pradesh', 'csv', null, 'contacted', 'active', 'delivered', 'missed', 'AI CALL SCHEDULED', 'medium', 40, 'a0000000-0000-4000-8000-000000000004', null, 'UP32 UV 7788', 'Honda', 'Amaze', 'VX', 2019, 'Petrol', 'Oriental Insurance', '2026-11-20', 'Comprehensive', true, true, now() - interval '3 hours', now() + interval '2 hours', now() - interval '3 days'),
  ('1e000000-0000-4000-8000-000000000012', 'INS-1012', 'insurance', 'Kavya Reddy', '+91 98110 31012', 'kavya.r@gmail.com', 'Hyderabad', 'Telangana', 'meta', 'Meta — Car Insurance Renewal Oct', 'ai_contacting', 'active', 'sent', 'not_called', 'AI ACTIVE', 'low', 25, null, null, 'TS07 WX 9900', 'Kia', 'Sonet', 'HTK+', 2023, 'Petrol', null, null, null, true, false, now() - interval '1 hour', null, now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000013', 'INS-1013', 'insurance', 'Aditya Bhatt', '+91 98110 31013', 'aditya.b@gmail.com', 'Surat', 'Gujarat', 'excel', null, 'new', 'not_started', 'not_sent', 'not_called', 'AI NOT STARTED', 'low', 10, null, null, 'GJ05 YZ 1212', 'Maruti Suzuki', 'Swift', 'ZXi', 2021, 'Petrol', null, null, null, false, false, null, null, now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000014', 'INS-1014', 'insurance', 'Nisha Menon', '+91 98110 31014', 'nisha.m@gmail.com', 'Kochi', 'Kerala', 'website', 'Website — Organic Enquiries', 'new', 'not_started', 'not_sent', 'not_called', 'AI NOT STARTED', 'low', 10, null, null, 'KL01 AA 3434', 'Hyundai', 'Venue', 'SX', 2022, 'Petrol', null, null, null, false, false, null, null, now() - interval '20 hours'),
  ('1e000000-0000-4000-8000-000000000015', 'INS-1015', 'insurance', 'Sanjay Patil', '+91 98110 31015', 'sanjay.p@gmail.com', 'Kolhapur', 'Maharashtra', 'meta', 'Meta — Car Insurance Renewal Oct', 'follow_up', 'paused', 'read', 'missed', 'AUTOMATION PAUSED', 'medium', 35, 'a0000000-0000-4000-8000-000000000004', null, 'MH09 BB 5656', 'Tata', 'Harrier', 'XT', 2021, 'Diesel', 'Bajaj Allianz', '2026-12-10', 'Comprehensive', true, true, now() - interval '2 days', now() + interval '2 days', now() - interval '6 days'),
  ('1e000000-0000-4000-8000-000000000016', 'INS-1016', 'insurance', 'Pooja Sharma', '+91 98110 31016', 'pooja.s@gmail.com', 'Jaipur', 'Rajasthan', 'google', 'Google — New Car Insurance', 'not_interested', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'low', 8, 'a0000000-0000-4000-8000-000000000003', null, 'RJ14 CC 7878', 'Honda', 'WR-V', 'VX', 2019, 'Diesel', 'New India Assurance', '2026-10-18', 'Third Party', true, true, now() - interval '4 days', null, now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000017', 'INS-1017', 'insurance', 'Manish Gupta', '+91 98110 31017', 'manish.g@gmail.com', 'Kanpur', 'Uttar Pradesh', 'csv', null, 'invalid', 'paused', 'failed', 'failed', 'AUTOMATION PAUSED', 'low', 2, null, null, null, null, null, null, null, null, null, null, null, false, false, null, null, now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000018', 'INS-1018', 'insurance', 'Ritu Kapoor', '+91 98110 31018', 'ritu.k@gmail.com', 'Delhi', 'Delhi', 'meta', 'Meta — Car Insurance Renewal Oct', 'lost', 'opted_out', 'read', 'not_called', 'OPTED OUT', 'low', 0, 'a0000000-0000-4000-8000-000000000005', null, 'DL05 DD 9090', 'Maruti Suzuki', 'Ertiga', 'VXi', 2020, 'CNG', 'Go Digit', '2026-11-25', 'Comprehensive', false, false, now() - interval '5 days', null, now() - interval '9 days'),
  ('1e000000-0000-4000-8000-000000000019', 'INS-1019', 'insurance', 'Nikhil Shetty', '+91 98110 31019', 'nikhil.s@gmail.com', 'Mangaluru', 'Karnataka', 'api', null, 'new', 'active', 'sent', 'not_called', 'AI ACTIVE', 'medium', 20, null, null, 'KA19 EE 1313', 'Mahindra', 'Thar', 'LX', 2023, 'Diesel', null, null, null, true, false, now() - interval '30 minutes', null, now() - interval '5 hours'),
  ('1e000000-0000-4000-8000-000000000020', 'INS-1020', 'insurance', 'Tara Chavan', '+91 98110 31020', 'tara.c@gmail.com', 'Nashik', 'Maharashtra', 'google', 'Google — New Car Insurance', 'ai_contacting', 'qualifying', 'read', 'scheduled', 'QUALIFYING', 'medium', 38, 'a0000000-0000-4000-8000-000000000004', null, 'MH15 FF 1515', 'Hyundai', 'Aura', 'SX', 2022, 'Petrol', 'Tata AIG', '2026-11-05', 'Comprehensive', true, true, now() - interval '1 hour', now() + interval '1 hour', now() - interval '1 day');

insert into public.leads (id, lead_uid, product, full_name, phone, email, city, state, source, campaign, status, ai_status, whatsapp_status, call_status, automation_status, priority, lead_score, assigned_to, customer_id, vehicle_make, vehicle_model, vehicle_variant, vehicle_year, fuel_type, employment_type, monthly_income, loan_amount, down_payment, tenure_months, whatsapp_consent, call_consent, last_contacted_at, next_follow_up_at, created_at) values
  ('1e000000-0000-4000-8000-000000000101', 'LON-2001', 'loan', 'Kabir Anand', '+91 98220 41001', 'kabir.anand@gmail.com', 'Mumbai', 'Maharashtra', 'meta', 'Meta — Used Car Loan Fest', 'converted', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 95, 'a0000000-0000-4000-8000-000000000002', 'ce000000-0000-4000-8000-000000000003', 'Hyundai', 'Creta', 'SX', 2023, 'Petrol', 'Salaried', 95000, 900000, 200000, 60, true, true, now() - interval '1 day', null, now() - interval '14 days'),
  ('1e000000-0000-4000-8000-000000000102', 'LON-2002', 'loan', 'Shreya Kulkarni', '+91 98220 41002', 'shreya.k@gmail.com', 'Pune', 'Maharashtra', 'google', 'Google — Instant Car Loan', 'disbursed', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 90, 'a0000000-0000-4000-8000-000000000005', 'ce000000-0000-4000-8000-000000000004', 'Maruti Suzuki', 'Fronx', 'Zeta', 2024, 'Petrol', 'Salaried', 72000, 750000, 150000, 48, true, true, now() - interval '2 days', null, now() - interval '13 days'),
  ('1e000000-0000-4000-8000-000000000103', 'LON-2003', 'loan', 'Dev Patel', '+91 98220 41003', 'dev.p@gmail.com', 'Ahmedabad', 'Gujarat', 'meta', 'Meta — Used Car Loan Fest', 'disbursement_pending', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 87, 'a0000000-0000-4000-8000-000000000002', null, 'Tata', 'Nexon', 'XZ+', 2023, 'Petrol', 'Self-employed', 120000, 850000, 250000, 60, true, true, now() - interval '4 hours', now() + interval '1 day', now() - interval '12 days'),
  ('1e000000-0000-4000-8000-000000000104', 'LON-2004', 'loan', 'Ishita Bose', '+91 98220 41004', 'ishita.b@gmail.com', 'Kolkata', 'West Bengal', 'google', 'Google — Instant Car Loan', 'sanctioned', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'high', 82, 'a0000000-0000-4000-8000-000000000003', null, 'Honda', 'City', 'ZX', 2023, 'Petrol', 'Salaried', 88000, 950000, 300000, 60, true, true, now() - interval '1 day', now() + interval '2 days', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000105', 'LON-2005', 'loan', 'Varun Nair', '+91 98220 41005', 'varun.n@gmail.com', 'Kochi', 'Kerala', 'meta', 'Meta — Used Car Loan Fest', 'approved', 'human_handoff', 'read', 'connected', 'HUMAN HANDOFF', 'high', 79, 'a0000000-0000-4000-8000-000000000005', null, 'Toyota', 'Glanza', 'G', 2022, 'Petrol', 'Salaried', 65000, 650000, 100000, 48, true, true, now() - interval '6 hours', now() + interval '4 hours', now() - interval '10 days'),
  ('1e000000-0000-4000-8000-000000000106', 'LON-2006', 'loan', 'Anika Jain', '+91 98220 41006', 'anika.j@gmail.com', 'Indore', 'Madhya Pradesh', 'google', 'Google — Instant Car Loan', 'bank_review', 'completed', 'delivered', 'connected', 'AUTOMATION COMPLETED', 'high', 75, 'a0000000-0000-4000-8000-000000000003', null, 'Kia', 'Sonet', 'HTX', 2023, 'Diesel', 'Salaried', 79000, 800000, 200000, 60, true, true, now() - interval '1 day', now() + interval '3 days', now() - interval '9 days'),
  ('1e000000-0000-4000-8000-000000000107', 'LON-2007', 'loan', 'Harsh Vardhan', '+91 98220 41007', 'harsh.v@gmail.com', 'Delhi', 'Delhi', 'meta', 'Meta — Used Car Loan Fest', 'application_submitted', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'medium', 71, 'a0000000-0000-4000-8000-000000000002', null, 'Mahindra', 'Scorpio-N', 'Z4', 2023, 'Diesel', 'Self-employed', 150000, 1400000, 400000, 72, true, true, now() - interval '2 days', now() + interval '1 day', now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000108', 'LON-2008', 'loan', 'Lakshmi Prasad', '+91 98220 41008', 'lakshmi.p@gmail.com', 'Chennai', 'Tamil Nadu', 'website', null, 'application_created', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'medium', 66, 'a0000000-0000-4000-8000-000000000005', null, 'Hyundai', 'Verna', 'SX', 2022, 'Petrol', 'Salaried', 83000, 900000, 225000, 60, true, true, now() - interval '1 day', now() + interval '6 hours', now() - interval '7 days'),
  ('1e000000-0000-4000-8000-000000000109', 'LON-2009', 'loan', 'Yash Thakur', '+91 98220 41009', 'yash.t@gmail.com', 'Bhopal', 'Madhya Pradesh', 'google', 'Google — Instant Car Loan', 'documents_required', 'human_handoff', 'read', 'connected', 'HUMAN HANDOFF', 'medium', 60, 'a0000000-0000-4000-8000-000000000003', null, 'Maruti Suzuki', 'Baleno', 'Alpha', 2023, 'Petrol', 'Salaried', 56000, 700000, 140000, 48, true, true, now() - interval '5 hours', now() + interval '1 day', now() - interval '6 days'),
  ('1e000000-0000-4000-8000-000000000110', 'LON-2010', 'loan', 'Nandini Rao', '+91 98220 41010', 'nandini.r@gmail.com', 'Bengaluru', 'Karnataka', 'meta', 'Meta — Used Car Loan Fest', 'eligibility_check', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'medium', 55, 'a0000000-0000-4000-8000-000000000002', null, 'Tata', 'Altroz', 'XZ', 2022, 'Petrol', 'Salaried', 61000, 600000, 120000, 48, true, true, now() - interval '8 hours', now() + interval '2 hours', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000111', 'LON-2011', 'loan', 'Sameer Khan', '+91 98220 41011', 'sameer.k@gmail.com', 'Hyderabad', 'Telangana', 'google', 'Google — Instant Car Loan', 'qualified', 'human_handoff', 'delivered', 'connected', 'HUMAN HANDOFF', 'medium', 52, 'a0000000-0000-4000-8000-000000000005', null, 'Honda', 'Elevate', 'VX', 2024, 'Petrol', 'Self-employed', 105000, 1100000, 300000, 60, true, true, now() - interval '3 hours', now() + interval '4 hours', now() - interval '4 days'),
  ('1e000000-0000-4000-8000-000000000112', 'LON-2012', 'loan', 'Pallavi Desai', '+91 98220 41012', 'pallavi.d@gmail.com', 'Vadodara', 'Gujarat', 'csv', null, 'contacted', 'active', 'read', 'missed', 'AI CALL SCHEDULED', 'medium', 42, 'a0000000-0000-4000-8000-000000000004', null, 'Kia', 'Carens', 'Prestige', 2023, 'Petrol', 'Salaried', 68000, 950000, 200000, 60, true, true, now() - interval '2 hours', now() + interval '3 hours', now() - interval '3 days'),
  ('1e000000-0000-4000-8000-000000000113', 'LON-2013', 'loan', 'Rohit Shetty', '+91 98220 41013', 'rohit.s@gmail.com', 'Mangaluru', 'Karnataka', 'meta', 'Meta — Used Car Loan Fest', 'ai_contacting', 'active', 'sent', 'not_called', 'AI ACTIVE', 'low', 28, null, null, 'Toyota', 'Taisor', 'V', 2024, 'Petrol', null, null, 550000, null, null, true, false, now() - interval '45 minutes', null, now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000114', 'LON-2014', 'loan', 'Aarti Mishra', '+91 98220 41014', 'aarti.m@gmail.com', 'Varanasi', 'Uttar Pradesh', 'excel', null, 'new', 'not_started', 'not_sent', 'not_called', 'AI NOT STARTED', 'low', 12, null, null, 'Maruti Suzuki', 'Dzire', 'ZXi', 2023, 'Petrol', null, null, 650000, null, null, false, false, null, null, now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000115', 'LON-2015', 'loan', 'Vivek Menon', '+91 98220 41015', 'vivek.m@gmail.com', 'Kochi', 'Kerala', 'website', null, 'new', 'not_started', 'not_sent', 'not_called', 'AI NOT STARTED', 'low', 12, null, null, 'Hyundai', 'Exter', 'SX', 2024, 'Petrol', null, null, 500000, null, null, false, false, null, null, now() - interval '16 hours'),
  ('1e000000-0000-4000-8000-000000000116', 'LON-2016', 'loan', 'Kiran Reddy', '+91 98220 41016', 'kiran.r@gmail.com', 'Vijayawada', 'Andhra Pradesh', 'google', 'Google — Instant Car Loan', 'follow_up', 'paused', 'read', 'missed', 'AUTOMATION PAUSED', 'medium', 33, 'a0000000-0000-4000-8000-000000000004', null, 'Tata', 'Tiago', 'XZ+', 2022, 'Petrol', 'Salaried', 48000, 480000, 100000, 48, true, true, now() - interval '2 days', now() + interval '1 day', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000117', 'LON-2017', 'loan', 'Neha Saxena', '+91 98220 41017', 'neha.s@gmail.com', 'Noida', 'Uttar Pradesh', 'meta', 'Meta — Used Car Loan Fest', 'not_interested', 'completed', 'read', 'connected', 'AUTOMATION COMPLETED', 'low', 6, 'a0000000-0000-4000-8000-000000000003', null, 'Honda', 'Jazz', 'VX', 2020, 'Petrol', 'Salaried', 52000, 550000, 110000, 48, true, true, now() - interval '3 days', null, now() - interval '7 days'),
  ('1e000000-0000-4000-8000-000000000118', 'LON-2018', 'loan', 'Arnav Ghosh', '+91 98220 41018', 'arnav.g@gmail.com', 'Kolkata', 'West Bengal', 'api', null, 'duplicate', 'paused', 'not_sent', 'not_called', 'AUTOMATION PAUSED', 'low', 4, null, null, 'Maruti Suzuki', 'Wagon R', 'VXi', 2021, 'CNG', null, null, 350000, null, null, false, false, null, null, now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000119', 'LON-2019', 'loan', 'Swati Pillai', '+91 98220 41019', 'swati.p@gmail.com', 'Chennai', 'Tamil Nadu', 'google', 'Google — Instant Car Loan', 'lost', 'opted_out', 'read', 'not_called', 'OPTED OUT', 'low', 0, 'a0000000-0000-4000-8000-000000000002', null, 'Hyundai', 'Grand i10', 'Asta', 2021, 'Petrol', 'Salaried', 45000, 450000, 90000, 36, false, false, now() - interval '4 days', null, now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000120', 'LON-2020', 'loan', 'Deepak Yadav', '+91 98220 41020', 'deepak.y@gmail.com', 'Patna', 'Bihar', 'meta', 'Meta — Used Car Loan Fest', 'ai_contacting', 'qualifying', 'read', 'scheduled', 'QUALIFYING', 'medium', 36, 'a0000000-0000-4000-8000-000000000004', null, 'Mahindra', 'Bolero Neo', 'N10', 2023, 'Diesel', 'Self-employed', 85000, 800000, 160000, 60, true, true, now() - interval '90 minutes', now() + interval '2 hours', now() - interval '1 day');