/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserPerms {
  region: string;
  installmentsView: boolean;
  installmentsAdd: boolean;
  installmentsEdit: boolean;
  installmentsDelete: boolean;
  quotes: boolean;
  receipts: boolean;
  payments: boolean;
  expenses: boolean;
  treasury: boolean;
  projects: boolean;
  workers: boolean;
  users: boolean;
  sessions: boolean;
  print: boolean;
  companies: boolean;
  dashTopCards: boolean;
  dashCollection: boolean;
  dashPulse: boolean;
  dashLateClients: boolean;
  dashLastReceipts: boolean;
  dashUpcomingPaid: boolean;
  dashboard?: boolean;
  attendance?: boolean;
  financial_reports?: boolean;
  is_authorized?: boolean;
  use_global?: boolean;
  worker_id?: string | null;
  hr_employees_view?: boolean;
  hr_employees_add?: boolean;
  hr_employees_edit?: boolean;
  hr_employees_delete?: boolean;
  hr_contracts_view?: boolean;
  hr_contracts_add?: boolean;
  hr_contracts_approve?: boolean;
  hr_custody_view?: boolean;
  hr_custody_add?: boolean;
  hr_custody_return?: boolean;
  hr_journals_add?: boolean;
  hr_journals_approve?: boolean;
  hr_journals_pay?: boolean;
  hr_deductions_add?: boolean;
  hr_deductions_approve?: boolean;
  hr_salaries_view?: boolean;
  hr_reports_print?: boolean;
}

export const CASHIER_DEFAULT_PERMS: UserPerms = {
  region: "",
  dashboard: true,
  attendance: true,
  installmentsView: true,
  installmentsAdd: true,
  installmentsEdit: false,
  installmentsDelete: false,
  quotes: true,
  receipts: true,
  payments: true,
  expenses: true,
  treasury: true,
  financial_reports: false,
  projects: false,
  workers: false,
  companies: false,
  users: false,
  sessions: false,
  print: true,
  dashTopCards: true,
  dashCollection: true,
  dashPulse: false,
  dashLateClients: true,
  dashLastReceipts: true,
  dashUpcomingPaid: true,
};

export interface User {
  id: string;
  name: string;
  code: string;
  password?: string;
  role: "admin" | "employee" | "supervisor" | "cashier";
  perms: UserPerms;
  company_perms?: Record<string, UserPerms>;
  worker_id?: string;
  company_id?: string | null;
  status?: string;
  created_at?: string;
  email?: string;
  google_id?: string;
  phone?: string;
  requested_company_name?: string;
  requested_company_slug?: string;
  requested_company_manager?: string;
  requested_company_phone?: string;
  requested_company_capital?: number;
  requested_company_address?: string;
  requested_company_record_no?: string;
  requested_company_tax_no?: string;
}

export interface Installment {
  id: string;
  company_id?: string;
  client: string;
  identity: string;
  nationality: string;
  phone: string;
  no: string;
  amount: number;
  paid: number;
  remaining: number;
  type: string;
  start_date: string;
  end_date: string;
  next_due?: string;
  periods: number;
  installment: number;
  discount: number;
  after_discount: number;
  project: string;
  workplace?: string;
  guarantor?: string;
  status: "منتظم" | "متأخر" | "متعثر" | "مكتمل";
  contract_direction?: "لنا" | "علينا" | "مصروفات عمالة" | string;
  worker_id?: string;
  project_id?: string;
  notes?: string;
  created_at?: string;
}

export interface Quote {
  id: string;
  company_id?: string;
  no: string;
  client: string;
  phone: string;
  project: string;
  amount: number;
  vat: number;
  total: number;
  date: string;
  status: "جديد" | "مرسل" | "مقبول" | "مرفوض";
  notes?: string;
  items?: { description: string; quantity: number; price: number; total: number; }[];
  created_at?: string;
}

export interface Receipt {
  id: string;
  company_id?: string;
  no: string;
  from_name: string;
  amount: number;
  method: string;
  date: string;
  project: string;
  notes?: string;
  installment_id?: string;
  contract_no?: string;
  identity?: string;
  phone?: string;
  nationality?: string;
  remaining_before?: number;
  remaining_after?: number;
  created_at?: string;
}

