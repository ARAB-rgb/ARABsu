/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Building2,
  Columns,
  Copy,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Italic,
  Lock,
  Plus,
  Printer,
  Redo2,
  Rows,
  Save,
  Search,
  Send,
  Share2,
  Sigma,
  Trash2,
  Underline,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../db";
import {
  Company,
  CompanyFile,
  CompanyMessage,
  CompanySpreadsheet,
  SpreadsheetCell,
  SpreadsheetCellStyle,
  SpreadsheetSheet,
  User as AuthUser,
} from "../types";

interface CompanySpreadsheetsProps {
  currentUser: AuthUser;
  users: AuthUser[];
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany?: (companyId: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  isSuperAdmin?: boolean;
  incomingFile?: { name: string; dataUrl: string } | null;
  onClearIncomingFile?: () => void;
}

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 12;
const DIRECT_DATA_LIMIT = 520_000;
const CHUNK_CHAR_SIZE = 500_000;

function colIndexToLetter(colIdx: number): string {
  let n = colIdx + 1;
  let str = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

function letterToColIndex(letters: string): number {
  let res = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    res = res * 26 + (up.charCodeAt(i) - 64);
  }
  return res - 1;
}

function cellKey(r: number, c: number): string {
  return `${colIndexToLetter(c)}${r + 1}`;
}

function parseCellKey(key: string): { r: number; c: number } | null {
  const m = key.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const c = letterToColIndex(m[1]);
  const r = Number(m[2]) - 1;
  if (r < 0 || c < 0) return null;
  return { r, c };
}

function expandRangeKeys(startKey: string, endKey: string): string[] {
  const s = parseCellKey(startKey);
  const e = parseCellKey(endKey);
  if (!s || !e) return [];
  const rMin = Math.min(s.r, e.r);
  const rMax = Math.max(s.r, e.r);
  const cMin = Math.min(s.c, e.c);
  const cMax = Math.max(s.c, e.c);
  const keys: string[] = [];
  if ((rMax - rMin + 1) * (cMax - cMin + 1) > 4000) return keys;
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      keys.push(cellKey(r, c));
    }
  }
  return keys;
}

function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let curr = "";
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if ((ch === "," || ch === ";") && depth === 0) {
        args.push(curr.trim());
        curr = "";
        continue;
      }
    }
    curr += ch;
  }
  if (curr.trim() || args.length > 0) args.push(curr.trim());
  return args;
}

