/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Official A4 Subcontract Print & Export View
 */

import React, { useRef } from "react";
import { Printer, Download, X, FileText, CheckCircle2, Shield } from "lucide-react";
import { Subcontract } from "../../types";
import { replaceSmartVariables, CONTRACT_STATUS_CONFIG } from "../../utils/subcontractDefaults";

interface ContractPrintViewProps {
  contract: Subcontract;
  onClose: () => void;
  logoUrl?: string;
}

export const ContractPrintView: React.FC<ContractPrintViewProps> = ({
  contract,
  onClose,
  logoUrl,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = () => {
    if (!printContentRef.current) return;
    const content = printContentRef.current.innerHTML;
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${contract.contract_no} - ${contract.title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; margin: 2cm; }
          h1, h2, h3 { color: #0f172a; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #94a3b8; padding: 8px 12px; font-size: 11pt; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
          .header-box { border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px; }
          .clause-title { font-weight: bold; color: #0f172a; margin-top: 14px; font-size: 12pt; }
          .clause-text { font-size: 11pt; line-height: 1.7; color: #334155; text-align: justify; }
          .signature-box { margin-top: 40px; page-break-inside: avoid; }
        </style>
      </head>
      <body>
    `;
    const footer = `</body></html>`;
    const sourceHTML = header + content + footer;
    const blob = new Blob(["\ufeff" + sourceHTML], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contract.contract_no}_عقد_مقاولات_${contract.second_party?.legal_name || "مقاولة"}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const statusCfg = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.draft;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-6" dir="rtl">
      {/* Top Action Bar */}
      <div className="w-full max-w-5xl bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-xl shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>{contract.title || "عقد مقاولة من الباطن"}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                {statusCfg.label}
              </span>
              <span className="text-xs text-amber-400/80 font-mono">الإصدار {contract.version}</span>
            </h3>
            <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
              رقم العقد: {contract.contract_no} • المقاول: {contract.second_party?.legal_name || "غير محدد"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة / حفظ PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadWord}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Word (.doc)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable A4 Paper Container */}
      <div
        ref={printContentRef}
        className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 border border-slate-300 text-right leading-relaxed font-sans print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none"
      >
        {/* Official Header */}
        <div className="header-box border-b-2 border-amber-600 pb-5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-right">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {contract.first_party?.legal_name || "شركة عرب وورلد للمقاولات العامة"}
              </h1>
              <p className="text-xs font-bold text-amber-700 mt-1">
                إدارة العقود والمشاريع والمقاولات من الباطن
              </p>
              <div className="text-[10px] text-slate-600 space-y-0.5 mt-2 font-mono">
                {contract.first_party?.cr_number && <div>السجل التجاري: {contract.first_party.cr_number}</div>}
                {contract.first_party?.tax_number && <div>الرقم الضريبي: {contract.first_party.tax_number}</div>}
                {contract.first_party?.national_address && <div>العنوان الوطني: {contract.first_party.national_address}</div>}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="شعار عرب وورلد"
                  className="h-16 w-auto object-contain mb-1 max-w-[120px]"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 rounded-2xl flex items-center justify-center text-slate-950 shadow-md border-2 border-amber-600 mb-1">
                  <span className="font-black text-xl tracking-tighter">AW</span>
                </div>
              )}
              <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">
                ARAB WORLD
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">رقم العقد:</span>
              <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-bold">{contract.contract_no}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">تاريخ التحرير:</span>
              <span className="font-mono text-slate-900">{contract.commencement_date || new Date().toISOString().slice(0, 10)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">طبيعة التعاقد:</span>
              <span className="text-amber-800 font-black">{contract.contract_type}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-6">
          <h2 className="text-lg sm:text-xl font-black text-slate-950 underline decoration-amber-600 decoration-2 underline-offset-8">
            {contract.title || "عقد مقاولة من الباطن"}
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-2">
            مشروع: {contract.project_name || "مشروع مقاولات عامة"} • {contract.activity_category}
          </p>
        </div>

        {/* Parties Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-6 space-y-4 text-xs">
          <div className="border-b border-slate-200 pb-3">
            <h4 className="font-black text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              الطرف الأول (عرب وورلد للمقاولات - المقاول العام):
            </h4>
            <p className="leading-relaxed text-slate-700">
              <b>{contract.first_party?.legal_name || "شركة عرب وورلد للمقاولات العامة"}</b>، 
              سجل تجاري: <span className="font-mono">{contract.first_party?.cr_number || "غير مدخل"}</span>، 
              الرقم الضريبي: <span className="font-mono">{contract.first_party?.tax_number || "غير مدخل"}</span>، 
              العنوان الوطني: {contract.first_party?.national_address || "المملكة العربية السعودية"}، 
              هاتف: <span className="font-mono">{contract.first_party?.phone || "غير مدخل"}</span>، 
              بريد: <span className="font-mono">{contract.first_party?.email || "غير مدخل"}</span>. 
              يمثلها في التوقيع: <b>{contract.first_party?.representative_name || "المفوض بالتوقيع"}</b> بصفته ({contract.first_party?.representative_title || "المدير العام"}).
            </p>
          </div>

          <div>
            <h4 className="font-black text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              الطرف الثاني (المقاول من الباطن):
            </h4>
            <p className="leading-relaxed text-slate-700">
              <b>{contract.second_party?.legal_name || "مؤسسة / شركة المقاول من الباطن"}</b>، 
              نوع الكيان: {contract.second_party?.entity_type || "مؤسسة فردية"}، 
              سجل تجاري: <span className="font-mono">{contract.second_party?.cr_number || "غير مدخل"}</span>، 
              الرقم الضريبي: <span className="font-mono">{contract.second_party?.tax_number || "غير مدخل"}</span>، 
              العنوان: {contract.second_party?.national_address || "المملكة العربية السعودية"}، 
              هاتف: <span className="font-mono">{contract.second_party?.phone || "غير مدخل"}</span>، 
              بريد: <span className="font-mono">{contract.second_party?.email || "غير مدخل"}</span>. 
              يمثلها في التوقيع: <b>{contract.second_party?.representative_name || "المفوض بالتوقيع"}</b> بصفته ({contract.second_party?.representative_title || "المالك / المفوض"}).
              {contract.second_party?.iban && (
                <span className="block mt-1 font-mono text-[11px] text-slate-600">
                  الحساب البنكي المعتمد: {contract.second_party.bank_name || "البنك"} - IBAN: {contract.second_party.iban} (باسم المنشأة)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Project Summary Box */}
        <div className="border border-slate-200 rounded-xl overflow-hidden my-6">
          <div className="bg-slate-100 px-4 py-2 font-black text-xs text-slate-800 border-b border-slate-200">
            بيانات المشروع وموقع العمل
          </div>
          <table className="w-full text-xs text-right">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600 w-1/4">اسم المشروع:</td>
                <td className="p-2.5 text-slate-900 font-bold w-1/4">{contract.project_name || "---"}</td>
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600 w-1/4">المالك / جهة الإشراف:</td>
                <td className="p-2.5 text-slate-900 w-1/4">{contract.project_owner || "---"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">موقع المشروع:</td>
                <td className="p-2.5 text-slate-900">{contract.project_location || "---"}</td>
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">المهندس المشرف:</td>
                <td className="p-2.5 text-slate-900">{contract.supervising_engineer || "---"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">مدة التنفيذ:</td>
                <td className="p-2.5 text-slate-900 font-mono font-bold">{contract.duration_days ? `${contract.duration_days} يوماً تقويمياً` : "---"}</td>
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">تاريخ بدء وانتهاء العمل:</td>
                <td className="p-2.5 text-slate-900 font-mono">{contract.commencement_date || "---"} إلى {contract.completion_date || "---"}</td>
              </tr>
              <tr>
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">نوع المشروع:</td>
                <td className="p-2.5 text-slate-900">{contract.is_governmental ? "مشروع حكومي" : "مشروع خاص"}</td>
                <td className="p-2.5 bg-slate-50 font-bold text-slate-600">إجمالي قيمة العقد:</td>
                <td className="p-2.5 text-slate-900 font-mono font-black text-amber-800">
                  {contract.total_amount ? `${contract.total_amount.toLocaleString()} ريال سعودي` : "طبقاً للحصر والقياس الفعلي"}
                  {contract.is_vat_inclusive ? " (شامل الضريبة)" : " (غير شامل الضريبة)"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bill of Quantities (if exists) */}
        {contract.boq && contract.boq.length > 0 && (
          <div className="my-6">
            <h3 className="font-black text-slate-900 text-sm mb-2">
              جدول الكميات والأسعار المعتمد (BOQ):
            </h3>
            <table className="w-full text-xs text-right border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                  <th className="p-2 text-center w-12">#</th>
                  <th className="p-2">بيان ووصف الأعمال والمواصفة</th>
                  <th className="p-2 text-center w-16">الوحدة</th>
                  <th className="p-2 text-center w-20">الكمية</th>
                  <th className="p-2 text-center w-24">سعر الوحدة</th>
                  <th className="p-2 text-center w-28">الإجمالي (ريال)</th>
                </tr>
              </thead>
              <tbody>
                {contract.boq.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-slate-200">
                    <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-2 font-bold text-slate-800">{item.description}</td>
                    <td className="p-2 text-center text-slate-600">{item.unit}</td>
                    <td className="p-2 text-center font-mono text-slate-900 font-bold">{item.qty?.toLocaleString()}</td>
                    <td className="p-2 text-center font-mono text-slate-900">{item.unit_price?.toLocaleString()}</td>
                    <td className="p-2 text-center font-mono font-bold text-amber-800">{item.total_price?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black text-slate-900">
                  <td colSpan={5} className="p-2 text-left pl-4">المجموع الإجمالي لجدول الكميات:</td>
                  <td className="p-2 text-center font-mono text-amber-800">
                    {contract.boq.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0).toLocaleString()} ريال
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Contract Clauses */}
        <div className="my-8 space-y-5">
          <h3 className="font-black text-slate-950 text-base border-b border-slate-300 pb-2">
            بنود وشروط عقد المقاولة من الباطن:
          </h3>

          {contract.clauses?.map((clause) => {
            const parsedText = replaceSmartVariables(clause.text, contract);
            return (
              <div key={clause.id} className="text-justify leading-relaxed">
                <h4 className="clause-title font-black text-slate-900 text-xs sm:text-sm mb-1">
                  {clause.title}
                </h4>
                <p className="clause-text text-slate-700 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line">
                  {parsedText}
                </p>
              </div>
            );
          })}
        </div>

        {/* Signatures and Seals */}
        <div className="signature-box mt-12 pt-8 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h4 className="font-black text-slate-900 text-sm mb-2">عن الطرف الأول</h4>
            <p className="font-bold text-slate-800 mb-4">{contract.first_party?.legal_name || "شركة عرب وورلد للمقاولات"}</p>
            <div className="text-right space-y-2 text-[11px] text-slate-600">
              <div>اسم المفوض: {contract.first_party?.representative_name || "...................................."}</div>
              <div>الصفة: {contract.first_party?.representative_title || "المدير العام"}</div>
              <div>التوقيع: ....................................</div>
              <div>التاريخ: {contract.first_party_signed_at || "....../....../2026م"}</div>
            </div>
            <div className="mt-8 border-2 border-dashed border-slate-300 h-20 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
              (الختم الرسمي للطرف الأول)
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h4 className="font-black text-slate-900 text-sm mb-2">عن الطرف الثاني (المقاول من الباطن)</h4>
            <p className="font-bold text-slate-800 mb-4">{contract.second_party?.legal_name || "مؤسسة / شركة المقاول"}</p>
            <div className="text-right space-y-2 text-[11px] text-slate-600">
              <div>اسم الممثل: {contract.second_party?.representative_name || "...................................."}</div>
              <div>الصفة: {contract.second_party?.representative_title || "المفوض بالتوقيع"}</div>
              <div>التوقيع: ....................................</div>
              <div>التاريخ: {contract.second_party_signed_at || "....../....../2026م"}</div>
            </div>
            <div className="mt-8 border-2 border-dashed border-slate-300 h-20 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
              (الختم الرسمي للطرف الثاني)
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-mono flex justify-between items-center">
          <span>عقد مقاولة رسمي معتمد • شركة عرب وورلد للمقاولات</span>
          <span>صفحة 1 من 1</span>
          <span>{contract.contract_no} • الإصدار {contract.version}</span>
        </div>
      </div>
    </div>
  );
};
