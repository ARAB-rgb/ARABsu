/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  Landmark,
  TrendingUp,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  Coins,
  Edit2,
  Check,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Printer,
  FileText,
  Upload,
  Calendar,
  Building,
  DollarSign,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  Filter,
  CheckCircle2,
  CreditCard,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import { Receipt, Payment, Expense, Installment, Company, Project, Worker, User } from "../types";
import {
  sb,
  awExtractTreasury,
  awExtractCapital,
  awExtractCapitalSource,
  awExtractCapitalCompany,
  awExtractCapitalCollection,
  awGetSafeCapitalOutflow,
  awBuildNotesWithRegionAndTreasury,
  awBuildNotesWithRegionAndTreasuryAndExternalNo,
  awExtractRegion,
  awExtractExternalNo,
  awCleanNotes,
  awExtractAttachment,
  generateNextNo,
  logSession
} from "../db";
import { safeStorage } from "../safeStorage";

const localStorage = safeStorage;

interface TreasuryProps {
  receipts: Receipt[];
  payments: Payment[];
  expenses: Expense[];
  installments: Installment[];
  authorizedTreasuries?: string[];
  isAdmin?: boolean;
  selectedCompanyId?: string;
  onUpdate?: () => void;
  companies?: Company[];
  currentUser?: User | null;
  projects?: Project[];
  workers?: Worker[];
  onPrintReceipt?: (id: string) => void;
  onPrintPayment?: (payment: Payment) => void;
  onPrintExpense?: (expense: Expense) => void;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

const getStoredTreasuries = (companyId?: string, companiesList?: Company[]): string[] => {
  const defaults = ["خزنة الشركة", "خزنة التحصيل"];

  // If specific company, load from DB
  if (companyId && companyId !== "all" && companiesList) {
    const matched = companiesList.find(c => c.id === companyId);
    if (matched && matched.treasuries && Array.isArray(matched.treasuries) && matched.treasuries.length > 0) {
      return matched.treasuries;
    }
  }

  // Combined across all companies if "all"
  if ((!companyId || companyId === "all") && companiesList && companiesList.length > 0) {
    const allTreasuries = new Set<string>();
    let hasCustom = false;
    companiesList.forEach(c => {
      if (c.treasuries && Array.isArray(c.treasuries) && c.treasuries.length > 0) {
        c.treasuries.forEach(t => allTreasuries.add(t));
        hasCustom = true;
      }
    });
    if (hasCustom && allTreasuries.size > 0) {
      return Array.from(allTreasuries);
    }
  }

  const suffix = companyId && companyId !== "all" ? `_${companyId}` : "";
  const saved = localStorage.getItem(`aw_treasuries${suffix}`);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr;
      }
    } catch {}
  }
  return defaults;
};

