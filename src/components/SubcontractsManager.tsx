/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Subcontracts Master Management Hub (عرب وورلد للمقاولات)
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText, Plus, Search, Filter, Printer, Download, Eye, Edit3,
  Copy, Trash2, CheckCircle2, Clock, AlertTriangle, Shield,
  Building2, Users, DollarSign, Calendar, Upload, Settings,
  Briefcase, ChevronDown, Sparkles, X, ArrowUpDown
} from "lucide-react";
import { Subcontract, SubcontractParty } from "../types";
import { sb } from "../db";
import {
  ARAB_WORLD_DEFAULT_PARTY, CONTRACT_CATEGORIES_LIST, CONTRACT_STATUS_CONFIG,
  DEFAULT_25_CLAUSES
} from "../utils/subcontractDefaults";
import { ContractPrintView } from "./subcontracts/ContractPrintView";
import { ContractWizardModal } from "./subcontracts/ContractWizardModal";
import { InvoicesTab } from "./subcontracts/InvoicesTab";
import { ChangeOrdersTab } from "./subcontracts/ChangeOrdersTab";
import { DelayLogsTab } from "./subcontracts/DelayLogsTab";

interface SubcontractsManagerProps {
  selectedCompanyId?: string;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  can?: (permission: string) => boolean;
}