export interface Payment {
  id: string;
  company_id?: string;
  worker_id?: string;
  no: string;
  to_name: string;
  amount: number;
  method: string;
  date: string;
  project: string;
  notes?: string;
  installment_id?: string;
  contract_no?: string;
  remaining_before?: number;
  remaining_after?: number;
  created_at?: string;
}

export interface Expense {
  id: string;
  company_id?: string;
  no: string;
  name: string;
  category: "مواد" | "عمالة" | "نقل" | "إيجار" | "وقود" | "إعاشة" | "سيارات" | "عدة" | "بنزين" | "تغيير زيت" | "صيانة" | "اتصالات" | "أخرى" | string;
  amount: number;
  date: string;
  project: string;
  supplier?: string;
  notes?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  company_id?: string;
  name: string;
  location: string;
  engineer: string;
  budget: number;
  start_date: string;
  end_date: string;
  progress: number;
  status: "نشط" | "متوقف" | "منتهي";
  notes?: string;
  latitude?: number;
  longitude?: number;
  allowed_radius?: number; // In meters
  created_at?: string;
}

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  worker_name: string;
  project_id: string;
  project_name: string;
  date: string; // YYYY-MM-DD
  check_in_time?: string; // HH:MM:SS
  check_out_time?: string; // HH:MM:SS
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  distance_in_meters?: number;
  status: "حاضر" | "حاضر (خارج النطاق)" | "متأخر" | "غائب" | string;
  notes?: string;
  company_id?: string;
  created_at?: string;
  device_info?: string;
  device_type?: string;
  ip_address?: string;
}

export interface Worker {
  id: string;
  company_id?: string;
  name: string;
  worker_id: string;
  phone: string;
  job: "حداد" | "نجار" | "كهربائي" | "سباك" | "عامل" | "مشرف";
  project: string;
  daily: number;
  days: number;
  advance: number;
  total: number;
  balance: number;
  status: "على رأس العمل" | "إجازة" | "موقوف";
  recipient_name?: string;
  notes?: string;
  created_at?: string;
}

export interface DbSession {
  id: string;
  name: string;
  code: string;
  role: string;
  time: string;
  action: string;
  created_at?: string;
  device_info?: string;
  device_type?: string;
  ip_address?: string;
}

export interface Company {
  id: string;
  slug?: string;
  name: string;
  activity?: string;  // نشاط الشركة الرئيسي / التخصص
  sub_title?: string; // العنوان الفرعي للشركة
  record_no?: string; // Commercial Registration / السجل التجاري
  commercial_register?: string;
  tax_no?: string;
  capital?: number;
  manager?: string;   // مدير الشركة للتعميدات والتوقيع
  phone?: string;
  address?: string;
  notes?: string;     // بنود وشروط إضافية للعقود
  promissory_note_template?: string; // صيغة سند الأمر الافتراضية للشركة
  logo_url?: string;  // شعار الشركة كـ URL أو base64
  treasuries?: string[]; // قائمة الخزائن الخاصة بالشركة
  created_at?: string;
}

export interface Extract {
  id: string;
  no: string;         // رقم المستخلص
  company_id: string; // تبعية الشركة
  project_id: string; // المشروع المعني
  client_name: string;// الجهة المالكة للمستخلص / العميل
  total_amount: number; // المبلغ الإجمالي المعتمد
  deductions: number;  // نسبة أو قيمة خصومات الغرامات/المواد
  net_amount: number;  // المبلغ الصافي للاستلام
  date: string;       // تاريخ إصدار المستخلص
  status: "مسودة" | "تحت المراجعة" | "مقبول" | "مسدد جزئياً" | "تم السداد";
  notes?: string;
  created_at?: string;
}

export interface CompanyAssetMaintenanceLog {
  id: string;
  date: string;
  description: string;
  cost: number;
  mileage_at_maintenance?: number;
  status: "completed" | "pending";
}

