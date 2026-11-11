import React, { useState } from "react";
import { Company, AuthUser } from "../types";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Building2,
  UserCheck,
  Phone,
  FileText,
  DollarSign,
  MapPin,
  Calendar,
  Globe,
  ExternalLink,
  Clock,
  AlertTriangle,
  Sparkles,
  KeyRound,
  Edit3
} from "lucide-react";

interface SuperAdminCompanyApprovalsProps {
  companies: Company[];
  users: AuthUser[];
  currentUser: AuthUser | null;
  onApproveCompany: (companyId: string) => Promise<void>;
  onRejectCompany: (companyId: string, reason?: string) => Promise<void>;
  onSwitchCompany?: (companyId: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const SuperAdminCompanyApprovals: React.FC<SuperAdminCompanyApprovalsProps> = ({
  companies,
  users,
  currentUser,
  onApproveCompany,
  onRejectCompany,
  onSwitchCompany,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalComp, setRejectModalComp] = useState<Company | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Categorize companies
  const pendingCompanies = companies.filter(
    (c) => c.status === "بانتظار موافقة السوبر أدمن" || c.status === "pending_approval"
  );
  const approvedCompanies = companies.filter(
    (c) => !c.status || c.status === "نشط" || c.status === "active" || c.status === "معتمدة"
  );
  const rejectedCompanies = companies.filter((c) => c.status === "مرفوض");

  const handleApprove = async (company: Company) => {
    setProcessingId(company.id);
    try {
      await onApproveCompany(company.id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalComp) return;
    setProcessingId(rejectModalComp.id);
    try {
      await onRejectCompany(rejectModalComp.id, rejectionReason.trim());
      setRejectModalComp(null);
      setRejectionReason("");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-2xl border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden" dir="rtl">
      {/* Royal Background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 rounded-2xl text-xl shadow-inner">
              👑
            </span>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>خانة السوبر أدمن — موافقات تسجيل الشركات الجديدة</span>
                {pendingCompanies.length > 0 && (
                  <span className="animate-pulse bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[11px] px-3 py-0.5 rounded-full shadow-md shadow-amber-500/20">
                    {pendingCompanies.length} طلب بانتظار موافقتك
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                الصلاحية الحصرية للسوبر أدمن لمراجعة واعتماد طلبات تأسيس المنشآت السحابية وتفعيل الحسابات رسمياً.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
            <span className="text-[10px] text-amber-400 font-bold block">بانتظار القرار</span>
            <span className="text-sm font-black text-amber-300 font-mono">{pendingCompanies.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
            <span className="text-[10px] text-emerald-400 font-bold block">معتمدة ونشطة</span>
            <span className="text-sm font-black text-emerald-300 font-mono">{approvedCompanies.length}</span>
          </div>
          {rejectedCompanies.length > 0 && (
            <div className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center">
              <span className="text-[10px] text-rose-400 font-bold block">مرفوضة</span>
              <span className="text-sm font-black text-rose-300 font-mono">{rejectedCompanies.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "pending"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
              : "bg-slate-950/60 hover:bg-slate-850 text-slate-300 border border-slate-800"
          }`}
        >
          <span>⏳</span>
          <span>الطلبات بانتظار الاعتماد</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            activeTab === "pending" ? "bg-slate-950 text-amber-400" : "bg-amber-500/20 text-amber-300"
          }`}>
            {pendingCompanies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "approved"
              ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
              : "bg-slate-950/60 hover:bg-slate-850 text-slate-300 border border-slate-800"
          }`}
        >
          <span>✅</span>
          <span>الشركات المعتمدة</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            activeTab === "approved" ? "bg-slate-950 text-emerald-400" : "bg-emerald-500/20 text-emerald-300"
          }`}>
            {approvedCompanies.length}
          </span>
        </button>

        {rejectedCompanies.length > 0 && (
          <button
            onClick={() => setActiveTab("rejected")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rejected"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "bg-slate-950/60 hover:bg-slate-850 text-slate-300 border border-slate-800"
            }`}
          >
            <span>❌</span>
            <span>الطلبات المرفوضة</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-rose-500/20 text-rose-300">
              {rejectedCompanies.length}
            </span>
          </button>
        )}
      </div>

      {/* Tab 1: Pending Approvals */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingCompanies.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-3xl space-y-3">
              <span className="text-4xl block">✨</span>
              <h4 className="text-sm font-black text-white">لا توجد طلبات تسجيل شركات جديدة بانتظار الاعتماد حالياً</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                جميع طلبات تسجيل الشركات التي وردت إلى المنظومة تم فحصها واعتمادها بالكامل.
                أي طلب جديد يتم تقديمه من البوابة سيظهر هنا مباشرة للموافقة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {pendingCompanies.map((comp) => {
                const isProcessing = processingId === comp.id;
                const adminUser = users.find((u) => u.company_id === comp.id && u.role === "admin");

                return (
                  <div
                    key={comp.id}
                    className="bg-slate-950/70 border-2 border-amber-500/30 hover:border-amber-500/60 transition-all rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl relative overflow-hidden"
                  >
                    {/* Status Top Tag */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-yellow-500/5 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 text-xl font-black shrink-0">
                          🏢
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                            <span>{comp.name}</span>
                            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                              ⏳ بانتظار موافقة السوبر أدمن
                            </span>
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-mono">
                            <span className="text-amber-300">الرابط المخصص: /{comp.slug}</span>
                            <span>•</span>
                            <span>النطاق: {comp.domain || comp.slug}{comp.domain_extension || ".com"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:text-left text-[11px] text-slate-500 font-mono">
                        <span>📅 تاريخ التقديم: </span>
                        <span className="text-slate-300 font-bold">
                          {comp.created_at ? new Date(comp.created_at).toLocaleString("ar-SA") : "الآن"}
                        </span>
                      </div>
                    </div>

                    {/* Full Company Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      {/* 1. Manager */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>المدير المسؤول والمفوض:</span>
                        </span>
                        <p className="text-xs font-black text-white">{comp.manager || "غير محدد"}</p>
                      </div>

                      {/* 2. Phone */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-amber-400" />
                          <span>رقم هاتف المنشأة:</span>
                        </span>
                        <p className="text-xs font-mono font-black text-white dir-ltr text-right">{comp.phone || "غير مدخل"}</p>
                      </div>

                      {/* 3. Commercial Register */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>السجل التجاري:</span>
                        </span>
                        <p className="text-xs font-mono font-black text-white">
                          {comp.record_no || comp.commercial_register || "غير مدخل"}
                        </p>
                      </div>

                      {/* 4. Tax ID */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>الرقم الضريبي الموحد:</span>
                        </span>
                        <p className="text-xs font-mono font-black text-white">{comp.tax_no || "غير مدخل"}</p>
                      </div>

                      {/* 5. Capital */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                          <span>رأس المال بالعقود:</span>
                        </span>
                        <p className="text-xs font-black text-amber-300 font-mono">
                          {Number(comp.capital || 0).toLocaleString("ar-SA")} ريال سعودي
                        </p>
                      </div>

                      {/* 6. Address */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>العنوان والمقر:</span>
                        </span>
                        <p className="text-xs font-medium text-slate-200 truncate">{comp.address || "غير مدخل"}</p>
                      </div>

                      {/* 7. Admin Account Code */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>كود حساب المدير:</span>
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-200">
                          {comp.admin_code || adminUser?.code || "admin"}
                        </p>
                      </div>

                      {/* 8. Web & Domain */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-amber-400" />
                          <span>رابط الدخول المباشر:</span>
                        </span>
                        <p className="text-xs font-mono text-slate-300 truncate dir-ltr text-right">
                          arab1000.online/{comp.slug}
                        </p>
                      </div>
                    </div>

                    {/* Super Admin Action Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2 text-xs text-amber-400/90 font-bold">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>عند الموافقة، سيتم تفعيل حساب المشرف وتدشين المنشأة رسمياً في المنظومة.</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Reject Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => {
                            setRejectModalComp(comp);
                            setRejectionReason("");
                          }}
                          className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>رفض الطلب</span>
                        </button>

                        {/* Approve Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => handleApprove(comp)}
                          className="px-6 py-2.5 bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                          {isProcessing ? (
                            <>
                              <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                              <span>جاري الاعتماد والتفعيل...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-slate-950" />
                              <span>موافقة واعتماد الشركة وتفعيلها فوراً 👑</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Approved Companies */}
      {activeTab === "approved" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedCompanies.map((comp) => (
              <div
                key={comp.id}
                className="bg-slate-950/60 border border-slate-800 hover:border-emerald-500/30 transition-all rounded-2xl p-4 space-y-3 relative"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black text-sm">
                      🏢
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{comp.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">/{comp.slug}</span>
                    </div>
                  </div>
                  <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-md">
                    معتمدة ونشطة
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1 font-sans">
                  <div>المدير: <span className="text-white font-bold">{comp.manager || "غير محدد"}</span></div>
                  <div>الهاتف: <span className="font-mono text-slate-200">{comp.phone || "-"}</span></div>
                  <div>رأس المال: <span className="font-mono text-amber-300 font-bold">{Number(comp.capital || 0).toLocaleString("ar-SA")} ريال</span></div>
                  {comp.approval_date && (
                    <div className="text-[9px] text-slate-500 font-mono">
                      اعتمدت بتاريخ: {new Date(comp.approval_date).toLocaleDateString("ar-SA")}
                    </div>
                  )}
                </div>

                {onSwitchCompany && (
                  <button
                    onClick={() => onSwitchCompany(comp.id)}
                    className="w-full mt-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏢 الدخول للشركة كمدير عام</span>
                    <ExternalLink className="w-3 h-3 text-amber-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Rejected Companies */}
      {activeTab === "rejected" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rejectedCompanies.map((comp) => (
              <div
                key={comp.id}
                className="bg-slate-950/60 border border-rose-500/30 rounded-2xl p-4 space-y-3 relative"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-white">{comp.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">/{comp.slug}</span>
                  </div>
                  <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[9px] font-black px-2 py-0.5 rounded-md">
                    طلب مرفوض
                  </span>
                </div>

                <div className="p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl text-[11px] text-rose-300">
                  <span className="font-bold block text-[10px] text-rose-400">سبب الرفض:</span>
                  <span>{comp.rejection_reason || "تم الرفض بواسطة السوبر أدمن"}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(comp)}
                    className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>إعادة الاعتماد والتفعيل</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalComp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative" dir="rtl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="text-rose-500">❌</span>
              <span>رفض طلب تسجيل شركة «{rejectModalComp.name}»</span>
            </h3>
            <p className="text-xs text-slate-400">
              يرجى كتابة سبب رفض الطلب لتوثيق الإجراء في سجلات المنظومة:
            </p>
            <textarea
              rows={3}
              placeholder="اكتب سبب الرفض (مثال: بيانات السجل غير متطابقة، الرابط غير مصرح به...)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 text-right"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectModalComp(null)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={processingId === rejectModalComp.id}
                onClick={handleConfirmReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {processingId === rejectModalComp.id ? "جاري الرفض..." : "تأكيد الرفض"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