export const SubcontractsManager: React.FC<SubcontractsManagerProps> = ({
  selectedCompanyId,
  showToast,
}) => {
  const [contracts, setContracts] = useState<Subcontract[]>([]);
  const [loading, setLoading] = useState(false);

  // Active View Tabs: 'contracts' | 'invoices' | 'changes' | 'delays' | 'templates'
  const [activeTab, setActiveTab] = useState<"contracts" | "invoices" | "changes" | "delays" | "templates">("contracts");

  // Selected Contract for Detailed Tabs or Actions
  const [selectedContract, setSelectedContract] = useState<Subcontract | null>(null);

  // Modals
  const [showWizard, setShowWizard] = useState(false);
  const [editingContract, setEditingContract] = useState<Subcontract | null>(null);
  const [previewContract, setPreviewContract] = useState<Subcontract | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Arab World Settings (Logo & First Party Credentials)
  const [companySettings, setCompanySettings] = useState<{
    logo_url?: string;
    first_party: SubcontractParty;
  }>({
    first_party: ARAB_WORLD_DEFAULT_PARTY,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Load Settings and Contracts from Cloud Firestore
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Settings
      const { data: settsList } = await sb
        .from("subcontract_settings")
        .select("*")
        .eq("id", "aw_settings");

      const setts = settsList?.[0];
      if (setts) {
        setCompanySettings({
          logo_url: setts.logo_url || "",
          first_party: setts.first_party || ARAB_WORLD_DEFAULT_PARTY,
        });
      }

      // 2. Load Contracts
      const { data, error } = await sb
        .from("subcontracts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setContracts(data as Subcontract[]);
        if (data.length > 0 && !selectedContract) {
          setSelectedContract(data[0] as Subcontract);
        }
      }
    } catch (e) {
      console.warn("Error loading subcontracts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId]);

  // Save or Update Contract in Firestore
  const handleSaveContract = async (contract: Subcontract, isApproval = false) => {
    try {
      const exists = contracts.some((c) => c.id === contract.id);
      if (exists) {
        const { error } = await sb.from("subcontracts").update(contract).eq("id", contract.id);
        if (error) throw error;
        showToast(isApproval ? "تم اعتماد العقد بنجاح" : "تم تحديث بيانات العقد", "success");
      } else {
        const { error } = await sb.from("subcontracts").insert(contract);
        if (error) throw error;
        showToast(isApproval ? "تم اعتماد وإصدار العقد رسمياً" : "تم حفظ مسودة العقد بنجاح", "success");
      }
      setSelectedContract(contract);
      loadData();
    } catch (e: any) {
      showToast("حدث خطأ أثناء حفظ العقد: " + e.message, "error");
    }
  };

  // Delete Contract
  const handleDeleteContract = async (contractId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا العقد نهائياً؟")) return;
    try {
      await sb.from("subcontracts").delete().eq("id", contractId);
      showToast("تم حذف العقد بنجاح", "info");
      if (selectedContract?.id === contractId) {
        setSelectedContract(null);
      }
      loadData();
    } catch (e: any) {
      showToast("تعذر حذف العقد: " + e.message, "error");
    }
  };

  // Duplicate as Template
  const handleDuplicateAsTemplate = async (contract: Subcontract) => {
    const templateContract: Subcontract = {
      ...contract,
      id: "sub_" + Date.now(),
      contract_no: contract.contract_no + "-TMP",
      title: "قالب: " + contract.title,
      status: "draft",
      is_template: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await handleSaveContract(templateContract);
  };

  // Change Status Quick Action
  const handleStatusChange = async (contractId: string, newStatus: Subcontract["status"]) => {
    try {
      const { error } = await sb.from("subcontracts").update({ status: newStatus }).eq("id", contractId);
      if (error) throw error;
      showToast("تم تحديث حالة العقد", "success");
      loadData();
    } catch (e: any) {
      showToast("خطأ: " + e.message, "error");
    }
  };

  // Save Company Settings (Logo and Legal Credentials)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await sb.from("subcontract_settings").upsert({
        id: "aw_settings",
        logo_url: companySettings.logo_url,
        first_party: companySettings.first_party,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast("تم حفظ إعدادات وهوية عرب وورلد بنجاح", "success");
      setShowSettingsModal(false);
    } catch (e: any) {
      showToast("فشل حفظ الإعدادات: " + e.message, "error");
    }
  };

  // Handle Logo Upload (Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("حجم الشعار يجب ألا يتجاوز 2 ميجابايت", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompanySettings((prev) => ({
        ...prev,
        logo_url: reader.result as string,
      }));
      showToast("تم تحميل الشعار بنجاح", "success");
    };
    reader.readAsDataURL(file);
  };

  // Export Contracts to CSV
  const handleExportCSV = () => {
    if (contracts.length === 0) {
      showToast("لا توجد عقود لتصديرها", "warning");
      return;
    }
    const headers = ["رقم العقد", "عنوان العقد", "المقاول من الباطن", "المشروع", "التصنيف", "القيمة (ريال)", "الحالة", "تاريخ البدء", "تاريخ الانتهاء"];
    const rows = filteredContracts.map((c) => [
      c.contract_no,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${(c.second_party?.legal_name || "").replace(/"/g, '""')}"`,
      `"${(c.project_name || "").replace(/"/g, '""')}"`,
      `"${c.activity_category}"`,
      c.total_amount || 0,
      c.status,
      c.commencement_date || "",
      c.completion_date || "",
    ]);

    const csvContent = "\ufeff" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `عقود_المقاولات_من_الباطن_عرب_وورلد_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (activeTab === "templates" && !c.is_template) return false;
      if (activeTab !== "templates" && c.is_template) return false;

      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.activity_category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = c.contract_no?.toLowerCase().includes(q);
        const matchTitle = c.title?.toLowerCase().includes(q);
        const matchSub = c.second_party?.legal_name?.toLowerCase().includes(q);
        const matchProj = c.project_name?.toLowerCase().includes(q);
        return matchNo || matchTitle || matchSub || matchProj;
      }
      return true;
    });
  }, [contracts, activeTab, statusFilter, categoryFilter, searchQuery]);

  // Executive Metrics
  const activeContractsCount = contracts.filter((c) => c.status === "active" || c.status === "approved").length;
  const totalValueSum = contracts
    .filter((c) => !c.is_template)
    .reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);
  const totalRetentionSum = contracts
    .filter((c) => !c.is_template)
    .reduce((sum, c) => sum + (Number(c.retention_amount) || 0), 0);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Luxury Brand Header Bar */}
      <div className="bg-gradient-to-l from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-32 bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => setShowSettingsModal(true)}>
              {companySettings.logo_url ? (
                <img
                  src={companySettings.logo_url}
                  alt="شعار عرب وورلد"
                  className="w-16 h-16 object-contain rounded-2xl bg-slate-900/90 border-2 border-amber-500/40 p-1 shadow-lg shadow-amber-500/10 transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 rounded-2xl flex flex-col items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20 border-2 border-amber-400/80 transition-transform group-hover:scale-105">
                  <span className="font-black text-2xl tracking-tighter leading-none">AW</span>
                  <span className="text-[8px] font-black tracking-widest uppercase mt-0.5">ARAB WORLD</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-slate-900 text-amber-400 p-1 rounded-full border border-amber-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings className="w-3 h-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  عرب وورلد للمقاولات
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  إدارة عقود المقاولات من الباطن
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-bold">
                توثيق العقود، حماية الحقوق، إدارة المستخلصات والتغييرات والتأخيرات طبقاً للأنظمة السعودية
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700/60 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>إعدادات الهوية والشعار</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingContract(null);
                setShowWizard(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء عقد مقاولة جديد</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 block">العقود النشطة والمعتمدة</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-white font-mono">{activeContractsCount}</span>
              <span className="text-[11px] text-emerald-400 font-bold">عقد سارٍ</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي القيمة التعاقدية</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-amber-400 font-mono">
                {totalValueSum.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400">ريال</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 block">المحتجزات المحفوظة (ضمان حسن تنفيذ)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-purple-400 font-mono">
                {totalRetentionSum.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400">ريال</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي العقود المسجلة</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-blue-400 font-mono">{contracts.length}</span>
              <span className="text-[11px] text-slate-400">عقد وقالب</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("contracts")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "contracts"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📋 سجل العقود والاتفاقيات ({contracts.filter((c) => !c.is_template).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "invoices"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📑 المستخلصات وحساب الكميات (IPC)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("changes")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "changes"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔄 أوامر التغيير (Variation Orders)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delays")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "delays"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⏱️ محاضر التأخير والتوقف
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "templates"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⭐ قوالب العقود النموذجية ({contracts.filter((c) => c.is_template).length})
          </button>
        </div>

        {/* Selected contract badge when inside sub-tabs */}
        {activeTab !== "contracts" && activeTab !== "templates" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">العقد المحدد:</span>
            <select
              value={selectedContract?.id || ""}
              onChange={(e) => {
                const found = contracts.find((c) => c.id === e.target.value);
                if (found) setSelectedContract(found);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300"
            >
              {contracts.filter((c) => !c.is_template).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_no} - {c.second_party?.legal_name || c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: CONTRACTS LIST / TEMPLATES */}
      {(activeTab === "contracts" || activeTab === "templates") && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم العقد، اسم المقاول من الباطن، المشروع، أو النشاط..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">جميع الحالات</option>
                <option value="draft">مسودة</option>
                <option value="approved">معتمد</option>
                <option value="active">سارٍ وقيد التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="suspended">معلق</option>
                <option value="terminated">ملغى / مفسوخ</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer max-w-[180px]"
              >
                <option value="all">جميع التخصصات</option>
                {CONTRACT_CATEGORIES_LIST.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="تصدير كجدول بيانات CSV"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>تصدير Excel / CSV</span>
              </button>
            </div>
          </div>

          {/* Contracts Table */}
          {filteredContracts.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-black text-slate-300">لا توجد عقود تطابق معايير البحث</h3>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك الضغط على «إنشاء عقد مقاولة جديد» للبدء في صياغة أول عقد معتمد من الباطن.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingContract(null);
                  setShowWizard(true);
                }}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                إنشاء عقد جديد الآن
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3.5">رقم العقد</th>
                      <th className="p-3.5">مسمى العقد والتخصص</th>
                      <th className="p-3.5">المقاول من الباطن</th>
                      <th className="p-3.5">المشروع</th>
                      <th className="p-3.5">إجمالي القيمة</th>
                      <th className="p-3.5">المدة والتواريخ</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredContracts.map((c) => {
                      const statusCfg = CONTRACT_STATUS_CONFIG[c.status] || CONTRACT_STATUS_CONFIG.draft;
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-all">
                          {/* Contract No & Version */}
                          <td className="p-3.5">
                            <span className="font-mono font-black text-amber-400 text-xs block">
                              {c.contract_no}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              الإصدار V{c.version || 1}
                            </span>
                          </td>

                          {/* Title & Category */}
                          <td className="p-3.5">
                            <div className="font-black text-white">{c.title}</div>
                            <div className="text-[11px] text-amber-400/80 font-bold mt-0.5">
                              {c.activity_category} • <span className="text-slate-400">{c.contract_type}</span>
                            </div>
                          </td>

                          {/* Subcontractor */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{c.second_party?.legal_name || "غير محدد"}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {c.second_party?.cr_number ? `س.ت: ${c.second_party.cr_number}` : ""} 
                              {c.second_party?.phone ? ` • ${c.second_party.phone}` : ""}
                            </div>
                          </td>

                          {/* Project */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{c.project_name || "---"}</div>
                            <div className="text-[10px] text-slate-400">{c.project_location || ""}</div>
                          </td>

                          {/* Total Amount */}
                          <td className="p-3.5 font-mono">
                            <div className="font-black text-amber-400">
                              {c.total_amount ? `${c.total_amount.toLocaleString()} ريال` : "حسب القياس"}
                            </div>
                            {c.retention_amount ? (
                              <div className="text-[10px] text-purple-400">
                                محتجز: {c.retention_amount.toLocaleString()} ريال
                              </div>
                            ) : null}
                          </td>

                          {/* Dates */}
                          <td className="p-3.5 font-mono text-[11px] text-slate-300">
                            <div>{c.commencement_date || "---"}</div>
                            <div className="text-slate-500">{c.duration_days ? `${c.duration_days} يوم` : ""}</div>
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                              {statusCfg.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewContract(c)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-all cursor-pointer"
                                title="معاينة وطباعة وتصدير Word"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingContract(c);
                                  setShowWizard(true);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all cursor-pointer"
                                title="تعديل العقد"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDuplicateAsTemplate(c)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg transition-all cursor-pointer"
                                title="نسخ كقالب"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedContract(c);
                                  setActiveTab("invoices");
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-all cursor-pointer"
                                title="إدارة المستخلصات"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteContract(c.id)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-lg transition-all cursor-pointer"
                                title="حذف العقد"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: INVOICES TAB */}
      {activeTab === "invoices" && (
        selectedContract ? (
          <InvoicesTab
            contract={selectedContract}
            showToast={showToast}
          />
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 text-xs">
            يرجى اختيار عقد لعرض مستخلصاته المالية.
          </div>
        )
      )}

      {/* VIEW 3: CHANGE ORDERS TAB */}
      {activeTab === "changes" && (
        selectedContract ? (
          <ChangeOrdersTab
            contract={selectedContract}
            showToast={showToast}
          />
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 text-xs">
            يرجى اختيار عقد لعرض أوامر التغيير الخاصة به.
          </div>
        )
      )}

      {/* VIEW 4: DELAYS TAB */}
      {activeTab === "delays" && (
        selectedContract ? (
          <DelayLogsTab
            contract={selectedContract}
            showToast={showToast}
          />
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 text-xs">
            يرجى اختيار عقد لعرض محاضر التأخير والتوقف.
          </div>
        )
      )}

      {/* CONTRACT WIZARD MODAL */}
      {showWizard && (
        <ContractWizardModal
          isOpen={showWizard}
          onClose={() => {
            setShowWizard(false);
            setEditingContract(null);
          }}
          onSave={handleSaveContract}
          initialContract={editingContract}
          existingContractsCount={contracts.length}
          defaultFirstParty={companySettings.first_party}
          showToast={showToast}
        />
      )}

      {/* PRINT & WORD PREVIEW MODAL */}
      {previewContract && (
        <ContractPrintView
          contract={previewContract}
          onClose={() => setPreviewContract(null)}
          logoUrl={companySettings.logo_url}
        />
      )}

      {/* ARAB WORLD IDENTITY & LOGO SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-2xl shadow-2xl p-6 space-y-6 text-xs text-right">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>إعدادات هوية «عرب وورلد للمقاولات» والشعار المعتمد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Logo Upload Section */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-5">
                <div className="shrink-0">
                  {companySettings.logo_url ? (
                    <img
                      src={companySettings.logo_url}
                      alt="Logo"
                      className="w-20 h-20 object-contain rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-1"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 rounded-2xl flex flex-col items-center justify-center text-slate-950 font-black">
                      <span className="text-2xl">AW</span>
                      <span className="text-[7px]">ARAB WORLD</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <h4 className="font-bold text-white text-xs">شعار الشركة في العقود والمطبوعات الرسمية</h4>
                  <p className="text-[11px] text-slate-400">
                    يمكنك رفع الشعار الرسمي لعرب وورلد (PNG أو SVG) ليظهر أعلى جميع العقود المطبوعة ومستندات Word.
                  </p>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer text-xs transition-all shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع شعار مخصص</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {companySettings.logo_url && (
                    <button
                      type="button"
                      onClick={() => setCompanySettings((p) => ({ ...p, logo_url: "" }))}
                      className="text-rose-400 text-[11px] font-bold block hover:underline cursor-pointer"
                    >
                      استعادة شعار AW الافتراضي
                    </button>
                  )}
                </div>
              </div>

              {/* First Party Official Legal Data */}
              <div className="space-y-3">
                <h4 className="font-black text-amber-400 text-xs">بيانات الطرف الأول الرسمية (الافتراضية في كل عقد):</h4>
                
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">اسم الشركة الرسمي الكامل</label>
                  <input
                    type="text"
                    required
                    value={companySettings.first_party.legal_name}
                    onChange={(e) =>
                      setCompanySettings({
                        ...companySettings,
                        first_party: { ...companySettings.first_party, legal_name: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">رقم السجل التجاري</label>
                    <input
                      type="text"
                      value={companySettings.first_party.cr_number}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          first_party: { ...companySettings.first_party, cr_number: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">الرقم الضريبي (ZATCA)</label>
                    <input
                      type="text"
                      value={companySettings.first_party.tax_number}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          first_party: { ...companySettings.first_party, tax_number: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">اسم المفوض بالتوقيع</label>
                    <input
                      type="text"
                      value={companySettings.first_party.representative_name}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          first_party: { ...companySettings.first_party, representative_name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">صفة المفوض</label>
                    <input
                      type="text"
                      value={companySettings.first_party.representative_title}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          first_party: { ...companySettings.first_party, representative_title: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-bold">العنوان الوطني المعتمد</label>
                  <input
                    type="text"
                    value={companySettings.first_party.national_address}
                    onChange={(e) =>
                      setCompanySettings({
                        ...companySettings,
                        first_party: { ...companySettings.first_party, national_address: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
