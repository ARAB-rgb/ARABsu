/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Subcontract Change Orders (أوامر التغيير)
 */

import React, { useState, useEffect } from "react";
import { Plus, GitPullRequest, CheckCircle2, Clock, Trash2, X, AlertTriangle } from "lucide-react";
import { Subcontract, SubcontractChangeOrder } from "../../types";
import { sb } from "../../db";

interface ChangeOrdersTabProps {
  contract: Subcontract;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ChangeOrdersTab: React.FC<ChangeOrdersTabProps> = ({
  contract,
  showToast,
}) => {
  const [orders, setOrders] = useState<SubcontractChangeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [orderNo, setOrderNo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [impactDays, setImpactDays] = useState<number>(0);
  const [status, setStatus] = useState<SubcontractChangeOrder["status"]>("pending");

  const loadChangeOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from("subcontract_changes")
        .select("*")
        .eq("contract_id", contract.id);

      if (!error && data) {
        setOrders(data as SubcontractChangeOrder[]);
      }
    } catch (e) {
      console.warn("Failed to load change orders:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract.id) {
      loadChangeOrders();
    }
  }, [contract.id]);

  const handleOpenModal = () => {
    const nextNo = `CO-${String(orders.length + 1).padStart(2, "0")}`;
    setOrderNo(nextNo);
    setTitle("");
    setDescription("");
    setReason("");
    setQty(1);
    setUnitPrice(0);
    setImpactDays(0);
    setStatus("pending");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("يرجى إدخال عنوان أمر التغيير", "error");
      return;
    }

    try {
      const newOrder: SubcontractChangeOrder = {
        id: "co_" + Date.now(),
        contract_id: contract.id,
        order_no: orderNo,
        title,
        description,
        reason,
        qty: Number(qty) || 1,
        unit_price: Number(unitPrice) || 0,
        total_amount: (Number(qty) || 1) * (Number(unitPrice) || 0),
        impact_days: Number(impactDays) || 0,
        status,
        date: new Date().toISOString().slice(0, 10),
      };

      const { error } = await sb.from("subcontract_changes").insert(newOrder);
      if (error) throw error;

      showToast("تم توثيق أمر التغيير بنجاح", "success");
      setShowModal(false);
      loadChangeOrders();
    } catch (e: any) {
      showToast("خطأ في الحفظ: " + e.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف أمر التغيير؟")) return;
    try {
      await sb.from("subcontract_changes").delete().eq("id", id);
      showToast("تم الحذف بنجاح", "info");
      loadChangeOrders();
    } catch (e: any) {
      showToast("فشل الحذف: " + e.message, "error");
    }
  };

  const totalApprovedChangeValue = orders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const totalApprovedDays = orders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (Number(o.impact_days) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي أوامر التغيير المسجلة</span>
          <span className="text-base font-black text-amber-400 font-mono mt-1 block">{orders.length}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">القيمة المالية المعتمدة للتغييرات</span>
          <span className="text-base font-black text-emerald-400 font-mono mt-1 block">
            {totalApprovedChangeValue.toLocaleString()} ريال
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">الأيام الإضافية المعتمدة للجدول الزمني</span>
          <span className="text-base font-black text-blue-400 font-mono mt-1 block">
            {totalApprovedDays} يوماً تقويمياً
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>🔄</span> أوامر التغيير والأعمال الإضافية (Variation Orders)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            توثيق التغييرات الفنية، تعديل المواصفات، احتساب الأثر المالي وتمديد مدة التنفيذ رسمياً.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار أمر تغيير</span>
        </button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
          <GitPullRequest className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400">لا توجد أوامر تغيير مسجلة لهذا العقد.</p>
          <p className="text-[11px] text-slate-500 mt-1">أي أعمال إضافية أو تعديل في المواصفات يجب توثيقه بأمر تغيير خطي لحفظ حقوق الطرفين.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all space-y-2 text-right"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {order.order_no}
                  </span>
                  <h4 className="text-xs font-black text-white">{order.title}</h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    order.status === "approved" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                    order.status === "rejected" ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" :
                    "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  }`}>
                    {order.status === "approved" ? "معتمد" : order.status === "rejected" ? "مرفوض" : "قيد الدراسة"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(order.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {order.description && (
                <p className="text-xs text-slate-300 leading-relaxed">{order.description}</p>
              )}

              {order.reason && (
                <div className="text-[11px] text-slate-400">
                  <span className="font-bold text-slate-500">سبب التغيير:</span> {order.reason}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono">
                <div className="flex items-center gap-4 text-slate-400">
                  <span>الكمية: <b className="text-white">{order.qty}</b></span>
                  <span>السعر: <b className="text-white">{order.unit_price?.toLocaleString()} ريال</b></span>
                  <span>الأثر الزمني: <b className="text-blue-400">+{order.impact_days} يوم</b></span>
                </div>
                <div className="text-amber-400 font-black">
                  إجمالي القيمة: {order.total_amount?.toLocaleString()} ريال
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🔄</span> إنشاء أمر تغيير رسمي
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">رقم أمر التغيير</label>
                  <input
                    type="text"
                    required
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">الحالة</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  >
                    <option value="pending">بانتظار الاعتماد</option>
                    <option value="approved">معتمد رسمياً</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">عنوان أو بيان التغيير *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: إضافة أعمال نعلات رخامية وعزل إضافي لدورات المياه"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">سبب التغيير</label>
                <input
                  type="text"
                  placeholder="مثال: طلب رسمي من المالك / تعديل معماري / عائق إنشائي"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">الكمية</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">سعر الوحدة (ريال)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">التأثير الزمني (أيام)</label>
                  <input
                    type="number"
                    min={0}
                    value={impactDays}
                    onChange={(e) => setImpactDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-blue-400"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center font-bold">
                <span className="text-slate-400">إجمالي قيمة أمر التغيير:</span>
                <span className="font-mono text-amber-400 text-sm">{((qty || 0) * (unitPrice || 0)).toLocaleString()} ريال</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl"
                >
                  حفظ أمر التغيير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
