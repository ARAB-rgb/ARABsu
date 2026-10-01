/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Subcontract Invoices & IPC Management
 */

import React, { useState, useEffect } from "react";
import { Plus, FileText, CheckCircle2, AlertCircle, DollarSign, Calendar, Printer, Trash2, Edit3, X } from "lucide-react";
import { Subcontract, SubcontractInvoice, SubcontractInvoiceItem } from "../../types";
import { sb } from "../../db";

interface InvoicesTabProps {
  contract: Subcontract;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUpdateContract?: (updated: Subcontract) => void;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  contract,
  showToast,
}) => {
  const [invoices, setInvoices] = useState<SubcontractInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [items, setItems] = useState<SubcontractInvoiceItem[]>([]);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SubcontractInvoice["status"]>("submitted");

  // Load Invoices from DB
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from("subcontract_invoices")
        .select("*")
        .eq("contract_id", contract.id);

      if (!error && data) {
        setInvoices(data as SubcontractInvoice[]);
      }
    } catch (e) {
      console.warn("Failed to load subcontract invoices:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract.id) {
      loadInvoices();
    }
  }, [contract.id]);

  // Compute previous quantities for items based on prior approved or submitted invoices
  const getPreviousQty = (boqId: string) => {
    return invoices.reduce((sum, inv) => {
      const found = inv.items?.find((i) => i.boq_id === boqId);
      return sum + (Number(found?.current_qty) || 0);
    }, 0);
  };

  const handleOpenNewModal = () => {
    const nextNo = `INV-${contract.contract_no.slice(-4) || "001"}-${String(invoices.length + 1).padStart(2, "0")}`;
    setInvoiceNo(nextNo);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setPeriodStart(contract.commencement_date || new Date().toISOString().slice(0, 10));
    setPeriodEnd(new Date().toISOString().slice(0, 10));
    setAdvanceDeduction(0);
    setOtherDeductions(0);
    setNotes("");
    setStatus("submitted");

    // Initialize items from contract BOQ
    const initialItems: SubcontractInvoiceItem[] = (contract.boq || []).map((boq) => {
      const prevQty = getPreviousQty(boq.id);
      return {
        boq_id: boq.id,
        description: boq.description,
        unit: boq.unit,
        unit_price: boq.unit_price,
        contract_qty: boq.qty,
        previous_qty: prevQty,
        current_qty: 0,
        total_qty: prevQty,
        total_amount: 0,
      };
    });
    setItems(initialItems);
    setShowModal(true);
  };

  // Update quantity for an item
  const handleItemQtyChange = (index: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      const currentQty = Math.max(0, val);
      const totalQty = item.previous_qty + currentQty;
      const totalAmount = currentQty * item.unit_price;
      next[index] = {
        ...item,
        current_qty: currentQty,
        total_qty: totalQty,
        total_amount: totalAmount,
      };
      return next;
    });
  };

  // Gross current executed amount
  const grossAmount = items.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  
  // Retention deduction rate (e.g. 5% or 10%)
  const retentionPct = contract.retention_pct || 5;
  const retentionDeduction = (grossAmount * retentionPct) / 100;

  // Subtotal before tax
  const subtotalAfterDeductions = Math.max(0, grossAmount - advanceDeduction - retentionDeduction - otherDeductions);

  // VAT (15% if VAT applicable)
  const vatRate = contract.is_vat_inclusive || contract.vat_rate ? 15 : 0;
  const vatAmount = (subtotalAfterDeductions * vatRate) / 100;
  const netPayable = subtotalAfterDeductions + vatAmount;

  // Save Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNo.trim()) {
      showToast("يرجى إدخال رقم المستخلص", "error");
      return;
    }
    if (grossAmount <= 0) {
      showToast("يرجى إدخال كميات منفذة للمستخلص الحالي", "warning");
      return;
    }

    try {
      const newInvoice: SubcontractInvoice = {
        id: "inv_" + Date.now(),
        contract_id: contract.id,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        period_start: periodStart,
        period_end: periodEnd,
        items,
        gross_amount: grossAmount,
        advance_deduction: advanceDeduction,
        retention_deduction: retentionDeduction,
        other_deductions: otherDeductions,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        net_payable: netPayable,
        status,
        notes,
        created_at: new Date().toISOString(),
      };

      const { error } = await sb.from("subcontract_invoices").insert(newInvoice);
      if (error) throw error;

      showToast("تم حفظ مستخلص المقاولة بنجاح", "success");
      setShowModal(false);
      loadInvoices();
    } catch (e: any) {
      showToast("فشل في حفظ المستخلص: " + e.message, "error");
    }
  };

  // Delete invoice
  const handleDeleteInvoice = async (invId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستخلص نهائياً؟")) return;
    try {
      await sb.from("subcontract_invoices").delete().eq("id", invId);
      showToast("تم حذف المستخلص بنجاح", "info");
      loadInvoices();
    } catch (e: any) {
      showToast("فشل في الحذف: " + e.message, "error");
    }
  };

  // Summary Metrics
  const totalInvoicedGross = invoices.reduce((sum, inv) => sum + (Number(inv.gross_amount) || 0), 0);
  const totalRetentionHeld = invoices.reduce((sum, inv) => sum + (Number(inv.retention_deduction) || 0), 0);
  const totalNetPaidOrDue = invoices.reduce((sum, inv) => sum + (Number(inv.net_payable) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي قيمة العقد الأساسي</span>
          <span className="text-base font-black text-amber-400 font-mono mt-1 block">
            {contract.total_amount ? `${contract.total_amount.toLocaleString()} ريال` : "حسب القياس"}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي الأعمال المرفوعة (المستخلصات)</span>
          <span className="text-base font-black text-blue-400 font-mono mt-1 block">
            {totalInvoicedGross.toLocaleString()} <span className="text-xs text-slate-400">ريال</span>
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي المحتجزات (حسن التنفيذ)</span>
          <span className="text-base font-black text-purple-400 font-mono mt-1 block">
            {totalRetentionHeld.toLocaleString()} <span className="text-xs text-slate-400">ريال</span>
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 block">صافي المستحقات الصادرة</span>
          <span className="text-base font-black text-emerald-400 font-mono mt-1 block">
            {totalNetPaidOrDue.toLocaleString()} <span className="text-xs text-slate-400">ريال</span>
          </span>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>📑</span> مستخلصات العقد الجارية والنهائية (IPC)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            توثيق الكميات المنفذة، حساب المحتجزات والخصومات، وتوليد كشوفات الصرف النظامية.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>رفع مستخلص جديد</span>
        </button>
      </div>

      {/* Invoices List Table */}
      {invoices.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400">لا توجد مستخلصات مسجلة لهذا العقد حتى الآن.</p>
          <p className="text-[11px] text-slate-500 mt-1">اضغط على «رفع مستخلص جديد» لإدخال الكميات المنجزة واحتساب المستحقات بدقة.</p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <th className="p-3">رقم المستخلص</th>
                  <th className="p-3">تاريخ الإصدار</th>
                  <th className="p-3">فترة المستخلص</th>
                  <th className="p-3">إجمالي المنفذ</th>
                  <th className="p-3">المحتجز</th>
                  <th className="p-3">الصافي المستحق</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-all">
                    <td className="p-3 font-mono font-black text-amber-400">{inv.invoice_no}</td>
                    <td className="p-3 font-mono">{inv.invoice_date}</td>
                    <td className="p-3 text-[11px] text-slate-400 font-mono">
                      {inv.period_start || "---"} إلى {inv.period_end || "---"}
                    </td>
                    <td className="p-3 font-mono font-bold">{inv.gross_amount?.toLocaleString()} ريال</td>
                    <td className="p-3 font-mono text-purple-400">{inv.retention_deduction?.toLocaleString()} ريال</td>
                    <td className="p-3 font-mono font-black text-emerald-400">{inv.net_payable?.toLocaleString()} ريال</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        inv.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                        inv.status === "approved" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                        "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}>
                        {inv.status === "paid" ? "مسدد" : inv.status === "approved" ? "معتمد" : "مرفوع للمراجعة"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition-all cursor-pointer"
                        title="حذف المستخلص"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>📑</span> رفع مستخلص مقاولة جديد • {contract.contract_no}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveInvoice} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-300 block mb-1">رقم المستخلص *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-300 block mb-1">تاريخ الإصدار *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-300 block mb-1">حالة المستخلص</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="draft">مسودة</option>
                    <option value="submitted">مرفوع للمراجعة</option>
                    <option value="approved">معتمد للصرف</option>
                    <option value="paid">تم السداد</option>
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-amber-400 flex items-center justify-between">
                  <span>جدول حصر وقياس الكميات المنفذة:</span>
                  <span className="text-[11px] font-normal text-slate-400">يتم احتساب التراكمي والقيمة آلياً</span>
                </h4>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="p-2.5">البند والمواصفة</th>
                        <th className="p-2.5 text-center w-16">الوحدة</th>
                        <th className="p-2.5 text-center w-20">كمية العقد</th>
                        <th className="p-2.5 text-center w-20">السابق</th>
                        <th className="p-2.5 text-center w-28">الكمية الحالية *</th>
                        <th className="p-2.5 text-center w-20">التراكمي</th>
                        <th className="p-2.5 text-center w-24">سعر الوحدة</th>
                        <th className="p-2.5 text-center w-28">القيمة (ريال)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {items.map((item, idx) => (
                        <tr key={item.boq_id || idx} className="hover:bg-slate-900/40">
                          <td className="p-2.5 font-bold text-slate-200">{item.description}</td>
                          <td className="p-2.5 text-center text-slate-400">{item.unit}</td>
                          <td className="p-2.5 text-center font-mono">{item.contract_qty}</td>
                          <td className="p-2.5 text-center font-mono text-slate-400">{item.previous_qty}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.current_qty || ""}
                              onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                              placeholder="0"
                              className="w-24 px-2 py-1 bg-slate-900 border border-amber-500/40 rounded-lg text-center font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-400">{item.total_qty}</td>
                          <td className="p-2.5 text-center font-mono">{item.unit_price}</td>
                          <td className="p-2.5 text-center font-mono font-black text-amber-400">
                            {item.total_amount?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions & Final Calculation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">خصم استرداد دفعة مقدمة (ريال)</label>
                    <input
                      type="number"
                      min={0}
                      value={advanceDeduction || ""}
                      onChange={(e) => setAdvanceDeduction(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">خصومات أو غرامات أخرى (ريال)</label>
                    <input
                      type="number"
                      min={0}
                      value={otherDeductions || ""}
                      onChange={(e) => setOtherDeductions(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2 border-r border-slate-800 pr-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">إجمالي الأعمال الحالية:</span>
                    <span className="font-mono font-bold text-white">{grossAmount.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">محتجز حسن التنفيذ ({retentionPct}%):</span>
                    <span className="font-mono font-bold text-purple-400">- {retentionDeduction.toLocaleString()} ريال</span>
                  </div>
                  {vatAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-850">
                      <span className="text-slate-400">ضريبة القيمة المضافة (15%):</span>
                      <span className="font-mono font-bold text-blue-400">+ {vatAmount.toLocaleString()} ريال</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 bg-amber-500/10 px-3 rounded-xl border border-amber-500/20 mt-2">
                    <span className="font-black text-amber-300">صافي المستحق النهائي للصرف:</span>
                    <span className="font-mono font-black text-amber-400 text-sm">{netPayable.toLocaleString()} ريال</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  حفظ واعتماد المستخلص
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