export interface CompanyAsset {
  id: string;
  company_id: string;
  name: string;
  type: "vehicle" | "real_estate" | "equipment" | "other" | string;
  model?: string;
  plate_number_or_title?: string;
  mileage?: number;
  status: "active" | "maintenance" | "sold" | "inactive" | string;
  purchase_date?: string;
  purchase_value?: number;
  notes?: string;
  maintenance_logs?: CompanyAssetMaintenanceLog[];
  created_at?: string;
}

// ==========================================
// SUB-CONTRACTS & ARAB WORLD CONTRACTING
// ==========================================

export interface SubcontractParty {
  legal_name: string;
  entity_type: string;
  cr_number: string;
  unified_number: string;
  tax_number: string;
  national_address: string;
  city: string;
  phone: string;
  email: string;
  representative_name: string;
  representative_title: string;
  representative_id?: string;
  bank_name?: string;
  iban?: string;
  account_name?: string;
}

export interface SubcontractClause {
  id: string;
  number: number;
  title: string;
  text: string;
  is_custom?: boolean;
}

export interface SubcontractBOQItem {
  id: string;
  item_no: number;
  description: string;
  unit: string;
  qty: number;
  unit_price: number;
  total_price: number;
  execution_type?: string;
}

export interface SubcontractInvoiceItem {
  boq_id: string;
  description: string;
  unit: string;
  unit_price: number;
  contract_qty: number;
  previous_qty: number;
  current_qty: number;
  total_qty: number;
  total_amount: number;
}

export interface SubcontractInvoice {
  id: string;
  contract_id: string;
  invoice_no: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  items: SubcontractInvoiceItem[];
  gross_amount: number;
  advance_deduction: number;
  retention_deduction: number;
  other_deductions: number;
  vat_rate: number;
  vat_amount: number;
  net_payable: number;
  status: "draft" | "submitted" | "approved" | "paid";
  notes?: string;
  created_at?: string;
}

export interface SubcontractChangeOrder {
  id: string;
  contract_id: string;
  order_no: string;
  title: string;
  description: string;
  reason: string;
  qty: number;
  unit_price: number;
  total_amount: number;
  impact_days: number;
  status: "draft" | "pending" | "approved" | "rejected";
  date: string;
  approved_by?: string;
  notes?: string;
}

export interface SubcontractDelayLog {
  id: string;
  contract_id: string;
  log_no: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  affected_days: number;
  responsible_party: "first_party" | "second_party" | "owner" | "force_majeure";
  description: string;
  status: "recorded" | "resolved" | "extension_granted";
  extension_granted_days?: number;
  created_at?: string;
}

export interface SubcontractAuditLog {
  id: string;
  contract_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  details: string;
}

export interface Subcontract {
  id: string;
  company_id?: string;
  contract_no: string;
  title: string;
  contract_type: string;
  activity_category: string;
  status: "draft" | "pending_approval" | "approved" | "in_progress" | "suspended" | "completed" | "cancelled";
  version: number;
  parent_version_id?: string;
  is_locked?: boolean;
  is_template?: boolean;
  first_party: SubcontractParty;
  second_party: SubcontractParty;
  project_id?: string;
  project_name: string;
  project_owner: string;
  main_contractor: string;
  project_location: string;
  main_contract_no?: string;
  scope_description: string;
  is_governmental: boolean;
  required_approvals?: string;
  site_handover_date: string;
  commencement_date: string;
  duration_days: number;
  completion_date: string;
  supervising_engineer: string;
  approved_specs: string;
  pricing_method: string;
  currency: string;
  total_amount: number;
  is_vat_inclusive: boolean;
  vat_rate: number;
  advance_payment_pct: number;
  advance_payment_amount: number;
  retention_pct: number;
  retention_amount: number;
  delay_penalty_daily_rate: number;
  delay_penalty_cap_pct: number;
  boq: SubcontractBOQItem[];
  clauses: SubcontractClause[];
  first_party_signed_by?: string;
  first_party_signed_at?: string;
  second_party_signed_by?: string;
  second_party_signed_at?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  attachments?: { name: string; url: string; date?: string; type?: string }[];
  audit_trail?: SubcontractAuditLog[];
  created_at?: string;
  updated_at?: string;
}