export const Treasury: React.FC<TreasuryProps> = ({
  receipts,
  payments,
  expenses,
  installments,
  authorizedTreasuries,
  isAdmin = false,
  selectedCompanyId,
  onUpdate,
  companies = [],
  currentUser = null,
  projects = [],
  workers = [],
  onPrintReceipt,
  onPrintPayment,
  onPrintExpense,
  showToast
}) => {
  const [treasuries, setTreasuries] = useState<string[]>(() => {
    const list = getStoredTreasuries(selectedCompanyId, companies);
    if (authorizedTreasuries) {
      return list.filter(t => authorizedTreasuries.includes(t));
    }
    return list;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (authorizedTreasuries && authorizedTreasuries.length > 0) {
      return authorizedTreasuries[0];
    }
    const list = getStoredTreasuries(selectedCompanyId, companies);
    return list[0] || "خزنة الشركة";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "inbound" | "outbound" | "expense" | "capital" | "transfer">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [newTreasuryName, setNewTreasuryName] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [editingTreasuryName, setEditingTreasuryName] = useState<string | null>(null);
  const [editInputVal, setEditInputVal] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Modals for Operations
  const [modalMode, setModalMode] = useState<"deposit" | "withdrawal" | "transfer" | null>(null);
  const [targetSafeForOp, setTargetSafeForOp] = useState<string>(activeTab);

  // Form States: Deposit (إيداع)
  const [depDepositType, setDepDepositType] = useState<"cash" | "general_receipt" | "contract_payment">("cash");
  const [depAmount, setDepAmount] = useState<string>("");
  const [depFromName, setDepFromName] = useState<string>("");
  const [depMethod, setDepMethod] = useState<string>("نقداً");
  const [depDate, setDepDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [depProject, setDepProject] = useState<string>("");
  const [depContractId, setDepContractId] = useState<string>("");
  const [depNotes, setDepNotes] = useState<string>("");
  const [depAttachment, setDepAttachment] = useState<string>("");
  const [depExternalNo, setDepExternalNo] = useState<string>("");

  // Form States: Withdrawal (سحب)
  const [withWithdrawalType, setWithWithdrawalType] = useState<"cash_custody" | "payment_beneficiary" | "operating_expense" | "worker_advance">("cash_custody");
  const [withAmount, setWithAmount] = useState<string>("");
  const [withToName, setWithToName] = useState<string>("");
  const [withMethod, setWithMethod] = useState<string>("نقداً");
  const [withDate, setWithDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [withProject, setWithProject] = useState<string>("");
  const [withCategory, setWithCategory] = useState<string>("أخرى");
  const [withWorkerId, setWithWorkerId] = useState<string>("");
  const [withNotes, setWithNotes] = useState<string>("");
  const [withAttachment, setWithAttachment] = useState<string>("");
  const [withBeneficiaryType, setWithBeneficiaryType] = useState<"شخص" | "مجموعة">("شخص");

  // Form States: Transfer (مناقلة)
  const [transSourceSafe, setTransSourceSafe] = useState<string>(activeTab);
  const [transDestSafe, setTransDestSafe] = useState<string>("");
  const [transAmount, setTransAmount] = useState<string>("");
  const [transDate, setTransDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transNotes, setTransNotes] = useState<string>("");

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(msg);
    }
  };

  useEffect(() => {
    const list = getStoredTreasuries(selectedCompanyId, companies);
    const filtered = authorizedTreasuries
      ? list.filter(t => authorizedTreasuries.includes(t))
      : list;
    setTreasuries(filtered);
    if (authorizedTreasuries && authorizedTreasuries.length > 0) {
      if (!authorizedTreasuries.includes(activeTab)) {
        setActiveTab(authorizedTreasuries[0]);
      }
    } else {
      if (!filtered.includes(activeTab)) {
        setActiveTab(filtered[0] || "خزنة الشركة");
      }
    }
  }, [selectedCompanyId, authorizedTreasuries, companies]);

  useEffect(() => {
    const handleStorageChange = () => {
      const freshList = getStoredTreasuries(selectedCompanyId, companies);
      const filtered = authorizedTreasuries
        ? freshList.filter(t => authorizedTreasuries.includes(t))
        : freshList;
      setTreasuries(filtered);
      if (!filtered.includes(activeTab)) {
        setActiveTab(filtered[0] || "خزنة الشركة");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [activeTab, authorizedTreasuries, selectedCompanyId, companies]);

  // Helper to resolve safe/treasury for any receipt
  const getReceiptTreasury = (r: Receipt): string => {
    const rDirect = awExtractTreasury(r.notes || "");
    if (rDirect) return rDirect;
    const linked = installments.find(inst => inst.id === r.installment_id || inst.no === r.contract_no);
    if (linked) {
      return awExtractTreasury(linked.notes || "") || "خزنة التحصيل";
    }
    return "خزنة التحصيل";
  };

  // Helper for payments
  const getPaymentTreasury = (p: Payment): string => {
    return awExtractTreasury(p.notes || "") || "خزنة الشركة";
  };

  // Helper for expenses
  const getExpenseTreasury = (e: Expense): string => {
    return awExtractTreasury(e.notes || "") || "خزنة الشركة";
  };

  // Safe Statistics per treasury
  const safeStats = useMemo(() => {
    return treasuries.map(t => {
      const receiptsOfSafe = receipts.filter(r => getReceiptTreasury(r) === t);
      const paymentsOfSafe = payments.filter(p => getPaymentTreasury(p) === t);
      const expensesOfSafe = expenses.filter(e => getExpenseTreasury(e) === t);

      let capitalOut = 0;
      installments.forEach(x => {
        capitalOut += awGetSafeCapitalOutflow(x.notes || "", t);
      });

      const inbound = receiptsOfSafe.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const paymentsOut = paymentsOfSafe.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expensesOut = expensesOfSafe.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const outbound = paymentsOut + expensesOut + capitalOut;
      const balance = inbound - outbound;

      return {
        name: t,
        inbound,
        outbound,
        balance,
        paymentsOut,
        expensesOut,
        capitalOut,
        txCount: receiptsOfSafe.length + paymentsOfSafe.length + expensesOfSafe.length
      };
    });
  }, [treasuries, receipts, payments, expenses, installments]);

  const currentSafeStat = safeStats.find(s => s.name === activeTab) || {
    name: activeTab,
    inbound: 0,
    outbound: 0,
    balance: 0,
    paymentsOut: 0,
    expensesOut: 0,
    capitalOut: 0,
    txCount: 0
  };

  // Get compiled transactions for chosen safe
  const getCompiledTransactionsForSafe = (safeName: string) => {
    let items: {
      id: string;
      rawId?: string;
      originalEntity?: any;
      date: string;
      createdAt: string;
      type: "قبض" | "صرف" | "مصروف" | "رأس مال" | "مناقلة_واردة" | "مناقلة_صادرة";
      categoryLabel: string;
      desc: string;
      inbound: number;
      outbound: number;
      sourceTreasury: string;
      refNo?: string;
      method?: string;
      notes?: string;
      attachment?: string | null;
    }[] = [];

    receipts.forEach((r) => {
      if (getReceiptTreasury(r) === safeName) {
        const isTransfer = String(r.notes || "").includes("[مناقلة_من:");
        const fromSafeMatch = String(r.notes || "").match(/\[مناقلة_من:\s*([^\]]+)\]/);
        const fromSafe = fromSafeMatch ? fromSafeMatch[1].trim() : "";

        items.push({
          id: `rec_${r.id}`,
          rawId: r.id,
          originalEntity: r,
          date: r.date || "",
          createdAt: r.created_at || r.date || "",
          type: isTransfer ? "مناقلة_واردة" : "قبض",
          categoryLabel: isTransfer ? "مناقلة واردة" : (r.contract_no ? "دفعة عقد" : "إيراد / إيداع"),
          desc: isTransfer 
            ? `🔄 مناقلة مالية واردة من: ${fromSafe || "خزنة أخرى"} — ${awCleanNotes(r.notes || "")}`
            : (r.from_name ? `${r.from_name} ${r.contract_no ? `— سند قبض لعقد ${r.contract_no}` : ""}` : `إيداع / سند قبض رقم ${r.no}`),
          inbound: Number(r.amount || 0),
          outbound: 0,
          sourceTreasury: safeName,
          refNo: r.no,
          method: r.method,
          notes: r.notes,
          attachment: awExtractAttachment(r.notes || "")
        });
      }
    });

    payments.forEach((p) => {
      if (getPaymentTreasury(p) === safeName) {
        const isTransfer = String(p.notes || "").includes("[مناقلة_إلى:");
        const toSafeMatch = String(p.notes || "").match(/\[مناقلة_إلى:\s*([^\]]+)\]/);
        const toSafe = toSafeMatch ? toSafeMatch[1].trim() : "";

        items.push({
          id: `pay_${p.id}`,
          rawId: p.id,
          originalEntity: p,
          date: p.date || "",
          createdAt: p.created_at || p.date || "",
          type: isTransfer ? "مناقلة_صادرة" : "صرف",
          categoryLabel: isTransfer ? "مناقلة صادرة" : (p.worker_id ? "مستحقات عامل" : "سند صرف"),
          desc: isTransfer
            ? `🔄 مناقلة مالية صادرة إلى: ${toSafe || "خزنة أخرى"} — ${awCleanNotes(p.notes || "")}`
            : (p.to_name ? `سند صرف إلى: ${p.to_name} ${awCleanNotes(p.notes || "") ? `— ${awCleanNotes(p.notes || "")}` : ""}` : `سند صرف مالي رقم ${p.no}`),
          inbound: 0,
          outbound: Number(p.amount || 0),
          sourceTreasury: safeName,
          refNo: p.no,
          method: p.method,
          notes: p.notes,
          attachment: awExtractAttachment(p.notes || "")
        });
      }
    });

    expenses.forEach((e) => {
      if (getExpenseTreasury(e) === safeName) {
        items.push({
          id: `exp_${e.id}`,
          rawId: e.id,
          originalEntity: e,
          date: e.date || "",
          createdAt: e.created_at || e.date || "",
          type: "مصروف",
          categoryLabel: `مصروف (${e.category || "عام"})`,
          desc: `${e.name || "مصروف"} [${e.category || "تشغيلي"}] — المورد: ${e.supplier || "عام"} ${awCleanNotes(e.notes || "") ? `— ${awCleanNotes(e.notes || "")}` : ""}`,
          inbound: 0,
          outbound: Number(e.amount || 0),
          sourceTreasury: safeName,
          refNo: e.no,
          notes: e.notes,
          attachment: awExtractAttachment(e.notes || "")
        });
      }
    });

    // Contract Capital Outflows
    installments.forEach((x) => {
      const applicableCapOutflow = awGetSafeCapitalOutflow(x.notes || "", safeName);
      if (applicableCapOutflow > 0) {
        const source = awExtractCapitalSource(x.notes || "");
        let descSuffix = "";

        if (source === "كلاهما") {
          descSuffix = ` [مساهمة تقسيم: ${applicableCapOutflow.toLocaleString()} ريال]`;
        } else if (source === "شركة" && safeName === "خزنة الشركة") {
          descSuffix = " [كامل التمويل من الشركة]";
        } else if (source === "تحصيل" && safeName === "خزنة التحصيل") {
          descSuffix = " [كامل التمويل من التحصيل]";
        } else {
          descSuffix = ` [تمويل من ${safeName}: ${applicableCapOutflow.toLocaleString()} ريال]`;
        }

        items.push({
          id: `cap_${x.id}`,
          rawId: x.id,
          originalEntity: x,
          date: x.start_date || "",
          createdAt: x.created_at || x.start_date || "",
          type: "رأس مال",
          categoryLabel: "رأس مال عقد",
          desc: `تأسيس رأس مال العقد رقم: ${x.no} — العميل: ${x.client}${descSuffix}`,
          inbound: 0,
          outbound: applicableCapOutflow,
          sourceTreasury: safeName,
          refNo: x.no
        });
      }
    });

    // Chronological sort
    items.sort((a, b) => {
      const dComp = String(a.date).localeCompare(String(b.date));
      if (dComp !== 0) return dComp;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    let running = 0;
    const itemsWithBalance = items.map((item) => {
      running += (item.inbound - item.outbound);
      return { ...item, balance: running };
    });

    itemsWithBalance.reverse();
    return itemsWithBalance;
  };

  const getFilteredTransactions = () => {
    const rawTxs = getCompiledTransactionsForSafe(activeTab);

    return rawTxs.filter((tx) => {
      // Filter by type
      if (filterType === "inbound" && tx.inbound <= 0) return false;
      if (filterType === "outbound" && tx.outbound <= 0) return false;
      if (filterType === "expense" && tx.type !== "مصروف") return false;
      if (filterType === "capital" && tx.type !== "رأس مال") return false;
      if (filterType === "transfer" && tx.type !== "مناقلة_واردة" && tx.type !== "مناقلة_صادرة") return false;

      // Filter by date range
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;

      // Filter by search query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        tx.date.includes(q) ||
        tx.type.includes(q) ||
        tx.categoryLabel.toLowerCase().includes(q) ||
        tx.desc.toLowerCase().includes(q) ||
        (tx.refNo && tx.refNo.toLowerCase().includes(q)) ||
        (tx.method && tx.method.toLowerCase().includes(q)) ||
        String(tx.inbound).includes(q) ||
        String(tx.outbound).includes(q)
      );
    });
  };

  const filteredTxs = getFilteredTransactions();

  const totalBalance = safeStats.reduce((sum, s) => sum + s.balance, 0);
  const totalInbound = safeStats.reduce((sum, s) => sum + s.inbound, 0);
  const totalOutbound = safeStats.reduce((sum, s) => sum + s.outbound, 0);
  const totalCapitalOut = safeStats.reduce((sum, s) => sum + s.capitalOut, 0);

  // Open operation modal with active safe pre-filled
  const openDepositModal = (safeName?: string) => {
    const target = safeName || activeTab;
    setTargetSafeForOp(target);
    setDepAmount("");
    setDepFromName("");
    setDepMethod("نقداً");
    setDepDate(new Date().toISOString().slice(0, 10));
    setDepProject("");
    setDepContractId("");
    setDepNotes("");
    setDepAttachment("");
    setDepExternalNo("");
    setDepDepositType("cash");
    setModalMode("deposit");
  };

  const openWithdrawalModal = (safeName?: string) => {
    const target = safeName || activeTab;
    setTargetSafeForOp(target);
    setWithAmount("");
    setWithToName("");
    setWithMethod("نقداً");
    setWithDate(new Date().toISOString().slice(0, 10));
    setWithProject("");
    setWithCategory("أخرى");
    setWithWorkerId("");
    setWithNotes("");
    setWithAttachment("");
    setWithBeneficiaryType("شخص");
    setWithWithdrawalType("cash_custody");
    setModalMode("withdrawal");
  };

  const openTransferModal = (sourceSafe?: string) => {
    const src = sourceSafe || activeTab;
    setTransSourceSafe(src);
    const otherSafes = treasuries.filter(t => t !== src);
    setTransDestSafe(otherSafes[0] || "");
    setTransAmount("");
    setTransDate(new Date().toISOString().slice(0, 10));
    setTransNotes("");
    setModalMode("transfer");
  };

  // Submit Direct Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depAmount);
    if (!amt || amt <= 0) {
      notify("يرجى إدخال مبلغ صحيح للإيداع!", "error");
      return;
    }

    const payer = depFromName.trim() || (currentUser?.name ? `الموظف: ${currentUser.name}` : "إيداع نقدي مباشر");
    const targetCompanyId = selectedCompanyId && selectedCompanyId !== "all" ? selectedCompanyId : (currentUser?.company_id || "arab_world");

    let linkedContract: Installment | null = null;
    if (depContractId) {
      linkedContract = installments.find(i => i.id === depContractId) || null;
    }

    const beforeAmt = linkedContract ? Number(linkedContract.remaining || 0) : 0;
    const afterAmt = linkedContract ? Math.max(0, beforeAmt - amt) : 0;

    let baseNotes = depNotes.trim();
    if (depDepositType === "cash") {
      baseNotes = baseNotes ? `[تغذية_نقدية_للخزنة] ${baseNotes}` : "[تغذية نقدية وإيداع رصيد بالخزنة]";
    }

    let notesAppended = awBuildNotesWithRegionAndTreasuryAndExternalNo(
      baseNotes,
      currentUser?.perms?.region || "",
      targetSafeForOp,
      depExternalNo
    );

    if (depAttachment) {
      notesAppended = `${notesAppended} [مرفق: ${depAttachment}]`;
    }

    const receiptNo = generateNextNo("AW-REC", receipts, "no");

    const row: any = {
      no: receiptNo,
      from_name: payer,
      amount: amt,
      method: depMethod,
      date: depDate,
      created_at: new Date().toISOString(),
      project: depProject || (linkedContract ? linkedContract.project : ""),
      notes: notesAppended,
      installment_id: linkedContract ? linkedContract.id : null,
      contract_no: linkedContract ? linkedContract.no : "",
      identity: linkedContract ? linkedContract.identity : "",
      phone: linkedContract ? linkedContract.phone : "",
      remaining_before: beforeAmt,
      remaining_after: afterAmt,
      company_id: linkedContract ? (linkedContract.company_id || targetCompanyId) : targetCompanyId,
    };

    setIsUpdating(true);
    try {
      const { data, error } = await sb.from("receipts").insert(row).select();
      if (error) {
        notify(`فشل تسجيل الإيداع: ${error.message}`, "error");
        return;
      }

      if (linkedContract) {
        const newPaid = Number(linkedContract.paid || 0) + amt;
        const newRemaining = Math.max(0, Number(linkedContract.amount || 0) - newPaid);
        const newStatus = newRemaining <= 0 ? "مكتمل" : linkedContract.status;
        await sb.from("installments").update({ paid: newPaid, remaining: newRemaining, status: newStatus }).eq("id", linkedContract.id);
      }

      await logSession(
        currentUser || { id: "treasury", name: "أمين الخزينة", role: "admin", code: "TREASURY", perms: {} as any },
        `إيداع مالي مباشر في (${targetSafeForOp}) بقيمة ${amt.toLocaleString()} ريال [سند رقم: ${receiptNo}] من: ${payer}`
      );

      notify(`✅ تم تسجيل الإيداع بنجاح بقيمة ${amt.toLocaleString()} ريال في (${targetSafeForOp})`, "success");
      setModalMode(null);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      notify(`حدث خطأ أثناء حفظ المعاملة: ${err?.message || err}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Submit Direct Withdrawal
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withAmount);
    if (!amt || amt <= 0) {
      notify("يرجى إدخال مبلغ صحيح للسحب!", "error");
      return;
    }

    const safeBal = safeStats.find(s => s.name === targetSafeForOp)?.balance || 0;
    if (amt > safeBal) {
      const proceed = window.confirm(`⚠️ تنبيه سيولة: المبلغ المطلوب سحبه (${amt.toLocaleString()} ريال) يتجاوز الرصيد الفعلي المتوفر حالياً في (${targetSafeForOp}) البالغ (${safeBal.toLocaleString()} ريال).\n\nهل ترغب في الاستمرار واعتماد السحب كعجز/سحب مكشوف؟`);
      if (!proceed) return;
    }

    const recipient = withToName.trim() || (withWithdrawalType === "cash_custody" ? "عهدة نقدية / مسحوبات عامة" : "مستفيد عام");
    const targetCompanyId = selectedCompanyId && selectedCompanyId !== "all" ? selectedCompanyId : (currentUser?.company_id || "arab_world");

    setIsUpdating(true);
    try {
      if (withWithdrawalType === "operating_expense") {
        // Save as Expense
        const expNo = generateNextNo("AW-EXP", expenses, "no");
        let notesAppended = awBuildNotesWithRegionAndTreasury(withNotes, currentUser?.perms?.region || "", targetSafeForOp);
        if (withAttachment) {
          notesAppended = `${notesAppended} [مرفق: ${withAttachment}]`;
        }

        const expRow = {
          no: expNo,
          name: recipient,
          category: withCategory,
          amount: amt,
          date: withDate,
          created_at: new Date().toISOString(),
          project: withProject,
          supplier: recipient,
          notes: notesAppended,
          company_id: targetCompanyId,
        };

        const { error } = await sb.from("expenses").insert(expRow);
        if (error) throw error;

        await logSession(
          currentUser || { id: "treasury", name: "أمين الخزينة", role: "admin", code: "TREASURY", perms: {} as any },
          `سحب وتسجيل مصروف تشغيلي من (${targetSafeForOp}) بقيمة ${amt.toLocaleString()} ريال [بند رقم: ${expNo}]`
        );
      } else {
        // Save as Payment
        const payNo = generateNextNo("AW-PAY", payments, "no");
        let notesAppended = awBuildNotesWithRegionAndTreasury(withNotes, currentUser?.perms?.region || "", targetSafeForOp);
        if (withBeneficiaryType) {
          notesAppended = `[نوع_المستفيد: ${withBeneficiaryType}] ` + notesAppended;
        }
        if (withWithdrawalType === "cash_custody") {
          notesAppended = `[مسحوبات_عهدة_نقدية] ` + notesAppended;
        }
        if (withAttachment) {
          notesAppended = `${notesAppended} [مرفق: ${withAttachment}]`;
        }

        // If linked to worker, adjust advance
        if (withWorkerId) {
          const w = workers.find(x => x.id === withWorkerId);
          if (w) {
            const currentAdvance = Number(w.advance || 0);
            const newAdvance = currentAdvance + amt;
            const tot = Number(w.daily || 0) * Number(w.days || 0);
            const newBalance = Math.max(0, tot - newAdvance);
            await sb.from("workers").update({ advance: newAdvance, balance: newBalance }).eq("id", w.id);
          }
        }

        const payRow: any = {
          no: payNo,
          to_name: recipient,
          amount: amt,
          method: withMethod,
          date: withDate,
          created_at: new Date().toISOString(),
          project: withProject,
          notes: notesAppended,
          company_id: targetCompanyId,
          worker_id: withWorkerId || null,
        };

        const { error } = await sb.from("payments").insert(payRow);
        if (error) throw error;

        await logSession(
          currentUser || { id: "treasury", name: "أمين الخزينة", role: "admin", code: "TREASURY", perms: {} as any },
          `سحب مالي صادر من (${targetSafeForOp}) بقيمة ${amt.toLocaleString()} ريال [سند رقم: ${payNo}] إلى: ${recipient}`
        );
      }

      notify(`✅ تم خصم وسحب ${amt.toLocaleString()} ريال بنجاح من (${targetSafeForOp})`, "success");
      setModalMode(null);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      notify(`حدث خطأ أثناء تسجيل السحب: ${err?.message || err}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Submit Inter-Treasury Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(transAmount);
    if (!amt || amt <= 0) {
      notify("يرجى إدخال مبلغ صحيح للتحويل!", "error");
      return;
    }
    if (!transDestSafe || transDestSafe === transSourceSafe) {
      notify("يرجى اختيار خزنة مستهدفة مختلفة عن خزنة المصدر!", "error");
      return;
    }

    const srcBal = safeStats.find(s => s.name === transSourceSafe)?.balance || 0;
    if (amt > srcBal) {
      const proceed = window.confirm(`⚠️ تنبيه: المبلغ المراد تحويله (${amt.toLocaleString()} ريال) أكبر من الرصيد المتوفر في (${transSourceSafe}) البالغ (${srcBal.toLocaleString()} ريال).\n\nهل ترغب في المتابعة واعتماد المناقلة؟`);
      if (!proceed) return;
    }

    const targetCompanyId = selectedCompanyId && selectedCompanyId !== "all" ? selectedCompanyId : (currentUser?.company_id || "arab_world");
    const payNo = generateNextNo("AW-PAY", payments, "no");
    const recNo = generateNextNo("AW-REC", receipts, "no");

    setIsUpdating(true);
    try {
      // 1. Outbound from source safe
      const outNotes = `[الإدارة: ${currentUser?.perms?.region || "الرئيسية"}] [الخزنة: ${transSourceSafe}] [مناقلة_إلى: ${transDestSafe}] مناقلة وتحويل نقدي إلى (${transDestSafe})${transNotes ? ` — ${transNotes}` : ""}`;
      const payRow: any = {
        no: payNo,
        to_name: `مناقلة إلى ${transDestSafe}`,
        amount: amt,
        method: "تحويل نقدي",
        date: transDate,
        created_at: new Date().toISOString(),
        project: "مناقلة داخلية بين الخزائن",
        notes: outNotes,
        company_id: targetCompanyId,
      };
      const { error: payErr } = await sb.from("payments").insert(payRow);
      if (payErr) throw payErr;

      // 2. Inbound to destination safe
      const inNotes = `[الإدارة: ${currentUser?.perms?.region || "الرئيسية"}] [الخزنة: ${transDestSafe}] [مناقلة_من: ${transSourceSafe}] استلام مناقلة مالية واردة من (${transSourceSafe})${transNotes ? ` — ${transNotes}` : ""}`;
      const recRow: any = {
        no: recNo,
        from_name: `مناقلة من ${transSourceSafe}`,
        amount: amt,
        method: "تحويل نقدي",
        date: transDate,
        created_at: new Date().toISOString(),
        project: "مناقلة داخلية بين الخزائن",
        notes: inNotes,
        company_id: targetCompanyId,
      };
      const { error: recErr } = await sb.from("receipts").insert(recRow);
      if (recErr) throw recErr;

      await logSession(
        currentUser || { id: "treasury", name: "أمين الخزينة", role: "admin", code: "TREASURY", perms: {} as any },
        `مناقلة مالية بين الخزائن: تحويل ${amt.toLocaleString()} ريال من (${transSourceSafe}) إلى (${transDestSafe})`
      );

      notify(`🎉 تمت المناقلة بنجاح! تم تحويل ${amt.toLocaleString()} ريال من (${transSourceSafe}) إلى (${transDestSafe})`, "success");
      setModalMode(null);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      notify(`حدث خطأ أثناء إجراء المناقلة: ${err?.message || err}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete transaction from treasury table
  const handleDeleteTx = async (tx: any) => {
    if (!isAdmin) {
      notify("⚠️ عذراً، لا تملك صلاحية إلغاء أو حذف قيود الخزينة!", "error");
      return;
    }

    if (tx.type === "رأس مال") {
      notify("⚠️ لا يمكن حذف قيود رأس المال مباشرة من هنا؛ يتم تعديلها من بطاقة العقد الأساسية في قسم العقود.", "info");
      return;
    }

    const confirmMsg = `هل أنت متأكد من حذف وإلغاء القيد المالي (${tx.desc}) بقيمة ${tx.inbound > 0 ? tx.inbound.toLocaleString() : tx.outbound.toLocaleString()} ريال؟`;
    if (!window.confirm(confirmMsg)) return;

    setIsUpdating(true);
    try {
      if (tx.id.startsWith("rec_")) {
        await sb.from("receipts").delete().eq("id", tx.rawId);
      } else if (tx.id.startsWith("pay_")) {
        // If worker linked, adjust balance back
        if (tx.originalEntity?.worker_id) {
          const w = workers.find(x => x.id === tx.originalEntity.worker_id);
          if (w) {
            const newAdv = Math.max(0, Number(w.advance || 0) - Number(tx.originalEntity.amount || 0));
            const tot = Number(w.daily || 0) * Number(w.days || 0);
            const newBal = Math.max(0, tot - newAdv);
            await sb.from("workers").update({ advance: newAdv, balance: newBal }).eq("id", w.id);
          }
        }
        await sb.from("payments").delete().eq("id", tx.rawId);
      } else if (tx.id.startsWith("exp_")) {
        await sb.from("expenses").delete().eq("id", tx.rawId);
      }

      await logSession(
        currentUser || { id: "treasury", name: "أمين الخزينة", role: "admin", code: "TREASURY", perms: {} as any },
        `حذف قيد مالي من الخزينة (${activeTab}): ${tx.desc}`
      );

      notify("تم حذف القيد المالي وتحديث رصيد الخزنة بنجاح!", "success");
      if (onUpdate) onUpdate();
    } catch (err: any) {
      notify(`فشل حذف القيد: ${err?.message || err}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Print Official Treasury Account Statement
  const handlePrintStatement = () => {
    const selectedCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
    const compName = selectedCompany?.name || "شركة عرب وورلد للمقاولات العامة";
    const compLogo = localStorage.getItem(`aw_company_logo_${selectedCompany?.id || "arab_world"}`) || "";
    const printDate = new Date().toLocaleDateString("ar-SA");

    const rowsHtml = filteredTxs.map((t, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px; text-align: center; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 8px; font-family: monospace;">${t.date}</td>
        <td style="padding: 8px; font-weight: bold; color: ${t.inbound > 0 ? '#059669' : '#dc2626'};">${t.categoryLabel}</td>
        <td style="padding: 8px; font-family: monospace; color: #475569;">${t.refNo || "—"}</td>
        <td style="padding: 8px; max-width: 250px;">${t.desc}</td>
        <td style="padding: 8px; text-align: center;">${t.method || "نقدي"}</td>
        <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #059669; text-align: left;">${t.inbound > 0 ? '+' + t.inbound.toLocaleString() : '—'}</td>
        <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #dc2626; text-align: left;">${t.outbound > 0 ? '-' + t.outbound.toLocaleString() : '—'}</td>
        <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #0f172a; text-align: left;">${t.balance.toLocaleString()}</td>
      </tr>
    `).join("");

    const win = window.open("", "_blank");
    if (!win) {
      notify("يرجى السماح بالنوافذ المنبثقة لطباعة كشف الحساب!", "info");
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب معتمد — ${activeTab}</title>
        <style>
          * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
          body { margin: 0; padding: 20px; background: #fff; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .title-block { text-align: center; flex: 1; }
          .title-block h1 { margin: 0; font-size: 22px; color: #0f172a; }
          .title-block p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: bold; }
          .meta-box { font-size: 11px; line-height: 1.6; text-align: left; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; background: #f8fafc; }
          .stat-card b { display: block; font-size: 10px; color: #64748b; margin-bottom: 4px; }
          .stat-card span { font-size: 16px; font-weight: bold; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #0f172a; color: #fff; padding: 9px; font-size: 11px; text-align: right; font-weight: bold; }
          .footer-signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin-top: 40px; }
          .sign-col { border-top: 1px dashed #64748b; padding-top: 10px; text-align: center; font-size: 11px; font-weight: bold; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; display: flex; gap: 10px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #059669; color: #fff; border: 0; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ طباعة كشف الحساب / حفظ PDF</button>
          <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: #fff; border: 0; border-radius: 6px; font-weight: bold; cursor: pointer;">إغلاق</button>
        </div>

        <div class="header">
          <div style="width: 140px;">
            ${compLogo ? `<img src="${compLogo}" style="max-height: 55px; max-width: 130px; object-fit: contain;" />` : `<h3 style="margin:0; font-size:14px;">${compName}</h3>`}
          </div>
          <div class="title-block">
            <h1>كشف حساب الخزينة والسيولة النقدية</h1>
            <p>حساب: ${activeTab} | ${compName}</p>
          </div>
          <div class="meta-box">
            <b>تاريخ التقرير:</b> ${printDate}<br/>
            <b>عدد القيود:</b> ${filteredTxs.length} معاملة<br/>
            <b>المسؤول:</b> ${currentUser?.name || "الإدارة المالية"}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <b>الرصيد الفعلي الحالي</b>
            <span style="color: #0f172a;">${currentSafeStat.balance.toLocaleString()} ريال</span>
          </div>
          <div class="stat-card">
            <b>إجمالي الوارد / الإيداعات</b>
            <span style="color: #059669;">+${currentSafeStat.inbound.toLocaleString()} ريال</span>
          </div>
          <div class="stat-card">
            <b>إجمالي الصادر / المسحوبات</b>
            <span style="color: #dc2626;">-${(currentSafeStat.paymentsOut + currentSafeStat.expensesOut).toLocaleString()} ريال</span>
          </div>
          <div class="stat-card">
            <b>رؤوس أموال عقود ممولة</b>
            <span style="color: #9333ea;">-${currentSafeStat.capitalOut.toLocaleString()} ريال</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 4%;">م</th>
              <th style="width: 10%;">التاريخ</th>
              <th style="width: 12%;">نوع الحركة</th>
              <th style="width: 10%;">رقم السند</th>
              <th style="width: 32%;">البيان والتفاصيل</th>
              <th style="width: 8%; text-align: center;">الوسيلة</th>
              <th style="width: 8%; text-align: left;">وارد (+)</th>
              <th style="width: 8%; text-align: left;">صادر (-)</th>
              <th style="width: 8%; text-align: left;">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align: center; padding: 20px;">لا توجد حركات مسجلة.</td></tr>'}
          </tbody>
        </table>

        <div class="footer-signs">
          <div class="sign-col">أمين الخزينة المعتمد</div>
          <div class="sign-col">المراجعة والتدقيق المالي</div>
          <div class="sign-col">اعتماد الإدارة العامة</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Add a new treasury
  const handleAddTreasury = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    const name = newTreasuryName.trim();
    if (!name) return;
    if (treasuries.includes(name)) {
      setInlineError("⚠️ هذه الخزنة مسجلة مسبقاً في النظام!");
      return;
    }
    const updated = [...treasuries, name];
    setTreasuries(updated);
    const suffix = selectedCompanyId && selectedCompanyId !== "all" ? `_${selectedCompanyId}` : "";
    localStorage.setItem(`aw_treasuries${suffix}`, JSON.stringify(updated));

    if (selectedCompanyId && selectedCompanyId !== "all") {
      try {
        await sb.from("companies").update({ treasuries: updated }).eq("id", selectedCompanyId);
      } catch (err: any) {
        console.error("Failed to save treasury to DB:", err);
      }
    }

    setNewTreasuryName("");
    window.dispatchEvent(new Event("storage"));
    if (onUpdate) onUpdate();
  };

  const updateNotesTreasury = (notes: string | undefined, oldT: string, newT: string, defaultT: string): string => {
    const text = String(notes || "").trim();
    const escapedOldT = oldT.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\[الخزنة:\\s*${escapedOldT}\\s*\\]`);
    const hasOldExplicit = text.includes(`[الخزنة: ${oldT}]`) || text.match(regex);
    if (hasOldExplicit) {
      const globalRegex = new RegExp(`\\[الخزنة:\\s*${escapedOldT}\\s*\\]`, 'g');
      return text.replace(globalRegex, `[الخزنة: ${newT}]`);
    }

    const hasAnyExplicit = text.includes(`[الخزنة:`);
    if (hasAnyExplicit) return text;

    if (oldT === defaultT) {
      return `[الخزنة: ${newT}]` + (text ? ` ${text}` : "");
    }
    return text;
  };

  const handleEditTreasurySubmit = async (oldName: string) => {
    setInlineError(null);
    const cleanOld = oldName.trim();
    const cleanNew = editInputVal.trim();
    if (!cleanNew) {
      setInlineError("⚠️ اسم الخزنة الجديد لا يمكن أن يكون فارغاً!");
      return;
    }
    if (cleanOld === cleanNew) {
      setEditingTreasuryName(null);
      return;
    }
    if (treasuries.includes(cleanNew) && cleanNew !== cleanOld) {
      setInlineError("⚠️ يوجد خزنة أخرى مسجلة بنفس هذا الاسم!");
      return;
    }

    try {
      setIsUpdating(true);
      const updated = treasuries.map(t => t === cleanOld ? cleanNew : t);
      setTreasuries(updated);
      const suffix = selectedCompanyId && selectedCompanyId !== "all" ? `_${selectedCompanyId}` : "";
      localStorage.setItem(`aw_treasuries${suffix}`, JSON.stringify(updated));

      if (selectedCompanyId && selectedCompanyId !== "all") {
        await sb.from("companies").update({ treasuries: updated }).eq("id", selectedCompanyId);
      }

      // Update receipts, payments, expenses, installments
      const affectedReceipts = receipts.filter(r => getReceiptTreasury(r) === cleanOld);
      for (const r of affectedReceipts) {
        const updatedNotes = updateNotesTreasury(r.notes, cleanOld, cleanNew, "خزنة التحصيل");
        await sb.from("receipts").update({ notes: updatedNotes }).eq("id", r.id);
      }

      const affectedPayments = payments.filter(p => getPaymentTreasury(p) === cleanOld);
      for (const p of affectedPayments) {
        const updatedNotes = updateNotesTreasury(p.notes, cleanOld, cleanNew, "خزنة الشركة");
        await sb.from("payments").update({ notes: updatedNotes }).eq("id", p.id);
      }

      const affectedExpenses = expenses.filter(e => getExpenseTreasury(e) === cleanOld);
      for (const e of affectedExpenses) {
        const updatedNotes = updateNotesTreasury(e.notes, cleanOld, cleanNew, "خزنة الشركة");
        await sb.from("expenses").update({ notes: updatedNotes }).eq("id", e.id);
      }

      if (activeTab === cleanOld) {
        setActiveTab(cleanNew);
      }

      window.dispatchEvent(new Event("storage"));
      if (onUpdate) onUpdate();
      setEditingTreasuryName(null);
    } catch (err: any) {
      setInlineError(`⚠️ حدث خطأ أثناء تعديل الخزنة: ${err.message || err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTreasury = async (name: string) => {
    setInlineError(null);
    if (treasuries.length <= 1) {
      setInlineError("⚠️ يجب إبقاء خزنة واحدة على الأقل في النظام لتسجيل المعاملات المالية!");
      return;
    }

    const txCount = getCompiledTransactionsForSafe(name).length;
    let confirmMsg = `هل أنت متأكد من إلغاء وحذف (${name}) نهائياً؟`;
    if (txCount > 0) {
      confirmMsg += `\nتنبيه: تحتوي هذه الخزنة على عدد ${txCount} معاملات نشطة بالدفتر! قد يؤثر حذفها على الترصيد الحسابي.`;
    }

    if (window.confirm(confirmMsg)) {
      try {
        setIsUpdating(true);
        const updated = treasuries.filter(t => t !== name);
        setTreasuries(updated);
        const suffix = selectedCompanyId && selectedCompanyId !== "all" ? `_${selectedCompanyId}` : "";
        localStorage.setItem(`aw_treasuries${suffix}`, JSON.stringify(updated));

        if (selectedCompanyId && selectedCompanyId !== "all") {
          await sb.from("companies").update({ treasuries: updated }).eq("id", selectedCompanyId);
        }

        if (activeTab === name) {
          setActiveTab(updated[0] || "خزنة الشركة");
        }
        window.dispatchEvent(new Event("storage"));
        if (onUpdate) onUpdate();
      } catch (err: any) {
        setInlineError(`⚠️ حدث خطأ أثناء حذف الخزنة: ${err.message || err}`);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <div className="space-y-8" dir="rtl">

      {/* Dynamic Main Consolidated Liquidity Widget */}
      {(() => {
        const selectedCompany = companies.find(c => c.id === selectedCompanyId);
        const hasSpecificCompany = selectedCompanyId && selectedCompanyId !== "all" && selectedCompany;

        const titleText = hasSpecificCompany
          ? `رصيد خزائن شركة ${selectedCompany.name}`
          : "الرصيد الموحد لكافة شركات المنظومة (المجموع الكلي)";

        const descText = hasSpecificCompany
          ? "إجمالي السيولة النقدية والترصيد المالي الخاص بصناديق هذه الشركة فقط"
          : "إجمالي السيولة النقدية المتوفرة والمحتسبة بالدفتر في كافة خزائن الشركات التابعة معاً";

        return (
          <div className="relative overflow-hidden rounded-3xl p-6 bg-slate-900/80 backdrop-blur-xl border border-emerald-500/40 shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 animate-pulse" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-200">{titleText}</h4>
                    <p className="text-[10px] text-slate-400">{descText}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <h2 className="text-4xl font-extrabold text-white font-mono tracking-tight flex items-baseline gap-1.5">
                    {totalBalance.toLocaleString()} <span className="text-sm font-normal font-sans text-slate-400">ريال سعودي</span>
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap gap-3.5 w-full lg:w-auto">
                <div className="flex-1 min-w-[130px] bg-slate-950/60 rounded-2xl p-3.5 border border-emerald-500/15 text-right shadow-inner">
                  <span className="block text-slate-500 text-[10px] font-black mb-1">إجمالي الوارد</span>
                  <b className="text-emerald-400 font-extrabold text-sm font-mono flex items-center justify-start gap-1">
                    <span>+</span>{totalInbound.toLocaleString()} <span className="text-[9px] font-sans font-normal text-slate-400">ريال</span>
                  </b>
                </div>
                <div className="flex-1 min-w-[130px] bg-slate-950/60 rounded-2xl p-3.5 border border-rose-500/15 text-right shadow-inner">
                  <span className="block text-slate-500 text-[10px] font-black mb-1">إجمالي الصادر</span>
                  <b className="text-rose-400 font-extrabold text-sm font-mono flex items-center justify-start gap-1">
                    <span>-</span>{totalOutbound.toLocaleString()} <span className="text-[9px] font-sans font-normal text-slate-400">ريال</span>
                  </b>
                </div>
                {totalCapitalOut > 0 && (
                  <div className="flex-1 min-w-[130px] bg-slate-950/60 rounded-2xl p-3.5 border border-purple-500/15 text-right shadow-inner">
                    <span className="block text-slate-500 text-[10px] font-black mb-1">رؤوس أموال عقود</span>
                    <b className="text-purple-400 font-extrabold text-sm font-mono flex items-center justify-start gap-1">
                      <span>-</span>{totalCapitalOut.toLocaleString()} <span className="text-[9px] font-sans font-normal text-slate-400">ريال</span>
                    </b>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dynamic Main Treasury Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {safeStats.map((stat, idx) => {
          const styles = [
            { border: "border-blue-500/30 hover:border-blue-500/50", glow: "bg-blue-500/10", text: "text-blue-300", icon: "text-blue-400" },
            { border: "border-emerald-500/30 hover:border-emerald-500/50", glow: "bg-emerald-500/10", text: "text-emerald-300", icon: "text-emerald-400" },
            { border: "border-amber-500/30 hover:border-amber-500/50", glow: "bg-amber-500/10", text: "text-amber-300", icon: "text-amber-400" },
            { border: "border-purple-500/30 hover:border-purple-500/50", glow: "bg-purple-500/10", text: "text-purple-300", icon: "text-purple-400" },
            { border: "border-rose-500/30 hover:border-rose-500/50", glow: "bg-rose-500/10", text: "text-rose-300", icon: "text-rose-400" }
          ];
          const st = styles[idx % styles.length];
          const isCurrentActive = activeTab === stat.name;

          return (
            <div
              key={stat.name}
              className={`relative overflow-hidden rounded-3xl p-5 bg-slate-900/60 backdrop-blur-xl border ${isCurrentActive ? 'border-amber-400 ring-2 ring-amber-400/20' : st.border} shadow-xl transition-all duration-300 flex flex-col justify-between`}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 ${st.glow} rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none`} />

              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs md:text-sm font-black tracking-wide flex items-center gap-1.5 ${st.text}`}>
                    <Landmark className="w-4 h-4 text-blue-400" /> {stat.name}
                  </span>
                  {isCurrentActive && (
                    <span className="px-2 py-0.5 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black rounded-lg">
                      الخزنة النشطة
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-white font-mono">
                    {stat.balance.toLocaleString()} <span className="text-xs font-normal font-sans text-slate-400">ريال</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400">الرصيد النشط الفعلي بالدفتر</p>
                </div>
              </div>

              {/* Inflows vs Outflows breakdown */}
              <div className="mt-4 space-y-1 text-[11px] bg-slate-950/50 border border-slate-850/80 p-2.5 rounded-2xl">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-emerald-400 font-bold">وارد وتحصيلات:</span>
                  <span className="font-mono text-emerald-400 font-black">+{stat.inbound.toLocaleString()} ريال</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-rose-400 font-bold">صادر ومسحوبات:</span>
                  <span className="font-mono text-rose-400 font-black">-{(stat.outbound - stat.capitalOut).toLocaleString()} ريال</span>
                </div>
                {stat.capitalOut > 0 && (
                  <div className="flex justify-between items-center text-purple-300">
                    <span>رؤوس أموال عقود:</span>
                    <span className="font-mono font-bold">-{stat.capitalOut.toLocaleString()} ريال</span>
                  </div>
                )}
              </div>

              {/* Card Action Buttons (Direct Operations) */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openDepositModal(stat.name)}
                  className="flex-1 py-1.5 px-2 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  title={`إيداع مالي في ${stat.name}`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>إيداع</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWithdrawalModal(stat.name)}
                  className="flex-1 py-1.5 px-2 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  title={`سحب مالي من ${stat.name}`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>سحب</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(stat.name);
                    openTransferModal(stat.name);
                  }}
                  className="p-1.5 bg-amber-600/15 hover:bg-amber-600 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl transition-all cursor-pointer"
                  title={`مناقلة من ${stat.name} إلى خزنة أخرى`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Active Safe Command Center & Operations Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  الخزنة النشطة: <span className="text-amber-300">{activeTab}</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                  رصيد: {currentSafeStat.balance.toLocaleString()} ريال
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                قم بإجراء إيداع أو سحب أو مناقلة أو استخراج كشف حساب الخزنة الحالية مباشرة
              </p>
            </div>
          </div>

          {/* Large Action Buttons for the Active Safe */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => openDepositModal(activeTab)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إيداع مالي ({activeTab})</span>
            </button>

            <button
              type="button"
              onClick={() => openWithdrawalModal(activeTab)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>سحب وصرف ({activeTab})</span>
            </button>

            <button
              type="button"
              onClick={() => openTransferModal(activeTab)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>مناقلة لخزنة أخرى</span>
            </button>

            <button
              type="button"
              onClick={handlePrintStatement}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="طباعة كشف حساب معتمد لهذه الخزنة"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>كشف حساب</span>
            </button>
          </div>
        </div>

        {/* Treasury Tabs and Ledger Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-1">
          {/* Treasury Selection Tabs */}
          <div className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto flex-wrap gap-1.5">
            {treasuries.map((tName, idx) => {
              const isActive = activeTab === tName;
              return (
                <button
                  key={tName}
                  onClick={() => setActiveTab(tName)}
                  className={`px-4 py-2 rounded-xl text-xs font-black select-none transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{tName}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Filter Pill Buttons */}
          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-850 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${filterType === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              الكل ({filteredTxs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("inbound")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${filterType === "inbound" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-emerald-300"}`}
            >
              وارد / إيداع
            </button>
            <button
              type="button"
              onClick={() => setFilterType("outbound")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${filterType === "outbound" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-rose-300"}`}
            >
              صادر / سحب
            </button>
            <button
              type="button"
              onClick={() => setFilterType("expense")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${filterType === "expense" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-amber-300"}`}
            >
              مصروفات
            </button>
            <button
              type="button"
              onClick={() => setFilterType("transfer")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${filterType === "transfer" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-purple-300"}`}
            >
              مناقلات
            </button>
          </div>
        </div>

        {/* Search and Date Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="بحث في قيود الخزنة بالبيان، رقم السند، أو المبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-bold focus:outline-none w-full font-mono"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-bold focus:outline-none w-full font-mono"
            />
          </div>
        </div>
      </div>

      {/* Transaction Records Table */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
            <span>📊</span>
            <span>كشف حركة حساب ({activeTab})</span>
            <span className="text-xs font-normal text-slate-400">({filteredTxs.length} حركة مسجلة)</span>
          </h3>
        </div>

        <div className="overflow-x-auto bg-slate-900/50 border border-slate-800 rounded-3xl shadow-xl">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800">
                <th className="py-4 px-4 font-black text-slate-300">التاريخ</th>
                <th className="py-4 px-4 font-black text-slate-300">النوع</th>
                <th className="py-4 px-4 font-black text-slate-300">رقم السند</th>
                <th className="py-4 px-4 font-black text-slate-300">البيان والشرح</th>
                <th className="py-4 px-4 font-black text-slate-300">الوسيلة</th>
                <th className="py-4 px-4 font-black text-emerald-400">وارد (قبض/إيداع)</th>
                <th className="py-4 px-4 font-black text-rose-400">صادر (صرف/سحب)</th>
                <th className="py-4 px-4 font-black text-amber-300">الرصيد المتراكم</th>
                <th className="py-4 px-4 font-black text-slate-400 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.length > 0 ? (
                filteredTxs.map((tx) => {
                  let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                  if (tx.type === "قبض") badgeClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                  if (tx.type === "صرف") badgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
                  if (tx.type === "مصروف") badgeClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
                  if (tx.type === "رأس مال") badgeClass = "bg-purple-500/15 text-purple-400 border-purple-500/30";
                  if (tx.type === "مناقلة_واردة") badgeClass = "bg-teal-500/15 text-teal-300 border-teal-500/30";
                  if (tx.type === "مناقلة_صادرة") badgeClass = "bg-orange-500/15 text-orange-300 border-orange-500/30";

                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-slate-850/60 hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-300 whitespace-nowrap">{tx.date}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-black border ${badgeClass}`}>
                          {tx.categoryLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300 whitespace-nowrap">
                        {tx.refNo || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-bold max-w-sm" title={tx.desc}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{tx.desc}</span>
                          {tx.attachment && (
                            <a
                              href={tx.attachment}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0 font-bold underline"
                            >
                              📎 مرفق
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs font-medium whitespace-nowrap">
                        {tx.method || "نقدي"}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-400 font-mono whitespace-nowrap">
                        {tx.inbound > 0 ? `+${tx.inbound.toLocaleString()} ريال` : "—"}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-rose-400 font-mono whitespace-nowrap">
                        {tx.outbound > 0 ? `-${tx.outbound.toLocaleString()} ريال` : "—"}
                      </td>
                      <td className="py-3.5 px-4 font-black text-white font-mono whitespace-nowrap">
                        {tx.balance.toLocaleString()} ريال
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print voucher button */}
                          {tx.id.startsWith("rec_") && onPrintReceipt && (
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(tx.rawId)}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                              title="طباعة سند القبض"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.id.startsWith("pay_") && onPrintPayment && (
                            <button
                              type="button"
                              onClick={() => onPrintPayment(tx.originalEntity)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                              title="طباعة سند الصرف"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.id.startsWith("exp_") && onPrintExpense && (
                            <button
                              type="button"
                              onClick={() => onPrintExpense(tx.originalEntity)}
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors"
                              title="طباعة سند المصروف"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Void/Delete button for admins */}
                          {isAdmin && tx.type !== "رأس مال" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                              title="إلغاء وحذف القيد من الخزنة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-bold">
                    لا توجد حركات حسابية أو قيود مسجلة في هذه الخزنة تطابق معايير البحث الحالية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Treasury Setup & Hierarchy Management section */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-4">
          <div>
            <h4 className="text-md font-black text-white flex items-center gap-2">
              🛠️ لوحة إدارة وهيكلة خزائن وصناديق المنظومة
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              يمكنك إضافة خزائن وصناديق مالية فرعية جديدة أو إعادة تسميتها أو حذف الخزائن غير المستخدمة لجعل النظام المحاسبي ديناميكياً بالكامل.
            </p>
          </div>
        </div>

        {inlineError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {inlineError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form to add new safe */}
          <form onSubmit={handleAddTreasury} className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-300">تسجيل وتأسيس خزنة مالية جديدة</label>
              <input
                type="text"
                placeholder="مثال: خزنة الرياض، خزنة النقد الاحتياطي، حساب الراجحي..."
                value={newTreasuryName}
                onChange={(e) => {
                  setNewTreasuryName(e.target.value);
                  setInlineError(null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> إضافة الخزنة المقترحة للقائمة
            </button>
          </form>

          {/* List and edit/delete safes */}
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl space-y-3">
            <span className="block text-xs font-black text-slate-300">الخزائن المعرفة بالبرنامج حالياً ({treasuries.length})</span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {treasuries.map((name) => {
                const txCount = getCompiledTransactionsForSafe(name).length;
                return (
                  <div key={name} className="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-850">
                    <div className="flex items-center gap-2 flex-grow">
                      <Coins className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {editingTreasuryName === name ? (
                        <div className="flex items-center gap-2 flex-grow ml-2" dir="rtl">
                          <input
                            type="text"
                            value={editInputVal}
                            onChange={(e) => setEditInputVal(e.target.value)}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-blue-500 w-full"
                          />
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleEditTreasurySubmit(name)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                            title="حفظ التعديل"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => setEditingTreasuryName(null)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-750 transition-colors cursor-pointer"
                            title="إلغاء التعديل"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-black text-white">{name}</span>
                          <span className="block text-[9px] text-slate-500">تحتوي على عدد {txCount} قيد بالدفتر</span>
                        </div>
                      )}
                    </div>

                    {editingTreasuryName !== name && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTreasuryName(name);
                            setEditInputVal(name);
                          }}
                          className="p-1 px-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300 text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                          title="تعديل اسم الخزنة"
                        >
                          <Edit2 className="w-3 h-3" /> تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTreasury(name)}
                          className="p-1 px-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-rose-400 hover:text-rose-300 text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                          title="حذف وإلغاء هذه الخزنة من القائمة"
                        >
                          <Trash2 className="w-3 h-3" /> إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📥 MODAL 1: DIRECT DEPOSIT (إيداع مالي مباشر في الخزنة) */}
      {/* ========================================================================= */}
      {modalMode === "deposit" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
                  <ArrowDownLeft className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">إيداع مالي مباشر في الخزنة</h3>
                  <p className="text-[11px] text-slate-400">تسجيل وتغذية رصيد لصالح: <b className="text-emerald-400">{targetSafeForOp}</b></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Deposit Type Selector */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDepDepositType("cash")}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${depDepositType === "cash" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  💵 تغذية نقدية مباشرة
                </button>
                <button
                  type="button"
                  onClick={() => setDepDepositType("general_receipt")}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${depDepositType === "general_receipt" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  📄 سند قبض / إيراد عام
                </button>
                <button
                  type="button"
                  onClick={() => setDepDepositType("contract_payment")}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${depDepositType === "contract_payment" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  🤝 دفعة عقد لعميل
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Target Safe */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">الخزنة المستهدفة للإيداع *</label>
                  <select
                    value={targetSafeForOp}
                    onChange={(e) => setTargetSafeForOp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-emerald-400"
                  >
                    {treasuries.map(t => (
                      <option key={t} value={t}>💼 {t}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">المبلغ المودع بالريال *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={depAmount}
                      onChange={(e) => setDepAmount(e.target.value)}
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-emerald-400 font-mono focus:outline-none focus:border-emerald-400"
                    />
                    <span className="absolute left-3 top-2 text-[10px] font-bold text-slate-500">ريال</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Depositor Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">اسم المودع / استلمنا من *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المودع أو الجهة المسددة"
                    value={depFromName}
                    onChange={(e) => setDepFromName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Method */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">وسيلة وقناة الإيداع</label>
                  <select
                    value={depMethod}
                    onChange={(e) => setDepMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="نقداً">💵 نقداً (كاش)</option>
                    <option value="تحويل بنكي">🏦 تحويل بنكي</option>
                    <option value="شبكة / مدى">💳 شبكة / مدى</option>
                    <option value="شيك">📑 شيك بنكي</option>
                  </select>
                </div>
              </div>

              {/* If contract payment chosen, show contract dropdown */}
              {depDepositType === "contract_payment" && (
                <div className="space-y-1 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <label className="text-[11px] font-black text-amber-400">ربط السداد بعقد تقسيط نشط</label>
                  <select
                    value={depContractId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setDepContractId(cid);
                      const matched = installments.find(i => i.id === cid);
                      if (matched) {
                        setDepFromName(matched.client);
                        if (!depAmount && matched.installment) {
                          setDepAmount(String(matched.installment));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- اختر العقد المراد سداد قسط له --</option>
                    {installments.filter(i => i.status !== "مكتمل").map(inst => (
                      <option key={inst.id} value={inst.id}>
                        عقد #{inst.no} — العميل: {inst.client} (متبقي: {Number(inst.remaining || 0).toLocaleString()} ريال)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">تاريخ الإيداع</label>
                  <input
                    type="date"
                    value={depDate}
                    onChange={(e) => setDepDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none font-mono"
                  />
                </div>

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">المشروع التابع (اختياري)</label>
                  <select
                    value={depProject}
                    onChange={(e) => setDepProject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="">-- عام بدون مشروع محدد --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>🏗️ {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400">البيان وملاحظات الإيداع</label>
                <textarea
                  rows={2}
                  placeholder="سبب الإيداع، تفاصيل الحوالة، أو أي بيانات إضافية..."
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-black rounded-xl transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>تأكيد الإيداع في ({targetSafeForOp})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📤 MODAL 2: DIRECT WITHDRAWAL (سحب مالي مباشر من الخزنة) */}
      {/* ========================================================================= */}
      {modalMode === "withdrawal" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-rose-500/15 text-rose-400 rounded-xl">
                  <ArrowUpRight className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">سحب وصرف مالي من الخزنة</h3>
                  <p className="text-[11px] text-slate-400">خصم وصرف رصيد من: <b className="text-rose-400">{targetSafeForOp}</b></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              {/* Withdrawal Type Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setWithWithdrawalType("cash_custody")}
                  className={`py-2 rounded-xl text-[11px] font-black transition-all ${withWithdrawalType === "cash_custody" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  💼 عهدة / مسحوبات
                </button>
                <button
                  type="button"
                  onClick={() => setWithWithdrawalType("payment_beneficiary")}
                  className={`py-2 rounded-xl text-[11px] font-black transition-all ${withWithdrawalType === "payment_beneficiary" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  📄 صرف مستحقات
                </button>
                <button
                  type="button"
                  onClick={() => setWithWithdrawalType("operating_expense")}
                  className={`py-2 rounded-xl text-[11px] font-black transition-all ${withWithdrawalType === "operating_expense" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  🛒 سداد مصروف
                </button>
                <button
                  type="button"
                  onClick={() => setWithWithdrawalType("worker_advance")}
                  className={`py-2 rounded-xl text-[11px] font-black transition-all ${withWithdrawalType === "worker_advance" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                >
                  👷 سلفة / دفعة عامل
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Source Safe */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">الخزنة المسحوب منها *</label>
                  <select
                    value={targetSafeForOp}
                    onChange={(e) => setTargetSafeForOp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-rose-400"
                  >
                    {treasuries.map(t => (
                      <option key={t} value={t}>💼 {t}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-slate-400">المبلغ المسحوب *</label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      المتوفر: {safeStats.find(s => s.name === targetSafeForOp)?.balance.toLocaleString()} ريال
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={withAmount}
                      onChange={(e) => setWithAmount(e.target.value)}
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-rose-400 font-mono focus:outline-none focus:border-rose-400"
                    />
                    <span className="absolute left-3 top-2 text-[10px] font-bold text-slate-500">ريال</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Recipient Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">يصرف للمكرم / المستفيد *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المستلم أو المورد أو جهة الصرف"
                    value={withToName}
                    onChange={(e) => setWithToName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                {/* Method */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">وسيلة وطريقة الصرف</label>
                  <select
                    value={withMethod}
                    onChange={(e) => setWithMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-400"
                  >
                    <option value="نقداً">💵 نقداً (كاش من الصندوق)</option>
                    <option value="تحويل بنكي">🏦 تحويل بنكي</option>
                    <option value="شيك">📑 شيك بنكي</option>
                  </select>
                </div>
              </div>

              {/* If operating expense, show category */}
              {withWithdrawalType === "operating_expense" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">تصنيف وبند المصروف</label>
                  <select
                    value={withCategory}
                    onChange={(e) => setWithCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="مواد">📦 مواد ومشتريات</option>
                    <option value="عمالة">👷 مصاريف عمالة وفنيين</option>
                    <option value="نقل">🚚 نقل وتوصيل</option>
                    <option value="إيجار">🏢 إيجار مقار ومواقع</option>
                    <option value="وقود">⛽ وقود وبنزين وديزل</option>
                    <option value="صيانة">🔧 صيانة وتشغيل</option>
                    <option value="اتصالات">📱 اتصالات وإنترنت</option>
                    <option value="إعاشة">🍱 إعاشة وضيافة</option>
                    <option value="أخرى">📌 أخرى وعام</option>
                  </select>
                </div>
              )}

              {/* If worker advance, show worker list */}
              {withWithdrawalType === "worker_advance" && (
                <div className="space-y-1 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <label className="text-[11px] font-black text-amber-400">اختيار العامل المستلم للسلفة / الدفعة</label>
                  <select
                    value={withWorkerId}
                    onChange={(e) => {
                      const wid = e.target.value;
                      setWithWorkerId(wid);
                      const w = workers.find(x => x.id === wid);
                      if (w) {
                        setWithToName(w.name);
                        if (w.project) setWithProject(w.project);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- حدد العامل من القائمة --</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.job}) — رصيد متبقي: {Number(w.balance || 0).toLocaleString()} ريال
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">تاريخ السحب</label>
                  <input
                    type="date"
                    value={withDate}
                    onChange={(e) => setWithDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none font-mono"
                  />
                </div>

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">المشروع التابع (اختياري)</label>
                  <select
                    value={withProject}
                    onChange={(e) => setWithProject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="">-- عام بدون مشروع محدد --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>🏗️ {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400">البيان ومبرر الصرف</label>
                <textarea
                  rows={2}
                  placeholder="سبب السحب، الغرض، أو تفاصيل المصروف..."
                  value={withNotes}
                  onChange={(e) => setWithNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-black rounded-xl transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>تأكيد السحب والخصم من ({targetSafeForOp})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔄 MODAL 3: INTER-TREASURY TRANSFER (مناقلة مالية بين الخزائن) */}
      {/* ========================================================================= */}
      {modalMode === "transfer" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
                  <ArrowLeftRight className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">مناقلة وتحويل مالي بين الخزائن</h3>
                  <p className="text-[11px] text-slate-400">تحويل سيولة نقدية مباشرة من خزنة إلى خزنة أخرى بالمنظومة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                {/* Source Safe */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-rose-400 flex items-center gap-1">
                    <span>📤</span> من الخزنة (المصدر / خصم):
                  </label>
                  <select
                    value={transSourceSafe}
                    onChange={(e) => setTransSourceSafe(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {treasuries.map(t => (
                      <option key={t} value={t}>💼 {t} (رصيد: {safeStats.find(s => s.name === t)?.balance.toLocaleString()} ريال)</option>
                    ))}
                  </select>
                </div>

                {/* Destination Safe */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-emerald-400 flex items-center gap-1">
                    <span>📥</span> إلى الخزنة (الوجهة / إيداع):
                  </label>
                  <select
                    value={transDestSafe}
                    onChange={(e) => setTransDestSafe(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- اختر الخزنة المستلمة --</option>
                    {treasuries.filter(t => t !== transSourceSafe).map(t => (
                      <option key={t} value={t}>💼 {t} (رصيد: {safeStats.find(s => s.name === t)?.balance.toLocaleString()} ريال)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Transfer Amount */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">مبلغ التحويل بالريال *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={transAmount}
                      onChange={(e) => setTransAmount(e.target.value)}
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-amber-400 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute left-3 top-2 text-[10px] font-bold text-slate-500">ريال</span>
                  </div>
                </div>

                {/* Transfer Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400">تاريخ المناقلة</label>
                  <input
                    type="date"
                    value={transDate}
                    onChange={(e) => setTransDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400">البيان وسبب المناقلة</label>
                <textarea
                  rows={2}
                  placeholder="سبب التحويل بين الخزائن، تغذية فرع، إعادة ترصيد..."
                  value={transNotes}
                  onChange={(e) => setTransNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-black rounded-xl transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>تنفيذ المناقلة والتحويل المالي</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
