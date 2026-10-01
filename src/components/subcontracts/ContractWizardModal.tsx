/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Subcontract Creation & Edition Wizard (المحرر الذكي)
 */

import React, { useState, useEffect } from "react";
import {
  X, Check, ChevronRight, ChevronLeft, Building2, UserCheck,
  Briefcase, FileText, Plus, Trash2, Edit3, DollarSign, Calendar,
  ShieldCheck, AlertTriangle, Sparkles, Copy, Eye
} from "lucide-react";
import { Subcontract, SubcontractParty, SubcontractBOQItem, SubcontractClause } from "../../types";
import {
  ARAB_WORLD_DEFAULT_PARTY, CONTRACT_TYPES_LIST, CONTRACT_CATEGORIES_LIST,
  DEFAULT_25_CLAUSES, generateSubcontractNumber, replaceSmartVariables
} from "../../utils/subcontractDefaults";

interface ContractWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contract: Subcontract, isApproval?: boolean) => void;
  initialContract?: Subcontract | null;
  existingContractsCount: number;
  availableProjects?: { id: string; name: string; client?: string; location?: string }[];
  defaultFirstParty?: SubcontractParty;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ContractWizardModal: React.FC<ContractWizardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialContract,
  existingContractsCount,
  availableProjects = [],
  defaultFirstParty,
  showToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Contract Basic States
  const [contractNo, setContractNo] = useState("");
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState(CONTRACT_TYPES_LIST[0].label);
  const [activityCategory, setActivityCategory] = useState(CONTRACT_CATEGORIES_LIST[0]);
  const [status, setStatus] = useState<Subcontract["status"]>("draft");
  const [version, setVersion] = useState<number>(1);

  // First Party (Arab World)
  const [firstParty, setFirstParty] = useState<SubcontractParty>(
    defaultFirstParty || ARAB_WORLD_DEFAULT_PARTY
  );

  // Second Party (Subcontractor)
  const [secondParty, setSecondParty] = useState<SubcontractParty>({
    legal_name: "",
    entity_type: "مؤسسة فردية",
    cr_number: "",
    unified_number: "",
    tax_number: "",
    national_address: "",
    city: "",
    phone: "",
    email: "",
    representative_name: "",
    representative_title: "المدير العام / المفوض",
    representative_id: "",
    bank_name: "",
    iban: "",
    account_name: "",
  });

  // Project Details
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectOwner, setProjectOwner] = useState("");
  const [mainContractor, setMainContractor] = useState("شركة عرب وورلد للمقاولات العامة");
  const [projectLocation, setProjectLocation] = useState("");
  const [mainContractNo, setMainContractNo] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [isGovernmental, setIsGovernmental] = useState(false);
  const [requiredApprovals, setRequiredApprovals] = useState("");
  const [siteHandoverDate, setSiteHandoverDate] = useState("");
  const [commencementDate, setCommencementDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState<number>(90);
  const [completionDate, setCompletionDate] = useState("");
  const [supervisingEngineer, setSupervisingEngineer] = useState("");
  const [approvedSpecs, setApprovedSpecs] = useState("طبقاً للمخططات المعتمدة وكود البناء السعودي");

  // Financials & BOQ
  const [pricingMethod, setPricingMethod] = useState("unit");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isVatInclusive, setIsVatInclusive] = useState(false);
  const [vatRate, setVatRate] = useState<number>(15);
  const [advancePaymentPct, setAdvancePaymentPct] = useState<number>(0);
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState<number>(0);
  const [retentionPct, setRetentionPct] = useState<number>(5);
  const [delayPenaltyDailyRate, setDelayPenaltyDailyRate] = useState<number>(500);
  const [delayPenaltyCapPct, setDelayPenaltyCapPct] = useState<number>(10);
  const [boq, setBoq] = useState<SubcontractBOQItem[]>([]);

  // Clauses
  const [clauses, setClauses] = useState<SubcontractClause[]>(DEFAULT_25_CLAUSES);
  const [selectedClauseId, setSelectedClauseId] = useState<string>("cl_1");

  // Load Initial or Default Values
  useEffect(() => {
    if (initialContract) {
      setContractNo(initialContract.contract_no);
      setTitle(initialContract.title);
      setContractType(initialContract.contract_type);
      setActivityCategory(initialContract.activity_category);
      setStatus(initialContract.status);
      setVersion(initialContract.version || 1);
      setFirstParty(initialContract.first_party || ARAB_WORLD_DEFAULT_PARTY);
      setSecondParty(initialContract.second_party);
      setProjectId(initialContract.project_id || "");
      setProjectName(initialContract.project_name || "");
      setProjectOwner(initialContract.project_owner || "");
      setMainContractor(initialContract.main_contractor || "شركة عرب وورلد للمقاولات العامة");
      setProjectLocation(initialContract.project_location || "");
      setMainContractNo(initialContract.main_contract_no || "");
      setScopeDescription(initialContract.scope_description || "");
      setIsGovernmental(!!initialContract.is_governmental);
      setRequiredApprovals(initialContract.required_approvals || "");
      setSiteHandoverDate(initialContract.site_handover_date || "");
      setCommencementDate(initialContract.commencement_date || "");
      setDurationDays(initialContract.duration_days || 90);
      setCompletionDate(initialContract.completion_date || "");
      setSupervisingEngineer(initialContract.supervising_engineer || "");
      setApprovedSpecs(initialContract.approved_specs || "");
      setPricingMethod(initialContract.pricing_method || "unit");
      setTotalAmount(initialContract.total_amount || 0);
      setIsVatInclusive(!!initialContract.is_vat_inclusive);
      setVatRate(initialContract.vat_rate || 15);
      setAdvancePaymentPct(initialContract.advance_payment_pct || 0);
      setAdvancePaymentAmount(initialContract.advance_payment_amount || 0);
      setRetentionPct(initialContract.retention_pct || 5);
      setDelayPenaltyDailyRate(initialContract.delay_penalty_daily_rate || 500);
      setDelayPenaltyCapPct(initialContract.delay_penalty_cap_pct || 10);
      setBoq(initialContract.boq || []);
      setClauses(initialContract.clauses?.length ? initialContract.clauses : DEFAULT_25_CLAUSES);
    } else {
      // New Contract defaults
      const newNo = generateSubcontractNumber(existingContractsCount);
      setContractNo(newNo);
      setTitle("عقد مقاولة من الباطن لأعمال " + CONTRACT_CATEGORIES_LIST[0]);
      setContractType(CONTRACT_TYPES_LIST[0].label);
      setActivityCategory(CONTRACT_CATEGORIES_LIST[0]);
      setStatus("draft");
      setVersion(1);
      setFirstParty(defaultFirstParty || ARAB_WORLD_DEFAULT_PARTY);
      setClauses(DEFAULT_25_CLAUSES);
      setBoq([
        {
          id: "boq_1",
          item_no: 1,
          description: "تنفيذ أعمال " + CONTRACT_CATEGORIES_LIST[0] + " طبقاً للمواصفات",
          unit: "متر مربع",
          qty: 100,
          unit_price: 50,
          total_price: 5000,
          execution_type: "مصنعية فقط",
        },
      ]);
      setTotalAmount(5000);
    }
  }, [initialContract, existingContractsCount, defaultFirstParty]);

  // Recalculate completion date from commencement date + duration days
  useEffect(() => {
    if (commencementDate && durationDays) {
      try {
        const d = new Date(commencementDate);
        d.setDate(d.getDate() + Number(durationDays));
        setCompletionDate(d.toISOString().slice(0, 10));
      } catch {}
    }
  }, [commencementDate, durationDays]);

  // BOQ Handlers
  const handleAddBOQItem = () => {
    const nextItemNo = boq.length + 1;
    setBoq([
      ...boq,
      {
        id: "boq_" + Date.now(),
        item_no: nextItemNo,
        description: "",
        unit: "متر مربع",
        qty: 1,
        unit_price: 0,
        total_price: 0,
        execution_type: "مصنعية",
      },
    ]);
  };

  const handleUpdateBOQItem = (index: number, field: keyof SubcontractBOQItem, val: any) => {
    setBoq((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };
      if (field === "qty" || field === "unit_price") {
        const q = Number(field === "qty" ? val : item.qty) || 0;
        const p = Number(field === "unit_price" ? val : item.unit_price) || 0;
        item.total_price = q * p;
      }
      next[index] = item;
      const sum = next.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
      setTotalAmount(sum);
      return next;
    });
  };

  const handleDeleteBOQItem = (index: number) => {
    setBoq((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const sum = next.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
      setTotalAmount(sum);
      return next;
    });
  };

  // Clause editing
  const handleUpdateClauseText = (id: string, newText: string) => {
    setClauses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, text: newText } : c))
    );
  };

  const handleAddCustomClause = () => {
    const nextNo = clauses.length + 1;
    const newId = "cl_custom_" + Date.now();
    const newClause: SubcontractClause = {
      id: newId,
      number: nextNo,
      title: `البند المخصص رقم ${nextNo}: شروط إضافية خاصة`,
      text: "تم الاتفاق صراحةً بين الطرفين على ...",
      is_custom: true,
    };
    setClauses([...clauses, newClause]);
    setSelectedClauseId(newId);
  };

  const handleDeleteClause = (id: string) => {
    if (clauses.length <= 1) {
      showToast("يجب أن يحتوي العقد على بند واحد على الأقل", "warning");
      return;
    }
    setClauses((prev) => prev.filter((c) => c.id !== id));
    if (selectedClauseId === id) {
      setSelectedClauseId(clauses[0]?.id || "");
    }
  };

  // Validation
  const validateForm = (isFinalApproval = false): boolean => {
    if (!title.trim()) {
      showToast("يرجى إدخال عنوان العقد", "error");
      return false;
    }
    if (!secondParty.legal_name.trim()) {
      showToast("يرجى إدخال اسم المقاول من الباطن (الطرف الثاني)", "error");
      return false;
    }
    if (isFinalApproval) {
      if (!secondParty.cr_number?.trim() && !secondParty.representative_id?.trim()) {
        showToast("لا يمكن اعتماد العقد دون إدخال السجل التجاري أو هوية ممثل المقاول من الباطن", "error");
        return false;
      }
      if (!secondParty.representative_name?.trim()) {
        showToast("يرجى تحديد اسم ممثل المقاول من الباطن وصفته للمطابقة النظامية", "error");
        return false;
      }
      if (!projectName.trim()) {
        showToast("يرجى إدخال اسم المشروع وموقعه قبل الاعتماد الرسمي", "error");
        return false;
      }
    }
    return true;
  };

  // Save / Approve handler
  const handleSaveAction = (isApproval = false) => {
    if (!validateForm(isApproval)) return;

    // If editing an approved contract and saving changes, bump version
    const nextVersion =
      initialContract && initialContract.status === "approved" && !isApproval
        ? (initialContract.version || 1) + 1
        : version;

    const newContract: Subcontract = {
      id: initialContract?.id || "sub_" + Date.now(),
      contract_no: contractNo,
      title,
      contract_type: contractType,
      activity_category: activityCategory,
      status: isApproval ? "approved" : (initialContract?.status || "draft"),
      version: nextVersion,
      parent_version_id: initialContract?.id,
      is_locked: isApproval,
      first_party: firstParty,
      second_party: secondParty,
      project_id: projectId,
      project_name: projectName,
      project_owner: projectOwner,
      main_contractor: mainContractor,
      project_location: projectLocation,
      main_contract_no: mainContractNo,
      scope_description: scopeDescription,
      is_governmental: isGovernmental,
      required_approvals: requiredApprovals,
      site_handover_date: siteHandoverDate,
      commencement_date: commencementDate,
      duration_days: durationDays,
      completion_date: completionDate,
      supervising_engineer: supervisingEngineer,
      approved_specs: approvedSpecs,
      pricing_method: pricingMethod,
      currency: "SAR",
      total_amount: totalAmount,
      is_vat_inclusive: isVatInclusive,
      vat_rate: vatRate,
      advance_payment_pct: advancePaymentPct,
      advance_payment_amount: (totalAmount * advancePaymentPct) / 100,
      retention_pct: retentionPct,
      retention_amount: (totalAmount * retentionPct) / 100,
      delay_penalty_daily_rate: delayPenaltyDailyRate,
      delay_penalty_cap_pct: delayPenaltyCapPct,
      boq,
      clauses,
      approved_at: isApproval ? new Date().toISOString() : initialContract?.approved_at,
      updated_at: new Date().toISOString(),
    };

    onSave(newContract, isApproval);
    onClose();
  };

  if (!isOpen) return null;

  const currentClause = clauses.find((c) => c.id === selectedClauseId) || clauses[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{initialContract ? "تعديل عقد مقاولة من الباطن" : "إنشاء عقد مقاولة من الباطن جديد"}</span>
                <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {contractNo}
                </span>
                {initialContract?.status === "approved" && (
                  <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    سيتم إنشاء الإصدار V{version + 1}
                  </span>
                )}
              </h3>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                نظام عرب وورلد لإدارة العقود وفق الأنظمة واللوائح السعودية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-4 bg-slate-950/90 border-b border-slate-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`py-3 px-4 font-black transition-all flex items-center justify-center gap-2 border-b-2 ${
              step === 1
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-mono">1</span>
            <span>بيانات الأطراف والتعاقد</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`py-3 px-4 font-black transition-all flex items-center justify-center gap-2 border-b-2 ${
              step === 2
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-mono">2</span>
            <span>بيانات المشروع والموقع</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(3)}
            className={`py-3 px-4 font-black transition-all flex items-center justify-center gap-2 border-b-2 ${
              step === 3
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-mono">3</span>
            <span>الأسعار وجدول الكميات (BOQ)</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(4)}
            className={`py-3 px-4 font-black transition-all flex items-center justify-center gap-2 border-b-2 ${
              step === 4
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-mono">4</span>
            <span>محرر البنود الـ 25 والشروط</span>
          </button>
        </div>

        {/* Wizard Step Content */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-right">
          
          {/* STEP 1: Parties Information */}
          {step === 1 && (
            <div className="space-y-6">
              {/* General Contract Definition */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-slate-400 font-bold block mb-1">عنوان العقد المعتمد *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: عقد مقاولة من الباطن لأعمال الخرسانات المسلحة"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">نوع العقد وطبيعة التعاقد *</label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {CONTRACT_TYPES_LIST.map((t) => (
                      <option key={t.id} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-slate-400 font-bold block mb-1">النشاط والتخصص الإنشائي *</label>
                  <select
                    value={activityCategory}
                    onChange={(e) => setActivityCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {CONTRACT_CATEGORIES_LIST.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two Parties Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* First Party (Arab World) */}
                <div className="bg-slate-950/60 border border-amber-500/20 rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h4 className="font-black text-amber-400 flex items-center gap-1.5 text-xs">
                      <span>🏛️</span> الطرف الأول (عرب وورلد للمقاولات - المقاول العام)
                    </h4>
                    <span className="text-[10px] text-slate-400">بيانات الشركة الثابتة</span>
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">الاسم النظامي للطرف الأول</label>
                    <input
                      type="text"
                      value={firstParty.legal_name}
                      onChange={(e) => setFirstParty({ ...firstParty, legal_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">السجل التجاري</label>
                      <input
                        type="text"
                        value={firstParty.cr_number}
                        onChange={(e) => setFirstParty({ ...firstParty, cr_number: e.target.value })}
                        placeholder="السجل التجاري"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">الرقم الضريبي</label>
                      <input
                        type="text"
                        value={firstParty.tax_number}
                        onChange={(e) => setFirstParty({ ...firstParty, tax_number: e.target.value })}
                        placeholder="الرقم الضريبي"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">اسم المفوض بالتوقيع</label>
                      <input
                        type="text"
                        value={firstParty.representative_name}
                        onChange={(e) => setFirstParty({ ...firstParty, representative_name: e.target.value })}
                        placeholder="اسم المفوض"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">صفة المفوض</label>
                      <input
                        type="text"
                        value={firstParty.representative_title}
                        onChange={(e) => setFirstParty({ ...firstParty, representative_title: e.target.value })}
                        placeholder="المدير العام / المفوض"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">العنوان الوطني</label>
                    <input
                      type="text"
                      value={firstParty.national_address}
                      onChange={(e) => setFirstParty({ ...firstParty, national_address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                {/* Second Party (Subcontractor) */}
                <div className="bg-slate-950/60 border border-blue-500/20 rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h4 className="font-black text-blue-400 flex items-center gap-1.5 text-xs">
                      <span>👷</span> الطرف الثاني (المقاول من الباطن) *
                    </h4>
                    <span className="text-[10px] text-rose-400 font-bold">البيانات النظامية إلزامية</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">اسم منشأة المقاول من الباطن *</label>
                    <input
                      type="text"
                      required
                      value={secondParty.legal_name}
                      onChange={(e) => setSecondParty({ ...secondParty, legal_name: e.target.value })}
                      placeholder="مثال: مؤسسة بن لادن للمقاولات العامة"
                      className="w-full px-3 py-2 bg-slate-900 border border-blue-500/40 rounded-xl text-white font-bold focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">نوع الكيان</label>
                      <select
                        value={secondParty.entity_type}
                        onChange={(e) => setSecondParty({ ...secondParty, entity_type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="مؤسسة فردية">مؤسسة فردية</option>
                        <option value="شركة ذات مسؤولية محدودة">شركة ذات مسؤولية محدودة</option>
                        <option value="شركة مساهمة">شركة مساهمة</option>
                        <option value="شركة تضامنية">شركة تضامنية</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold block mb-1">السجل التجاري</label>
                      <input
                        type="text"
                        value={secondParty.cr_number}
                        onChange={(e) => setSecondParty({ ...secondParty, cr_number: e.target.value })}
                        placeholder="السجل التجاري"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">الرقم الضريبي</label>
                      <input
                        type="text"
                        value={secondParty.tax_number}
                        onChange={(e) => setSecondParty({ ...secondParty, tax_number: e.target.value })}
                        placeholder="الرقم الضريبي"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">رقم الجوال والتواصل *</label>
                      <input
                        type="text"
                        value={secondParty.phone}
                        onChange={(e) => setSecondParty({ ...secondParty, phone: e.target.value })}
                        placeholder="05XXXXXXXX"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">اسم الممثل المفوض بالتوقيع *</label>
                      <input
                        type="text"
                        value={secondParty.representative_name}
                        onChange={(e) => setSecondParty({ ...secondParty, representative_name: e.target.value })}
                        placeholder="اسم الممثل"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">صفة الممثل</label>
                      <input
                        type="text"
                        value={secondParty.representative_title}
                        onChange={(e) => setSecondParty({ ...secondParty, representative_title: e.target.value })}
                        placeholder="المالك / المدير العام"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">اسم البنك المعتمد</label>
                      <input
                        type="text"
                        value={secondParty.bank_name}
                        onChange={(e) => setSecondParty({ ...secondParty, bank_name: e.target.value })}
                        placeholder="مثال: مصرف الراجحي"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">رقم الآيبان (IBAN) باسم المنشأة</label>
                      <input
                        type="text"
                        value={secondParty.iban}
                        onChange={(e) => setSecondParty({ ...secondParty, iban: e.target.value })}
                        placeholder="SA0000000000000000000000"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Project Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="font-black text-amber-400 text-xs border-b border-slate-800 pb-2">
                  بيانات المشروع الرئيسي والارتباط
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">اسم المشروع *</label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="مثال: مجمع أبراج النخيل السكني"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">المالك / الجهة المشرفة</label>
                    <input
                      type="text"
                      value={projectOwner}
                      onChange={(e) => setProjectOwner(e.target.value)}
                      placeholder="مثال: وزارة الإسكان / شركة التطوير العقاري"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">موقع المشروع والمدينة</label>
                    <input
                      type="text"
                      value={projectLocation}
                      onChange={(e) => setProjectLocation(e.target.value)}
                      placeholder="مثال: الرياض - حي الملقا"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">المقاول العام الرئيسي</label>
                    <input
                      type="text"
                      value={mainContractor}
                      onChange={(e) => setMainContractor(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">رقم العقد الرئيسي (إن وجد)</label>
                    <input
                      type="text"
                      value={mainContractNo}
                      onChange={(e) => setMainContractNo(e.target.value)}
                      placeholder="MAIN-CTR-2026-..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">المهندس المشرف المعتمد</label>
                    <input
                      type="text"
                      value={supervisingEngineer}
                      onChange={(e) => setSupervisingEngineer(e.target.value)}
                      placeholder="المهندس المقيم"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-850">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">تاريخ تسليم الموقع الفعلي</label>
                    <input
                      type="date"
                      value={siteHandoverDate}
                      onChange={(e) => setSiteHandoverDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">تاريخ بدء التنفيذ المعتمد</label>
                    <input
                      type="date"
                      value={commencementDate}
                      onChange={(e) => setCommencementDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">مدة التنفيذ (بالأيام التقويمية) *</label>
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono font-bold text-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">وصف نطاق الأعمال الموكلة وحدودها</label>
                  <textarea
                    rows={3}
                    value={scopeDescription}
                    onChange={(e) => setScopeDescription(e.target.value)}
                    placeholder="بيان تفصيلي بحدود الأعمال والمسؤوليات الفنية والتشغيلية..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="gov_check"
                    checked={isGovernmental}
                    onChange={(e) => setIsGovernmental(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 cursor-pointer"
                  />
                  <label htmlFor="gov_check" className="text-xs font-bold text-slate-300 cursor-pointer">
                    مشروع تابع لجهة حكومية (يطبق نظام المنافسات والمشتريات الحكومية والشروط الخاصة للتعاقد من الباطن)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Financials & BOQ */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Financial Constraints */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">طريقة القياس والأسعار</label>
                  <select
                    value={pricingMethod}
                    onChange={(e) => setPricingMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="unit">حسب القياس والحصر الهندسي الفعلي</option>
                    <option value="lump_sum">مقطوعية إجمالية شاملة</option>
                    <option value="cost_plus">مصنعية وتكلفة مضافة</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">نسبة الدفعة المقدمة %</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={advancePaymentPct}
                    onChange={(e) => setAdvancePaymentPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">نسبة محتجز حسن التنفيذ %</label>
                  <input
                    type="number"
                    min={5}
                    max={10}
                    value={retentionPct}
                    onChange={(e) => setRetentionPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-purple-400 font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">غرامة التأخير اليومية (ريال)</label>
                  <input
                    type="number"
                    min={0}
                    value={delayPenaltyDailyRate}
                    onChange={(e) => setDelayPenaltyDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-rose-400"
                  />
                </div>
              </div>

              {/* BOQ Items Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-amber-400 text-xs flex items-center gap-1.5">
                    <span>📊</span> جدول الكميات والأسعار (BOQ):
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddBOQItem}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-black text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة بند كميات
                  </button>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="p-2.5 w-12 text-center">#</th>
                        <th className="p-2.5">بيان ووصف البند الفني والمواصفة</th>
                        <th className="p-2.5 text-center w-24">الوحدة</th>
                        <th className="p-2.5 text-center w-24">الكمية</th>
                        <th className="p-2.5 text-center w-28">سعر الوحدة</th>
                        <th className="p-2.5 text-center w-32">الإجمالي (ريال)</th>
                        <th className="p-2.5 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {boq.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-900/40">
                          <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="وصف البند والمواصفة..."
                              value={item.description}
                              onChange={(e) => handleUpdateBOQItem(idx, "description", e.target.value)}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleUpdateBOQItem(idx, "unit", e.target.value)}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-center text-slate-300"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.qty}
                              onChange={(e) => handleUpdateBOQItem(idx, "qty", Number(e.target.value))}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateBOQItem(idx, "unit_price", Number(e.target.value))}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-white"
                            />
                          </td>
                          <td className="p-2 text-center font-mono font-black text-amber-400">
                            {item.total_price?.toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteBOQItem(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950 font-black text-slate-200">
                        <td colSpan={5} className="p-3 text-left pl-6">
                          القيمة الإجمالية التقديرية لجدول الكميات:
                        </td>
                        <td className="p-3 text-center font-mono text-sm text-amber-400">
                          {totalAmount.toLocaleString()} ريال
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Smart 25-Clauses Editor */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>📜</span> محرر البنود الـ 25 المعتمدة وفق الأنظمة السعودية
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يمكنك تعديل أي نص قانوني بدقة أو إضافة بنود مخصصة إضافية.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomClause}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة بند مخصص
                </button>
              </div>

              {/* Clauses Layout: Sidebar + Editor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[380px]">
                
                {/* List of Clauses */}
                <div className="border border-slate-800 rounded-2xl bg-slate-950/50 p-2 overflow-y-auto max-h-[420px] space-y-1">
                  {clauses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClauseId(c.id)}
                      className={`w-full text-right p-2.5 rounded-xl transition-all block text-xs font-bold ${
                        selectedClauseId === c.id
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <div className="truncate">{c.title}</div>
                    </button>
                  ))}
                </div>

                {/* Active Clause Text Editor */}
                <div className="md:col-span-2 border border-slate-800 rounded-2xl bg-slate-950/60 p-4 flex flex-col justify-between space-y-3">
                  {currentClause ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="font-black text-amber-400 text-xs">
                          {currentClause.title}
                        </h4>
                        {currentClause.is_custom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClause(currentClause.id)}
                            className="text-rose-400 hover:text-rose-300 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> حذف البند
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={10}
                        value={currentClause.text}
                        onChange={(e) => handleUpdateClauseText(currentClause.id, e.target.value)}
                        className="w-full flex-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-amber-500"
                      />

                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>💡 يدعم الحقول الذكية التلقائية: <b>&#123;&#123;رقم_العقد&#125;&#125;</b>، <b>&#123;&#123;اسم_المشروع&#125;&#125;</b>، <b>&#123;&#123;إجمالي_المبلغ&#125;&#125;</b></span>
                        <span className="text-amber-400/80 font-bold">بند نظامي ملزم</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 py-20">اختر بنداً لتحريره</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" /> الخطوة السابقة
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSaveAction(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              حفظ كمسودة
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev + 1) as any)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>متابعة الخطوة التالية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveAction(true)}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد وإصدار العقد رسمياً</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
