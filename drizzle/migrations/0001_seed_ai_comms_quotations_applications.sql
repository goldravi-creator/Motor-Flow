-- Demo WhatsApp conversations (AI qualification flows)
insert into public.whatsapp_messages (lead_id, direction, body, status, sender_type, created_at) values
  ('1e000000-0000-4000-8000-000000000001', 'out', 'Hi Aarav! This is MotorFlow. Your Hyundai Creta insurance (MH02 AB 1234) expires on 12 Nov 2026. Shall I share the best renewal quotes?', 'read', 'ai', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000001', 'in', 'Yes, please send comprehensive with zero dep.', 'read', 'lead', now() - interval '11 days' + interval '2 hours'),
  ('1e000000-0000-4000-8000-000000000001', 'out', 'Great choice! HDFC Ergo Comprehensive + Zero Dep: ₹17,800/yr (IDV ₹11,00,000). Would you like to proceed?', 'read', 'ai', now() - interval '11 days' + interval '2 hours'),
  ('1e000000-0000-4000-8000-000000000001', 'in', 'Done, paid just now.', 'read', 'lead', now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000003', 'out', 'Hi Rohan! Your Tata Nexon insurance expires 20 Oct 2026. I have 3 renewal quotes ready — starting ₹16,400/yr. Interested?', 'read', 'ai', now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000003', 'in', 'Share the best one with zero depreciation.', 'read', 'lead', now() - interval '8 days' + interval '3 hours'),
  ('1e000000-0000-4000-8000-000000000003', 'out', 'HDFC Ergo Comprehensive + Zero Dep: ₹18,450/yr (IDV ₹11,50,000). Payment link sent — valid for 15 days.', 'delivered', 'ai', now() - interval '3 hours'),
  ('1e000000-0000-4000-8000-000000000005', 'out', 'Hi Vikram! Your Kia Seltos policy expires 25 Oct. Best quote: Go Digit Comprehensive ₹16,900/yr. Can I explain the benefits?', 'read', 'ai', now() - interval '6 days'),
  ('1e000000-0000-4000-8000-000000000005', 'in', 'Can you reduce it further? Got a cheaper quote elsewhere.', 'read', 'lead', now() - interval '5 hours'),
  ('1e000000-0000-4000-8000-000000000005', 'out', 'Connecting you with our advisor Ravi to discuss the best possible price.', 'delivered', 'human', now() - interval '5 hours'),
  ('1e000000-0000-4000-8000-000000000006', 'out', 'Hi Ananya! Toyota Innova Crysta renewal (expires 15 Nov): Tata AIG Comprehensive ₹24,500/yr, IDV ₹16,50,000. Shall I send the quote PDF?', 'read', 'ai', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000006', 'in', 'Yes, send it. Also check if NCB is applied.', 'read', 'lead', now() - interval '5 days' + interval '1 hour'),
  ('1e000000-0000-4000-8000-000000000006', 'out', 'Quote sent! 50% NCB already applied — you saved ₹8,100. Valid till 20 Oct.', 'delivered', 'ai', now() - interval '6 hours'),
  ('1e000000-0000-4000-8000-000000000008', 'out', 'Hi! This is MotorFlow regarding your car insurance enquiry. Is this a good time to chat?', 'delivered', 'ai', now() - interval '2 hours'),
  ('1e000000-0000-4000-8000-000000000101', 'out', 'Hi Kabir! Your car loan application for Hyundai Creta (₹9,00,000) is approved at 8.4% — EMI ₹18,410 for 60 months. Shall we proceed to disbursal?', 'read', 'ai', now() - interval '13 days'),
  ('1e000000-0000-4000-8000-000000000101', 'in', 'Yes, completed the disbursal today. Thanks!', 'read', 'lead', now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000103', 'out', 'Hi Dev! Pre-approved car loan offer: ₹8,50,000 at 8.6% for your Tata Nexon. EMI ₹17,470 × 60 months. Want the sanction letter?', 'read', 'ai', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000103', 'in', 'Yes please. What documents are pending?', 'read', 'lead', now() - interval '11 days' + interval '4 hours'),
  ('1e000000-0000-4000-8000-000000000103', 'out', 'Only your latest 3-month bank statement. Upload here and disbursal happens within 48 hrs.', 'delivered', 'ai', now() - interval '4 hours'),
  ('1e000000-0000-4000-8000-000000000105', 'out', 'Hi Varun! Your ₹6,50,000 car loan for Toyota Glanza is approved at 8.9% — EMI ₹16,140 × 48 months. Next step: e-sign the agreement.', 'read', 'ai', now() - interval '9 days'),
  ('1e000000-0000-4000-8000-000000000105', 'in', 'Can I increase tenure to 60 months?', 'read', 'lead', now() - interval '6 hours'),
  ('1e000000-0000-4000-8000-000000000105', 'out', 'Sure — connecting you with our loan specialist to rework the tenure.', 'delivered', 'human', now() - interval '6 hours');

-- Demo AI + human call records
insert into public.call_records (lead_id, agent_id, call_type, status, duration_seconds, outcome, summary, sentiment, created_at) values
  ('1e000000-0000-4000-8000-000000000001', null, 'ai', 'completed', 186, 'qualified', 'Confirmed renewal intent for Creta; wants zero-dep comprehensive. Budget ~₹18k. Agreed to pay today.', 'positive', now() - interval '10 days'),
  ('1e000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'human', 'completed', 240, 'payment_completed', 'Guided through payment link; policy issued same day.', 'positive', now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000003', null, 'ai', 'completed', 154, 'quotation_interest', 'Nexon renewal due 20 Oct. Asked for zero-dep quote only. Hot lead.', 'positive', now() - interval '8 days'),
  ('1e000000-0000-4000-8000-000000000004', null, 'ai', 'completed', 171, 'documents_pending', 'Honda City renewal. Ready to buy; needs RC copy and previous policy. Promised to share tomorrow.', 'positive', now() - interval '7 days'),
  ('1e000000-0000-4000-8000-000000000005', null, 'ai', 'completed', 203, 'price_objection', 'Seltos renewal. Has a competing quote ₹900 cheaper. Wants callback from human advisor.', 'neutral', now() - interval '5 hours'),
  ('1e000000-0000-4000-8000-000000000006', null, 'ai', 'completed', 142, 'quotation_sent', 'Innova Crysta renewal. Verified 50% NCB eligibility; quote sent on WhatsApp.', 'positive', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000008', null, 'ai', 'no_answer', 0, 'no_answer', 'No answer after 20s ring. Will retry tomorrow at 11 AM.', 'neutral', now() - interval '2 hours'),
  ('1e000000-0000-4000-8000-000000000011', null, 'ai', 'completed', 128, 'not_interested', 'Already renewed with existing insurer last week. Marked lost.', 'negative', now() - interval '4 days'),
  ('1e000000-0000-4000-8000-000000000101', null, 'ai', 'completed', 215, 'qualified', 'Salaried, ₹95k/mo, wants ₹9L for Creta. CIBIL 780 self-reported. Strong profile.', 'positive', now() - interval '13 days'),
  ('1e000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000002', 'human', 'completed', 310, 'disbursed', 'Final disbursal confirmation call completed.', 'positive', now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000103', null, 'ai', 'completed', 178, 'documents_pending', 'Self-employed, ₹1.2L/mo. Needs 3-month bank statement for disbursal. Very keen.', 'positive', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000104', null, 'ai', 'completed', 196, 'sanctioned', 'Honda City loan ₹9.5L sanctioned. Explained foreclosure charges. Awaiting e-sign.', 'positive', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000105', null, 'ai', 'completed', 164, 'tenure_change', 'Wants 60 months instead of 48 on ₹6.5L Glanza loan. Handoff to specialist.', 'neutral', now() - interval '6 hours'),
  ('1e000000-0000-4000-8000-000000000107', null, 'ai', 'no_answer', 0, 'no_answer', 'Ring no answer. WhatsApp follow-up queued.', 'neutral', now() - interval '1 day');

-- Demo quotations
insert into public.quotations (lead_id, product, provider, coverage, premium, idv, loan_amount, interest_rate, tenure_months, emi, status, valid_until, notes, created_by, created_at) values
  ('1e000000-0000-4000-8000-000000000001', 'insurance', 'HDFC Ergo', 'Comprehensive + Zero Dep', 17800, 1100000, null, null, null, null, 'accepted', current_date + 15, '50% NCB applied. Customer paid via UPI.', 'a0000000-0000-4000-8000-000000000002', now() - interval '10 days'),
  ('1e000000-0000-4000-8000-000000000003', 'insurance', 'HDFC Ergo', 'Comprehensive + Zero Dep', 18450, 1150000, null, null, null, null, 'sent', current_date + 15, 'Best of 3 quotes shared on WhatsApp.', 'a0000000-0000-4000-8000-000000000003', now() - interval '3 hours'),
  ('1e000000-0000-4000-8000-000000000004', 'insurance', 'New India Assurance', 'Comprehensive', 15200, 890000, null, null, null, null, 'sent', current_date + 12, null, 'a0000000-0000-4000-8000-000000000002', now() - interval '1 day'),
  ('1e000000-0000-4000-8000-000000000005', 'insurance', 'Go Digit', 'Comprehensive', 16900, 980000, null, null, null, null, 'sent', current_date + 10, 'Customer negotiating — has competing quote.', 'a0000000-0000-4000-8000-000000000003', now() - interval '2 days'),
  ('1e000000-0000-4000-8000-000000000006', 'insurance', 'Tata AIG', 'Comprehensive', 24500, 1650000, null, null, null, null, 'sent', current_date + 14, '50% NCB applied, saved ₹8,100.', 'a0000000-0000-4000-8000-000000000005', now() - interval '6 hours'),
  ('1e000000-0000-4000-8000-000000000002', 'insurance', 'ICICI Lombard', 'Comprehensive', 14200, 820000, null, null, null, null, 'accepted', current_date - 5, 'Policy issued 26 Sep.', 'a0000000-0000-4000-8000-000000000002', now() - interval '12 days'),
  ('1e000000-0000-4000-8000-000000000101', 'loan', 'HDFC Bank', null, null, null, 900000, 8.4, 60, 18410, 'accepted', current_date + 20, 'Pre-approved offer. Processing fee waived.', 'a0000000-0000-4000-8000-000000000002', now() - interval '12 days'),
  ('1e000000-0000-4000-8000-000000000103', 'loan', 'HDFC Bank', null, null, null, 850000, 8.6, 60, 17470, 'sent', current_date + 18, null, 'a0000000-0000-4000-8000-000000000002', now() - interval '4 hours'),
  ('1e000000-0000-4000-8000-000000000105', 'loan', 'ICICI Bank', null, null, null, 650000, 8.9, 48, 16140, 'accepted', current_date + 15, 'Customer asked for 60-month rework.', 'a0000000-0000-4000-8000-000000000005', now() - interval '3 days'),
  ('1e000000-0000-4000-8000-000000000106', 'loan', 'Axis Bank', null, null, null, 800000, 9.1, 60, 16640, 'draft', current_date + 21, 'Draft — pending internal review.', 'a0000000-0000-4000-8000-000000000003', now() - interval '1 day');

-- Demo loan applications
insert into public.applications (lead_id, lender, loan_amount, status, created_at) values
  ('1e000000-0000-4000-8000-000000000101', 'HDFC Bank', 900000, 'approved', now() - interval '11 days'),
  ('1e000000-0000-4000-8000-000000000102', 'ICICI Bank', 750000, 'approved', now() - interval '10 days'),
  ('1e000000-0000-4000-8000-000000000103', 'HDFC Bank', 850000, 'under_review', now() - interval '6 days'),
  ('1e000000-0000-4000-8000-000000000104', 'State Bank of India', 950000, 'under_review', now() - interval '5 days'),
  ('1e000000-0000-4000-8000-000000000105', 'ICICI Bank', 650000, 'approved', now() - interval '4 days'),
  ('1e000000-0000-4000-8000-000000000106', 'Axis Bank', 800000, 'submitted', now() - interval '2 days');