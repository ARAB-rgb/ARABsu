/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World Contracting - Delay & Suspension Logs (محاضر التأخير والتوقف)
 */

import React, { useState, useEffect } from "react";
import { Plus, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Trash2, X } from "lucide-react";
import { Subcontract, SubcontractDelayLog } from "../../types";
import { sb } from "../../db";

interface DelayLogsTabProps {
  contract: Subcontract;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const DelayLogsTab: React.FC<DelayLogsTabProps> = ({
  contract,
  showToast,
}) => {
  const [logs, setLogs] = useState<SubcontractDelayLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [logNo, setLogNo] = useState("");
  const [eventType, setEventType] = useState("site_handover_delay");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [affectedDays, setAffectedDays] = useState<number>(1);
  const [responsibleParty, setResponsibleParty] = useState<SubcontractDelayLog["responsible_party"]>("first_party");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SubcontractDelayLog["status"]>("recorded");
  const [extensionGrantedDays, setExtensionGrantedDays] = useState<number>(0);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from("subcontract_delays")
        .select("*")
        .eq("contract_id", contract.id);

      if (!error && data) {
        setLogs(data as SubcontractDelayLog[]);
      }
    } catch (e) {
      console.warn("Failed to load delay logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract.id) {
      loadLogs();
    }
  }, [contract.id]);

  const handleOpenModal = () => {
    const nextNo = `DLY-${String(logs.length + 1).padStart(2, "0")}`;
    setLogNo(nextNo);
    setEventType("site_handover_delay");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setAffectedDays(1);
    setResponsibleParty("first_party");
    setDescription("");
    setStatus("recorded");
    setExtensionGrantedDays(0);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast("يرجى إدخال تفاصيل وبيان واقعة التأخير", "error");
      return;
    }

    try {
      const newLog: SubcontractDelayLog = {
        id: "dly_" + Date.now(),
        contract_id: contract.id,
        log_no: logNo,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        affected_days: Number(affectedDays) || 1,
        responsible_party: responsibleParty,
        description,
        status,
        extension_granted_days: Number(extensionGrantedDays) || 0,
        created_at: new Date().toISOString(),
      };

      const { error } = await sb.from("subcontract_delays").insert(newLog);
      if (error) throw error;

      showToast("تم توثيق محضر التأخير بنجاح", "success");
      setShowModal(false);
      loadLogs();
    } catch (e: any) {
      showToast("خطأ في الحفظ: " + e.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المحضر؟")) return;
    try {
      await sb.from("subcontract_delays").delete().eq("id", id);
      showToast("تم الحذف بنجاح", "info");
      loadLogs();
    } catch (e: any) {
      showToast("فشل الحذف: " + e.message, "error");
    }
  };

  const totalAffectedDays = logs.reduce((sum, l) => sum + (Number(l.affected_days) || 0), 0);
  const totalGrantedExtension = logs.reduce((sum, l) => sum + (Number(l.extension_granted_days) || 0), 0);

  const getEventName = (t: string) => {
    switch (t) {
      case "site_handover_delay": return "تأخر تسليم الموقع";
      case "material_shortage": return "نقص أو تأخر توريد المواد";
      case "power_water_cut": return "انقطاع التيار الكهربائي أو المياه بالموقع";
      case "drawings_delay": return "تأخر المخططات أو الاعتمادات الهندسية";
      case "contractor_clash": return "تعارض أعمال مقاولين آخرين بالموقع";
      case "payment_delay": return "توقف مؤقت بسبب تأخر سداد مستخلص";
      case "force_majeure": return "ظرف طارئ / قوة قاهرة أو طقس غير مواتٍ";
      default: return "عائق تشغيلي آخر";
    }
  };

  const getResponsibleLabel = (p: string) => {
    switch (p) {
      case "first_party": return "الطرف الأول (عرب وورلد)";
      case "second_party": return "الطرف الثاني (المقاول من الباطن)";
      case "owner": return "المالك / الاستشاري العام";
      case "force_majeure": return "قوة قاهرة / ظروف جوية";
      default: return p;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي وقائع التأخير المثبتة</span>
          <span className="text-base font-black text-amber-400 font-mono mt-1 block">{logs.length} محضر</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">إجمالي أيام التعطيل المسجلة</span>
          <span className="text-base font-black text-rose-400 font-mono mt-1 block">
            {totalAffectedDays} يوماً
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right">
          <span className="text-[10px] font-bold text-slate-400 block">التمديد الزمني الممنوح رسمياً</span>
          <span className="text-base font-black text-emerald-400 font-mono mt-1 block">
            +{totalGrantedExtension} يوماً
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>⏱️</span> محاضر إثبات التأخير والتوقف (Delay & Suspension Claims)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            إثبات الوقائع الميدانية، حماية المقاول من غرامات غير مبررة، وتوثيق حقوق تمديد العقد نظاماً.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>توثيق محضر تأخير / توقف</span>
        </button>
      </div>

      {/* List */}
      {logs.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400">لا توجد محاضر توقف أو تأخير مسجلة لهذا العقد.</p>
          <p className="text-[11px] text-slate-500 mt-1">يتم استخدام هذه المحاضر لإثبات أي عوائق ميدانية تمنع المقاول من التنفيذ خارج إرادته.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2 text-right"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {log.log_no}
                  </span>
                  <span className="text-xs font-black text-white">{getEventName(log.event_type)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    log.status === "extension_granted" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                    log.status === "resolved" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                    "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                  }`}>
                    {log.status === "extension_granted" ? `تم تمديد العقد (+${log.extension_granted_days} يوم)` : log.status === "resolved" ? "تمت المعالجة" : "مقيد قيد المتابعة"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(log.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{log.description}</p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-400 border-t border-slate-850">
                <div>
                  الفترة: <b className="text-white">{log.start_date}</b> {log.end_date ? `إلى ${log.end_date}` : "(مستمرة)"}
                  <span className="text-amber-400 mr-2">({log.affected_days} يوم متأثر)</span>
                </div>
                <div>
                  المسؤولية: <b className="text-blue-300">{getResponsibleLabel(log.responsible_party)}</b>
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
                <span>⏱️</span> تسجيل محضر إثبات توقف / تأخير
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">نوع العائق أو التأخير *</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="site_handover_delay">تأخر تسليم الموقع</option>
                    <option value="material_shortage">نقص أو تأخر توريد المواد</option>
                    <option value="power_water_cut">انقطاع المياه أو الكهرباء بالموقع</option>
                    <option value="drawings_delay">تأخر المخططات والاعتمادات</option>
                    <option value="contractor_clash">تعارض مقاولين آخرين</option>
                    <option value="payment_delay">توقف بسبب تأخر مستحقات</option>
                    <option value="force_majeure">قوة قاهرة أو أحوال جوية قاهرة</option>
                    <option value="other">عائق آخر</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-bold">الطرف المسؤول عن العائق</label>
                  <select
                    value={responsibleParty}
                    onChange={(e) => setResponsibleParty(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="first_party">الطرف الأول (عرب وورلد)</option>
                    <option value="second_party">الطرف الثاني (المقاول من الباطن)</option>
                    <option value="owner">المالك / الاستشاري العام</option>
                    <option value="force_majeure">قوة قاهرة / ظروف طارئة عامة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">تاريخ البداية *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">الأيام المتأثرة</label>
                  <input
                    type="number"
                    min={1}
                    value={affectedDays}
                    onChange={(e) => setAffectedDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">شرح وتفاصيل الواقعة الميدانية *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="وصف دقيق للأسباب المادية أو الفنية التي أدت إلى التوقف أو التأخير والمراسلات المثبتة..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">حالة المحضر</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  >
                    <option value="recorded">مقيد قيد المتابعة</option>
                    <option value="resolved">تمت المعالجة الميدانية</option>
                    <option value="extension_granted">تم منح تمديد زمني معتمد</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">الأيام المعتمدة للتمديد</label>
                  <input
                    type="number"
                    min={0}
                    value={extensionGrantedDays}
                    onChange={(e) => setExtensionGrantedDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-emerald-400 font-bold"
                  />
                </div>
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
                  حفظ وتوثيق المحضر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