function createEmptySheet(name = "ورقة 1", rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SpreadsheetSheet {
  return {
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    rows,
    cols,
    colWidths: {},
    freezeHeader: true,
    cells: {},
  };
}

function buildTemplateWorkbook(
  templateType: "blank" | "financial" | "payroll" | "inventory",
  companyId: string,
  ownerId: string,
  ownerName: string
): CompanySpreadsheet {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  if (templateType === "financial") {
    const cells: Record<string, SpreadsheetCell> = {
      A1: { raw: "البند / البيان", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "right" } },
      B1: { raw: "التاريخ", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      C1: { raw: "الإيرادات", style: { bold: true, bg: "#1e293b", color: "#34d399", align: "center" } },
      D1: { raw: "المصروفات", style: { bold: true, bg: "#1e293b", color: "#fb7185", align: "center" } },
      E1: { raw: "الصافي", style: { bold: true, bg: "#1e293b", color: "#f8fafc", align: "center" } },
      A2: { raw: "مبيعات نقدية وتحويلات" },
      B2: { raw: nowIso.slice(0, 10), style: { align: "center" } },
      C2: { raw: "25000", style: { numFmt: "currency" } },
      D2: { raw: "4200", style: { numFmt: "currency" } },
      E2: { raw: "=C2-D2", style: { numFmt: "currency", bold: true } },
      A3: { raw: "مستخلص مشروع قائم" },
      B3: { raw: nowIso.slice(0, 10), style: { align: "center" } },
      C3: { raw: "48000", style: { numFmt: "currency" } },
      D3: { raw: "16500", style: { numFmt: "currency" } },
      E3: { raw: "=C3-D3", style: { numFmt: "currency", bold: true } },
      A4: { raw: "الإجمالي العام", style: { bold: true, bg: "#0f172a", color: "#fbbf24" } },
      C4: { raw: "=SUM(C2:C3)", style: { bold: true, numFmt: "currency", color: "#34d399", bg: "#0f172a" } },
      D4: { raw: "=SUM(D2:D3)", style: { bold: true, numFmt: "currency", color: "#fb7185", bg: "#0f172a" } },
      E4: { raw: "=SUM(E2:E3)", style: { bold: true, numFmt: "currency", color: "#fbbf24", bg: "#0f172a" } },
    };
    return {
      id: `ss_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      company_id: companyId,
      title: "كشف الإيرادات والمصروفات",
      sheets: [{ ...createEmptySheet("التقرير المالي", 30, 10), cells, colWidths: { 0: 210, 1: 120, 2: 130, 3: 130, 4: 140 } }],
      active_sheet_index: 0,
      shared_mode: "company_edit",
      owner_id: ownerId,
      owner_name: ownerName,
      updated_by_name: ownerName,
      created_at: nowIso,
      updated_at: nowIso,
      created_ms: nowMs,
    };
  }

  if (templateType === "payroll") {
    const cells: Record<string, SpreadsheetCell> = {
      A1: { raw: "اسم الموظف", style: { bold: true, bg: "#1e293b", color: "#fbbf24" } },
      B1: { raw: "المسمى الوظيفي", style: { bold: true, bg: "#1e293b", color: "#fbbf24" } },
      C1: { raw: "الراتب الأساسي", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      D1: { raw: "البدلات", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      E1: { raw: "الخصومات / السلف", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      F1: { raw: "صافي المستحق", style: { bold: true, bg: "#1e293b", color: "#34d399", align: "center" } },
      A2: { raw: "موظف نموذجي" },
      B2: { raw: "محاسب مالي" },
      C2: { raw: "6000", style: { numFmt: "currency" } },
      D2: { raw: "1500", style: { numFmt: "currency" } },
      E2: { raw: "500", style: { numFmt: "currency" } },
      F2: { raw: "=C2+D2-E2", style: { numFmt: "currency", bold: true } },
      A3: { raw: "إجمالي مسير الرواتب", style: { bold: true, bg: "#0f172a", color: "#fbbf24" } },
      C3: { raw: "=SUM(C2:C2)", style: { bold: true, numFmt: "currency", bg: "#0f172a" } },
      D3: { raw: "=SUM(D2:D2)", style: { bold: true, numFmt: "currency", bg: "#0f172a" } },
      E3: { raw: "=SUM(E2:E2)", style: { bold: true, numFmt: "currency", bg: "#0f172a" } },
      F3: { raw: "=SUM(F2:F2)", style: { bold: true, numFmt: "currency", color: "#34d399", bg: "#0f172a" } },
    };
    return {
      id: `ss_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      company_id: companyId,
      title: "مسير رواتب ومستحقات الموظفين",
      sheets: [{ ...createEmptySheet("مسير الرواتب", 30, 10), cells, colWidths: { 0: 190, 1: 150, 2: 130, 3: 120, 4: 130, 5: 140 } }],
      active_sheet_index: 0,
      shared_mode: "company_edit",
      owner_id: ownerId,
      owner_name: ownerName,
      updated_by_name: ownerName,
      created_at: nowIso,
      updated_at: nowIso,
      created_ms: nowMs,
    };
  }

  if (templateType === "inventory") {
    const cells: Record<string, SpreadsheetCell> = {
      A1: { raw: "كود الصنف", style: { bold: true, bg: "#1e293b", color: "#fbbf24" } },
      B1: { raw: "اسم الصنف", style: { bold: true, bg: "#1e293b", color: "#fbbf24" } },
      C1: { raw: "الكمية المتوفرة", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      D1: { raw: "سعر الوحدة", style: { bold: true, bg: "#1e293b", color: "#fbbf24", align: "center" } },
      E1: { raw: "إجمالي القيمة", style: { bold: true, bg: "#1e293b", color: "#34d399", align: "center" } },
      A2: { raw: "ITEM-001", style: { align: "center" } },
      B2: { raw: "مواد بناء / توريد" },
      C2: { raw: "50", style: { numFmt: "number" } },
      D2: { raw: "120", style: { numFmt: "currency" } },
      E2: { raw: "=C2*D2", style: { numFmt: "currency", bold: true } },
      A3: { raw: "إجمالي الجرد", style: { bold: true, bg: "#0f172a", color: "#fbbf24" } },
      C3: { raw: "=SUM(C2:C2)", style: { bold: true, numFmt: "number", bg: "#0f172a" } },
      E3: { raw: "=SUM(E2:E2)", style: { bold: true, numFmt: "currency", color: "#34d399", bg: "#0f172a" } },
    };
    return {
      id: `ss_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      company_id: companyId,
      title: "جرد المخزون والمواد",
      sheets: [{ ...createEmptySheet("جرد المخزون", 30, 10), cells, colWidths: { 0: 130, 1: 210, 2: 120, 3: 130, 4: 150 } }],
      active_sheet_index: 0,
      shared_mode: "company_edit",
      owner_id: ownerId,
      owner_name: ownerName,
      updated_by_name: ownerName,
      created_at: nowIso,
      updated_at: nowIso,
      created_ms: nowMs,
    };
  }

  return {
    id: `ss_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    company_id: companyId,
    title: `جدول بيانات جديد ${new Date().toLocaleDateString("ar-SA")}`,
    sheets: [createEmptySheet("ورقة 1", DEFAULT_ROWS, DEFAULT_COLS)],
    active_sheet_index: 0,
    shared_mode: "company_edit",
    owner_id: ownerId,
    owner_name: ownerName,
    updated_by_name: ownerName,
    created_at: nowIso,
    updated_at: nowIso,
    created_ms: nowMs,
  };
}

function getSafeEvaluator(cells: Record<string, SpreadsheetCell>) {
  const cache = new Map<string, string | number>();
  const visiting = new Set<string>();

  const toNumber = (val: string | number): number => {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    const cleaned = String(val || "").replace(/,/g, "").trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const evaluateRawValuesInArg = (arg: string): (string | number)[] => {
    const trimmed = arg.trim();
    const rangeMatch = trimmed.match(/^([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)$/);
    if (rangeMatch) {
      return expandRangeKeys(rangeMatch[1], rangeMatch[2]).map((k) => evalCell(k));
    }
    const singleRef = trimmed.match(/^([A-Za-z]+\d+)$/);
    if (singleRef) {
      return [evalCell(singleRef[1].toUpperCase())];
    }
    return [evalFormulaString("=" + trimmed)];
  };

  const evalCondition = (condExpr: string): boolean => {
    const ops = [">=", "<=", "<>", "!=", "=", ">", "<"];
    for (const op of ops) {
      const idx = condExpr.indexOf(op);
      if (idx > 0) {
        const leftRaw = condExpr.slice(0, idx).trim();
        const rightRaw = condExpr.slice(idx + op.length).trim();
        const leftVal = evalFormulaString("=" + leftRaw);
        const rightVal = evalFormulaString("=" + rightRaw);
        const lNum = Number(leftVal);
        const rNum = Number(rightVal);
        const bothNum =
          leftVal !== "" &&
          rightVal !== "" &&
          !Number.isNaN(lNum) &&
          !Number.isNaN(rNum);
        const a: any = bothNum ? lNum : String(leftVal).trim();
        const b: any = bothNum ? rNum : String(rightVal).trim();
        if (op === ">=") return a >= b;
        if (op === "<=") return a <= b;
        if (op === "<>" || op === "!=") return a !== b;
        if (op === "=") return a === b;
        if (op === ">") return a > b;
        if (op === "<") return a < b;
      }
    }
    return Boolean(evalFormulaString("=" + condExpr));
  };

  const evalFormulaString = (raw: string): string | number => {
    const exprBody = raw.slice(1).trim();
    if (!exprBody) return "";

    // Quoted literal inside expression
    if (/^".*"$/.test(exprBody)) {
      return exprBody.slice(1, -1);
    }

    // Iterative replacement of Excel functions from innermost outward
    let transformed = exprBody;
    let guard = 0;
    while (guard++ < 35) {
      const fnMatch = transformed.match(
        /\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT|COUNTA|ROUND|ABS|IF)\s*\(([^()]*)\)/i
      );
      if (!fnMatch) break;
      const fnName = fnMatch[1].toUpperCase();
      const args = splitTopLevelArgs(fnMatch[2]);
      let fnResult: string | number = 0;

      if (fnName === "IF") {
        const cond = args[0] ? evalCondition(args[0]) : false;
        const chosen = cond ? args[1] ?? "" : args[2] ?? "";
        fnResult = /^".*"$/.test(chosen) ? chosen.slice(1, -1) : evalFormulaString("=" + chosen);
        if (typeof fnResult === "string" && Number.isNaN(Number(fnResult))) {
          fnResult = `"${fnResult.replace(/"/g, "")}"`;
        }
      } else if (fnName === "ROUND") {
        const val = toNumber(evalFormulaString("=" + (args[0] || "0")));
        const digits = Math.max(0, Math.min(8, Math.round(toNumber(evalFormulaString("=" + (args[1] || "0"))))));
        const factor = Math.pow(10, digits);
        fnResult = Math.round(val * factor) / factor;
      } else if (fnName === "ABS") {
        fnResult = Math.abs(toNumber(evalFormulaString("=" + (args[0] || "0"))));
      } else {
        const vals: (string | number)[] = [];
        for (const a of args) {
          if (a) vals.push(...evaluateRawValuesInArg(a));
        }
        const numericVals = vals
          .filter((v) => v !== "" && !Number.isNaN(Number(String(v).replace(/,/g, ""))))
          .map((v) => toNumber(v));

        if (fnName === "SUM") {
          fnResult = numericVals.reduce((acc, v) => acc + v, 0);
        } else if (fnName === "AVERAGE" || fnName === "AVG") {
          fnResult = numericVals.length > 0 ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length : 0;
        } else if (fnName === "MIN") {
          fnResult = numericVals.length > 0 ? Math.min(...numericVals) : 0;
        } else if (fnName === "MAX") {
          fnResult = numericVals.length > 0 ? Math.max(...numericVals) : 0;
        } else if (fnName === "COUNT") {
          fnResult = numericVals.length;
        } else if (fnName === "COUNTA") {
          fnResult = vals.filter((v) => String(v).trim() !== "").length;
        }
      }

      transformed =
        transformed.slice(0, fnMatch.index!) +
        String(fnResult) +
        transformed.slice(fnMatch.index! + fnMatch[0].length);
    }

    // Check if pure string result after IF replacement
    if (/^"[^"]*"$/.test(transformed.trim())) {
      return transformed.trim().slice(1, -1);
    }

    // Replace remaining cell references (e.g. A1, BC22)
    transformed = transformed.replace(/\b([A-Za-z]{1,3}\d+)\b/g, (ref) => {
      const val = evalCell(ref.toUpperCase());
      if (typeof val === "string" && val.startsWith("#")) return "NaN";
      const n = toNumber(val);
      return String(n);
    });

    // Security sanitization: allow only numbers, math operators, parens, spaces, decimals
    const safeMath = transformed.replace(/\s+/g, "");
    if (!/^[0-9+\-*/().eE]+$/.test(safeMath)) {
      return "#ERROR!";
    }
    try {
      const evaluated = Function(`"use strict"; return (${safeMath});`)();
      if (typeof evaluated !== "number" || Number.isNaN(evaluated)) return "#ERROR!";
      if (!Number.isFinite(evaluated)) return "#DIV/0!";
      return Math.round(evaluated * 1e9) / 1e9;
    } catch {
      return "#ERROR!";
    }
  };

  const evalCell = (key: string): string | number => {
    const up = key.toUpperCase();
    if (cache.has(up)) return cache.get(up)!;
    if (visiting.has(up)) return "#REF!";

    const cell = cells[up];
    if (!cell || cell.raw === undefined || cell.raw === "") {
      cache.set(up, "");
      return "";
    }

    const rawStr = String(cell.raw);
    if (!rawStr.startsWith("=")) {
      cache.set(up, rawStr);
      return rawStr;
    }

    visiting.add(up);
    const result = evalFormulaString(rawStr);
    visiting.delete(up);
    cache.set(up, result);
    return result;
  };

  return evalCell;
}

function formatDisplayValue(val: string | number, style?: SpreadsheetCellStyle): string {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "string" && val.startsWith("#")) return val;

  const fmt = style?.numFmt || "general";
  if (fmt === "general" || fmt === "date") return String(val);

  const num = typeof val === "number" ? val : Number(String(val).replace(/,/g, "").trim());
  if (!Number.isFinite(num) || String(val).trim() === "") return String(val);

  if (fmt === "number") {
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (fmt === "currency") {
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  }
  if (fmt === "percent") {
    return `${(num * 100).toFixed(1)}%`;
  }
  return String(val);
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const CompanySpreadsheets: React.FC<CompanySpreadsheetsProps> = ({
  currentUser,
  users,
  companies,
  selectedCompanyId,
  onSelectCompany,
  showToast,
  isSuperAdmin = false,
  incomingFile,
  onClearIncomingFile,
}) => {
  // Strict isolated active company ID
  const activeCompanyId = useMemo(() => {
    if (!isSuperAdmin && currentUser.company_id) return currentUser.company_id;
    if (selectedCompanyId && selectedCompanyId !== "all") return selectedCompanyId;
    if (currentUser.company_id && currentUser.company_id !== "all") return currentUser.company_id;
    return companies[0]?.id || "arab_world";
  }, [isSuperAdmin, selectedCompanyId, currentUser.company_id, companies]);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId),
    [companies, activeCompanyId]
  );

  // Colleagues inside activeCompanyId ONLY
  const companyMembers = useMemo(() => {
    if (!activeCompanyId) return [];
    const seen = new Set<string>();
    const list: AuthUser[] = [];
    for (const u of users) {
      if (!u || !u.id || u.id === currentUser.id) continue;
      if (u.status && u.status !== "نشط") continue;
      const belongsDirectly = u.company_id === activeCompanyId;
      const belongsViaPerms = !!u.company_perms?.[activeCompanyId]?.is_authorized;
      if (!belongsDirectly && !belongsViaPerms) continue;
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      list.push(u);
    }
    return list;
  }, [users, activeCompanyId, currentUser.id]);

  // Firestore workbooks list strictly isolated to activeCompanyId
  const [workbooks, setWorkbooks] = useState<CompanySpreadsheet[]>([]);
  const [loadingSync, setLoadingSync] = useState(true);
  const [activeWorkbookId, setActiveWorkbookId] = useState<string>("");
  const [draftWorkbook, setDraftWorkbook] = useState<CompanySpreadsheet | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Undo / Redo stacks for active workbook sheets
  const [undoStack, setUndoStack] = useState<SpreadsheetSheet[][]>([]);
  const [redoStack, setRedoStack] = useState<SpreadsheetSheet[][]>([]);

  // Grid selection & editing
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editingText, setEditingText] = useState("");
  const [cellSearch, setCellSearch] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Share inside company modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetId, setShareTargetId] = useState<string>("general");
  const [shareNote, setShareNote] = useState("");
  const [sharingInProgress, setSharingInProgress] = useState(false);

  const importFileRef = useRef<HTMLInputElement>(null);

  // Subscribe strictly to company_spreadsheets where company_id == activeCompanyId
  useEffect(() => {
    if (!activeCompanyId) {
      setWorkbooks([]);
      setDraftWorkbook(null);
      setLoadingSync(false);
      return;
    }

    setLoadingSync(true);
    const q = query(
      collection(db, "company_spreadsheets"),
      where("company_id", "==", activeCompanyId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as CompanySpreadsheet))
          .filter((wb) => {
            if (wb.company_id !== activeCompanyId) return false;
            if (wb.shared_mode === "private") {
              return (
                wb.owner_id === currentUser.id ||
                currentUser.role === "admin" ||
                isSuperAdmin
              );
            }
            return true;
          })
          .sort((a, b) => (b.created_ms || 0) - (a.created_ms || 0));

        setWorkbooks(list);
        setLoadingSync(false);

        setActiveWorkbookId((prevId) => {
          if (prevId && list.some((w) => w.id === prevId)) return prevId;
          return list[0]?.id || "";
        });
      },
      (err) => {
        console.error("Spreadsheets sync error:", err);
        setLoadingSync(false);
        try {
          handleFirestoreError(err, OperationType.LIST, "company_spreadsheets");
        } catch {
          // handled safely
        }
      }
    );

    return () => unsub();
  }, [activeCompanyId, currentUser.id, currentUser.role, isSuperAdmin]);

  // Sync draft workbook when activeWorkbookId changes (only if no local unsaved override for same doc)
  useEffect(() => {
    if (!activeWorkbookId) {
      setDraftWorkbook(null);
      setHasUnsavedChanges(false);
      setUndoStack([]);
      setRedoStack([]);
      return;
    }
    const found = workbooks.find((w) => w.id === activeWorkbookId);
    if (found) {
      setDraftWorkbook((prev) => {
        if (prev && prev.id === found.id && hasUnsavedChanges) return prev;
        return JSON.parse(JSON.stringify(found));
      });
      if (!draftWorkbook || draftWorkbook.id !== found.id) {
        setHasUnsavedChanges(false);
        setUndoStack([]);
        setRedoStack([]);
        setSelectedCell({ r: 0, c: 0 });
        setEditingCell(null);
      }
    }
  }, [activeWorkbookId, workbooks]);

  // Import helper (used by both File upload and InternalMessaging "فتح بالإكسل" bridge)
  const importArrayBufferWorkbook = useCallback(
    async (fileName: string, buffer: ArrayBuffer) => {
      try {
        const wb = XLSX.read(buffer, { type: "array" });
        const sheets: SpreadsheetSheet[] = wb.SheetNames.map((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "" });
          const maxRows = Math.max(DEFAULT_ROWS, aoa.length + 5);
          const maxCols = Math.max(
            DEFAULT_COLS,
            aoa.reduce((m, row) => Math.max(m, Array.isArray(row) ? row.length : 0), 0) + 2
          );
          const cells: Record<string, SpreadsheetCell> = {};
          aoa.forEach((row, rIdx) => {
            if (!Array.isArray(row)) return;
            row.forEach((val, cIdx) => {
              const ref = cellKey(rIdx, cIdx);
              const xlsxCell = ws[ref];
              if (xlsxCell && xlsxCell.f) {
                cells[ref] = { raw: `=${xlsxCell.f}` };
              } else if (val !== "" && val !== null && val !== undefined) {
                cells[ref] = {
                  raw: String(val),
                  style: rIdx === 0 ? { bold: true, bg: "#1e293b", color: "#fbbf24" } : undefined,
                };
              }
            });
          });
          return {
            id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: sheetName || "ورقة",
            rows: Math.min(maxRows, 250),
            cols: Math.min(maxCols, 40),
            colWidths: {},
            freezeHeader: true,
            cells,
          };
        });

        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const cleanTitle = fileName.replace(/\.(xlsx|xls|csv)$/i, "");
        const newDoc: CompanySpreadsheet = {
          id: `ss_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
          company_id: activeCompanyId,
          title: cleanTitle || "ملف إكسل مستورد",
          sheets: sheets.length > 0 ? sheets : [createEmptySheet()],
          active_sheet_index: 0,
          shared_mode: "company_edit",
          owner_id: currentUser.id,
          owner_name: currentUser.name,
          updated_by_name: currentUser.name,
          created_at: nowIso,
          updated_at: nowIso,
          created_ms: nowMs,
        };

        await setDoc(doc(db, "company_spreadsheets", newDoc.id), newDoc);
        setActiveWorkbookId(newDoc.id);
        setDraftWorkbook(JSON.parse(JSON.stringify(newDoc)));
        setHasUnsavedChanges(false);
        showToast(`تم استيراد وفتح ملف الإكسل «${cleanTitle}» بنجاح داخل الشركة!`, "success");
      } catch (err: any) {
        showToast("تعذر قراءة ملف الإكسل: " + (err?.message || err), "error");
      }
    },
    [activeCompanyId, currentUser.id, currentUser.name, showToast]
  );

  useEffect(() => {
    if (!incomingFile) return;
    const buf = dataUrlToArrayBuffer(incomingFile.dataUrl);
    importArrayBufferWorkbook(incomingFile.name, buf).finally(() => {
      onClearIncomingFile?.();
    });
  }, [incomingFile, importArrayBufferWorkbook, onClearIncomingFile]);

  const activeSheetIdx = draftWorkbook?.active_sheet_index || 0;
  const activeSheet: SpreadsheetSheet | null =
    draftWorkbook?.sheets[activeSheetIdx] || draftWorkbook?.sheets[0] || null;

  const canEditActiveWorkbook = useMemo(() => {
    if (!draftWorkbook) return false;
    if (isSuperAdmin || currentUser.role === "admin") return true;
    if (draftWorkbook.owner_id === currentUser.id) return true;
    return draftWorkbook.shared_mode === "company_edit";
  }, [draftWorkbook, currentUser.id, currentUser.role, isSuperAdmin]);

  const evaluator = useMemo(() => {
    return getSafeEvaluator(activeSheet?.cells || {});
  }, [activeSheet?.cells]);

  const pushSheetsUpdate = (updater: (sheets: SpreadsheetSheet[]) => SpreadsheetSheet[]) => {
    if (!draftWorkbook || !canEditActiveWorkbook) return;
    setUndoStack((u) => [...u.slice(-24), JSON.parse(JSON.stringify(draftWorkbook.sheets))]);
    setRedoStack([]);
    setDraftWorkbook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sheets: updater(JSON.parse(JSON.stringify(prev.sheets))),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleUndo = () => {
    if (!draftWorkbook || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r.slice(-24), JSON.parse(JSON.stringify(draftWorkbook.sheets))]);
    setUndoStack((u) => u.slice(0, -1));
    setDraftWorkbook({ ...draftWorkbook, sheets: previous });
    setHasUnsavedChanges(true);
  };

  const handleRedo = () => {
    if (!draftWorkbook || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u.slice(-24), JSON.parse(JSON.stringify(draftWorkbook.sheets))]);
    setRedoStack((r) => r.slice(0, -1));
    setDraftWorkbook({ ...draftWorkbook, sheets: next });
    setHasUnsavedChanges(true);
  };

  const handleCreateWorkbook = async (
    template: "blank" | "financial" | "payroll" | "inventory"
  ) => {
    setShowCreateMenu(false);
    const created = buildTemplateWorkbook(template, activeCompanyId, currentUser.id, currentUser.name);
    try {
      await setDoc(doc(db, "company_spreadsheets", created.id), created);
      setActiveWorkbookId(created.id);
      setDraftWorkbook(JSON.parse(JSON.stringify(created)));
      setHasUnsavedChanges(false);
      showToast(`تم إنشاء الجدول «${created.title}» داخل الشركة.`, "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, "company_spreadsheets");
    }
  };

  const handleSaveWorkbook = async () => {
    if (!draftWorkbook || !canEditActiveWorkbook) return;
    setSaving(true);
    try {
      const payload: CompanySpreadsheet = {
        ...draftWorkbook,
        company_id: activeCompanyId,
        updated_by_name: currentUser.name,
        updated_at: new Date().toISOString(),
      };
      await setDoc(doc(db, "company_spreadsheets", payload.id), payload);
      setHasUnsavedChanges(false);
      showToast("تم حفظ كافة التعديلات على السحابة بأمان.", "success");
    } catch (err: any) {
      showToast("تعذر الحفظ: " + (err?.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkbook = async (wb: CompanySpreadsheet) => {
    const allowed =
      wb.owner_id === currentUser.id || currentUser.role === "admin" || isSuperAdmin;
    if (!allowed || wb.company_id !== activeCompanyId) {
      showToast("لا تملك صلاحية حذف هذا الجدول.", "error");
      return;
    }
    try {
      await deleteDoc(doc(db, "company_spreadsheets", wb.id));
      if (activeWorkbookId === wb.id) setActiveWorkbookId("");
      showToast(`تم حذف الجدول «${wb.title}»`, "info");
    } catch (err: any) {
      showToast("تعذر حذف الجدول: " + (err?.message || err), "error");
    }
  };

  const updateCellRaw = (r: number, c: number, newRaw: string) => {
    if (!canEditActiveWorkbook) return;
    const key = cellKey(r, c);
    pushSheetsUpdate((sheets) => {
      const sh = sheets[activeSheetIdx] || sheets[0];
      if (!sh) return sheets;
      if (!newRaw && !sh.cells[key]?.style) {
        delete sh.cells[key];
      } else {
        sh.cells[key] = {
          ...(sh.cells[key] || { raw: "" }),
          raw: newRaw,
        };
      }
      return sheets;
    });
  };

  const toggleCellStyle = (patch: Partial<SpreadsheetCellStyle>) => {
    if (!canEditActiveWorkbook || !activeSheet) return;
    const key = cellKey(selectedCell.r, selectedCell.c);
    pushSheetsUpdate((sheets) => {
      const sh = sheets[activeSheetIdx] || sheets[0];
      if (!sh) return sheets;
      const existing = sh.cells[key] || { raw: "" };
      sh.cells[key] = {
        ...existing,
        style: { ...(existing.style || {}), ...patch },
      };
      return sheets;
    });
  };

  const handleInsertAutoSum = () => {
    if (!canEditActiveWorkbook || !activeSheet) return;
    const { r, c } = selectedCell;
    const colLetter = colIndexToLetter(c);
    const formula = r > 0 ? `=SUM(${colLetter}1:${colLetter}${r})` : "=SUM(A1:A10)";
    updateCellRaw(r, c, formula);
  };

  const commitActiveEditor = () => {
    if (!editingCell) return;
    updateCellRaw(editingCell.r, editingCell.c, editingText);
    setEditingCell(null);
  };

  const startEditingCell = (r: number, c: number, initialChar?: string) => {
    if (!canEditActiveWorkbook || !activeSheet) return;
    const currentRaw = activeSheet.cells[cellKey(r, c)]?.raw || "";
    setSelectedCell({ r, c });
    setEditingCell({ r, c });
    setEditingText(initialChar !== undefined ? initialChar : currentRaw);
  };

  // Multi-sheet actions
  const handleAddSheet = () => {
    if (!draftWorkbook || !canEditActiveWorkbook) return;
    const nextNum = draftWorkbook.sheets.length + 1;
    pushSheetsUpdate((sheets) => {
      sheets.push(createEmptySheet(`ورقة ${nextNum}`, DEFAULT_ROWS, DEFAULT_COLS));
      return sheets;
    });
    setDraftWorkbook((prev) =>
      prev ? { ...prev, active_sheet_index: prev.sheets.length } : prev
    );
  };

  const handleDeleteSheet = (idx: number) => {
    if (!draftWorkbook || draftWorkbook.sheets.length <= 1 || !canEditActiveWorkbook) return;
    pushSheetsUpdate((sheets) => {
      sheets.splice(idx, 1);
      return sheets;
    });
    setDraftWorkbook((prev) =>
      prev ? { ...prev, active_sheet_index: Math.max(0, idx - 1) } : prev
    );
  };

  // Build real XLSX workbook instance from current draftWorkbook
  const buildXlsxWorkbook = useCallback((): XLSX.WorkBook | null => {
    if (!draftWorkbook) return null;
    const wb = XLSX.utils.book_new();
    draftWorkbook.sheets.forEach((sh) => {
      const shEval = getSafeEvaluator(sh.cells || {});
      const aoa: (string | number)[][] = [];
      let maxR = 0;
      let maxC = 0;
      Object.keys(sh.cells || {}).forEach((k) => {
        const parsed = parseCellKey(k);
        if (parsed && sh.cells[k]?.raw) {
          maxR = Math.max(maxR, parsed.r);
          maxC = Math.max(maxC, parsed.c);
        }
      });
      for (let r = 0; r <= maxR; r++) {
        const row: (string | number)[] = [];
        for (let c = 0; c <= maxC; c++) {
          const val = shEval(cellKey(r, c));
          const num = Number(String(val).replace(/,/g, ""));
          if (val !== "" && !Number.isNaN(num) && typeof val !== "boolean") {
            row.push(num);
          } else {
            row.push(val);
          }
        }
        aoa.push(row);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = Array.from({ length: maxC + 1 }, (_, i) => ({
        wch: Math.round(((sh.colWidths?.[i] || 120) / 8)),
      }));
      XLSX.utils.book_append_sheet(wb, ws, (sh.name || "Sheet").slice(0, 31));
    });
    return wb;
  }, [draftWorkbook]);

  const handleDownloadXlsx = () => {
    if (!draftWorkbook) return;
    const wb = buildXlsxWorkbook();
    if (!wb) return;
    const safeName = `${draftWorkbook.title || "sheet"}`.replace(/[^\w\u0600-\u06FF\s-]/g, "_");
    XLSX.writeFile(wb, `${safeName}.xlsx`);
    showToast(`تم تصدير وتحميل الملف: ${safeName}.xlsx`, "success");
  };

  const handleDownloadCsv = () => {
    if (!draftWorkbook || !activeSheet) return;
    const wb = buildXlsxWorkbook();
    if (!wb) return;
    const ws = wb.Sheets[wb.SheetNames[activeSheetIdx] || wb.SheetNames[0]];
    const csv = "\ufeff" + XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftWorkbook.title}_${activeSheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("تم تحميل نسخة CSV العربية بنجاح.", "success");
  };

  const handlePrintSheet = () => {
    if (!draftWorkbook || !activeSheet) return;
    let maxR = 0;
    let maxC = 0;
    Object.keys(activeSheet.cells).forEach((k) => {
      const p = parseCellKey(k);
      if (p && activeSheet.cells[k]?.raw) {
        maxR = Math.max(maxR, p.r);
        maxC = Math.max(maxC, p.c);
      }
    });
    const rowsHtml: string[] = [];
    for (let r = 0; r <= maxR; r++) {
      const tds: string[] = [];
      for (let c = 0; c <= maxC; c++) {
        const k = cellKey(r, c);
        const cell = activeSheet.cells[k];
        const evaluated = evaluator(k);
        const text = formatDisplayValue(evaluated, cell?.style);
        const weight = cell?.style?.bold ? "font-weight:700;" : "";
        const align = `text-align:${cell?.style?.align || "right"};`;
        const bg = cell?.style?.bg ? `background:${cell.style.bg};color:${cell?.style?.color || "#fff"};` : "";
        tds.push(`<td style="border:1px solid #cbd5e1;padding:6px 8px;${weight}${align}${bg}">${text || "&nbsp;"}</td>`);
      }
      rowsHtml.push(`<tr>${tds.join("")}</tr>`);
    }
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl" lang="ar">
      <head><title>${draftWorkbook.title} - ${activeSheet.name}</title></head>
      <body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;">${draftWorkbook.title} — ${activeSheet.name}</h2>
            <p style="margin:4px 0 0;color:#475569;font-size:12px;">الشركة: ${activeCompany?.name || ""} | بتاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">${rowsHtml.join("")}</table>
        <script>setTimeout(()=>window.print(),300);</script>
      </body></html>
    `);
    win.document.close();
  };

  // Send workbook directly inside the same company's InternalMessaging + Vault
  const handleSendToCompanyChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftWorkbook || !activeCompanyId) return;
    setSharingInProgress(true);
    try {
      const wb = buildXlsxWorkbook();
      if (!wb) throw new Error("تعذر تجهيز ملف الإكسل");

      const base64Data = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`;
      const approxBytes = Math.round((base64Data.length * 3) / 4);
      const fileName = `${draftWorkbook.title.replace(/[^\w\u0600-\u06FF\s-]/g, "_")}.xlsx`;
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const fileId = `cf_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

      const isGeneral = shareTargetId === "general";
      const sortedUids = [currentUser.id, shareTargetId].sort();
      const channelId = isGeneral
        ? `general_${activeCompanyId}`
        : `dm_${activeCompanyId}_${sortedUids[0]}_${sortedUids[1]}`;
      const recipientMember = isGeneral
        ? undefined
        : companyMembers.find((m) => m.id === shareTargetId);

      const isChunked = dataUrl.length > DIRECT_DATA_LIMIT;
      let chunkCount = 0;
      if (isChunked) {
        chunkCount = Math.ceil(dataUrl.length / CHUNK_CHAR_SIZE);
        for (let i = 0; i < chunkCount; i++) {
          const chunkId = `${fileId}_part_${i}`;
          await setDoc(doc(db, "company_file_chunks", chunkId), {
            id: chunkId,
            company_id: activeCompanyId,
            file_id: fileId,
            chunk_index: i,
            data: dataUrl.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE),
          });
        }
      }

      const fileDoc: CompanyFile = {
        id: fileId,
        company_id: activeCompanyId,
        channel_id: channelId,
        folder: "مستندات عامة",
        file_name: fileName,
        file_size: approxBytes,
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data_url: isChunked ? undefined : dataUrl,
        is_chunked: isChunked,
        chunk_count: chunkCount,
        uploaded_by_id: currentUser.id,
        uploaded_by_name: currentUser.name,
        created_at: nowIso,
        created_ms: nowMs,
      };
      const cleanFileDoc = Object.fromEntries(
        Object.entries(fileDoc).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(db, "company_files", fileId), cleanFileDoc);

      const msgId = `msg_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      const msgPayload: CompanyMessage = {
        id: msgId,
        company_id: activeCompanyId,
        channel_id: channelId,
        channel_type: isGeneral ? "general" : "dm",
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_role_label: currentUser.role === "admin" ? "المدير العام" : "عضو بالشركة",
        recipient_id: recipientMember?.id,
        recipient_name: recipientMember?.name,
        text:
          shareNote.trim() ||
          `📊 مشاركة شيت إكسل: «${draftWorkbook.title}» — يمكنك فتحه وتعديله مباشرة أو تحميله.`,
        file_id: fileId,
        file_name: fileName,
        file_size: approxBytes,
        file_mime: fileDoc.mime_type,
        created_at: nowIso,
        created_ms: nowMs,
      };
      const cleanMsg = Object.fromEntries(
        Object.entries(msgPayload).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(db, "company_messages", msgId), cleanMsg);

      // Save latest sheet state if needed
      if (hasUnsavedChanges && canEditActiveWorkbook) {
        await handleSaveWorkbook();
      }

      showToast(
        isGeneral
          ? `تم إرسال شيت «${draftWorkbook.title}» إلى القناة العامة وخزنة ملفات الشركة!`
          : `تم إرسال شيت «${draftWorkbook.title}» إلى ${recipientMember?.name} داخل الشركة!`,
        "success"
      );
      setShowShareModal(false);
      setShareNote("");
    } catch (err: any) {
      showToast("تعذر إرسال الشيت داخل الشركة: " + (err?.message || err), "error");
    } finally {
      setSharingInProgress(false);
    }
  };

  // Keyboard navigation when a grid cell is selected (and not currently typing in inline input)
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!activeSheet) return;
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitActiveEditor();
        setSelectedCell((s) => ({ r: Math.min(activeSheet.rows - 1, s.r + 1), c: s.c }));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitActiveEditor();
        setSelectedCell((s) => ({ r: s.r, c: Math.min(activeSheet.cols - 1, s.c + 1) }));
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      handleUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedCell((s) => ({ r: Math.min(activeSheet.rows - 1, s.r + 1), c: s.c }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedCell((s) => ({ r: Math.max(0, s.r - 1), c: s.c }));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedCell((s) => ({ r: s.r, c: Math.min(activeSheet.cols - 1, s.c + 1) }));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedCell((s) => ({ r: s.r, c: Math.max(0, s.c - 1) }));
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEditingCell(selectedCell.r, selectedCell.c);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      updateCellRaw(selectedCell.r, selectedCell.c, "");
    }
  };

  // Column stats summary for footer status bar
  const selectedColumnStats = useMemo(() => {
    if (!activeSheet) return { sum: 0, count: 0, avg: 0 };
    let sum = 0;
    let count = 0;
    for (let r = 0; r < activeSheet.rows; r++) {
      const val = evaluator(cellKey(r, selectedCell.c));
      if (val !== "" && !Number.isNaN(Number(String(val).replace(/,/g, "")))) {
        sum += Number(String(val).replace(/,/g, ""));
        count++;
      }
    }
    return { sum, count, avg: count > 0 ? sum / count : 0 };
  }, [activeSheet, selectedCell.c, evaluator]);

  const currentCellKey = cellKey(selectedCell.r, selectedCell.c);
  const currentCellObj = activeSheet?.cells[currentCellKey];
  const currentStyle = currentCellObj?.style || {};

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      {/* Top SaaS Header Contract */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-white whitespace-nowrap">
                جداول الإكسل السحابية
              </h2>
              <span className="text-xs text-slate-400 truncate">
                {activeCompany?.name || "الشركة النشطة"} · معزولة بالكامل
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              إنشاء وتعديل واستيراد ملفات Excel بجميع الصيغ والمعادلات ومشاركتها أو إرسالها داخل نفس الشركة فقط
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isSuperAdmin && companies.length > 1 && onSelectCompany && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 h-9">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={activeCompanyId}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const buf = await f.arrayBuffer();
              await importArrayBufferWorkbook(f.name, buf);
              if (importFileRef.current) importFileRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="h-9 px-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>استيراد ملف Excel / CSV</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCreateMenu((v) => !v)}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>إنشاء شيت جديد</span>
            </button>
            {showCreateMenu && (
              <div className="absolute left-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("blank")}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  جدول بيانات فارغ
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("financial")}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  قالب كشف إيرادات ومصروفات
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("payroll")}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-amber-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  قالب مسير رواتب الموظفين
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("inventory")}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-sky-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  قالب جرد المخزون والأصناف
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Saved Company Workbooks + Active Spreadsheet Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Workbooks Sidebar (Isolated to Active Company) */}
        <aside className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-black text-white">جداول الشركة ({workbooks.length})</span>
            <span className="text-[11px] text-slate-400">معزولة</span>
          </div>

          <div className="divide-y divide-slate-800/70 max-h-[640px] overflow-y-auto">
            {loadingSync ? (
              <div className="p-6 text-center text-xs text-slate-400">جاري تحميل الجداول...</div>
            ) : workbooks.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">لا توجد جداول إكسل محفوظة لهذه الشركة بعد.</p>
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("financial")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  إنشاء أول جدول الآن
                </button>
              </div>
            ) : (
              workbooks.map((wb) => {
                const isSelected = wb.id === activeWorkbookId;
                const canDelete =
                  wb.owner_id === currentUser.id || currentUser.role === "admin" || isSuperAdmin;
                return (
                  <div
                    key={wb.id}
                    onClick={() => {
                      if (hasUnsavedChanges && draftWorkbook && draftWorkbook.id !== wb.id) {
                        if (!confirm("توجد تعديلات غير محفوظة على الجدول الحالي، هل تريد الانتقال بدون حفظ؟")) {
                          return;
                        }
                      }
                      setHasUnsavedChanges(false);
                      setActiveWorkbookId(wb.id);
                    }}
                    className={`p-3.5 cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? "bg-slate-800/80" : "hover:bg-slate-800/35"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? "text-emerald-300" : "text-white"}`}>
                        {wb.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                        <span>{wb.owner_name}</span>
                        <span>·</span>
                        <span>
                          {wb.shared_mode === "company_edit"
                            ? "تحرير للشركة"
                            : wb.shared_mode === "company_view"
                            ? "عرض للشركة"
                            : "خاص"}
                        </span>
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkbook(wb);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
                        title="حذف الجدول"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Active Spreadsheet Editor */}
        <section className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          {!draftWorkbook || !activeSheet ? (
            <div className="p-12 text-center space-y-4">
              <FileSpreadsheet className="w-12 h-12 text-emerald-500/60 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">مساحة عمل Excel السحابية جاهزة</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  اختر جدولاً من القائمة الجانبية، أو أنشئ شيت جديداً بالصيغ الجاهزة، أو قم برفع ملف إكسل من جهازك لتعديله ومشاركته مع فريق الشركة.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateWorkbook("blank")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  إنشاء جدول فارغ
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  رفع ملف Excel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Workbook Title + Save / Export / Share Actions */}
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="text"
                    disabled={!canEditActiveWorkbook}
                    value={draftWorkbook.title}
                    onChange={(e) => {
                      setDraftWorkbook({ ...draftWorkbook, title: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-transparent border border-transparent hover:border-slate-700 focus:border-emerald-500 focus:bg-slate-950 rounded-lg px-2 py-1 text-sm font-black text-white focus:outline-none min-w-[160px] flex-1 max-w-xs"
                  />
                  {hasUnsavedChanges && (
                    <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">
                      تعديلات غير محفوظة
                    </span>
                  )}
                  {!canEditActiveWorkbook && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Lock className="w-3 h-3" /> للعرض فقط
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <select
                    disabled={!canEditActiveWorkbook}
                    value={draftWorkbook.shared_mode}
                    onChange={(e: any) => {
                      setDraftWorkbook({ ...draftWorkbook, shared_mode: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 focus:outline-none cursor-pointer"
                    title="صلاحية الوصول داخل الشركة"
                  >
                    <option value="company_edit">تحرير مشترك للشركة</option>
                    <option value="company_view">عرض للشركة فقط</option>
                    <option value="private">خاص بي فقط</option>
                  </select>

                  <button
                    type="button"
                    disabled={!canEditActiveWorkbook || saving}
                    onClick={handleSaveWorkbook}
                    className={`h-8 px-3 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                      hasUnsavedChanges
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? "حفظ..." : "حفظ"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>إرسال داخل الشركة</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadXlsx}
                    className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>XLSX</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    CSV
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintSheet}
                    className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="طباعة الجدول"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Formatting & Structure Toolbar */}
              <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center gap-1.5 bg-slate-900">
                <button
                  type="button"
                  disabled={undoStack.length === 0}
                  onClick={handleUndo}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="تراجع (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={redoStack.length === 0}
                  onClick={handleRedo}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="إعادة (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>

                <span className="h-5 w-px bg-slate-800 mx-0.5" />

                <button
                  type="button"
                  onClick={() => toggleCellStyle({ bold: !currentStyle.bold })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    currentStyle.bold
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                  title="خط عريض"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCellStyle({ italic: !currentStyle.italic })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    currentStyle.italic
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                  title="خط مائل"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCellStyle({ underline: !currentStyle.underline })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    currentStyle.underline
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                  title="تسطير"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>

                <span className="h-5 w-px bg-slate-800 mx-0.5" />

                <button
                  type="button"
                  onClick={() => toggleCellStyle({ align: "right" })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    (currentStyle.align || "right") === "right"
                      ? "bg-slate-700 text-white border-slate-600"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCellStyle({ align: "center" })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    currentStyle.align === "center"
                      ? "bg-slate-700 text-white border-slate-600"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCellStyle({ align: "left" })}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    currentStyle.align === "left"
                      ? "bg-slate-700 text-white border-slate-600"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>

                <span className="h-5 w-px bg-slate-800 mx-0.5" />

                <select
                  value={currentStyle.numFmt || "general"}
                  onChange={(e: any) => toggleCellStyle({ numFmt: e.target.value })}
                  className="h-7 px-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-bold text-slate-200 cursor-pointer"
                >
                  <option value="general">تنسيق: عام</option>
                  <option value="number">رقم</option>
                  <option value="currency">عملة (ر.س)</option>
                  <option value="percent">نسبة %</option>
                </select>

                <label className="flex items-center gap-1 text-[10px] text-slate-400 px-1.5 cursor-pointer" title="لون النص">
                  <span>نص</span>
                  <input
                    type="color"
                    value={currentStyle.color || "#f8fafc"}
                    onChange={(e) => toggleCellStyle({ color: e.target.value })}
                    className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center gap-1 text-[10px] text-slate-400 px-1.5 cursor-pointer" title="تعبئة الخلية">
                  <span>خلفية</span>
                  <input
                    type="color"
                    value={currentStyle.bg || "#0f172a"}
                    onChange={(e) => toggleCellStyle({ bg: e.target.value })}
                    className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleInsertAutoSum}
                  className="h-7 px-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="إدراج معادلة جمع تلقائي SUM"
                >
                  <Sigma className="w-3.5 h-3.5" />
                  <span>جمع تلقائي</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    pushSheetsUpdate((sheets) => {
                      const sh = sheets[activeSheetIdx] || sheets[0];
                      if (sh) sh.rows = Math.min(250, sh.rows + 5);
                      return sheets;
                    })
                  }
                  className="h-7 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Rows className="w-3 h-3" />
                  <span>+5 صفوف</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    pushSheetsUpdate((sheets) => {
                      const sh = sheets[activeSheetIdx] || sheets[0];
                      if (sh) sh.cols = Math.min(40, sh.cols + 2);
                      return sheets;
                    })
                  }
                  className="h-7 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Columns className="w-3 h-3" />
                  <span>+2 أعمدة</span>
                </button>

                <div className="relative mr-auto">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1.5" />
                  <input
                    type="text"
                    placeholder="بحث بالخلايا..."
                    value={cellSearch}
                    onChange={(e) => setCellSearch(e.target.value)}
                    className="h-7 w-36 pr-7 pl-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Formula Bar (fx) */}
              <div className="px-3 py-1.5 border-b border-slate-800 flex items-center gap-2 bg-slate-950">
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md font-mono text-xs font-black text-amber-400 tabular-nums min-w-[52px] text-center">
                  {currentCellKey}
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 px-1">fx</span>
                <input
                  type="text"
                  dir="auto"
                  disabled={!canEditActiveWorkbook}
                  value={
                    editingCell &&
                    editingCell.r === selectedCell.r &&
                    editingCell.c === selectedCell.c
                      ? editingText
                      : currentCellObj?.raw || ""
                  }
                  onChange={(e) => {
                    if (
                      editingCell &&
                      editingCell.r === selectedCell.r &&
                      editingCell.c === selectedCell.c
                    ) {
                      setEditingText(e.target.value);
                    } else {
                      updateCellRaw(selectedCell.r, selectedCell.c, e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingCell) {
                      e.preventDefault();
                      commitActiveEditor();
                    }
                  }}
                  placeholder="أدخل قيمة أو معادلة مثل: =SUM(B2:B10) أو =IF(C2>1000,C2*0.15,0)"
                  className="flex-1 h-7 px-2.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 whitespace-nowrap">
                  <span>صيغ مدعومة:</span>
                  <span className="font-mono text-slate-400">SUM · AVG · MIN · MAX · COUNT · IF</span>
                </div>
              </div>

              {/* Interactive Spreadsheet Grid */}
              <div
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
                className="overflow-auto max-h-[520px] bg-slate-950 focus:outline-none select-none"
              >
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="w-11 min-w-[44px] h-7 bg-slate-900 border border-slate-800 text-[10px] text-slate-500 font-mono sticky right-0 z-30">
                        #
                      </th>
                      {Array.from({ length: activeSheet.cols }, (_, cIdx) => {
                        const width = activeSheet.colWidths?.[cIdx] || 120;
                        const isColActive = selectedCell.c === cIdx;
                        return (
                          <th
                            key={cIdx}
                            style={{ width: `${width}px`, minWidth: `${width}px` }}
                            className={`h-7 border border-slate-800 font-mono text-[11px] font-bold px-2 ${
                              isColActive
                                ? "bg-emerald-950/60 text-emerald-300"
                                : "bg-slate-900 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="mx-auto">{colIndexToLetter(cIdx)}</span>
                              {canEditActiveWorkbook && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    pushSheetsUpdate((sheets) => {
                                      const sh = sheets[activeSheetIdx] || sheets[0];
                                      if (sh) {
                                        sh.colWidths = {
                                          ...(sh.colWidths || {}),
                                          [cIdx]: Math.min(340, (sh.colWidths?.[cIdx] || 120) + 30),
                                        };
                                      }
                                      return sheets;
                                    })
                                  }
                                  className="text-[9px] text-slate-500 hover:text-amber-300 cursor-pointer"
                                  title="توسيع العمود"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: activeSheet.rows }, (_, rIdx) => {
                      const isRowActive = selectedCell.r === rIdx;
                      return (
                        <tr key={rIdx}>
                          <td
                            className={`w-11 min-w-[44px] h-8 border border-slate-800 text-center font-mono text-[11px] tabular-nums sticky right-0 z-10 ${
                              isRowActive
                                ? "bg-emerald-950/60 text-emerald-300 font-bold"
                                : "bg-slate-900 text-slate-500"
                            }`}
                          >
                            {rIdx + 1}
                          </td>
                          {Array.from({ length: activeSheet.cols }, (_, cIdx) => {
                            const key = cellKey(rIdx, cIdx);
                            const cell = activeSheet.cells[key];
                            const isSelected =
                              selectedCell.r === rIdx && selectedCell.c === cIdx;
                            const isEditing =
                              editingCell?.r === rIdx && editingCell?.c === cIdx;
                            const evaluated = evaluator(key);
                            const formatted = formatDisplayValue(evaluated, cell?.style);
                            const isMatch =
                              cellSearch.trim() !== "" &&
                              (String(formatted)
                                .toLowerCase()
                                .includes(cellSearch.toLowerCase()) ||
                                String(cell?.raw || "")
                                  .toLowerCase()
                                  .includes(cellSearch.toLowerCase()));

                            return (
                              <td
                                key={key}
                                onClick={() => {
                                  if (
                                    editingCell &&
                                    (editingCell.r !== rIdx || editingCell.c !== cIdx)
                                  ) {
                                    commitActiveEditor();
                                  }
                                  setSelectedCell({ r: rIdx, c: cIdx });
                                }}
                                onDoubleClick={() => startEditingCell(rIdx, cIdx)}
                                style={{
                                  backgroundColor:
                                    cell?.style?.bg ||
                                    (isMatch ? "rgba(245, 158, 11, 0.22)" : undefined),
                                  color: cell?.style?.color || undefined,
                                }}
                                className={`h-8 border px-2 align-middle tabular-nums relative ${
                                  isSelected
                                    ? "border-2 border-emerald-400 z-10"
                                    : "border-slate-800/80"
                                } ${cell?.style?.bold ? "font-bold" : "font-normal"} ${
                                  cell?.style?.italic ? "italic" : ""
                                } ${cell?.style?.underline ? "underline" : ""}`}
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    dir="auto"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onBlur={commitActiveEditor}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitActiveEditor();
                                        setSelectedCell({
                                          r: Math.min(activeSheet.rows - 1, rIdx + 1),
                                          c: cIdx,
                                        });
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        setEditingCell(null);
                                      } else if (e.key === "Tab") {
                                        e.preventDefault();
                                        commitActiveEditor();
                                        setSelectedCell({
                                          r: rIdx,
                                          c: Math.min(activeSheet.cols - 1, cIdx + 1),
                                        });
                                      }
                                    }}
                                    className="w-full h-full bg-slate-900 text-white text-xs font-mono px-1 focus:outline-none"
                                  />
                                ) : (
                                  <div
                                    className={`truncate text-xs ${
                                      cell?.style?.align === "center"
                                        ? "text-center"
                                        : cell?.style?.align === "left"
                                        ? "text-left"
                                        : "text-right"
                                    } ${
                                      typeof evaluated === "string" && evaluated.startsWith("#")
                                        ? "text-rose-400 font-mono"
                                        : ""
                                    }`}
                                  >
                                    {formatted}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Sheet Tabs + Live Column Aggregate Bar */}
              <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {draftWorkbook.sheets.map((sh, sIdx) => {
                    const isActive = sIdx === activeSheetIdx;
                    return (
                      <div
                        key={sh.id}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          isActive
                            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setDraftWorkbook({ ...draftWorkbook, active_sheet_index: sIdx })
                          }
                          className="cursor-pointer whitespace-nowrap"
                        >
                          {sh.name}
                        </button>
                        {draftWorkbook.sheets.length > 1 && canEditActiveWorkbook && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSheet(sIdx)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="حذف الورقة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {canEditActiveWorkbook && (
                    <button
                      type="button"
                      onClick={handleAddSheet}
                      className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
                      title="إضافة ورقة عمل جديدة"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-400 tabular-nums">
                  <span>
                    العمود {colIndexToLetter(selectedCell.c)} · العدد:{" "}
                    <strong className="text-white">{selectedColumnStats.count}</strong>
                  </span>
                  <span>
                    المجموع:{" "}
                    <strong className="text-emerald-400">
                      {selectedColumnStats.sum.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                  <span>
                    المتوسط:{" "}
                    <strong className="text-amber-400">
                      {selectedColumnStats.avg.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Share / Send Spreadsheet Inside Company Modal */}
      {showShareModal && draftWorkbook && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white">مشاركة وإرسال الشيت داخل الشركة</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendToCompanyChat} className="space-y-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-[11px] text-slate-400 block">الجدول المختار:</span>
                <span className="text-xs font-black text-emerald-300 block">{draftWorkbook.title}.xlsx</span>
                <span className="text-[10px] text-slate-500 block">
                  الشركة: {activeCompany?.name} (لا يراه أي شخص من خارج الشركة)
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">الوجهة داخل الشركة</label>
                <select
                  value={shareTargetId}
                  onChange={(e) => setShareTargetId(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="general">القناة العامة للشركة ({companyMembers.length + 1} أعضاء)</option>
                  {companyMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      موظف بالشركة: {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">رسالة مرفقة (اختياري)</label>
                <textarea
                  rows={3}
                  placeholder="مثال: مرفق كشف الحسابات المحدث للمراجعة..."
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(draftWorkbook.title);
                      showToast("تم نسخ اسم الجدول — متاح الآن لجميع أعضاء هذه الشركة في تبويب الإكسل.", "info");
                    } catch {
                      showToast("الجدول متاح حالياً في مساحة العمل الخاصة بالشركة.", "info");
                    }
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ العنوان</span>
                </button>

                <button
                  type="submit"
                  disabled={sharingInProgress}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sharingInProgress ? "جاري الإرسال..." : "إرسال لواتساب وملفات الشركة"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
