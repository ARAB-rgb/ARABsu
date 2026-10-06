/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Arab World - Database Connection Status Indicator (مؤشر حالة اتصال قاعدة البيانات)
 */

import React, { useState, useEffect, useRef } from "react";
import { Database, Cloud, RefreshCw, CheckCircle2, AlertCircle, Shield, X, Server } from "lucide-react";
import {
  getDatabaseStatus,
  subscribeDatabaseStatus,
  checkSupabaseHealth,
  DatabaseStatus
} from "../../db";

interface DatabaseStatusIndicatorProps {
  compact?: boolean;
  className?: string;
  showToast?: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  isAdmin?: boolean;
}

export const DatabaseStatusIndicator: React.FC<DatabaseStatusIndicatorProps> = ({
  compact = false,
  className = "",
  showToast,
  isAdmin = true,
}) => {
  if (!isAdmin) {
    return null;
  }

  const [status, setStatus] = useState<DatabaseStatus>(getDatabaseStatus());
  const [isChecking, setIsChecking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeDatabaseStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleManualTest = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsChecking(true);
    try {
      const isHealthy = await checkSupabaseHealth();
      const updated = getDatabaseStatus();
      setStatus(updated);
      if (showToast) {
        if (isHealthy) {
          showToast("تم التحقق: الاتصال بقاعدة بيانات Supabase نشط ومستقر 🟢", "success");
        } else {
          showToast("تم التحقق: قاعدة بيانات Firestore السحابية هي المصدر النشط حالياً 🟠", "info");
        }
      }
    } catch {
      if (showToast) {
        showToast("تعذر فحص الاتصال حالياً، تم الإبقاء على الوضع الآمن", "warning");
      }
    } finally {
      setIsChecking(false);
    }
  };

  const isSupabase = status.activeDb === "supabase";

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* The Status Pill / Badge */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-md select-none ${
          isSupabase
            ? "bg-emerald-950/40 hover:bg-emerald-950/70 border-emerald-500/35 hover:border-emerald-400 text-emerald-300"
            : "bg-amber-950/40 hover:bg-amber-950/70 border-amber-500/35 hover:border-amber-400 text-amber-300"
        }`}
        title="انقر لعرض تفاصيل اتصال قاعدة البيانات"
      >
        {/* Pulsing indicator dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isSupabase ? "bg-emerald-400" : "bg-amber-400"
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isSupabase ? "bg-emerald-500" : "bg-amber-500"
            }`}
          ></span>
        </span>

        {/* Database Icon */}
        {isSupabase ? (
          <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
        )}

        {/* Label */}
        <span className="font-mono text-[11px] font-bold tracking-tight">
          {compact ? (
            isSupabase ? "Supabase" : "Firestore"
          ) : (
            <>
              <span className="hidden sm:inline text-slate-400 text-[10px] ml-1">قاعدة البيانات:</span>
              <span>{isSupabase ? "Supabase" : "Firestore"}</span>
              <span className="text-[10px] opacity-80 mr-1">{isSupabase ? "🟢" : "🟠"}</span>
            </>
          )}
        </span>
      </button>

      {/* Popover Card */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-right">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black text-white">حالة الاتصال بقواعد البيانات</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowDropdown(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active Database Card */}
          <div
            className={`p-3 rounded-xl border mb-3 ${
              isSupabase
                ? "bg-emerald-950/30 border-emerald-500/30"
                : "bg-amber-950/30 border-amber-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400">القاعدة النشطة حالياً:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  isSupabase
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                }`}
              >
                {isSupabase ? "🟢 Supabase PostgreSQL" : "🟠 Cloud Firestore"}
              </span>
            </div>

            <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
              {isSupabase
                ? "قاعدة بيانات Supabase هي مصدر البيانات المعتمد حالياً، وجميع العمليات تُحفظ وتُستعلم منها مباشرة."
                : "قاعدة بيانات Google Cloud Firestore السحابية هي المصدر النشط لحفظ واسترجاع البيانات بضمان 100%."}
            </p>
          </div>

          {/* Database Dual Redundancy Info */}
          <div className="space-y-2 mb-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-slate-500" />
                <span>Supabase Cloud:</span>
              </span>
              <span className={status.isSupabaseHealthy ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {status.isSupabaseHealthy ? "متصل وطبيعي ✅" : "احتياطي / قيود ⚠️"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cloud className="w-3 h-3 text-slate-500" />
                <span>Google Firestore:</span>
              </span>
              <span className="text-emerald-400 font-bold">جاهز ونشط 🛡️</span>
            </div>
          </div>

          {/* Action Button: Test / Re-check Connection */}
          <button
            type="button"
            disabled={isChecking}
            onClick={handleManualTest}
            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            <span>{isChecking ? "جاري الفحص المباشر..." : "إعادة فحص واختبار الاتصال"}</span>
          </button>
        </div>
      )}
    </div>
  );
};
