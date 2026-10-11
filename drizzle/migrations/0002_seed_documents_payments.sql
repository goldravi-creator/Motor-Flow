-- Demo documents (KYC / vehicle / income proofs) tied to existing leads
INSERT INTO public.documents (lead_id, doc_type, file_name, status, created_at)
SELECT id, 'rc_copy', 'RC_KA01EF4521.pdf', 'verified', now() - interval '10 days' FROM public.leads WHERE lead_uid = 'INS-1001'
UNION ALL SELECT id, 'previous_policy', 'Policy_2025_Ackwick.pdf', 'verified', now() - interval '10 days' FROM public.leads WHERE lead_uid = 'INS-1001'
UNION ALL SELECT id, 'vehicle_photo', 'Creta_front.jpg', 'uploaded', now() - interval '9 days' FROM public.leads WHERE lead_uid = 'INS-1001'
UNION ALL SELECT id, 'rc_copy', 'RC_MH12CD7788.pdf', 'verified', now() - interval '8 days' FROM public.leads WHERE lead_uid = 'INS-1002'
UNION ALL SELECT id, 'driving_license', 'DL_PriyaNair.pdf', 'uploaded', now() - interval '7 days' FROM public.leads WHERE lead_uid = 'INS-1002'
UNION ALL SELECT id, 'rc_copy', 'RC_TN09AZ3344.pdf', 'pending', now() - interval '4 days' FROM public.leads WHERE lead_uid = 'INS-1004'
UNION ALL SELECT id, 'previous_policy', 'Policy_2025_Sneha.pdf', 'pending', now() - interval '4 days' FROM public.leads WHERE lead_uid = 'INS-1004'
UNION ALL SELECT id, 'rc_copy', 'RC_KA05MN9900.pdf', 'uploaded', now() - interval '5 days' FROM public.leads WHERE lead_uid = 'INS-1006'
UNION ALL SELECT id, 'vehicle_photo', 'Innova_side.jpg', 'pending', now() - interval '3 days' FROM public.leads WHERE lead_uid = 'INS-1006'
UNION ALL SELECT id, 'pan_card', 'PAN_KabirAnand.pdf', 'verified', now() - interval '12 days' FROM public.leads WHERE lead_uid = 'LON-2001'
UNION ALL SELECT id, 'aadhaar_card', 'Aadhaar_KabirAnand.pdf', 'verified', now() - interval '12 days' FROM public.leads WHERE lead_uid = 'LON-2001'
UNION ALL SELECT id, 'salary_slips', 'Salary_Apr-Jun.pdf', 'verified', now() - interval '11 days' FROM public.leads WHERE lead_uid = 'LON-2001'
UNION ALL SELECT id, 'bank_statement', 'BankStmt_6m.pdf', 'verified', now() - interval '11 days' FROM public.leads WHERE lead_uid = 'LON-2001'
UNION ALL SELECT id, 'pan_card', 'PAN_ShreyaK.pdf', 'verified', now() - interval '9 days' FROM public.leads WHERE lead_uid = 'LON-2002'
UNION ALL SELECT id, 'aadhaar_card', 'Aadhaar_ShreyaK.pdf', 'verified', now() - interval '9 days' FROM public.leads WHERE lead_uid = 'LON-2002'
UNION ALL SELECT id, 'bank_statement', 'BankStmt_Shreya.pdf', 'uploaded', now() - interval '6 days' FROM public.leads WHERE lead_uid = 'LON-2002'
UNION ALL SELECT id, 'pan_card', 'PAN_DevPatel.pdf', 'uploaded', now() - interval '5 days' FROM public.leads WHERE lead_uid = 'LON-2003'
UNION ALL SELECT id, 'aadhaar_card', 'Aadhaar_DevPatel.pdf', 'uploaded', now() - interval '5 days' FROM public.leads WHERE lead_uid = 'LON-2003'
UNION ALL SELECT id, 'salary_slips', 'Salary_DevPatel.pdf', 'pending', now() - interval '2 days' FROM public.leads WHERE lead_uid = 'LON-2003'
UNION ALL SELECT id, 'bank_statement', 'BankStmt_DevPatel.pdf', 'pending', now() - interval '2 days' FROM public.leads WHERE lead_uid = 'LON-2003'
UNION ALL SELECT id, 'pan_card', 'PAN_VarunNair.pdf', 'verified', now() - interval '8 days' FROM public.leads WHERE lead_uid = 'LON-2005'
UNION ALL SELECT id, 'aadhaar_card', 'Aadhaar_VarunNair.pdf', 'verified', now() - interval '8 days' FROM public.leads WHERE lead_uid = 'LON-2005'
UNION ALL SELECT id, 'salary_slips', 'Salary_VarunNair.pdf', 'verified', now() - interval '7 days' FROM public.leads WHERE lead_uid = 'LON-2005'
UNION ALL SELECT id, 'bank_statement', 'BankStmt_VarunNair.pdf', 'verified', now() - interval '7 days' FROM public.leads WHERE lead_uid = 'LON-2005';

-- Demo payments (premiums + loan processing fees)
INSERT INTO public.payments (lead_id, amount, method, transaction_ref, status, paid_at, created_at)
SELECT id, 17800, 'upi', 'UPI-8821345601', 'completed', now() - interval '9 days', now() - interval '9 days' FROM public.leads WHERE lead_uid = 'INS-1001'
UNION ALL SELECT id, 14200, 'card', 'CARD-5501238741', 'completed', now() - interval '11 days', now() - interval '11 days' FROM public.leads WHERE lead_uid = 'INS-1002'
UNION ALL SELECT id, 24500, 'net_banking', 'NB-7710238845', 'pending', null, now() - interval '1 day' FROM public.leads WHERE lead_uid = 'INS-1006'
UNION ALL SELECT id, 18450, 'upi', null, 'pending', null, now() - interval '6 hours' FROM public.leads WHERE lead_uid = 'INS-1003'
UNION ALL SELECT id, 16900, 'upi', 'UPI-8821349902', 'failed', null, now() - interval '2 days' FROM public.leads WHERE lead_uid = 'INS-1005'
UNION ALL SELECT id, 9999, 'card', 'CARD-5501241102', 'completed', now() - interval '10 days', now() - interval '10 days' FROM public.leads WHERE lead_uid = 'LON-2001'
UNION ALL SELECT id, 7499, 'upi', 'UPI-8821352210', 'completed', now() - interval '9 days', now() - interval '9 days' FROM public.leads WHERE lead_uid = 'LON-2002'
UNION ALL SELECT id, 6500, 'net_banking', 'NB-7710240091', 'completed', now() - interval '4 days', now() - interval '4 days' FROM public.leads WHERE lead_uid = 'LON-2005'
UNION ALL SELECT id, 9500, 'upi', null, 'pending', null, now() - interval '1 day' FROM public.leads WHERE lead_uid = 'LON-2004';