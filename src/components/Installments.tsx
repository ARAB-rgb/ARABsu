/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Plus, Search, User, Phone, MapPin, ClipboardList, Shield,
  Printer, Trash2, Edit2, FileText, CheckCircle, AlertTriangle, Eye, X, Globe,
  RotateCw, RefreshCw, CalendarCheck, Activity, CheckCircle2, Filter, RotateCcw,
  ChevronDown, ChevronUp, LayoutGrid, Table as TableIcon, Calendar, Clock, DollarSign,
  Maximize2, Minimize2, Info, ArrowRightLeft, Building2, FileSpreadsheet,
  Download, FileDown, FolderDown
} from "lucide-react";
import { Installment, Project, User as AuthUser, Company, Worker } from "../types";
import {
  getContractTiming, awExtractRegion, awCleanNotes, generateNextNo, awExtractTreasury,
  awExtractCapital, awExtractCapitalSource, awExtractCapitalCompany, awExtractCapitalCollection,
  awExtractCapitalSplit, awExtractCycle, awExtractClassification, awExtractContractDirection,
  awExtractWorkerId, awExtractProjectId, awExtractDownPayment, awExtractRenewedFrom
} from "../db";
import { safeStorage } from "../safeStorage";

const localStorage = safeStorage;

interface InstallmentsProps {
  currentUser: AuthUser | null;
  activePerms?: any;
  installments: Installment[];
  projects: Project[];
  workers?: Worker[];
  onSaveInstallment: (row: any, editId: string | null) => Promise<boolean>;
  onDeleteInstallment: (id: string) => void;
  onPrintContract: (id: string) => void;
  onMigrateInstallment?: (installmentId: string, targetCompanyId: string, reason?: string) => Promise<boolean>;
  onTransferContractAndPayments?: (
    sourceContractId: string,
    targetContractId: string,
    options: {
      transferReceipts: boolean;
      transferPayments: boolean;
      transferNotesAndFiles?: boolean;
      transferRemainingDebt?: boolean;
      sourceContractAction: "close_as_transferred" | "delete_source" | "keep_and_recalc";
      reason?: string;
    }
  ) => Promise<boolean>;
  onCreateReceiptForContract?: (installment: Installment) => void;
  receipts: any[];
  payments?: any[];
  expenses?: any[];
  companies?: Company[];
  selectedCompanyId?: string;
}

const getStoredTreasuries = (companyId?: string | null, companiesList?: Company[]): string[] => {
  const defaults = ["خزنة الشركة", "خزنة التحصيل"];
  
  if (companyId && companyId !== "all" && companiesList) {
    const matched = companiesList.find(c => c.id === companyId);
    if (matched && matched.treasuries && Array.isArray(matched.treasuries) && matched.treasuries.length > 0) {
      return matched.treasuries;
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

export const Installments: React.FC<InstallmentsProps> = ({
  currentUser,
  activePerms,
  installments,
  projects,
  workers,
  onSaveInstallment,
  onDeleteInstallment,
  onPrintContract,
  onMigrateInstallment,
  onTransferContractAndPayments,
  onCreateReceiptForContract,
  receipts,
  payments,
  expenses,
  companies,
  selectedCompanyId,
}) => {
  const finalPerms = activePerms || currentUser?.perms || {};
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [client, setClient] = useState("");
  const [contractType, setContractType] = useState<string>("تقسيط");
  const [contractDirection, setContractDirection] = useState<"لنا" | "علينا" | "مصروفات عمالة">("لنا");
  const [linkedWorkerId, setLinkedWorkerId] = useState<string>("");
  const [linkedProjectId, setLinkedProjectId] = useState<string>("");
  const [installmentCycle, setInstallmentCycle] = useState<string>("يومي");
  const [classification, setClassification] = useState<string>("مدين");
  const [identity, setIdentity] = useState("");
  const [nationality, setNationality] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paid, setPaid] = useState<number | "">("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [periods, setPeriods] = useState<number | "">("");
  const [installment, setInstallment] = useState<number | "">("");
  const [discount, setDiscount] = useState<number | "">("");
  const [afterDiscount, setAfterDiscount] = useState<number | " text">("");
  const [projectSug, setProjectSug] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [guarantor, setGuarantor] = useState("");
  const [status, setStatus] = useState<"منتظم" | "متأخر" | "متعثر" | "مكتمل">("منتظم");
  const [notes, setNotes] = useState("");
  const [treasury, setTreasury] = useState("خزنة التحصيل");
  const [capital, setCapital] = useState<number | "">("");
  const [capitalSource, setCapitalSource] = useState<string>("خزنة الشركة");
  const [capitalCompany, setCapitalCompany] = useState<number | "">("");
  const [capitalCollection, setCapitalCollection] = useState<number | "">("");
  const [capitalSplits, setCapitalSplits] = useState<Record<string, number | "">>({});
  const [installmentCompanyId, setInstallmentCompanyId] = useState("");
  const [dynamicTreasuries, setDynamicTreasuries] = useState<string[]>(() => 
    getStoredTreasuries(installmentCompanyId || selectedCompanyId, companies)
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setDynamicTreasuries(getStoredTreasuries(installmentCompanyId || selectedCompanyId, companies));
    };
    window.addEventListener("storage", handleStorageChange);
    handleStorageChange();
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [installmentCompanyId, selectedCompanyId, companies]);
  const [isCapitalManuallyEdited, setIsCapitalManuallyEdited] = useState(false);

  // Confirmation Modal states before saving contract
  const [pendingContractRow, setPendingContractRow] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSavingContract, setIsSavingContract] = useState(false);

  // Sync selected company when not in edit mode
  useEffect(() => {
    if (!editId) {
      setInstallmentCompanyId(selectedCompanyId !== "all" ? (selectedCompanyId || "") : "");
    }
  }, [selectedCompanyId, editId]);

  // Keep capitalCompany and capitalCollection synced with capitalSplits for backward compatibility & legacy code
  useEffect(() => {
    setCapitalCompany(capitalSplits["خزنة الشركة"] || "");
    setCapitalCollection(capitalSplits["خزنة التحصيل"] || "");
  }, [capitalSplits]);

  // Capital reactive sync / default computation
  useEffect(() => {
    if (editId || isCapitalManuallyEdited) return;
    
    // Auto populate capital based on amount and paid (The reactive feature)
    const calculatedCapital = Math.max(0, Number(amount || 0) - Number(paid || 0));
    if (calculatedCapital > 0) {
      if (capitalSource === "كلاهما") {
        const count = dynamicTreasuries.length || 2;
        const perSafe = Math.round(calculatedCapital / count);
        const newSplits: Record<string, number | ""> = {};
        dynamicTreasuries.forEach(tName => {
          newSplits[tName] = perSafe;
        });
        setCapitalSplits(newSplits);
        setCapital("");
      } else {
        setCapital(calculatedCapital);
        setCapitalSplits({});
      }
    } else {
      setCapital("");
      setCapitalSplits({});
    }
  }, [amount, paid, capitalSource, editId, isCapitalManuallyEdited, dynamicTreasuries]);

  const handleCapitalSourceChange = (newSource: string) => {
    setCapitalSource(newSource);
    
    // Convert / transfer existing values seamlessly
    if (newSource === "كلاهما") {
      const currentTotal = Number(capital || 0);
      if (currentTotal > 0) {
        const count = dynamicTreasuries.length || 2;
        const perSafe = Math.round(currentTotal / count);
        const newSplits: Record<string, number | ""> = {};
        dynamicTreasuries.forEach(tName => {
          newSplits[tName] = perSafe;
        });
        setCapitalSplits(newSplits);
      } else {
        setCapitalSplits({});
      }
      setCapital("");
    } else {
      const totalSplits = Object.values(capitalSplits).reduce<number>((sum, val) => sum + Number(val || 0), 0);
      if (totalSplits > 0) {
        setCapital(totalSplits);
      }
      setCapitalSplits({});
    }
  };

  const handleCapitalChange = (val: string) => {
    setCapital(val ? Number(val) : "");
    setIsCapitalManuallyEdited(true);
  };

  const handleCapitalCompanyChange = (val: string) => {
    setCapitalCompany(val ? Number(val) : "");
    setIsCapitalManuallyEdited(true);
  };

  const handleCapitalCollectionChange = (val: string) => {
    setCapitalCollection(val ? Number(val) : "");
    setIsCapitalManuallyEdited(true);
  };

  // Filters State
  const [qSearch, setQSearch] = useState("");
  const [fContractLifecycle, setFContractLifecycle] = useState<"all" | "active" | "completed">("all");
  const [fType, setFType] = useState("");
  const [fClassification, setFClassification] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fNationality, setFNationality] = useState("");
  const [fProject, setFProject] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fSort, setFSort] = useState("date_desc");
  const [viewLayout, setViewLayout] = useState<"smart_table" | "cards">("smart_table");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllExpanded = (expand: boolean) => {
    if (!expand) {
      setExpandedRows({});
    } else {
      const all: Record<string, boolean> = {};
      installments.forEach(item => {
        all[item.id] = true;
      });
      setExpandedRows(all);
    }
  };

  // Contract Renewal State
  const [renewTarget, setRenewTarget] = useState<Installment | null>(null);
  const [renewMode, setRenewMode] = useState<"new_contract" | "extend_contract">("new_contract");
  const [renewNewContractNo, setRenewNewContractNo] = useState<string>("");
  const [renewStartDate, setRenewStartDate] = useState<string>("");
  const [renewPeriods, setRenewPeriods] = useState<string>("30");
  const [renewCycle, setRenewCycle] = useState<string>("يومي");
  const [renewAmount, setRenewAmount] = useState<string>("");
  const [renewDownPayment, setRenewDownPayment] = useState<string>("0");
  // Balance adjustment choice: 'none' | 'add_remaining' | 'deduct_remaining' | 'custom_adjustment'
  const [renewBalanceAction, setRenewBalanceAction] = useState<"none" | "add_remaining" | "deduct_remaining" | "custom_discount">("none");
  const [renewCustomAdjustmentAmount, setRenewCustomAdjustmentAmount] = useState<string>("0");
  const [renewDiscount, setRenewDiscount] = useState<string>("0");
  const [renewNotes, setRenewNotes] = useState<string>("");
  const [renewCloseOld, setRenewCloseOld] = useState<boolean>(true);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  const openRenewModal = (c: Installment) => {
    setRenewTarget(c);
    setRenewMode("new_contract");
    const nextNo = generateNextNo("AW-CON", installments, "no");
    setRenewNewContractNo(nextNo);

    // Compute start date: if contract has end_date, start from next day or today
    let defaultStart = new Date().toISOString().slice(0, 10);
    if (c.end_date) {
      const endDateObj = new Date(c.end_date);
      if (!isNaN(endDateObj.getTime())) {
        endDateObj.setDate(endDateObj.getDate() + 1);
        defaultStart = endDateObj.toISOString().slice(0, 10);
      }
    }
    setRenewStartDate(defaultStart);

    const oldPeriods = c.periods ? String(c.periods) : "30";
    setRenewPeriods(oldPeriods);

    const oldCycle = awExtractCycle(c.notes || "") || "يومي";
    setRenewCycle(oldCycle);

    setRenewAmount(c.amount ? String(c.amount) : "");
    setRenewDownPayment("0");
    setRenewBalanceAction("none");
    setRenewCustomAdjustmentAmount("0");
    setRenewDiscount("0");
    setRenewNotes(`تجديد وتمديد للعقد السابق (${c.no})`);
    setRenewCloseOld(true);
  };

  const handleExecuteRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget) return;

    setIsRenewing(true);
    try {
      const periodsNum = Number(renewPeriods || 0);
      const baseAmount = Number(renewAmount || 0);
      const oldRemaining = Number(renewTarget.remaining || 0);
      
      let balanceAdjustment = 0;
      let balanceActionNote = "";
      if (renewBalanceAction === "add_remaining") {
        balanceAdjustment = oldRemaining;
        balanceActionNote = ` | مضاف إليه متبقي العقد السابق (${oldRemaining.toLocaleString()} ريال)`;
      } else if (renewBalanceAction === "deduct_remaining") {
        balanceAdjustment = -oldRemaining;
        balanceActionNote = ` | مخصوم منه متبقي العقد السابق (${oldRemaining.toLocaleString()} ريال)`;
      } else if (renewBalanceAction === "custom_discount") {
        const customAdj = Number(renewCustomAdjustmentAmount || 0);
        balanceAdjustment = -customAdj;
        balanceActionNote = ` | تم تطبيق خصم تسوية (${customAdj.toLocaleString()} ريال)`;
      }

      const totalAmount = Math.max(0, baseAmount + (balanceAdjustment > 0 ? balanceAdjustment : 0));
      const downPaymentNum = Number(renewDownPayment || 0);
      const discountNum = Number(renewDiscount || 0) + (balanceAdjustment < 0 ? Math.abs(balanceAdjustment) : 0);
      const finalRemaining = Math.max(0, totalAmount - downPaymentNum - discountNum);
      const installmentVal = periodsNum > 0 ? Math.ceil(finalRemaining / periodsNum) : 0;

      // Calculate end date
      let calcEndDate = "";
      if (periodsNum > 0 && renewStartDate) {
        const d = new Date(renewStartDate);
        if (renewCycle === "اسبوعي") {
          d.setDate(d.getDate() + (periodsNum * 7) - 1);
        } else if (renewCycle === "نصف شهر") {
          d.setDate(d.getDate() + (periodsNum * 15) - 1);
        } else if (renewCycle === "شهري") {
          d.setMonth(d.getMonth() + periodsNum);
          d.setDate(d.getDate() - 1);
        } else {
          d.setDate(d.getDate() + periodsNum - 1);
        }
        calcEndDate = d.toISOString().slice(0, 10);
      }

      if (renewMode === "new_contract") {
        let finalNo = (renewNewContractNo || generateNextNo("AW-CON", installments, "no")).trim().toUpperCase();
        const isDup = installments.some(
          (i) => String(i.no || "").trim().toUpperCase() === finalNo
        );
        if (isDup) {
          finalNo = generateNextNo("AW-CON", installments, "no");
        }

        const newRow = {
          client: renewTarget.client,
          identity: renewTarget.identity || "",
          nationality: renewTarget.nationality || "",
          phone: renewTarget.phone || "",
          no: finalNo,
          amount: totalAmount,
          paid: downPaymentNum,
          remaining: finalRemaining,
          type: renewTarget.type || "تقسيط",
          start_date: renewStartDate,
          end_date: calcEndDate,
          periods: periodsNum,
          installment: installmentVal,
          discount: discountNum,
          after_discount: finalRemaining,
          project: renewTarget.project || "",
          workplace: renewTarget.workplace || "",
          guarantor: renewTarget.guarantor || "",
          status: "منتظم",
          notes: `${renewNotes.trim()}${balanceActionNote}`.trim(),
          region_input: awExtractRegion(renewTarget.notes || "") || (finalPerms?.region || ""),
          treasury_input: awExtractTreasury(renewTarget.notes || "") || "خزنة التحصيل",
          cycle_input: renewCycle,
          classification_input: awExtractClassification(renewTarget.notes || "") || "مدين",
          contract_direction_input: (renewTarget.contract_direction as any) || awExtractContractDirection(renewTarget.notes || "") || "لنا",
          worker_id_input: renewTarget.worker_id || awExtractWorkerId(renewTarget.notes || "") || "",
          project_id_input: renewTarget.project_id || awExtractProjectId(renewTarget.notes || "") || "",
          renewed_from_input: renewTarget.no,
          capital_input: 0,
          capital_source_input: "",
          capital_company_input: 0,
          capital_collection_input: 0,
          capital_splits_input: {},
          company_id: renewTarget.company_id || undefined,
        };

        const success = await onSaveInstallment(newRow, null);
        if (success) {
          if (renewCloseOld) {
            const oldRowUpdated = {
              ...renewTarget,
              status: "مكتمل",
              region_input: awExtractRegion(renewTarget.notes || ""),
              treasury_input: awExtractTreasury(renewTarget.notes || ""),
              cycle_input: awExtractCycle(renewTarget.notes || ""),
              classification_input: awExtractClassification(renewTarget.notes || ""),
              contract_direction_input: renewTarget.contract_direction || awExtractContractDirection(renewTarget.notes || ""),
              worker_id_input: renewTarget.worker_id || awExtractWorkerId(renewTarget.notes || ""),
              project_id_input: renewTarget.project_id || awExtractProjectId(renewTarget.notes || ""),
            };
            await onSaveInstallment(oldRowUpdated, renewTarget.id);
          }
          setRenewTarget(null);
          if (selectedFileContract) {
            setSelectedFileContract(null);
          }
        }
      } else {
        // Extend existing contract
        const updatedPeriods = Number(renewTarget.periods || 0) + periodsNum;
        const updatedAmount = Number(renewTarget.amount || 0) + baseAmount;
        const updatedRemaining = Math.max(0, updatedAmount - Number(renewTarget.paid || 0) - discountNum);
        const updatedInstallmentVal = updatedPeriods > 0 ? Math.ceil(updatedRemaining / updatedPeriods) : 0;

        const updatedRow = {
          ...renewTarget,
          amount: updatedAmount,
          remaining: updatedRemaining,
          periods: updatedPeriods,
          installment: updatedInstallmentVal,
          end_date: calcEndDate || renewTarget.end_date,
          status: "منتظم",
          notes: `${awCleanNotes(renewTarget.notes || "")} | تم تمديد وتجديد العقد بتاريخ ${renewStartDate}${balanceActionNote}`,
          region_input: awExtractRegion(renewTarget.notes || ""),
          treasury_input: awExtractTreasury(renewTarget.notes || ""),
          cycle_input: renewCycle,
          classification_input: awExtractClassification(renewTarget.notes || ""),
          contract_direction_input: renewTarget.contract_direction || awExtractContractDirection(renewTarget.notes || ""),
          worker_id_input: renewTarget.worker_id || awExtractWorkerId(renewTarget.notes || ""),
          project_id_input: renewTarget.project_id || awExtractProjectId(renewTarget.notes || ""),
        };

        const success = await onSaveInstallment(updatedRow, renewTarget.id);
        if (success) {
          setRenewTarget(null);
          if (selectedFileContract) {
            setSelectedFileContract(null);
          }
        }
      }
    } finally {
      setIsRenewing(false);
    }
  };

  // Modal Detail State
  const [selectedFileContract, setSelectedFileContract] = useState<Installment | null>(null);

  // Migrate to another Company Modal State
  const [migrateCompanyContract, setMigrateCompanyContract] = useState<Installment | null>(null);
  const [targetMigrateCompanyId, setTargetMigrateCompanyId] = useState<string>("");
  const [migrateCompanyReason, setMigrateCompanyReason] = useState<string>("");
  const [isMigratingCompany, setIsMigratingCompany] = useState<boolean>(false);

  // Receipts linked to currently selected company migration contract
  const migrateReceiptsList = migrateCompanyContract
    ? receipts.filter(r => r.installment_id === migrateCompanyContract.id || (migrateCompanyContract.no && r.contract_no === migrateCompanyContract.no))
    : [];
  const migrateReceiptsSum = migrateReceiptsList.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  const handleExecuteCompanyMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!migrateCompanyContract || !targetMigrateCompanyId) {
      alert("يرجى اختيار الشركة المستهدفة لنقل العقد إليها أولاً!");
      return;
    }

    setIsMigratingCompany(true);
    try {
      if (onMigrateInstallment) {
        const success = await onMigrateInstallment(
          migrateCompanyContract.id,
          targetMigrateCompanyId,
          migrateCompanyReason.trim() || "نقل العقد لشركة أخرى"
        );
        if (success) {
          setMigrateCompanyContract(null);
          setTargetMigrateCompanyId("");
          setMigrateCompanyReason("");
          if (selectedFileContract) {
            setSelectedFileContract(null);
          }
        }
      }
    } finally {
      setIsMigratingCompany(false);
    }
  };

  // Contract & Payments Transfer Modal State
  const [transferSourceContract, setTransferSourceContract] = useState<Installment | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [transferSearchQuery, setTransferSearchQuery] = useState<string>("");
  const [transferAction, setTransferAction] = useState<"close_as_transferred" | "delete_source" | "keep_and_recalc">("close_as_transferred");
  const [transferDebtTogether, setTransferDebtTogether] = useState<boolean>(false);
  const [transferFilesAndNotes, setTransferFilesAndNotes] = useState<boolean>(true);
  const [transferReason, setTransferReason] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Receipts linked to currently selected transfer source contract
  const sourceReceiptsList = transferSourceContract
    ? receipts.filter(r => r.installment_id === transferSourceContract.id || (transferSourceContract.no && r.contract_no === transferSourceContract.no))
    : [];
  const sourceReceiptsSum = sourceReceiptsList.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  // Filter available target contracts
  const getAvailableTransferTargets = () => {
    if (!transferSourceContract) return [];
    return installments.filter((item) => {
      if (item.id === transferSourceContract.id) return false;
      if (!transferSearchQuery.trim()) return true;
      const q = transferSearchQuery.toLowerCase();
      return (
        (item.no && item.no.toLowerCase().includes(q)) ||
        (item.client && item.client.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.identity && item.identity.includes(q)) ||
        (item.project && item.project.toLowerCase().includes(q))
      );
    });
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceContract || !transferTargetId) {
      alert("يرجى اختيار العقد المستهدف لنقل السدادات إليه أولاً!");
      return;
    }

    const target = installments.find(i => i.id === transferTargetId);
    if (!target) return;

    const sourceRemaining = Number(transferSourceContract.remaining || 0);

    const actionText = 
      transferAction === "close_as_transferred" ? "إغلاق وتصفير العقد المصدر كعقد مدمج ومنقول" :
      transferAction === "delete_source" ? "حذف نهائي للعقد المصدر بعد نقل السندات والملفات" : "إبقاء العقد المصدر مع إعادة احتساب رصيده";

    const reasonToUse = transferReason.trim() || "نقل ودمج ملفات وسندات العقد";

    setIsTransferring(true);
    try {
      if (onTransferContractAndPayments) {
        const success = await onTransferContractAndPayments(
          transferSourceContract.id,
          transferTargetId,
          {
            transferReceipts: true,
            transferPayments: true,
            transferNotesAndFiles: transferFilesAndNotes,
            transferRemainingDebt: transferDebtTogether,
            sourceContractAction: transferAction,
            reason: reasonToUse,
          }
        );

        if (success) {
          setTransferSourceContract(null);
          setTransferTargetId("");
          setTransferReason("");
          setTransferSearchQuery("");
          if (selectedFileContract) {
            setSelectedFileContract(null);
          }
        }
      }
    } finally {
      setIsTransferring(false);
    }
  };

  useEffect(() => {
    if (selectedFileContract) {
      const updated = installments.find((i) => i.id === selectedFileContract.id);
      if (updated) {
        setSelectedFileContract(updated);
      }
    }
  }, [installments]);

  // Export comprehensive Client Statement of Account (كشف حساب العميل PDF)
  const handleExportClientStatementPDF = (item: Installment) => {
    if (!item) return;

    const targetCompId = item.company_id || "arab_world";
    const comp = (companies && companies.find(c => c.id === targetCompId)) || (companies && companies[0]);
    const compName = comp?.name || "شركة الأعمال المتطورة";
    const compLogo = localStorage.getItem(`aw_company_logo_${targetCompId}`) || "";
    const crNumber = comp?.commercial_register || comp?.record_no || "1010777555";
    const taxNumber = comp?.tax_no || "لا يوجد";
    const phone = comp?.phone || "0556446888";
    const address = comp?.address || "المملكة العربية السعودية";

    // 1. Gather all receipts linked to this contract
    const contractReceipts = (receipts || []).filter((r: any) => {
      if (r.installment_id && r.installment_id === item.id) return true;
      if (item.no && (r.contract_no === item.no || (r.notes && r.notes.includes(item.no)))) return true;
      if (r.from_name && item.client && r.from_name.trim().toLowerCase() === item.client.trim().toLowerCase()) {
        if (r.installment_id && r.installment_id !== item.id) return false;
        return true;
      }
      return false;
    }).sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    // 2. Gather all payments / disbursements linked to this contract
    const contractPayments = (payments || []).filter((p: any) => {
      if (p.installment_id && p.installment_id === item.id) return true;
      if (item.no && (p.contract_no === item.no || (p.notes && p.notes.includes(item.no)))) return true;
      if (p.to_name && item.client && p.to_name.trim().toLowerCase() === item.client.trim().toLowerCase()) {
        if (p.installment_id && p.installment_id !== item.id) return false;
        return true;
      }
      return false;
    }).sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    // 3. Gather all expenses linked to this project or contract
    const contractExpenses = (expenses || []).filter((e: any) => {
      if (item.project && e.project && e.project.trim().toLowerCase() === item.project.trim().toLowerCase()) return true;
      if (item.no && e.notes && e.notes.includes(item.no)) return true;
      return false;
    }).sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    // Financial Totals
    const totalAmount = Number(item.amount || 0);
    const totalDiscount = Number(item.discount || 0);
    const afterDiscountAmt = Number(item.after_discount || (totalAmount - totalDiscount));
    const totalReceipts = contractReceipts.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    const totalPayments = contractPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const totalExpenses = contractExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const remainingBalance = Number(item.remaining || Math.max(0, afterDiscountAmt - totalReceipts + totalPayments));
    const paidPercentage = afterDiscountAmt > 0 ? Math.min(100, Math.round((totalReceipts / afterDiscountAmt) * 100)) : 100;

    const t = getContractTiming(item);
    const isFullyPaid = remainingBalance <= 0 || item.status === "مكتمل";
    const statusLabel = isFullyPaid ? "مسدد بالكامل ومكتمل" : (t.overdueDays > 0 ? "متأخر السداد" : item.status || "نشط");

    const itemRegion = awExtractRegion(item.notes || "") || "الفرع الرئيسي";
    const itemTreasury = awExtractTreasury(item.notes || "") || "خزنة التحصيل";
    const itemCycle = awExtractCycle(item.notes || "") || "يومي";
    const itemDirection = awExtractContractDirection(item.notes || "") || "لنا";
    const itemClassification = awExtractClassification(item.notes || "") || "مدين";

    const statementRef = `STMT-${(item.no || item.id.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, "")}-${new Date().getFullYear()}`;
    const generatedDate = new Date().toLocaleDateString("ar-SA") + " - " + new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    // Build unified chronological ledger transactions
    type LedgerRow = {
      date: string;
      type: string;
      typeColor: string;
      refNo: string;
      description: string;
      method: string;
      treasury: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const ledgerRows: LedgerRow[] = [];
    let currentBal = 0;

    // Initial Contract Entry
    currentBal += totalAmount;
    ledgerRows.push({
      date: item.start_date || "—",
      type: "افتتاح العقد",
      typeColor: "#2563eb",
      refNo: item.no || "CON-INIT",
      description: `قيمة العقد الأساسية (${item.type || "تقسيط"} - ${item.periods || 1} قسط ${itemCycle})`,
      method: "قيد افتتاحي",
      treasury: itemTreasury,
      debit: totalAmount,
      credit: 0,
      balance: currentBal
    });

    // Discount if any
    if (totalDiscount > 0) {
      currentBal -= totalDiscount;
      ledgerRows.push({
        date: item.start_date || "—",
        type: "خصم تسوية",
        typeColor: "#7c3aed",
        refNo: "DISC-01",
        description: "خصم ممنوح ومخفض من إجمالي قيمة العقد",
        method: "تسوية محاسبية",
        treasury: "—",
        debit: 0,
        credit: totalDiscount,
        balance: currentBal
      });
    }

    // Merge Receipts and Payments chronologically
    const allEvents: { date: string; kind: "receipt" | "payment"; data: any }[] = [];
    contractReceipts.forEach(r => allEvents.push({ date: r.date || "", kind: "receipt", data: r }));
    contractPayments.forEach(p => allEvents.push({ date: p.date || "", kind: "payment", data: p }));

    allEvents.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    allEvents.forEach((ev) => {
      if (ev.kind === "receipt") {
        const r = ev.data;
        const amt = Number(r.amount || 0);
        currentBal -= amt;
        ledgerRows.push({
          date: r.date || "—",
          type: "سند قبض",
          typeColor: "#059669",
          refNo: r.no || "REC",
          description: awCleanNotes(r.notes || "") || `سداد دفعة من قيمة العقد (${r.method || "نقداً"})`,
          method: r.method || "نقداً",
          treasury: awExtractTreasury(r.notes || "") || itemTreasury,
          debit: 0,
          credit: amt,
          balance: currentBal
        });
      } else {
        const p = ev.data;
        const amt = Number(p.amount || 0);
        currentBal += amt;
        ledgerRows.push({
          date: p.date || "—",
          type: "سند صرف",
          typeColor: "#dc2626",
          refNo: p.no || "PAY",
          description: awCleanNotes(p.notes || "") || `صرف / دفعة مسترجعة (${p.to_name || item.client})`,
          method: p.method || "نقداً",
          treasury: awExtractTreasury(p.notes || "") || itemTreasury,
          debit: amt,
          credit: 0,
          balance: currentBal
        });
      }
    });

    try {
      const w = window.open("", "_blank");
      if (!w) {
        alert("تنبيه: ملقم المتصفح حظر نافذة الطباعة التلقائية! يرجى السماح بالنوافذ المنبثقة.");
        return;
      }

      w.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>كشف حساب العميل - ${item.client} - ${item.no}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',Tahoma,sans-serif}
body{background:#f8fafc;color:#0f172a;direction:rtl;padding:24px;font-size:12px;line-height:1.5}
.page{max-width:210mm;margin:0 auto;background:#fff;padding:28px;border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);border:1px solid #e2e8f0;position:relative}

/* Top bar for print */
.no-print{position:fixed;top:16px;left:16px;display:flex;gap:10px;z-index:9999}
.no-print button{border:0;border-radius:10px;padding:10px 18px;color:#fff;font-weight:800;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:all 0.2s}
.btn-print{background:#2563eb}.btn-print:hover{background:#1d4ed8}
.btn-close{background:#475569}.btn-close:hover{background:#334155}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #e2e8f0;padding-bottom:18px;margin-bottom:20px;gap:16px}
.comp-info{flex:1;text-align:right}
.comp-name{font-size:18px;font-weight:900;color:#0f172a;margin-bottom:4px}
.comp-sub{font-size:11px;color:#64748b;font-weight:600;line-height:1.6}
.comp-logo{width:130px;text-align:center;display:flex;align-items:center;justify-content:center}
.comp-logo img{max-height:75px;max-width:130px;object-fit:contain}
.logo-placeholder{width:65px;height:65px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px}
.doc-meta{width:160px;text-align:left;font-size:10.5px;color:#475569;line-height:1.7}
.doc-meta b{color:#0f172a}

/* Title banner */
.title-banner{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:12px 18px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.title-banner h2{font-size:15px;font-weight:900;display:flex;align-items:center;gap:8px}
.title-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700}

/* Info Cards Grid */
.info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:18px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.info-item{display:flex;flex-direction:column}
.info-label{font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px}
.info-val{font-size:12px;font-weight:800;color:#0f172a}
.info-val.highlight{color:#2563eb}

/* Financial KPIs */
.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}
.kpi-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 8px;text-align:center}
.kpi-box.kpi-main{background:#eff6ff;border-color:#bfdbfe}
.kpi-box.kpi-success{background:#ecfdf5;border-color:#a7f3d0}
.kpi-box.kpi-danger{background:#fef2f2;border-color:#fecaca}
.kpi-box.kpi-warning{background:#fffbeb;border-color:#fde68a}
.kpi-title{font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px}
.kpi-val{font-size:15px;font-weight:900;font-family:monospace;color:#0f172a}
.kpi-main .kpi-val{color:#1d4ed8}
.kpi-success .kpi-val{color:#047857}
.kpi-danger .kpi-val{color:#b91c1c}
.kpi-warning .kpi-val{color:#b45309}

/* Tables */
.section-title{font-size:13px;font-weight:900;color:#0f172a;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #f1f5f9;padding-bottom:6px}
.table-wrap{margin-bottom:22px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
table{width:100%;border-collapse:collapse;text-align:right;font-size:11px}
th{background:#0f172a;color:#fff;font-weight:800;padding:8px 10px;border-bottom:1px solid #334155}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
tr:nth-child(even) td{background:#f8fafc}
tr:last-child td{border-bottom:0}
.text-center{text-align:center}
.text-left{text-align:left}
.font-mono{font-family:monospace;font-weight:700}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:9.5px;font-weight:800}
.badge-green{background:#dcfce7;color:#15803d}
.badge-red{background:#fee2e2;color:#b91c1c}
.badge-blue{background:#dbeafe;color:#1d4ed8}
.badge-amber{background:#fef3c7;color:#b45309}

/* Summary / Settlement Box */
.summary-bar{background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.summary-bar b{font-size:13px;color:#0f172a}
.summary-bar span{font-size:16px;font-weight:900;color:#047857;font-family:monospace}

/* Signatures */
.signs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:28px;padding-top:14px;border-top:2px dashed #cbd5e1}
.sign-box{border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;min-height:90px;display:flex;flex-direction:column;justify-content:space-between}
.sign-title{font-size:10.5px;font-weight:800;color:#475569}
.sign-line{border-top:1px dashed #94a3b8;margin-top:35px;padding-top:4px;font-size:10px;color:#64748b}

/* Footer note */
.footer-note{margin-top:20px;text-align:center;font-size:9.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:10px}

@media print{
  body{background:#fff;padding:0}
  .page{box-shadow:none;border:0;padding:10px;max-width:100%}
  .no-print{display:none}
  tr{page-break-inside:avoid}
  .table-wrap{page-break-inside:auto}
  @page{size:A4;margin:10mm}
}
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">
    <span>🖨️</span>
    <span>طباعة كشف الحساب / حفظ PDF</span>
  </button>
  <button class="btn-close" onclick="window.close()">
    <span>✕</span>
    <span>إغلاق</span>
  </button>
</div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="comp-info">
      <div class="comp-name">${compName}</div>
      <div class="comp-sub">
        ${crNumber ? `سجل تجاري: <b>${crNumber}</b>` : ""} 
        ${taxNumber && taxNumber !== "لا يوجد" ? ` • الرقم الضريبي: <b>${taxNumber}</b>` : ""}<br>
        ${phone ? `هاتف / جوال: <b>${phone}</b>` : ""} • ${address}
      </div>
    </div>

    <div class="comp-logo">
      ${compLogo ? `<img src="${compLogo}" alt="${compName}" referrerPolicy="no-referrer" />` : `<div class="logo-placeholder">${compName.charAt(0)}</div>`}
    </div>

    <div class="doc-meta">
      <div><b>رقم المرجع:</b> ${statementRef}</div>
      <div><b>تاريخ الكشف:</b> ${generatedDate}</div>
      <div><b>الفرع الإداري:</b> ${itemRegion}</div>
    </div>
  </div>

  <!-- Title Banner -->
  <div class="title-banner">
    <h2>
      <span>📑</span>
      <span>كشف حساب مالي تفصيلي لحركات وسندات العقد</span>
    </h2>
    <span class="title-badge">${statusLabel}</span>
  </div>

  <!-- Client & Contract Info Box -->
  <div class="info-card">
    <div class="grid-4" style="margin-bottom: 10px;">
      <div class="info-item">
        <span class="info-label">اسم العميل الكريـم:</span>
        <span class="info-val highlight">${item.client || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">رقم الهوية / السجل:</span>
        <span class="info-val font-mono">${item.identity || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">رقم الجوال:</span>
        <span class="info-val font-mono">${item.phone || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">الجنسية ومقر العمل:</span>
        <span class="info-val">${item.nationality || "سعودي"} ${item.workplace ? `(${item.workplace})` : ""}</span>
      </div>
    </div>

    <div class="grid-4" style="border-top: 1px dashed #cbd5e1; padding-top: 10px;">
      <div class="info-item">
        <span class="info-label">رقم العقد:</span>
        <span class="info-val font-mono highlight">${item.no || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">المشروع المرتبط:</span>
        <span class="info-val">${item.project || "عام"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">فترة العقد:</span>
        <span class="info-val font-mono">${item.start_date || "—"} إلى ${item.end_date || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">طبيعة الأقساط والدورة:</span>
        <span class="info-val">${item.periods || 1} قسط (${itemCycle}) • ${Number(item.installment || 0).toLocaleString()} ريال/قسط</span>
      </div>
    </div>
  </div>

  <!-- Financial KPI Metrics -->
  <div class="kpi-grid">
    <div class="kpi-box kpi-main">
      <div class="kpi-title">إجمالي قيمة العقد</div>
      <div class="kpi-val">${totalAmount.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">الخصم الممنوح</div>
      <div class="kpi-val" style="color: #7c3aed;">${totalDiscount.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box kpi-success">
      <div class="kpi-title">إجمالي المقبوضات (المسدد)</div>
      <div class="kpi-val">${totalReceipts.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box kpi-danger">
      <div class="kpi-title">إجمالي سندات الصرف</div>
      <div class="kpi-val">${totalPayments.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box ${remainingBalance <= 0 ? "kpi-success" : "kpi-warning"}">
      <div class="kpi-title">صافي المتبقي المطلوب</div>
      <div class="kpi-val">${remainingBalance.toLocaleString()} <small>ريال</small></div>
    </div>
  </div>

  <!-- Section 1: Detailed Receipts Table -->
  <div class="section-title">
    <span>💰 سجل وحركات سندات القبض المستلمة (${contractReceipts.length} سند)</span>
    <span style="font-size:11px;color:#059669;font-weight:800;">إجمالي المقبوض: ${totalReceipts.toLocaleString()} ريال</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:35px">#</th>
          <th>رقم السند</th>
          <th>تاريخ السداد</th>
          <th>وسيلة الدفع</th>
          <th>الخزنة / الحساب</th>
          <th class="text-left">المبلغ المقبوض</th>
          <th class="text-left">المتبقي بعدها</th>
          <th>البيان والملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${contractReceipts.length > 0 ? contractReceipts.map((r: any, idx: number) => `
          <tr>
            <td class="text-center font-mono">${idx + 1}</td>
            <td class="font-mono"><b>${r.no || "—"}</b></td>
            <td class="font-mono">${r.date || "—"}</td>
            <td><span class="badge badge-blue">${r.method || "نقداً"}</span></td>
            <td>${awExtractTreasury(r.notes || "") || itemTreasury}</td>
            <td class="text-left font-mono" style="color:#059669;font-weight:900;">+${Number(r.amount || 0).toLocaleString()} ريال</td>
            <td class="text-left font-mono" style="color:#64748b;">${r.remaining_after ? Number(r.remaining_after).toLocaleString() + " ريال" : "—"}</td>
            <td>${awCleanNotes(r.notes || "") || "دفعة مسددة من العقد"}</td>
          </tr>
        `).join("") : `
          <tr>
            <td colspan="8" class="text-center" style="padding:16px;color:#94a3b8;font-weight:700;">لا توجد أي سندات قبض مسجلة لهذا العقد حتى الآن</td>
          </tr>
        `}
      </tbody>
    </table>
  </div>

  <!-- Section 2: Detailed Payments & Disbursements Table -->
  ${contractPayments.length > 0 ? `
  <div class="section-title">
    <span>💸 سجل سندات الصرف والمدفوعات الصادرة للعقد (${contractPayments.length} سند)</span>
    <span style="font-size:11px;color:#dc2626;font-weight:800;">إجمالي المصروف: ${totalPayments.toLocaleString()} ريال</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:35px">#</th>
          <th>رقم السند</th>
          <th>تاريخ الصرف</th>
          <th>المستلم / المستفيد</th>
          <th>طريقة الصرف</th>
          <th>الخزنة / الحساب</th>
          <th class="text-left">المبلغ المصروف</th>
          <th>البيان والملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${contractPayments.map((p: any, idx: number) => `
          <tr>
            <td class="text-center font-mono">${idx + 1}</td>
            <td class="font-mono"><b>${p.no || "—"}</b></td>
            <td class="font-mono">${p.date || "—"}</td>
            <td><b>${p.to_name || item.client}</b></td>
            <td><span class="badge badge-amber">${p.method || "نقداً"}</span></td>
            <td>${awExtractTreasury(p.notes || "") || itemTreasury}</td>
            <td class="text-left font-mono" style="color:#dc2626;font-weight:900;">-${Number(p.amount || 0).toLocaleString()} ريال</td>
            <td>${awCleanNotes(p.notes || "") || "صرف مالي للعقد"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <!-- Section 3: Chronological Unified Ledger -->
  <div class="section-title">
    <span>📊 كشف الحركة المالية التراكمي المتسلسل (Unified Running Balance Ledger)</span>
    <span style="font-size:11px;color:#475569;font-weight:800;">نسبة الإنجاز والسداد: %${paidPercentage}</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>نوع الحركة</th>
          <th>المرجع</th>
          <th>البيان والتفاصيل</th>
          <th class="text-left">مدين (+)</th>
          <th class="text-left">دائن (-)</th>
          <th class="text-left">الرصيد المستحق</th>
        </tr>
      </thead>
      <tbody>
        ${ledgerRows.map((row) => `
          <tr>
            <td class="font-mono">${row.date}</td>
            <td><span class="badge" style="background:${row.typeColor}15;color:${row.typeColor};border:1px solid ${row.typeColor}30">${row.type}</span></td>
            <td class="font-mono font-bold">${row.refNo}</td>
            <td>${row.description}</td>
            <td class="text-left font-mono" style="color:${row.debit > 0 ? "#2563eb" : "#94a3b8"}">${row.debit > 0 ? Number(row.debit).toLocaleString() : "—"}</td>
            <td class="text-left font-mono" style="color:${row.credit > 0 ? "#059669" : "#94a3b8"}">${row.credit > 0 ? Number(row.credit).toLocaleString() : "—"}</td>
            <td class="text-left font-mono" style="font-weight:900;color:${row.balance <= 0 ? "#059669" : "#0f172a"}">${Number(row.balance).toLocaleString()} ريال</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <!-- Summary Closing Bar -->
  <div class="summary-bar">
    <div>
      <b>خلاصة الموقف المالي للعقد:</b>
      <span style="font-size:11px;color:#64748b;display:block;margin-top:2px;">
        تم سداد <b>${totalReceipts.toLocaleString()} ريال</b> من أصل <b>${afterDiscountAmt.toLocaleString()} ريال</b>
      </span>
    </div>
    <div style="text-align:left;">
      <span style="display:block;font-size:10px;color:#64748b;font-weight:700;">صافي المتبقي الواجب سداده</span>
      <span style="font-size:18px;font-weight:900;color:${remainingBalance <= 0 ? "#059669" : "#b45309"}">
        ${remainingBalance <= 0 ? "0 ريال (مسدد بالكامل)" : `${remainingBalance.toLocaleString()} ريال`}
      </span>
    </div>
  </div>

  <!-- Signatures -->
  <div class="signs-grid">
    <div class="sign-box">
      <span class="sign-title">المحاسب المالي والتدقيق</span>
      <div class="sign-line">التوقيع والتاريخ</div>
    </div>
    <div class="sign-box">
      <span class="sign-title">مصادقة وتوقيع العميل</span>
      <div class="sign-line">${item.client || "توقيع العميل"}</div>
    </div>
    <div class="sign-box">
      <span class="sign-title">ختم واعتماد ${compName}</span>
      <div class="sign-line">الختم الرسمي للمنشأة</div>
    </div>
  </div>

  <!-- Footer Note -->
  <div class="footer-note">
    وثيقة كشف حساب معتمدة ومصدرة آلياً من النظام السحابي لإدارة العقود والأقساط لدى ${compName}. جميع المبالغ المذكورة بالريال السعودي (SAR).
  </div>

</div>

<script>
  setTimeout(function() {
    window.print();
  }, 400);
</script>

</body>
</html>`);
      w.document.close();
    } catch (err) {
      console.warn("Exception during Popups window.open printing:", err);
    }
  };

  // ==========================================
  // EXPORT & DOWNLOAD HELPERS (Excel / PDF)
  // ==========================================

  // Utility to download CSV file with UTF-8 BOM for Arabic support in Excel
  const downloadCsv = (filename: string, csvContent: string) => {
    try {
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download CSV:", err);
    }
  };

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // 1. Export Filtered Contracts to Excel (CSV)
  const handleExportAllContractsExcel = () => {
    const dataList = listToRender && listToRender.length > 0 ? listToRender : installments;
    if (!dataList || dataList.length === 0) {
      alert("لا توجد أي عقود متاحة للتصدير حالياً.");
      return;
    }

    const headers = [
      "م",
      "رقم العقد",
      "اسم العميل",
      "رقم الهوية / الإقامة",
      "رقم الجوال",
      "الجنسية",
      "نوع العقد",
      "اتجاه العقد",
      "دورة القسط",
      "التصنيف المالي",
      "تاريخ البداية",
      "تاريخ النهاية المتوقع",
      "إجمالي المبلغ (ريال)",
      "الخصم الممنوح (ريال)",
      "المبلغ الصافي (ريال)",
      "المسدد والمدفوع (ريال)",
      "المتبقي المستحق (ريال)",
      "قيمة القسط (ريال)",
      "عدد الأقساط / الفترات",
      "حالة السداد",
      "أيام التأخر",
      "المشروع المرتبط",
      "مقر العمل",
      "الكفيل والضامن",
      "الفرع الإداري",
      "الخزنة التابعة",
      "جهة تمويل رأس المال",
      "رأس مال العقد (ريال)",
      "الشركة التابعة",
      "المسؤول",
      "تاريخ آخر سداد",
      "الملاحظات والشروط"
    ];

    const rows = dataList.map((item, index) => {
      const t = getContractTiming(item);
      const isFullyPaid = Number(item.remaining || 0) <= 0 || item.status === "مكتمل";
      const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : item.status);
      const itemRegion = awExtractRegion(item.notes || "") || "غير محدد";
      const itemTreasury = awExtractTreasury(item.notes || "") || "خزنة التحصيل";
      const itemClassification = awExtractClassification(item.notes || "") || "مدين";
      const itemDirection = awExtractContractDirection(item.notes || "") || "لنا";
      const itemCapital = Number(awExtractCapital(item.notes || "") || 0);
      const itemCapitalSource = awExtractCapitalSource(item.notes || "") || "تحصيل";
      const itemCycle = awExtractCycle(item.notes || "") || "يومي";
      const matchedProject = projects.find(p => p.id === item.project_id)?.name || item.project || "عام";
      const matchedWorker = workers?.find(w => w.id === item.worker_id)?.name || "الإدارة";
      const matchedCompany = companies?.find(c => c.id === item.company_id)?.name || "الشركة الرئيسية";
      const cleanNotes = awCleanNotes(item.notes || "");

      return [
        escapeCsv(index + 1),
        escapeCsv(item.no || ""),
        escapeCsv(item.client || ""),
        escapeCsv(item.identity || ""),
        escapeCsv(item.phone || ""),
        escapeCsv(item.nationality || "سعودي"),
        escapeCsv(item.type === "daily" || !item.type ? "تقسيط" : item.type),
        escapeCsv(itemDirection),
        escapeCsv(itemCycle),
        escapeCsv(itemClassification),
        escapeCsv(item.start_date || ""),
        escapeCsv(item.end_date || ""),
        escapeCsv(Number(item.amount || 0)),
        escapeCsv(Number(item.discount || 0)),
        escapeCsv(Number(item.after_discount || item.amount || 0)),
        escapeCsv(Number(item.paid || 0)),
        escapeCsv(Number(item.remaining || 0)),
        escapeCsv(Number(item.installment || 0)),
        escapeCsv(Number(item.periods || 0)),
        escapeCsv(computedStatus),
        escapeCsv(t.overdueDays || 0),
        escapeCsv(matchedProject),
        escapeCsv(item.workplace || ""),
        escapeCsv(item.guarantor || ""),
        escapeCsv(itemRegion),
        escapeCsv(itemTreasury),
        escapeCsv(itemCapitalSource),
        escapeCsv(itemCapital),
        escapeCsv(matchedCompany),
        escapeCsv(matchedWorker),
        escapeCsv(t.lastPaid || "لا يوجد"),
        escapeCsv(cleanNotes)
      ].join(",");
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`كشف_عقود_التقسيط_والأعمال_${dateStr}.csv`, csvContent);
  };

  // 2. Export Single Contract to Excel (CSV)
  const handleExportSingleContractExcel = (item: Installment) => {
    if (!item) return;

    const t = getContractTiming(item);
    const isFullyPaid = Number(item.remaining || 0) <= 0 || item.status === "مكتمل";
    const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : item.status);
    const itemRegion = awExtractRegion(item.notes || "") || "غير محدد";
    const itemTreasury = awExtractTreasury(item.notes || "") || "خزنة التحصيل";
    const itemClassification = awExtractClassification(item.notes || "") || "مدين";
    const itemDirection = awExtractContractDirection(item.notes || "") || "لنا";
    const itemCapital = Number(awExtractCapital(item.notes || "") || 0);
    const itemCapitalSource = awExtractCapitalSource(item.notes || "") || "تحصيل";
    const itemCycle = awExtractCycle(item.notes || "") || "يومي";
    const matchedProject = projects.find(p => p.id === item.project_id)?.name || item.project || "عام";
    const matchedCompany = companies?.find(c => c.id === item.company_id)?.name || "الشركة الرئيسية";
    const cleanNotes = awCleanNotes(item.notes || "");

    // Receipts for this contract
    const contractReceipts = (receipts || []).filter((r: any) =>
      r.contract_no === item.no ||
      r.installment_id === item.id ||
      (r.from_name && item.client && r.from_name.trim() === item.client.trim())
    );

    // Payments for this contract
    const contractPayments = (payments || []).filter((p: any) =>
      p.contract_no === item.no ||
      p.installment_id === item.id ||
      (p.to_name && item.client && p.to_name.trim() === item.client.trim())
    );

    const lines: string[] = [];

    // Master Header
    lines.push([escapeCsv("تقرير وبيانات العقد المالي"), escapeCsv(item.no || ""), escapeCsv(item.client || "")].join(","));
    lines.push("");

    // Section 1: Basic info
    lines.push(escapeCsv("--- البيانات الأساسية للعقد ---"));
    lines.push([escapeCsv("رقم العقد"), escapeCsv(item.no || ""), escapeCsv("اسم العميل"), escapeCsv(item.client || "")].join(","));
    lines.push([escapeCsv("رقم الهوية"), escapeCsv(item.identity || ""), escapeCsv("رقم الجوال"), escapeCsv(item.phone || "")].join(","));
    lines.push([escapeCsv("الجنسية"), escapeCsv(item.nationality || "سعودي"), escapeCsv("مقر العمل"), escapeCsv(item.workplace || "")].join(","));
    lines.push([escapeCsv("الكفيل الغارم"), escapeCsv(item.guarantor || "لا يوجد"), escapeCsv("المشروع المرتبط"), escapeCsv(matchedProject)].join(","));
    lines.push([escapeCsv("الفرع الإداري"), escapeCsv(itemRegion), escapeCsv("الخزنة التابعة"), escapeCsv(itemTreasury)].join(","));
    lines.push([escapeCsv("الشركة التابعة"), escapeCsv(matchedCompany), escapeCsv("حالة السداد"), escapeCsv(computedStatus)].join(","));
    lines.push([escapeCsv("تاريخ البداية"), escapeCsv(item.start_date || ""), escapeCsv("تاريخ النهاية المتوقع"), escapeCsv(item.end_date || "")].join(","));
    lines.push("");

    // Section 2: Financials
    lines.push(escapeCsv("--- الموقف المالي وتفاصيل الأقساط ---"));
    lines.push([escapeCsv("إجمالي قيمة العقد"), escapeCsv(Number(item.amount || 0)), escapeCsv("الخصم الممنوح"), escapeCsv(Number(item.discount || 0))].join(","));
    lines.push([escapeCsv("الصافي بعد الخصم"), escapeCsv(Number(item.after_discount || item.amount || 0)), escapeCsv("المبلغ المسدد"), escapeCsv(Number(item.paid || 0))].join(","));
    lines.push([escapeCsv("المتبقي المستحق"), escapeCsv(Number(item.remaining || 0)), escapeCsv("قيمة القسط"), escapeCsv(Number(item.installment || 0))].join(","));
    lines.push([escapeCsv("دورة القسط"), escapeCsv(itemCycle), escapeCsv("عدد الأقساط"), escapeCsv(Number(item.periods || 0))].join(","));
    lines.push([escapeCsv("رأس مال العقد"), escapeCsv(itemCapital), escapeCsv("جهة تمويل رأس المال"), escapeCsv(itemCapitalSource)].join(","));
    lines.push([escapeCsv("أيام التأخر"), escapeCsv(t.overdueDays || 0), escapeCsv("تاريخ آخر سداد"), escapeCsv(t.lastPaid || "لا يوجد")].join(","));
    lines.push([escapeCsv("ملاحظات العقد"), escapeCsv(cleanNotes)].join(","));
    lines.push("");

    // Section 3: Receipts
    lines.push(escapeCsv(`--- سجل سندات القبض المستلمة (${contractReceipts.length} سند) ---`));
    lines.push([
      escapeCsv("م"),
      escapeCsv("رقم السند"),
      escapeCsv("تاريخ السند"),
      escapeCsv("المبلغ المدفوع (ريال)"),
      escapeCsv("المتبقي بعدها (ريال)"),
      escapeCsv("طريقة الدفع"),
      escapeCsv("الخزنة"),
      escapeCsv("البيان والملاحظات")
    ].join(","));

    if (contractReceipts.length > 0) {
      contractReceipts.forEach((r: any, idx: number) => {
        lines.push([
          escapeCsv(idx + 1),
          escapeCsv(r.no || ""),
          escapeCsv(r.date || ""),
          escapeCsv(Number(r.amount || 0)),
          escapeCsv(Number(r.remaining_after || 0)),
          escapeCsv(r.method || "نقداً"),
          escapeCsv(awExtractTreasury(r.notes || "") || itemTreasury),
          escapeCsv(awCleanNotes(r.notes || "") || "دفعة سداد")
        ].join(","));
      });
    } else {
      lines.push(escapeCsv("لا توجد سندات قبض مسجلة لهذا العقد"));
    }
    lines.push("");

    // Section 4: Payments
    if (contractPayments.length > 0) {
      lines.push(escapeCsv(`--- سجل سندات الصرف الصادرة (${contractPayments.length} سند) ---`));
      lines.push([
        escapeCsv("م"),
        escapeCsv("رقم السند"),
        escapeCsv("تاريخ الصرف"),
        escapeCsv("المستلم / المستفيد"),
        escapeCsv("المبلغ المصروف (ريال)"),
        escapeCsv("طريقة الصرف"),
        escapeCsv("الخزنة"),
        escapeCsv("البيان والملاحظات")
      ].join(","));

      contractPayments.forEach((p: any, idx: number) => {
        lines.push([
          escapeCsv(idx + 1),
          escapeCsv(p.no || ""),
          escapeCsv(p.date || ""),
          escapeCsv(p.to_name || item.client || ""),
          escapeCsv(Number(p.amount || 0)),
          escapeCsv(p.method || "نقداً"),
          escapeCsv(awExtractTreasury(p.notes || "") || itemTreasury),
          escapeCsv(awCleanNotes(p.notes || "") || "صرف مالي للعقد")
        ].join(","));
      });
    }

    const safeClientName = (item.client || "عميل").replace(/[\s/\\:*?"<>|]+/g, "_");
    const safeContractNo = (item.no || "عقد").replace(/[\s/\\:*?"<>|]+/g, "_");
    downloadCsv(`عقد_${safeContractNo}_${safeClientName}.csv`, lines.join("\r\n"));
  };

  // 3. Export Filtered Contracts to PDF Report
  const handleExportAllContractsPDF = () => {
    const dataList = listToRender && listToRender.length > 0 ? listToRender : installments;
    if (!dataList || dataList.length === 0) {
      alert("لا توجد أي عقود متاحة للطباعة والتصدير حالياً.");
      return;
    }

    const assocCompanyId = (dataList[0] && dataList[0].company_id) || selectedCompanyId || "arab_world";
    const compLogo = localStorage.getItem(`aw_company_logo_${assocCompanyId}`) || "";
    const comp = (companies && companies.find((c) => c.id === assocCompanyId)) || (companies && companies[0]);
    const compName = comp?.name || "مؤسسة الأعمال المتقدمة للتجارة والتقسيط";
    const crNumber = comp?.commercial_register || comp?.record_no || "";
    const taxNumber = comp?.tax_no || "";
    const phone = comp?.phone || "";
    const address = comp?.address || "المملكة العربية السعودية";

    const totalCount = dataList.length;
    const totalAmountSum = dataList.reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const totalPaidSum = dataList.reduce((acc, c) => acc + Number(c.paid || 0), 0);
    const totalRemainingSum = dataList.reduce((acc, c) => acc + Number(c.remaining || 0), 0);
    const totalCapitalSum = dataList.reduce((acc, c) => acc + Number(awExtractCapital(c.notes || "") || 0), 0);

    const completedCount = dataList.filter(c => Number(c.remaining || 0) <= 0 || c.status === "مكتمل").length;
    const activeCount = totalCount - completedCount;

    const reportRef = "RPT-CON-" + Date.now().toString().slice(-6);
    const generatedDate = new Date().toLocaleDateString("ar-SA") + " " + new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    try {
      const w = window.open("", "_blank");
      if (!w) {
        alert("يرجى السماح بالنوافذ المنبثقة لطباعة وتنزيل تقرير العقود PDF.");
        return;
      }

      const rowsHtml = dataList.map((item, idx) => {
        const t = getContractTiming(item);
        const isFullyPaid = Number(item.remaining || 0) <= 0 || item.status === "مكتمل";
        const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : item.status);
        const itemRegion = awExtractRegion(item.notes || "") || "الفرع الرئيسي";
        const itemTreasury = awExtractTreasury(item.notes || "") || "خزنة التحصيل";
        const itemCycle = awExtractCycle(item.notes || "") || "يومي";

        const statusBadgeClass = isFullyPaid
          ? "badge-green"
          : computedStatus === "متأخر"
          ? "badge-red"
          : "badge-blue";

        return `
          <tr>
            <td class="text-center font-mono">${idx + 1}</td>
            <td class="font-mono"><b>${item.no || "—"}</b></td>
            <td><b>${item.client || "—"}</b></td>
            <td class="font-mono">${item.phone || "—"}</td>
            <td class="font-mono">${item.start_date || "—"}</td>
            <td class="font-mono">${item.periods || 1} ${itemCycle}</td>
            <td class="text-left font-mono font-bold">${Number(item.amount || 0).toLocaleString()}</td>
            <td class="text-left font-mono" style="color:#059669;font-weight:bold;">${Number(item.paid || 0).toLocaleString()}</td>
            <td class="text-left font-mono" style="color:${isFullyPaid ? '#059669' : '#dc2626'};font-weight:900;">${Number(item.remaining || 0).toLocaleString()}</td>
            <td class="text-left font-mono text-amber-600 font-bold">${Number(item.installment || 0).toLocaleString()}</td>
            <td class="text-center"><span class="badge ${statusBadgeClass}">${computedStatus}</span></td>
            <td class="text-center font-mono">${t.overdueDays > 0 ? `<span style="color:#dc2626;font-weight:bold;">${t.overdueDays} يوم</span>` : "—"}</td>
            <td>${itemRegion}</td>
            <td>${itemTreasury}</td>
          </tr>
        `;
      }).join("");

      w.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>كشف وبيان عقود التقسيط والأعمال المعتمد - ${reportRef}</title>
<style>
*{box-sizing:border-box;font-family:Tahoma,Arial,sans-serif}
body{margin:0;background:#f8fafc;color:#0f172a;padding:20px}
.page{width:297mm;min-height:210mm;margin:auto;background:#fff;padding:16mm;box-shadow:0 10px 30px rgba(0,0,0,0.08);border-radius:12px;position:relative}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;padding-bottom:14px;margin-bottom:18px}
.comp-info{flex:1;text-align:right}
.comp-name{font-size:22px;font-weight:900;color:#0f172a;margin-bottom:4px}
.comp-sub{font-size:11px;color:#64748b;line-height:1.6}
.comp-logo{width:110px;text-align:center;margin:0 15px}
.comp-logo img{max-height:65px;max-width:110px;object-fit:contain}
.logo-placeholder{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;margin:auto}
.doc-meta{flex:1;text-align:left;font-size:11px;color:#475569;line-height:1.7}
.title-banner{background:linear-gradient(90deg,#0f172a,#1e293b);color:#fff;padding:12px 18px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.title-banner h2{margin:0;font-size:16px;font-weight:900;display:flex;align-items:center;gap:8px}
.title-badge{background:#f59e0b;color:#0f172a;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:900}

/* KPIs */
.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.kpi-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center}
.kpi-box.main{background:#eff6ff;border-color:#bfdbfe}
.kpi-box.success{background:#ecfdf5;border-color:#a7f3d0}
.kpi-box.danger{background:#fef2f2;border-color:#fecaca}
.kpi-box.amber{background:#fffbeb;border-color:#fde68a}
.kpi-title{font-size:10px;font-weight:700;color:#64748b;margin-bottom:3px}
.kpi-val{font-size:15px;font-weight:900;font-family:monospace;color:#0f172a}
.main .kpi-val{color:#1d4ed8}
.success .kpi-val{color:#047857}
.danger .kpi-val{color:#b91c1c}
.amber .kpi-val{color:#b45309}

/* Table */
.table-wrap{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px}
table{width:100%;border-collapse:collapse;text-align:right;font-size:10.5px}
th{background:#0f172a;color:#fff;font-weight:800;padding:7px 8px;border-bottom:1px solid #334155}
td{padding:6.5px 8px;border-bottom:1px solid #f1f5f9;color:#334155}
tr:nth-child(even) td{background:#f8fafc}
.totals-row td{background:#f1f5f9;font-weight:900;color:#0f172a;border-top:2px solid #cbd5e1;font-size:11px}
.text-center{text-align:center}
.text-left{text-align:left}
.font-mono{font-family:monospace;font-weight:700}
.badge{display:inline-block;padding:2px 7px;border-radius:5px;font-size:9px;font-weight:800}
.badge-green{background:#dcfce7;color:#15803d}
.badge-red{background:#fee2e2;color:#b91c1c}
.badge-blue{background:#dbeafe;color:#1d4ed8}

/* Signatures */
.signs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px;padding-top:12px;border-top:2px dashed #cbd5e1}
.sign-box{border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;min-height:75px;display:flex;flex-direction:column;justify-content:space-between}
.sign-title{font-size:10px;font-weight:800;color:#475569}
.sign-line{border-top:1px dashed #94a3b8;margin-top:25px;padding-top:4px;font-size:9.5px;color:#64748b}

.footer-note{margin-top:14px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:8px}

.no-print{position:fixed;top:15px;left:15px;display:flex;gap:10px;z-index:999}
.no-print button{border:0;border-radius:10px;padding:10px 16px;color:#fff;cursor:pointer;font-weight:bold;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
.btn-print{background:#f59e0b;color:#0f172a!important}.btn-close{background:#475569}

@media print{
  body{background:#fff;padding:0}
  .page{box-shadow:none;border:0;padding:5mm;max-width:100%;width:auto;min-height:auto}
  .no-print{display:none}
  tr{page-break-inside:avoid}
  @page{size:A4 landscape;margin:8mm}
}
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">
    <span>🖨️</span>
    <span>طباعة / حفظ التقرير PDF</span>
  </button>
  <button class="btn-close" onclick="window.close()">
    <span>✕</span>
    <span>إغلاق</span>
  </button>
</div>

<div class="page">
  <div class="header">
    <div class="comp-info">
      <div class="comp-name">${compName}</div>
      <div class="comp-sub">
        ${crNumber ? `سجل تجاري: <b>${crNumber}</b>` : ""} 
        ${taxNumber && taxNumber !== "لا يوجد" ? ` • الرقم الضريبي: <b>${taxNumber}</b>` : ""}<br>
        ${phone ? `هاتف: <b>${phone}</b>` : ""} • ${address}
      </div>
    </div>
    <div class="comp-logo">
      ${compLogo ? `<img src="${compLogo}" alt="${compName}" referrerPolicy="no-referrer" />` : `<div class="logo-placeholder">${compName.charAt(0)}</div>`}
    </div>
    <div class="doc-meta">
      <div><b>رقم التقرير:</b> ${reportRef}</div>
      <div><b>تاريخ التقرير:</b> ${generatedDate}</div>
      <div><b>إجمالي العقود المعروضة:</b> ${totalCount} عقد (${activeCount} نشط / ${completedCount} مكتمل)</div>
    </div>
  </div>

  <div class="title-banner">
    <h2>
      <span>📑</span>
      <span>كشف وبيان عقود التقسيط والعمليات المالية المعتمد</span>
    </h2>
    <span class="title-badge">تقرير رسمي معتمد</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box main">
      <div class="kpi-title">إجمالي قيمة العقود</div>
      <div class="kpi-val">${totalAmountSum.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box success">
      <div class="kpi-title">إجمالي المبالغ المسددة</div>
      <div class="kpi-val">${totalPaidSum.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box danger">
      <div class="kpi-title">إجمالي المتبقي تحت الذمة</div>
      <div class="kpi-val">${totalRemainingSum.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box amber">
      <div class="kpi-title">إجمالي رأس مال العقود</div>
      <div class="kpi-val">${totalCapitalSum.toLocaleString()} <small>ريال</small></div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">نسبة التحصيل العامة</div>
      <div class="kpi-val" style="color:#2563eb;">%${totalAmountSum > 0 ? ((totalPaidSum / totalAmountSum) * 100).toFixed(1) : "0"}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:30px">#</th>
          <th>رقم العقد</th>
          <th>اسم العميل</th>
          <th>الجوال</th>
          <th>تاريخ البدء</th>
          <th>الفترة</th>
          <th class="text-left">الإجمالي (ريال)</th>
          <th class="text-left">المسدد (ريال)</th>
          <th class="text-left">المتبقي (ريال)</th>
          <th class="text-left">القسط</th>
          <th class="text-center">الحالة</th>
          <th class="text-center">التأخر</th>
          <th>الفرع</th>
          <th>الخزنة</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="totals-row">
          <td colspan="6" class="text-center"><b>الإجماليات العامة (${totalCount} عقد)</b></td>
          <td class="text-left font-mono">${totalAmountSum.toLocaleString()} ريال</td>
          <td class="text-left font-mono" style="color:#059669;">${totalPaidSum.toLocaleString()} ريال</td>
          <td class="text-left font-mono" style="color:#dc2626;">${totalRemainingSum.toLocaleString()} ريال</td>
          <td colspan="5"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="signs-grid">
    <div class="sign-box">
      <span class="sign-title">إعداد المحاسب المسؤول</span>
      <div class="sign-line">التوقيع والتاريخ</div>
    </div>
    <div class="sign-box">
      <span class="sign-title">المراجعة والتدقيق المالي</span>
      <div class="sign-line">التوقيع والتاريخ</div>
    </div>
    <div class="sign-box">
      <span class="sign-title">اعتماد الإدارة والختم الرسمي</span>
      <div class="sign-line">${compName}</div>
    </div>
  </div>

  <div class="footer-note">
    تم استخراج هذا التقرير آلياً من النظام السحابي لإدارة العقود والحسابات لدى ${compName}. جميع المبالغ المالية بالريال السعودي.
  </div>
</div>

<script>
  setTimeout(function() {
    window.print();
  }, 400);
</script>
</body>
</html>`);
      w.document.close();
    } catch (err) {
      console.warn("Exception during Popups window.open printing:", err);
    }
  };

  // Auto computation triggers
  useEffect(() => {
    recalcLogic();
  }, [amount, paid, discount, periods, startDate, installmentCycle]);

  useEffect(() => {
    // Automatically guarantee unique sequence number for new contracts
    if (!editId) {
      setContractNo(generateNextNo("AW-CON", installments, "no"));
    }
  }, [installments, editId]);

  const recalcLogic = () => {
    const amt = Number(amount || 0);
    const pd = Number(paid || 0);
    const disc = Number(discount || 0);
    const days = Number(periods || 0);

    let calculatedEnd = "";
    if (days > 0 && startDate) {
      const d = new Date(startDate);
      if (installmentCycle === "اسبوعي") {
        d.setDate(d.getDate() + (days * 7) - 1);
      } else if (installmentCycle === "نصف شهر") {
        d.setDate(d.getDate() + (days * 15) - 1);
      } else if (installmentCycle === "شهري") {
        d.setMonth(d.getMonth() + days);
        d.setDate(d.getDate() - 1);
      } else { // "يومي"
        d.setDate(d.getDate() + days - 1);
      }
      calculatedEnd = d.toISOString().slice(0, 10);
    }
    setEndDate(calculatedEnd);

    const remaining = Math.max(0, amt - pd);
    const instVal = days > 0 ? Math.ceil(remaining / days) : 0;
    const finalRem = Math.max(0, remaining - disc);

    setInstallment(instVal || "");
    setAfterDiscount(finalRem || "");
  };

  const handleClear = () => {
    setEditId(null);
    setClient("");
    setContractType("تقسيط");
    setContractDirection("لنا");
    setLinkedWorkerId("");
    setLinkedProjectId("");
    setInstallmentCycle("يومي");
    setClassification("مدين");
    setIdentity("");
    setNationality("");
    // Keep or enforce authorized region restriction
    if (currentUser && currentUser.role !== "admin" && finalPerms?.region) {
      setRegion(finalPerms.region);
    } else {
      setRegion("");
    }
    setPhone("");
    setContractNo(generateNextNo("AW-CON", installments, "no"));
    setAmount("");
    setPaid("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setPeriods("");
    setInstallment("");
    setDiscount("");
    setAfterDiscount("");
    setProjectSug("");
    setWorkplace("");
    setGuarantor("");
    setStatus("منتظم");
    setNotes("");
    setTreasury(getStoredTreasuries(installmentCompanyId || selectedCompanyId, companies)[0] || "خزنة التحصيل");
    setCapital("");
    setCapitalSource("خزنة الشركة");
    setCapitalCompany("");
    setCapitalCollection("");
    setCapitalSplits({});
    setInstallmentCompanyId(selectedCompanyId !== "all" ? (selectedCompanyId || "") : "");
    setIsCapitalManuallyEdited(false);
  };

  const handleEdit = (x: Installment) => {
    setEditId(x.id);
    setClient(x.client || "");
    setContractType(x.type === "daily" || !x.type ? "تقسيط" : x.type);
    setContractDirection((x.contract_direction as any) || awExtractContractDirection(x.notes || "") || "لنا");
    setLinkedWorkerId(x.worker_id || awExtractWorkerId(x.notes || "") || "");
    setLinkedProjectId(x.project_id || awExtractProjectId(x.notes || "") || "");
    setInstallmentCycle(awExtractCycle(x.notes || "") || "يومي");
    setClassification(awExtractClassification(x.notes || "") || "مدين");
    setIdentity(x.identity || "");
    setNationality(x.nationality || "");
    setRegion(awExtractRegion(x.notes || "") || (finalPerms?.region || ""));
    setPhone(x.phone || "");
    setContractNo(x.no || "");
    setAmount(x.amount || "");
    const recordedDownPayment = awExtractDownPayment(x.notes || "");
    setPaid(recordedDownPayment > 0 ? recordedDownPayment : "");
    setStartDate(x.start_date || "");
    setPeriods(x.periods || "");
    setDiscount(x.discount || "");
    setProjectSug(x.project || "");
    setWorkplace(x.workplace || "");
    setGuarantor(x.guarantor || "");
    setStatus(x.status || "منتظم");
    setNotes(awCleanNotes(x.notes || ""));
    setTreasury(awExtractTreasury(x.notes || "") || getStoredTreasuries(installmentCompanyId || selectedCompanyId, companies)[0] || "خزنة التحصيل");
    setCapital(awExtractCapital(x.notes || "") || "");
    const rawSrc = awExtractCapitalSource(x.notes || "");
    const mappedSrc = rawSrc === "شركة" ? "خزنة الشركة" : (rawSrc === "تحصيل" ? "خزنة التحصيل" : rawSrc);
    setCapitalSource(mappedSrc);
    setCapitalCompany(awExtractCapitalCompany(x.notes || "") || "");
    setCapitalCollection(awExtractCapitalCollection(x.notes || "") || "");
    
    // Load splitting amounts dynamically
    const loadedSplits: Record<string, number | ""> = {};
    dynamicTreasuries.forEach(tName => {
      const val = awExtractCapitalSplit(x.notes || "", tName);
      loadedSplits[tName] = val || "";
    });
    setCapitalSplits(loadedSplits);

    setInstallmentCompanyId(x.company_id || "");
    setIsCapitalManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.trim()) return;

    // Guarantee unique contract number
    let finalContractNo = (contractNo || generateNextNo("AW-CON", installments, "no")).trim().toUpperCase();
    const isDup = installments.some(
      (i) => i.id !== editId && String(i.no || "").trim().toUpperCase() === finalContractNo
    );

    if (isDup) {
      if (!editId) {
        finalContractNo = generateNextNo("AW-CON", installments, "no");
        setContractNo(finalContractNo);
      } else {
        alert("⚠️ رقم العقد مسجل مسبقاً لعقد آخر! يرجى استخدام رقم عقد فريد.");
        return;
      }
    }

    const row = {
      client: client.trim(),
      identity: identity.trim(),
      nationality,
      phone: phone.trim(),
      no: finalContractNo,
      amount: Number(amount || 0),
      paid: Number(paid || 0),
      remaining: Math.max(0, Number(amount || 0) - Number(paid || 0)),
      type: contractType,
      start_date: startDate,
      end_date: endDate,
      periods: Number(periods || 0),
      installment: Number(installment || 0),
      discount: Number(discount || 0),
      after_discount: Number(afterDiscount || 0),
      project: projectSug.trim(),
      workplace: workplace.trim(),
      guarantor: guarantor.trim(),
      status,
      notes: notes.trim(), // notes builder handling appended inside App.tsx
      region_input: region, // to be passed down
      treasury_input: treasury, // to be passed down
      cycle_input: installmentCycle, // pass down cycle to onSaveInstallment
      classification_input: classification, // pass down classification (دائن/مدين)
      contract_direction_input: contractDirection,
      worker_id_input: linkedWorkerId,
      project_id_input: linkedProjectId,
      capital_input: capitalSource === "كلاهما" ? Object.values(capitalSplits).reduce<number>((sum, val) => sum + Number(val || 0), 0) : Number(capital || 0),
      capital_source_input: capitalSource,
      capital_company_input: capitalSource === "كلاهما" ? Number(capitalSplits["خزنة الشركة"] || 0) : (capitalSource === "خزنة الشركة" ? Number(capital || 0) : 0),
      capital_collection_input: capitalSource === "كلاهما" ? Number(capitalSplits["خزنة التحصيل"] || 0) : (capitalSource === "خزنة التحصيل" ? Number(capital || 0) : 0),
      capital_splits_input: capitalSplits,
      company_id: installmentCompanyId || (selectedCompanyId !== "all" ? selectedCompanyId : undefined)
    };

    setPendingContractRow(row);
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingContractRow) return;
    setIsSavingContract(true);
    try {
      const success = await onSaveInstallment(pendingContractRow, editId);
      if (success) {
        setShowConfirmModal(false);
        setPendingContractRow(null);
        handleClear();
      }
    } finally {
      setIsSavingContract(false);
    }
  };

  // Safe checks for user permission context
  const allowedRegion = finalPerms?.region || "";
  const filteredInstallments = installments.filter((item) => {
    const itemRegion = awExtractRegion(item.notes || "");
    if (currentUser && currentUser.role !== "admin" && allowedRegion) {
      return itemRegion === allowedRegion;
    }
    return true;
  });

  const totalContractsCount = filteredInstallments.length;
  const completedContractsCount = filteredInstallments.filter((x) => Number(x.remaining || 0) <= 0 || x.status === "مكتمل").length;
  const activeContractsCount = totalContractsCount - completedContractsCount;

  const getVisibleList = () => {
    const list = filteredInstallments.filter((x) => {
      const t = getContractTiming(x);
      const isFullyPaid = Number(x.remaining || 0) <= 0 || x.status === "مكتمل";
      const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : x.status);
      const r = awExtractRegion(x.notes || "");

      // Contract Lifecycle Filter (نشط / مكتمل)
      if (fContractLifecycle === "active" && isFullyPaid) return false;
      if (fContractLifecycle === "completed" && !isFullyPaid) return false;

      const txt = `${x.client} ${x.identity} ${x.phone} ${x.no} ${x.project} ${x.workplace} ${x.nationality} ${r}`.toLowerCase();
      const itemType = x.type === "daily" || !x.type ? "تقسيط" : x.type;
      const itemClassification = awExtractClassification(x.notes || "");

      return (
        (!qSearch || txt.includes(qSearch.toLowerCase().trim())) &&
        (!fStatus || computedStatus === fStatus) &&
        (!fNationality || x.nationality === fNationality) &&
        (!fProject || String(x.project).toLowerCase().includes(fProject.toLowerCase().trim())) &&
        (!fRegion || r === fRegion) &&
        (!fType || itemType === fType) &&
        (!fClassification || itemClassification === fClassification)
      );
    });

    return list.sort((a, b) => {
      if (fSort === "date_desc") {
        return String(b.start_date || "").localeCompare(String(a.start_date || ""));
      }
      if (fSort === "date_asc") {
        return String(a.start_date || "").localeCompare(String(b.start_date || ""));
      }
      if (fSort === "client_asc") {
        return String(a.client || "").localeCompare(String(b.client || ""), "ar");
      }
      if (fSort === "amount_desc") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }
      if (fSort === "amount_asc") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }
      return 0;
    });
  };

  const listToRender = getVisibleList();

  // Selected file timing details & related receipts
  const activeTiming = selectedFileContract ? getContractTiming(selectedFileContract) : null;
  const activeReceipts = selectedFileContract
    ? receipts.filter((r) => r.installment_id === selectedFileContract.id || r.contract_no === selectedFileContract.no)
    : [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Contract Addition Form Panel */}
      {((!editId && finalPerms?.installmentsAdd) || (editId && finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
        <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 sm:space-y-6">
          <div className="border-b border-slate-850 pb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">📝</span>
              {editId ? `تعديل عقد العميل — ${client}` : `إضافة عقد تقسيط ${installmentCycle} جديد`}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

            {/* Contract Direction Selector Panel */}
            <div className="sm:col-span-2 md:col-span-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <label className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>🧭</span> اتجاه العقد وطبيعة المعاملة المالية (Contract Direction & Flow)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setContractDirection("لنا")}
                  className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    contractDirection === "لنا"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-extrabold shadow-lg"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black">🟢 لنا (إيراد / تحصيل من عميل)</div>
                    <div className="text-[10px] text-slate-400 font-normal">عقد مشروع/تقسيط للشركة وتوليد مقبوضات</div>
                  </div>
                  {contractDirection === "لنا" && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setContractDirection("علينا")}
                  className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    contractDirection === "علينا"
                      ? "bg-rose-500/15 border-rose-500 text-rose-300 font-extrabold shadow-lg"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black">🔴 علينا (مصروف / استحقاق لمقاول)</div>
                    <div className="text-[10px] text-slate-400 font-normal">عقد مقاولة باطن أو توريد وتوليد مدفوعات</div>
                  </div>
                  {contractDirection === "علينا" && <CheckCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setContractDirection("مصروفات عمالة")}
                  className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    contractDirection === "مصروفات عمالة"
                      ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-extrabold shadow-lg"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black">💼 مصروفات عمالة (عقد تشغيل/رواتب)</div>
                    <div className="text-[10px] text-slate-400 font-normal">ربط مباشر بتكاليف عمالة مشروع محدد</div>
                  </div>
                  {contractDirection === "مصروفات عمالة" && <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              </div>
            </div>



            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">اسم العميل</label>
              <div className="relative">
                <User className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="text"
                  placeholder="اسم العميل الرباعي"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">رقم الهوية / الإقامة</label>
              <div className="relative">
                <Shield className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="text"
                  placeholder="10 أرقام"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">جنسية العميل</label>
              <div className="relative">
                <Globe className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">الجنسية</option>
                  <option value="سعودي">سعودي</option>
                  <option value="هندي">هندي</option>
                  <option value="باكستاني">باكستاني</option>
                  <option value="بنقالي">بنقالي</option>
                  <option value="مصري">مصري</option>
                  <option value="سوداني">سوداني</option>
                  <option value="يمني">يمني</option>
                  <option value="نيبالي">نيبالي</option>
                  <option value="فلبيني">فلبيني</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">إدارة الفرع</label>
              <select
                disabled={currentUser?.role !== "admin" && !!allowedRegion}
                value={region || (currentUser?.role !== "admin" ? allowedRegion : "")}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <option value="">الإدارة المسؤولة</option>
                <option value="الوسطى">الوسطى</option>
                <option value="الشرقية">الشرقية</option>
                <option value="الغربية">الغربية</option>
                <option value="الجنوب">الجنوب</option>
                <option value="الشمال">الشمال</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">نوع العقد</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="تقسيط">تقسيط</option>
                <option value="المشروع">المشروع</option>
                <option value="عقد عمل">عقد عمل</option>
                <option value="عقد مقاولات">عقد مقاولات</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">تصنيف الحساب (مدين / دائن)</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="مدين">مدين (العميل عليه التزام مالي لنا)</option>
                <option value="دائن">دائن (العميل له مستحقات مالية لدينا)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">رقم جوال العميل</label>
              <div className="relative">
                <Phone className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="text"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400">رقم العقد</label>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">فريد تلقائي</span>
              </div>
              <input
                readOnly
                type="text"
                value={contractNo}
                title="رقم العقد التسلسلي المضمون عدم تكراره"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-850 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none select-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">مبلغ العقد الكلي</label>
              <input
                required
                type="number"
                placeholder="المبلغ الإجمالي"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400">الدفعة المدفوعة مقدماً عند توقيع العقد</label>
                <span className="text-[9px] text-slate-500 font-bold">0 إذا لم توجد دفعة أولى</span>
              </div>
              <input
                type="number"
                placeholder="0 (تترك فارغة إذا كان السداد بسندات)"
                value={paid}
                onChange={(e) => setPaid(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">تاريخ البدء</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">دورية سداد القسط</label>
              <select
                value={installmentCycle}
                onChange={(e) => setInstallmentCycle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="يومي">يومي</option>
                <option value="اسبوعي">أسبوعي</option>
                <option value="نصف شهر">نصف شهري</option>
                <option value="شهري">شهري</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">
                {installmentCycle === "اسبوعي" ? "عدد أسابيع العقد" :
                 installmentCycle === "نصف شهر" ? "عدد الدفعات (كل 15 يوم)" :
                 installmentCycle === "شهري" ? "عدد أشهر العقد" : "عدد أيام العقد"}
              </label>
              <input
                required
                type="number"
                placeholder={
                  installmentCycle === "اسبوعي" ? "مثال: 4 أسابيع" :
                  installmentCycle === "نصف شهر" ? "مثال: 6 دفعات" :
                  installmentCycle === "شهري" ? "مثال: 12 شهر" : "مثال: 30 يوم"
                }
                value={periods}
                onChange={(e) => setPeriods(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">
                {installmentCycle === "اسبوعي" ? "القسط الأسبوعي المستحق" :
                 installmentCycle === "نصف شهر" ? "القسط نصف الشهري المستحق" :
                 installmentCycle === "شهري" ? "القسط الشهري المستحق" : "القسط اليومي المستحق"}
              </label>
              <input
                readOnly
                type="text"
                placeholder="تلقائي بقسمة المتبقي"
                value={installment ? `${installment} ريال / ${
                  installmentCycle === "اسبوعي" ? "أسبوع" :
                  installmentCycle === "نصف شهر" ? "نصف شهر" :
                  installmentCycle === "شهري" ? "شهر" : "يوم"
                }` : ""}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-850 rounded-xl text-xs font-bold text-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">خصم انتظام السداد</label>
              <input
                type="number"
                placeholder="خصم تسوية"
                value={discount}
                onChange={(e) => setDiscount(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">تاريخ الانتهاء</label>
              <input
                readOnly
                type="date"
                value={endDate}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-850 rounded-xl text-xs font-bold text-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">اسم المشروع المرتبط</label>
              <input
                type="text"
                list="projectsListForm"
                placeholder="ابحث وصنف المشروع"
                value={projectSug}
                onChange={(e) => setProjectSug(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              />
              <datalist id="projectsListForm">
                {projects.map((p, idx) => (
                  <option key={idx} value={p.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">مقر العمل</label>
              <input
                type="text"
                placeholder="الجهة أو الشركة المشغلة"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">الكفيل الغارم</label>
              <input
                type="text"
                placeholder="اسم الكفيل الضامن"
                value={guarantor}
                onChange={(e) => setGuarantor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">حالة السداد العامة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="منتظم">منتظم</option>
                <option value="متأخر">متأخر</option>
                <option value="متعثر">متعثر</option>
                <option value="مكتمل">مكتمل</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">الخزنة المستهدفة بالمعاملات</label>
              <select
                value={treasury}
                onChange={(e) => setTreasury(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {dynamicTreasuries.map((tName) => (
                  <option key={tName} value={tName} className="bg-slate-950 text-white">🏢 {tName}</option>
                ))}
              </select>
            </div>

             <div className="space-y-1">
              <label className="text-[10px] font-black text-amber-400">جهة تمويل رأس مال العقد</label>
              <select
                value={capitalSource}
                onChange={(e) => handleCapitalSourceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors bg-slate-950 cursor-pointer"
              >
                {dynamicTreasuries.map((tName) => (
                  <option key={tName} value={tName} className="bg-slate-950 text-white">💰 {tName}</option>
                ))}
                <option value="كلاهما" className="bg-slate-950 text-white">🤝 الاثنين معاً (تقسيم التمويل)</option>
              </select>
            </div>

            {capitalSource !== "كلاهما" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-amber-400 flex items-center justify-between">
                  <span>قيمة رأس مال العقد (تمويل البداية)</span>
                  {isCapitalManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCapitalManuallyEdited(false);
                      }}
                      className="text-[8px] text-blue-400 underline font-sans hover:text-blue-300"
                    >
                      (تفعيل تلقائي متبقي)
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  placeholder="رأس المال المدفوع لتأسيس العقد"
                  value={capital}
                  onChange={(e) => handleCapitalChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-amber-200 focus:outline-none focus:border-blue-500 transition-colors"
                />
                
                {/* Real-time interactive autofill helper badges */}
                {Number(amount || 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCapital(Number(amount || 0));
                        setIsCapitalManuallyEdited(true);
                      }}
                      className="text-[9px] px-2 py-0.5 bg-slate-950/60 text-slate-300 border border-slate-800 rounded hover:bg-slate-800 transition font-sans"
                    >
                      كامل العقد ({Number(amount).toLocaleString()})
                    </button>
                    {Number(paid || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCapital(Math.max(0, Number(amount || 0) - Number(paid || 0)));
                          setIsCapitalManuallyEdited(true);
                        }}
                        className="text-[9px] px-2 py-0.5 bg-slate-950/60 text-amber-400 border border-slate-800 rounded hover:bg-slate-800 transition font-sans"
                      >
                        المتبقي ({Math.max(0, Number(amount || 0) - Number(paid || 0)).toLocaleString()})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCapital(Math.round(Number(amount || 0) * 0.7));
                        setIsCapitalManuallyEdited(true);
                      }}
                      className="text-[9px] px-2 py-0.5 bg-slate-950/60 text-slate-300 border border-slate-800 rounded hover:bg-slate-800 transition font-sans"
                    >
                      70٪ عصف ({Math.round(Number(amount || 0) * 0.7).toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCapital(Math.round(Number(amount || 0) * 0.8));
                        setIsCapitalManuallyEdited(true);
                      }}
                      className="text-[9px] px-2 py-0.5 bg-slate-950/60 text-slate-300 border border-slate-800 rounded hover:bg-slate-800 transition font-sans"
                    >
                      80٪ عصف ({Math.round(Number(amount || 0) * 0.8).toLocaleString()})
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20">
                {dynamicTreasuries.map((tName) => {
                  const val = capitalSplits[tName] !== undefined ? capitalSplits[tName] : "";
                  const totalRem = Math.max(0, Number(amount || 0) - Number(paid || 0)) || 1;
                  const ratio = Number(amount || 0) > 0 ? ((Number(val || 0) / totalRem) * 100).toFixed(0) : "";
                  return (
                    <div key={tName} className="space-y-1">
                      <span className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-amber-400">كم دفع {tName} من رأس المال؟</label>
                        {ratio !== "" && (
                          <span className="text-[9px] text-amber-500 font-mono font-bold">
                            {ratio}٪
                          </span>
                        )}
                      </span>
                      <input
                        type="number"
                        placeholder={`تمويل من ${tName}`}
                        value={val}
                        onChange={(e) => {
                          const updatedVal = e.target.value === "" ? "" : Number(e.target.value);
                          setCapitalSplits((prev) => ({
                            ...prev,
                            [tName]: updatedVal,
                          }));
                          setIsCapitalManuallyEdited(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-amber-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  );
                })}
                
                {/* Live division ratio buttons */}
                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center border-t border-amber-500/10 pt-3 justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const total = Math.max(0, Number(amount || 0) - Number(paid || 0)) || Number(amount || 0);
                        if (total > 0) {
                          const newSplits: Record<string, number | ""> = {};
                          dynamicTreasuries.forEach(tName => {
                            if (tName === "خزنة الشركة") {
                              newSplits[tName] = Math.round(total * 0.5);
                            } else if (tName === "خزنة التحصيل") {
                              newSplits[tName] = total - Math.round(total * 0.5);
                            } else {
                              newSplits[tName] = 0;
                            }
                          });
                          setCapitalSplits(newSplits);
                          setIsCapitalManuallyEdited(true);
                        }
                      }}
                      className="text-[9px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded hover:bg-amber-500/20 transition font-sans"
                    >
                      ⚖️ مناصفة 50/50
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const total = Math.max(0, Number(amount || 0) - Number(paid || 0)) || Number(amount || 0);
                        if (total > 0) {
                          const newSplits: Record<string, number | ""> = {};
                          dynamicTreasuries.forEach(tName => {
                            if (tName === "خزنة الشركة") {
                              newSplits[tName] = Math.round(total * 0.7);
                            } else if (tName === "خزنة التحصيل") {
                              newSplits[tName] = total - Math.round(total * 0.7);
                            } else {
                              newSplits[tName] = 0;
                            }
                          });
                          setCapitalSplits(newSplits);
                          setIsCapitalManuallyEdited(true);
                        }
                      }}
                      className="text-[9px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded hover:bg-amber-500/20 transition font-sans"
                    >
                      🏢 الشركة 70٪ / التحصيل 30٪
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const total = Math.max(0, Number(amount || 0) - Number(paid || 0)) || Number(amount || 0);
                        if (total > 0) {
                          const newSplits: Record<string, number | ""> = {};
                          dynamicTreasuries.forEach(tName => {
                            if (tName === "خزنة الشركة") {
                              newSplits[tName] = Math.round(total * 0.8);
                            } else if (tName === "خزنة التحصيل") {
                              newSplits[tName] = total - Math.round(total * 0.8);
                            } else {
                              newSplits[tName] = 0;
                            }
                          });
                          setCapitalSplits(newSplits);
                          setIsCapitalManuallyEdited(true);
                        }
                      }}
                      className="text-[9px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded hover:bg-amber-500/20 transition font-sans"
                    >
                      🏢 الشركة 80٪ / التحصيل 20٪
                    </button>
                    {isCapitalManuallyEdited && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCapitalManuallyEdited(false);
                        }}
                        className="text-[9px] px-2 py-0.5 bg-blue-600/10 text-blue-300 border border-blue-500/20 rounded hover:bg-blue-600/20 transition font-sans"
                      >
                        🔄 إعادة التفعيل التلقائي
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] font-black text-amber-300">
                    💡 إجمالي رأس مال العقد المشترك: {Object.values(capitalSplits).reduce<number>((sum, val) => sum + Number(val || 0), 0).toLocaleString()} ريال
                  </span>
                </div>
              </div>
            )}

            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400">ملاحظات العقد</label>
              <textarea
                placeholder="تفاصيل إضافية أو شروط سداد"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 h-[46px] bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-slate-800 text-white hover:bg-slate-750 transition-all shadow-md"
            >
              إلغاء وتفريغ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md"
            >
              {editId ? "حفظ التعديلات" : "حفظ وتسجيل العقد"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Tables Section */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        {/* Contract Status Quick Filter Tabs Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400 flex items-center gap-1.5 ml-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>حالة العقود:</span>
            </span>

            {/* All Contracts Tab */}
            <button
              type="button"
              onClick={() => setFContractLifecycle("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                fContractLifecycle === "all"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400"
                  : "bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              <span>جميع العقود</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                fContractLifecycle === "all" ? "bg-slate-950/25 text-slate-950 font-black" : "bg-slate-800 text-slate-400"
              }`}>
                {totalContractsCount}
              </span>
            </button>

            {/* Active / Ongoing Contracts Tab */}
            <button
              type="button"
              onClick={() => setFContractLifecycle("active")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                fContractLifecycle === "active"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400"
                  : "bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>عقود نشطة وجارية</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                fContractLifecycle === "active" ? "bg-white/20 text-white font-black" : "bg-blue-500/15 text-blue-400"
              }`}>
                {activeContractsCount}
              </span>
            </button>

            {/* Completed / Finished Contracts Tab */}
            <button
              type="button"
              onClick={() => setFContractLifecycle("completed")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                fContractLifecycle === "completed"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 ring-1 ring-emerald-300"
                  : "bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>عقود منتهية ومكتملة</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                fContractLifecycle === "completed" ? "bg-slate-950/25 text-slate-950 font-black" : "bg-emerald-500/15 text-emerald-400"
              }`}>
                {completedContractsCount}
              </span>
            </button>
          </div>

          {/* Result counter and Reset Filters */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            {(qSearch || fStatus || fType || fClassification || fNationality || fProject || fRegion || fContractLifecycle !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQSearch("");
                  setFContractLifecycle("all");
                  setFStatus("");
                  setFType("");
                  setFClassification("");
                  setFNationality("");
                  setFProject("");
                  setFRegion("");
                  setFSort("date_desc");
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="إلغاء جميع الفلاتر والبحث"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>مسح الفلاتر</span>
              </button>
            )}
            <div className="text-xs font-bold text-slate-400 font-sans">
              المعروض: <span className="font-mono text-amber-400 font-black">{listToRender.length}</span> من <span className="font-mono text-slate-300">{totalContractsCount}</span>
            </div>
          </div>
        </div>

        {/* Quick Filter Controls Grid (Balanced responsive columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 p-3.5 sm:p-4 bg-slate-950/40 rounded-2xl border border-slate-850/80">
          <input
            type="text"
            placeholder="البحث باسم العميل أو العقد..."
            value={qSearch}
            onChange={(e) => setQSearch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500 sm:col-span-2 md:col-span-1"
          />
          <select
            value={fContractLifecycle}
            onChange={(e) => setFContractLifecycle(e.target.value as any)}
            className={`w-full px-3 py-2 border rounded-xl text-xs font-bold focus:outline-none transition-colors ${
              fContractLifecycle === "active"
                ? "bg-blue-950/60 border-blue-500/50 text-blue-300"
                : fContractLifecycle === "completed"
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-slate-900 border-slate-800 text-white"
            }`}
          >
            <option value="all">كل الحالات (نشط + مكتمل)</option>
            <option value="active">⚡ العقود النشطة والجارية فقط</option>
            <option value="completed">✅ العقود المنتهية والمكتملة فقط</option>
          </select>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
          >
            <option value="">جميع حالات السداد</option>
            <option value="منتظم">منتظم</option>
            <option value="متأخر">متأخر</option>
            <option value="متعثر">متعثر</option>
            <option value="مكتمل">مكتمل</option>
          </select>
          <select
            value={fType}
            onChange={(e) => setFType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
          >
            <option value="">كل أنواع العقود</option>
            <option value="تقسيط">تقسيط</option>
            <option value="المشروع">المشروع</option>
            <option value="عقد عمل">عقد عمل</option>
            <option value="عقد مقاولات">عقد مقاولات</option>
          </select>
          <select
            value={fClassification}
            onChange={(e) => setFClassification(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
          >
            <option value="">كل التصنيفات (مدين/دائن)</option>
            <option value="مدين">مدين</option>
            <option value="دائن">دائن</option>
          </select>
          <select
            value={fNationality}
            onChange={(e) => setFNationality(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
          >
            <option value="">كل الجنسيات</option>
            <option value="سعودي">سعودي</option>
            <option value="هندي">هندي</option>
            <option value="باكستاني">باكستاني</option>
            <option value="بنقالي">بنقالي</option>
            <option value="مصري">مصري</option>
            <option value="سوداني">سوداني</option>
            <option value="يمني">يمني</option>
            <option value="أخرى">أخرى</option>
          </select>
          <input
            type="text"
            placeholder="المشروع المرتبط..."
            value={fProject}
            onChange={(e) => setFProject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
          />
          <select
            value={fRegion}
            onChange={(e) => setFRegion(e.target.value)}
            disabled={currentUser?.role !== "admin" && !!allowedRegion}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-75"
          >
            <option value="">كل إدارات الفروع</option>
            <option value="الوسطى">الوسطى</option>
            <option value="الشرقية">الشرقية</option>
            <option value="الغربية">الغربية</option>
            <option value="الجنوب">الجنوب</option>
            <option value="الشمال">الشمال</option>
          </select>
          <select
            value={fSort}
            onChange={(e) => setFSort(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none font-sans"
          >
            <option value="date_desc">تاريخ العقد (الأحدث أولاً)</option>
            <option value="date_asc">تاريخ العقد (الأقدم أولاً)</option>
            <option value="client_asc">اسم العميل (أ - ي)</option>
            <option value="amount_desc">قيمة العقد (الأعلى ماليًا)</option>
            <option value="amount_asc">قيمة العقد (الأقل ماليًا)</option>
          </select>
        </div>

        {/* View Switcher, Export Actions, and Expand All Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400">طريقة العرض:</span>
            <div className="inline-flex p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewLayout("smart_table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewLayout === "smart_table"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>جدول مدمج متناسق</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("cards")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewLayout === "cards"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>بطاقات تفصيلية</span>
              </button>
            </div>

            {/* Export & Download Buttons for Contracts */}
            <div className="flex items-center gap-1.5 mr-1">
              {/* Export to Excel */}
              <button
                type="button"
                onClick={handleExportAllContractsExcel}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-102"
                title="تصدير وتنزيل قائمة العقود الحالية بملف Excel (CSV) مع كافة البيانات المالية"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>تصدير إكسل ({listToRender.length})</span>
              </button>

              {/* Export to PDF Report */}
              <button
                type="button"
                onClick={handleExportAllContractsPDF}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-102"
                title="تنزيل وطباعة تقرير معتمد لكافة العقود بصيغة PDF"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>تقرير العقود PDF</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAllExpanded(true)}
              className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="إظهار كافة الخانات والتفاصيل المنسدلة تحت كل عقد"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>إظهار تفاصيل الكل</span>
            </button>
            <button
              type="button"
              onClick={() => toggleAllExpanded(false)}
              className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="طي كافة الخانات الإضافية"
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
              <span>طي التفاصيل</span>
            </button>
          </div>
        </div>

        {/* Content View: Smart Table OR Cards */}
        {viewLayout === "smart_table" ? (
          /* Smart Table that fits 100% on screen without horizontal cutting */
          <div className="rounded-2xl border border-slate-800/80 shadow-2xl bg-slate-950/70 overflow-hidden w-full">
            <table className="w-full text-right text-xs md:text-sm border-collapse table-auto">
              <thead>
                <tr className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 text-slate-300">
                  <th className="py-3 px-3.5 font-black text-amber-400 w-[30%]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>العميل والعقد</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 font-black text-slate-200 w-[28%] text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>المبالغ المالية (إجمالي / مستلم / متبقي)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 font-black text-center text-slate-300 w-[17%]">
                    <div className="flex items-center justify-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>حالة السداد والتأخر</span>
                    </div>
                  </th>
                  <th className="py-3 px-3.5 font-black text-center text-slate-300 w-[25%]">
                    <span>الإجراءات والتفاصيل</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {listToRender.length > 0 ? (
                  listToRender.map((item, idx) => {
                    const t = getContractTiming(item);
                    const isFullyPaid = Number(item.remaining || 0) <= 0 || item.status === "مكتمل";
                    const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : item.status);
                    const itemRegion = awExtractRegion(item.notes || "");
                    const itemTreasury = awExtractTreasury(item.notes || "");
                    const itemClassification = awExtractClassification(item.notes || "");
                    const renewedFrom = awExtractRenewedFrom(item.notes || "");
                    const isExpanded = !!expandedRows[item.id];
                    const matchedProject = projects.find(p => p.id === item.project_id);
                    const matchedWorker = workers?.find(w => w.id === item.worker_id);

                    return (
                      <React.Fragment key={item.id || idx}>
                        <tr
                          className={`transition-all duration-150 group ${
                            isFullyPaid
                              ? "bg-emerald-950/15 hover:bg-emerald-950/30 border-r-4 border-r-emerald-500"
                              : computedStatus === "متأخر"
                              ? "bg-rose-950/15 hover:bg-rose-950/30 border-r-4 border-r-rose-500"
                              : idx % 2 === 0
                              ? "bg-slate-900/30 hover:bg-slate-800/40"
                              : "bg-slate-950/40 hover:bg-slate-800/40"
                          }`}
                        >
                          {/* Client Name & Contract Badges */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-white text-sm tracking-wide leading-tight group-hover:text-amber-300 transition-colors">
                                {item.client}
                              </span>
                              <span className="font-mono text-xs font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shadow-inner">
                                {item.no}
                              </span>
                              {isFullyPaid && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-300 bg-emerald-900/60 border border-emerald-600/50 px-1.5 py-0.5 rounded-md shadow-sm">
                                  <span>✅</span> منتهي
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800 font-bold">
                                {item.nationality || "غير محدد"}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-black">
                                {item.type === "daily" || !item.type ? "تقسيط" : item.type}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black">
                                {(() => {
                                  const c = awExtractCycle(item.notes || "") || "يومي";
                                  return c === "يومي" ? "يومي" :
                                         c === "اسبوعي" ? "أسبوعي" :
                                         c === "نصف شهر" ? "نصف شهري" : "شهري";
                                })()}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-md font-black ${
                                itemClassification === "دائن"
                                  ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
                                  : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                              }`}>
                                {itemClassification}
                              </span>
                            </div>
                          </td>

                          {/* Consolidated Financial Summary Cell */}
                          <td className="py-3 px-3 align-middle">
                            <div className="grid grid-cols-3 gap-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-850 shadow-inner text-center">
                              <div>
                                <span className="block text-[9px] font-bold text-slate-400">الإجمالي</span>
                                <span className={`block font-mono font-black text-xs md:text-sm mt-0.5 ${
                                  itemClassification === "دائن" ? "text-rose-400" : "text-slate-100"
                                }`}>
                                  {Number(item.amount || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="border-r border-slate-800">
                                <span className="block text-[9px] font-bold text-emerald-400">المستلم</span>
                                <span className="block font-mono font-black text-xs md:text-sm text-emerald-400 mt-0.5">
                                  {Number(item.paid || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="border-r border-slate-800">
                                <span className="block text-[9px] font-bold text-amber-400">المتبقي</span>
                                <span className={`block font-mono font-black text-xs md:text-sm mt-0.5 ${
                                  Number(item.remaining || 0) <= 0
                                    ? "text-emerald-400"
                                    : itemClassification === "دائن"
                                    ? "text-rose-400"
                                    : "text-amber-300"
                                }`}>
                                  {Number(item.remaining || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Status and Delay */}
                          <td className="py-3 px-3 align-middle text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>منتهي ومسدد</span>
                                </span>
                              ) : computedStatus === "منتظم" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  <span>منتظم</span>
                                </span>
                              ) : computedStatus === "متأخر" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-md shadow-rose-950/50 animate-pulse">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>متأخر</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  <span>{computedStatus}</span>
                                </span>
                              )}

                              {t.overdueDays > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                                  <span>تأخر:</span>
                                  <span className="font-mono">{t.overdueDays}</span>
                                  <span>يوم</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons + Dropdown Expander */}
                          <td className="py-3 px-3.5 align-middle text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Export Single Contract Excel */}
                              <button
                                type="button"
                                onClick={() => handleExportSingleContractExcel(item)}
                                className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="تنزيل وتصدير بيانات العقد وسجل الدفعات إكسل (Excel / CSV)"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                                <span>إكسل</span>
                              </button>

                              {/* Export Client Statement PDF */}
                              <button
                                type="button"
                                onClick={() => handleExportClientStatementPDF(item)}
                                className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="تصدير كشف حساب العميل PDF يحتوي على كامل سجل سندات القبض والصرف"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                                <span>كشف حساب</span>
                              </button>

                              {/* Print Contract PDF */}
                              <button
                                type="button"
                                onClick={() => onPrintContract(item.id)}
                                className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="طباعة وحفظ بطاقة العقد الرسمية PDF"
                              >
                                <Printer className="w-3.5 h-3.5 text-amber-400" />
                                <span>طباعة</span>
                              </button>

                              {/* Open File */}
                              <button
                                type="button"
                                onClick={() => setSelectedFileContract(item)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="فتح ملف العقد وتفاصيل الأقساط"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-400 group-hover:text-white" />
                                <span>الملف</span>
                              </button>

                              {/* Quick Receipt */}
                              {onCreateReceiptForContract && !isFullyPaid && (
                                <button
                                  type="button"
                                  onClick={() => onCreateReceiptForContract(item)}
                                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-500/20 hover:scale-105"
                                  title="تحرير سند قبض لهذا العقد فوراً"
                                >
                                  <span>💰</span>
                                  <span>سند قبض</span>
                                </button>
                              )}

                              {/* Renewal Button */}
                              {((finalPerms?.installmentsAdd) || currentUser?.role === "admin") && (
                                <button
                                  type="button"
                                  onClick={() => openRenewModal(item)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                                    isFullyPaid
                                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md ring-1 ring-cyan-300"
                                      : "bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30"
                                  }`}
                                  title={isFullyPaid ? "تجديد العقد المنتهي لعميلك" : "تجديد العقد أو تمديد فترته"}
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                  <span>تجديد</span>
                                </button>
                              )}

                               {/* Transfer Contract & Payments Button */}
                              {onTransferContractAndPayments && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransferSourceContract(item);
                                    setTransferTargetId("");
                                    setTransferReason("");
                                    setTransferSearchQuery("");
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="نقل العقد وسداداته إلى أي عقد يتم اختياره"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                  <span>نقل وسدادات</span>
                                </button>
                              )}

                              {/* Transfer to another Company */}
                              {onMigrateInstallment && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (companies && companies.length > 1) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMigrateCompanyContract(item);
                                    const otherComp = companies.find(c => c.id !== item.company_id);
                                    setTargetMigrateCompanyId(otherComp ? otherComp.id : "");
                                    setMigrateCompanyReason("");
                                  }}
                                  className="px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="نقل العقد بكافة سنداته ومصروفاته إلى شركة أخرى"
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>نقل لشركة</span>
                                </button>
                              )}

                              {/* Delete Button */}
                              {(currentUser?.role === "admin" || finalPerms?.installmentsDelete) && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteInstallment(item.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl transition-all cursor-pointer"
                                  title="حذف العقد نهائياً"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Dropdown Toggle for Remaining Hidden Fields */}
                              <button
                                type="button"
                                onClick={() => toggleRowExpanded(item.id)}
                                className={`px-2 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? "bg-amber-500 text-slate-950 shadow-sm"
                                    : "bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/30"
                                }`}
                                title="إظهار باقي الخانات والتواريخ والمعلومات التفصيلية تحت السطر"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span className="text-[11px]">إخفاء</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span className="text-[11px]">باقي الخانات</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Dropdown Sub-Row containing all remaining fields */}
                        {isExpanded && (
                          <tr className="bg-slate-900/80 border-b border-amber-500/20">
                            <td colSpan={4} className="p-4">
                              <div className="bg-slate-950/90 border border-amber-500/25 rounded-2xl p-4 shadow-xl space-y-3 text-right">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-400 font-black text-xs flex items-center gap-1.5">
                                      <Info className="w-4 h-4" />
                                      <span>كافة الخانات والتفاصيل الإضافية للعقد:</span>
                                    </span>
                                    <span className="text-xs font-mono font-bold text-slate-300">({item.no} - {item.client})</span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-bold">
                                    معرف العقد: <span className="font-mono text-slate-300">{item.id}</span>
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                                  {/* Contract Start Date */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-blue-400" />
                                      <span>تاريخ بداية العقد:</span>
                                    </span>
                                    <span className="block font-mono text-xs font-black text-white">
                                      {item.start_date || "غير محدد"}
                                    </span>
                                  </div>

                                  {/* Last Paid Date */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-400" />
                                      <span>تاريخ آخر سداد:</span>
                                    </span>
                                    <span className="block font-mono text-xs font-black text-amber-300">
                                      {t.lastPaid || "غير مسدد"}
                                    </span>
                                  </div>

                                  {/* Branch */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-amber-400" />
                                      <span>إدارة الفرع:</span>
                                    </span>
                                    <span className="block text-xs font-black text-amber-200">
                                      {itemRegion || "القرية الرئيسية"}
                                    </span>
                                  </div>

                                  {/* Treasury */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <span>🏢</span>
                                      <span>الخزنة التابعة:</span>
                                    </span>
                                    <span className="block text-xs font-black text-blue-300">
                                      {itemTreasury || "خزنة التحصيل"}
                                    </span>
                                  </div>

                                  {/* Project */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <ClipboardList className="w-3 h-3 text-emerald-400" />
                                      <span>المشروع المرتبط:</span>
                                    </span>
                                    <span className="block text-xs font-bold text-slate-200 truncate">
                                      {matchedProject?.name || "عام / غير مرتبط"}
                                    </span>
                                  </div>

                                  {/* Worker */}
                                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    <span className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                      <User className="w-3 h-3 text-purple-400" />
                                      <span>مسؤول العقد:</span>
                                    </span>
                                    <span className="block text-xs font-bold text-slate-200 truncate">
                                      {matchedWorker?.name || "الإدارة العامة"}
                                    </span>
                                  </div>
                                </div>

                                {/* Additional Notes & Renewal Metadata */}
                                {(renewedFrom || item.notes) && (
                                  <div className="pt-2 border-t border-slate-850 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    {renewedFrom && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-300 bg-cyan-950/80 border border-cyan-700/60 px-2.5 py-1 rounded-lg">
                                        🔄 تم تجديد هذا العقد من العقد السابق: <span className="font-mono">{renewedFrom}</span>
                                      </span>
                                    )}
                                    {item.notes && (
                                      <span className="text-slate-300 text-xs">
                                        <strong className="text-slate-400">ملاحظات:</strong> {awCleanNotes(item.notes)}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Quick Actions Bar in Expanded Subrow */}
                                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleExportSingleContractExcel(item)}
                                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                                      title="تنزيل وتصدير كافة بيانات العقد والسدادات بصيغة Excel (CSV)"
                                    >
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                      <span>تنزيل بيانات وسدادات العقد (Excel)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExportClientStatementPDF(item)}
                                      className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>تصدير كشف حساب العميل التفصيلي (PDF)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onPrintContract(item.id)}
                                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span>طباعة بطاقة العقد</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 font-bold text-sm">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-3xl">📭</span>
                        <span>لا توجد أي عقود مسجلة ومطابقة لشروط البحث والفلترة.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Responsive Cards View (جميع الخانات والإجراءات واضحة داخل كل كرت) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {listToRender.length > 0 ? (
              listToRender.map((item, idx) => {
                const t = getContractTiming(item);
                const isFullyPaid = Number(item.remaining || 0) <= 0 || item.status === "مكتمل";
                const computedStatus = isFullyPaid ? "مكتمل" : (t.overdueDays > 0 ? "متأخر" : item.status);
                const itemRegion = awExtractRegion(item.notes || "");
                const itemTreasury = awExtractTreasury(item.notes || "");
                const itemClassification = awExtractClassification(item.notes || "");
                const renewedFrom = awExtractRenewedFrom(item.notes || "");
                const matchedProject = projects.find(p => p.id === item.project_id);
                const matchedWorker = workers?.find(w => w.id === item.worker_id);

                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-2xl border p-4 shadow-xl transition-all space-y-3.5 relative text-right ${
                      isFullyPaid
                        ? "bg-gradient-to-b from-slate-900/90 to-emerald-950/20 border-emerald-500/40"
                        : computedStatus === "متأخر"
                        ? "bg-gradient-to-b from-slate-900/90 to-rose-950/25 border-rose-500/40"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Header: Client name & Contract No & Status */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-white leading-tight">
                            {item.client}
                          </h4>
                          <span className="font-mono text-xs font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                            {item.no}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 font-bold">
                            {item.nationality || "غير محدد"}
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-black">
                            {item.type === "daily" || !item.type ? "تقسيط" : item.type}
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black">
                            {(() => {
                              const c = awExtractCycle(item.notes || "") || "يومي";
                              return c === "يومي" ? "يومي" :
                                     c === "اسبوعي" ? "أسبوعي" :
                                     c === "نصف شهر" ? "نصف شهري" : "شهري";
                            })()}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-black ${
                            itemClassification === "دائن"
                              ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
                              : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                          }`}>
                            {itemClassification}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>منتهي ومسدد</span>
                          </span>
                        ) : computedStatus === "متأخر" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-md animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>متأخر ({t.overdueDays} يوم)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>منتظم</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial Blocks */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-850 text-center">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400">إجمالي العقد</span>
                        <span className={`block font-mono font-black text-sm mt-0.5 ${
                          itemClassification === "دائن" ? "text-rose-400" : "text-slate-100"
                        }`}>
                          {Number(item.amount || 0).toLocaleString()} <span className="text-[9px]">ريال</span>
                        </span>
                      </div>
                      <div className="border-r border-slate-800">
                        <span className="block text-[10px] font-bold text-emerald-400">المستلم</span>
                        <span className="block font-mono font-black text-sm text-emerald-400 mt-0.5">
                          {Number(item.paid || 0).toLocaleString()} <span className="text-[9px]">ريال</span>
                        </span>
                      </div>
                      <div className="border-r border-slate-800">
                        <span className="block text-[10px] font-bold text-amber-400">المتبقي</span>
                        <span className={`block font-mono font-black text-sm mt-0.5 ${
                          Number(item.remaining || 0) <= 0
                            ? "text-emerald-400"
                            : itemClassification === "دائن"
                            ? "text-rose-400"
                            : "text-amber-300"
                        }`}>
                          {Number(item.remaining || 0).toLocaleString()} <span className="text-[9px]">ريال</span>
                        </span>
                      </div>
                    </div>

                    {/* Details Grid (All remaining fields visible) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">📅 تاريخ البداية:</span>
                        <span className="font-mono font-bold text-white mt-0.5 block">{item.start_date || "—"}</span>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">⏱️ آخر سداد:</span>
                        <span className="font-mono font-bold text-amber-300 mt-0.5 block">{t.lastPaid || "غير مسدد"}</span>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">📍 الفرع:</span>
                        <span className="font-bold text-slate-200 mt-0.5 block truncate">{itemRegion || "القرية الرئيسية"}</span>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">🏢 الخزنة:</span>
                        <span className="font-bold text-blue-300 mt-0.5 block truncate">{itemTreasury || "خزنة التحصيل"}</span>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">💼 المشروع:</span>
                        <span className="font-bold text-slate-300 mt-0.5 block truncate">{matchedProject?.name || "عام"}</span>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-850">
                        <span className="block text-[10px] text-slate-400">👤 المسؤول:</span>
                        <span className="font-bold text-slate-300 mt-0.5 block truncate">{matchedWorker?.name || "الإدارة"}</span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-850">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Excel Single Contract */}
                        <button
                          type="button"
                          onClick={() => handleExportSingleContractExcel(item)}
                          className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="تنزيل وتصدير كافة بيانات العقد والسدادات بصيغة Excel (CSV)"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>إكسل</span>
                        </button>

                        {/* Statement PDF */}
                        <button
                          type="button"
                          onClick={() => handleExportClientStatementPDF(item)}
                          className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="تصدير كشف حساب العميل PDF بسجل سندات القبض والصرف"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>كشف حساب</span>
                        </button>

                        {/* Print Contract PDF */}
                        <button
                          type="button"
                          onClick={() => onPrintContract(item.id)}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="طباعة بطاقة العقد الرسمية PDF"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>طباعة</span>
                        </button>

                        {/* File Details */}
                        <button
                          type="button"
                          onClick={() => setSelectedFileContract(item)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-750 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>فتح الملف</span>
                        </button>

                        {/* Quick Receipt */}
                        {onCreateReceiptForContract && !isFullyPaid && (
                          <button
                            type="button"
                            onClick={() => onCreateReceiptForContract(item)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                          >
                            <span>💰</span>
                            <span>سند قبض</span>
                          </button>
                        )}

                        {/* Renewal */}
                        {((finalPerms?.installmentsAdd) || currentUser?.role === "admin") && (
                          <button
                            type="button"
                            onClick={() => openRenewModal(item)}
                            className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>تجديد</span>
                          </button>
                        )}

                        {/* Transfer Contract & Payments */}
                        {onTransferContractAndPayments && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferSourceContract(item);
                              setTransferTargetId("");
                              setTransferReason("");
                              setTransferSearchQuery("");
                            }}
                            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="نقل العقد وسداداته إلى عقد آخر يتم اختياره"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>نقل وسدادات العقد</span>
                          </button>
                        )}

                        {/* Transfer to another Company */}
                        {onMigrateInstallment && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (companies && companies.length > 1) && (
                          <button
                            type="button"
                            onClick={() => {
                              setMigrateCompanyContract(item);
                              const otherComp = companies.find(c => c.id !== item.company_id);
                              setTargetMigrateCompanyId(otherComp ? otherComp.id : "");
                              setMigrateCompanyReason("");
                            }}
                            className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="نقل العقد بكافة سنداته ومصروفاته إلى شركة أخرى"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>نقل لشركة أخرى</span>
                          </button>
                        )}
                      </div>

                      {/* Delete */}
                      {(currentUser?.role === "admin" || finalPerms?.installmentsDelete) && (
                        <button
                          type="button"
                          onClick={() => onDeleteInstallment(item.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl transition-all cursor-pointer"
                          title="حذف العقد نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 font-bold text-sm bg-slate-950/40 rounded-2xl border border-slate-850">
                <span className="text-3xl block mb-2">📭</span>
                <span>لا توجد أي عقود مسجلة ومطابقة لشروط البحث والفلترة.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contract File Details Sheet Modal overlay */}
      {selectedFileContract && activeTiming && (
        <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center z-10">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">📂</span>
                  ملف العقد — {selectedFileContract.no}
                </h4>
                <p className="text-xs text-slate-400 font-bold mt-1">عرض عام لمستندات العميل وتحركات الدفوعات التابعة</p>
              </div>
              <button
                onClick={() => setSelectedFileContract(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Fully Paid & Finished Contract Notice Banner */}
              {(Number(selectedFileContract.remaining || 0) <= 0 || selectedFileContract.status === "مكتمل") && (
                <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-300 shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-3.5 text-xs font-black">
                    <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xl shrink-0">🎉</span>
                    <div>
                      <span className="block text-white text-base font-black flex items-center gap-2">
                        <span>العقد منتهي وتم سداده بالكامل</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black">مسدد 100%</span>
                      </span>
                      <span className="text-emerald-200/90 text-xs font-bold leading-relaxed block mt-0.5">
                        تم استيفاء كامل المبالغ المستحقة على العقد بنجاح (المتبقي: 0 ريال). العقد الآن بحالة "مكتمل / منتهي". يمكنك تجديد العقد لعميلك مباشرة بضغطة زر.
                      </span>
                    </div>
                  </div>
                  {((finalPerms?.installmentsAdd) || currentUser?.role === "admin") && (
                    <button
                      type="button"
                      onClick={() => {
                        const c = selectedFileContract;
                        setSelectedFileContract(null);
                        openRenewModal(c);
                      }}
                      className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0 whitespace-nowrap"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>تجديد العقد الآن</span>
                    </button>
                  )}
                </div>
              )}

              {/* Renewal Origin Banner if applicable */}
              {awExtractRenewedFrom(selectedFileContract.notes || "") && (
                <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl flex items-center justify-between gap-3 text-cyan-300 shadow-sm">
                  <div className="flex items-center gap-3 text-xs font-black">
                    <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">🔄</span>
                    <div>
                      <span className="block text-white text-sm font-bold">عقد مجدد وممدد</span>
                      <span className="text-slate-400 text-xs">تم إنشاء وتجديد هذا العقد استناداً للعقد السابق رقم: </span>
                      <span className="font-mono text-cyan-300 font-black underline mr-1">{awExtractRenewedFrom(selectedFileContract.notes || "")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">العميل</span>
                  <span className="font-bold text-white text-sm">{selectedFileContract.client}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">رقم الهوية</span>
                  <span className="font-mono text-white font-bold text-xs">{selectedFileContract.identity}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">الجوال</span>
                  <span className="font-mono text-white font-bold text-xs">{selectedFileContract.phone}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">الجنسية</span>
                  <span className="font-bold text-white text-xs">{selectedFileContract.nationality || "سعودي"}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">نوع العقد</span>
                  <span className="font-bold text-blue-400 text-xs">
                    {selectedFileContract.type === "daily" || !selectedFileContract.type ? "تقسيط" : selectedFileContract.type}
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">تصنيف الحساب</span>
                  <span className={`font-black text-xs ${
                    awExtractClassification(selectedFileContract.notes || "") === "دائن"
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}>
                    {awExtractClassification(selectedFileContract.notes || "")} ({
                      awExtractClassification(selectedFileContract.notes || "") === "دائن"
                        ? "مستحقات للعميل علينا"
                        : "التزام على العميل لنا"
                    })
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">مبلغ العقد الكلي</span>
                  <span className={`font-mono font-black text-sm ${
                    awExtractClassification(selectedFileContract.notes || "") === "دائن"
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}>{Number(selectedFileContract.amount).toLocaleString()} ريال</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">المدفوع مقدماً</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-xs">{Number(selectedFileContract.paid).toLocaleString()} ريال</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850 bg-amber-500/5">
                  <span className="block text-[10px] font-black text-amber-400 mb-1">رأس مال العقد</span>
                  <span className="font-mono text-amber-200 font-extrabold text-sm block">
                    {Number(awExtractCapital(selectedFileContract.notes || "")).toLocaleString()} ريال
                  </span>
                  {(() => {
                    const src = awExtractCapitalSource(selectedFileContract.notes || "");
                    const comp = awExtractCapitalCompany(selectedFileContract.notes || "");
                    const coll = awExtractCapitalCollection(selectedFileContract.notes || "");
                    
                    if (src === "كلاهما") {
                      return (
                        <span className="block text-[9px] text-amber-300/80 mt-1 leading-normal font-sans">
                          (الشركة: {comp.toLocaleString()} | التحصيل: {coll.toLocaleString()})
                        </span>
                      );
                    } else if (src === "شركة") {
                      return (
                        <span className="block text-[9px] text-amber-300/80 mt-1 leading-normal font-sans">
                          (الممول: خزنة الشركة)
                        </span>
                      );
                    } else {
                      return (
                        <span className="block text-[9px] text-amber-300/80 mt-1 leading-normal font-sans">
                          (الممول: خزنة التحصيل)
                        </span>
                      );
                    }
                  })()}
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">المتبقي الكلي</span>
                  <span className={`font-mono font-extrabold text-sm ${
                    awExtractClassification(selectedFileContract.notes || "") === "دائن"
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}>{Number(selectedFileContract.remaining).toLocaleString()} ريال</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">
                    {(() => {
                      const c = awExtractCycle(selectedFileContract.notes || "") || "يومي";
                      return c === "يومي" ? "القسط اليومي" :
                             c === "اسبوعي" ? "القسط الأسبوعي" :
                             c === "نصف شهر" ? "القسط نصف الشهري" : "القسط الشهري";
                    })()}
                  </span>
                  <span className="font-mono text-amber-500 font-extrabold text-xs">
                    {Number(selectedFileContract.installment).toLocaleString()} ريال / {(() => {
                      const c = awExtractCycle(selectedFileContract.notes || "") || "يومي";
                      return c === "يومي" ? "يوم" :
                             c === "اسبوعي" ? "أسبوع" :
                             c === "نصف شهر" ? "نصف شهر" : "شهر";
                    })()}
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">تاريخ البدء والانتهاء</span>
                  <span className="font-mono text-white text-[11px] font-bold">{selectedFileContract.start_date} ← {selectedFileContract.end_date || "مستمر"}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">آخر سداد مدفوع</span>
                  <span className="font-mono text-white font-bold text-xs">{activeTiming.lastPaid}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">مبالغ وفترات التأخير</span>
                  <span className="font-bold text-rose-400 text-xs">
                    {activeTiming.overdueDays} {(() => {
                      const c = awExtractCycle(selectedFileContract.notes || "") || "يومي";
                      return c === "يومي" ? "يوم" :
                             c === "اسبوعي" ? "أسبوع" :
                             c === "نصف شهر" ? "نصف شهر" : "شهر";
                    })()} | {activeTiming.overdueAmount.toLocaleString()} ريال
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">المشروع المرتبط</span>
                  <span className="font-bold text-amber-500 text-xs">{selectedFileContract.project || "غير مرتبط بمشروع"}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">مقر العمل والكفيل</span>
                  <span className="font-bold text-white text-[11px] leading-relaxed">
                    مقر: {selectedFileContract.workplace || "لا يوجد"}<br />
                    كفيل: {selectedFileContract.guarantor || "لا يوجد"}
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850 col-span-2">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">ملاحظات وشهادات الفرع</span>
                  <span className="font-bold text-slate-350 text-xs">{awCleanNotes(selectedFileContract.notes || "") || "لا يوجد ملاحظات إدارية"}</span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850 text-center">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">تفريغ الفرع</span>
                  <span className="inline-block px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-extrabold text-xs">
                    {awExtractRegion(selectedFileContract.notes || "") || "غير مصنف"}
                  </span>
                </div>
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850 text-center flex flex-col items-center justify-center">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1">الخزنة النشطة</span>
                  <select
                    value={awExtractTreasury(selectedFileContract.notes || "") || "خزنة التحصيل"}
                    onChange={async (e) => {
                      const newTreasury = e.target.value;
                      const activeRegion = awExtractRegion(selectedFileContract.notes || "") || "";
                      const activeCap = awExtractCapital(selectedFileContract.notes || "");
                      const activeCapSource = awExtractCapitalSource(selectedFileContract.notes || "");
                      const activeCapCompany = awExtractCapitalCompany(selectedFileContract.notes || "");
                      const activeCapCollection = awExtractCapitalCollection(selectedFileContract.notes || "");
                      const row = {
                        client: selectedFileContract.client,
                        identity: selectedFileContract.identity,
                        nationality: selectedFileContract.nationality || "",
                        phone: selectedFileContract.phone,
                        no: selectedFileContract.no,
                        amount: Number(selectedFileContract.amount || 0),
                        paid: Number(selectedFileContract.paid || 0),
                        remaining: Number(selectedFileContract.remaining || 0),
                        type: "daily",
                        start_date: selectedFileContract.start_date,
                        end_date: selectedFileContract.end_date,
                        periods: Number(selectedFileContract.periods || 0),
                        installment: Number(selectedFileContract.installment || 0),
                        discount: Number(selectedFileContract.discount || 0),
                        after_discount: Number(selectedFileContract.after_discount || 0),
                        project: selectedFileContract.project,
                        workplace: selectedFileContract.workplace,
                        guarantor: selectedFileContract.guarantor,
                        status: selectedFileContract.status,
                        notes: awCleanNotes(selectedFileContract.notes || ""),
                        region_input: activeRegion,
                        treasury_input: newTreasury,
                        capital_input: activeCap,
                        capital_source_input: activeCapSource,
                        capital_company_input: activeCapCompany,
                        capital_collection_input: activeCapCollection
                      };
                      await onSaveInstallment(row, selectedFileContract.id);
                    }}
                    className="mt-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-extrabold text-xs rounded-xl px-2.5 py-1.5 text-center focus:outline-none cursor-pointer max-w-full transition-colors"
                  >
                    {dynamicTreasuries.map((tName) => (
                      <option key={tName} value={tName} className="bg-slate-950 text-white">💰 {tName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Related collections receipts section */}
              <div className="space-y-3">
                <h5 className="text-sm font-black text-slate-300 border-b border-slate-850 pb-2">💰 سندات المقبوضات المسجلة للعقد</h5>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400">
                        <th className="py-2.5 px-3 font-bold">رقم السند</th>
                        <th className="py-2.5 px-3 font-bold">تاريخ الدفعة</th>
                        <th className="py-2.5 px-3 font-bold">البيان</th>
                        <th className="py-2.5 px-3 font-bold">المستلم من</th>
                        <th className="py-2.5 px-3 font-bold">طريقة الدفع</th>
                        <th className="py-2.5 px-3 font-bold">المبلغ المدفوع</th>
                        <th className="py-2.5 px-3 font-bold">المتبقي الكلي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/30">
                      {activeReceipts.length > 0 ? (
                        activeReceipts.map((rec, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-800/10">
                            <td className="py-2 px-3 font-mono text-slate-300 font-bold">{rec.no}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{rec.date}</td>
                            <td className="py-2 px-3 text-slate-300">
                              {rec.notes || (() => {
                                const contract = installments.find(inst => inst.id === rec.installment_id || inst.no === rec.contract_no);
                                const c = contract ? (awExtractCycle(contract.notes || "") || "يومي") : "يومي";
                                return "قبض دفعة قسط " + (c === "يومي" ? "يومي" : c === "اسبوعي" ? "أسبوعي" : c === "نصف شهر" ? "نصف شهري" : "شهري");
                              })()}
                            </td>
                            <td className="py-2 px-3 font-bold">{rec.from_name}</td>
                            <td className="py-2 px-3 text-slate-400">{rec.method}</td>
                            <td className="py-2 px-3 font-black text-emerald-400 font-mono">+{Number(rec.amount || 0).toLocaleString()} ريال</td>
                            <td className="py-2 px-3 font-black text-slate-300 font-mono">{Number(rec.remaining_after || 0).toLocaleString()} ريال</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500 font-bold">
                            لا توجد أي سندات مقبوضات على العقد الحالي حالياً.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ترحيل العقد بين الشركات */}
              {((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && companies && companies.length > 1 && (
                <div className="border border-blue-500/20 bg-blue-500/5 p-5 rounded-2xl space-y-3.5 mt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h5 className="text-sm font-black text-blue-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      <span>نقل العقد والمستندات إلى شركة أخرى</span>
                    </h5>
                    <span className="text-[10px] font-bold text-slate-400">
                      الشركة الحالية: <strong className="text-blue-300">{companies.find(c => c.id === selectedFileContract.company_id)?.name || "غير محدد"}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-300 leading-relaxed font-sans">
                    سيؤدي هذا الإجراء لترحيل بطاقة العقد بكافة الأقساط والسجل، بالإضافة لنقل جميع سندات المقبوضات والدفعات المرتبطة، وكافة المصروفات المسجلة تحت مشروع العقد الحالي إلى حسابات الشركة المستهدفة بشكل فوري وتحديث المركز المالي للشركتين.
                  </p>
                  
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const c = selectedFileContract;
                        setMigrateCompanyContract(c);
                        const otherComp = companies.find(comp => comp.id !== c.company_id);
                        setTargetMigrateCompanyId(otherComp ? otherComp.id : "");
                        setMigrateCompanyReason("");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/15 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>فتح نافذة نقل العقد لشركة أخرى</span>
                    </button>
                  </div>
                </div>
              )}

              {/* نقل وسدادات العقد إلى عقد آخر */}
              {onTransferContractAndPayments && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
                <div className="border border-blue-500/20 bg-blue-500/5 p-5 rounded-2xl space-y-3.5 mt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-black text-blue-300 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                      <span>نقل العقد وسداداته إلى عقد آخر</span>
                    </h5>
                    <span className="text-[10px] font-bold text-slate-400">
                      سندات مرتبطة: <strong className="text-amber-400">{activeReceipts.length} سند</strong>
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-300 leading-relaxed font-sans">
                    يتيح لك هذا الخيار نقل كافة سندات القبض والدفعات المسجلة تحت هذا العقد إلى أي عقد آخر مسجل في النظام، مع إمكانية دمج المديونية وتحديث الأرصدة المالية لكلا العقدين فورياً وبشكل موثق رقابياً.
                  </p>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const c = selectedFileContract;
                        setTransferSourceContract(c);
                        setTransferTargetId("");
                        setTransferReason("");
                        setTransferSearchQuery("");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/15 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>فتح نافذة نقل وسدادات العقد</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 shrink-0 flex justify-end gap-3 z-10 flex-wrap">
              {(currentUser?.role === "admin" || finalPerms?.installmentsDelete) && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteInstallment(selectedFileContract.id);
                    setSelectedFileContract(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1 shadow transition-all mr-auto cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف العقد
                </button>
              )}

              {onTransferContractAndPayments && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedFileContract;
                    setTransferSourceContract(c);
                    setTransferTargetId("");
                    setTransferReason("");
                    setTransferSearchQuery("");
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="نقل العقد وسداداته إلى أي عقد يتم اختياره"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>نقل وسدادات العقد</span>
                </button>
              )}

              {onMigrateInstallment && ((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (companies && companies.length > 1) && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedFileContract;
                    setMigrateCompanyContract(c);
                    const otherComp = companies.find(comp => comp.id !== c.company_id);
                    setTargetMigrateCompanyId(otherComp ? otherComp.id : "");
                    setMigrateCompanyReason("");
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="نقل العقد بكافة سنداته ومصروفاته إلى شركة أخرى"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>نقل لشركة أخرى</span>
                </button>
              )}
              
              {((finalPerms?.installmentsAdd) || currentUser?.role === "admin") && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedFileContract;
                    openRenewModal(c);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="تجديد هذا العقد أو تمديد فترته"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  تجديد العقد
                </button>
              )}

              {onCreateReceiptForContract && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedFileContract;
                    setSelectedFileContract(null);
                    onCreateReceiptForContract(c);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="تحرير سند قبض جديد لهذا العقد"
                >
                  <span>💰</span>
                  تحرير سند قبض للعقد
                </button>
              )}

              {((finalPerms?.installmentsEdit) || currentUser?.role === "admin") && (
                <button
                  type="button"
                  onClick={() => {
                    handleEdit(selectedFileContract);
                    setSelectedFileContract(null);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl flex items-center gap-1 shadow transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  تعديل الملف
                </button>
              )}

              <button
                type="button"
                onClick={() => handleExportSingleContractExcel(selectedFileContract)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                title="تصدير وتنزيل ملف إكسل (CSV) كامل لبيانات العقد وسجل الدفعات والصرفيات"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تنزيل إكسل (Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportClientStatementPDF(selectedFileContract)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                title="تصدير كشف حساب العميل PDF يحتوي على كامل سجل سندات القبض والصرف"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>كشف حساب العميل (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintContract(selectedFileContract.id)}
                className="px-5 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 font-black text-xs rounded-xl flex items-center gap-1 shadow transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة العقد
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedFileContract(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-white font-black text-xs rounded-xl"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Dialog before saving contract */}
      {showConfirmModal && pendingContractRow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                  📝
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black text-white">
                    تأكيد مراجعة وحفظ العقد
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    يرجى مراجعة كافة التفاصيل المالية والإدارية المدخلة قبل الحفظ النهائي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingContractRow(null);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-right font-sans">
              
              {/* Highlight Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                    {editId ? "تعديل عقد قائم" : "إنشاء عقد جديد"}
                  </span>
                  <div className="text-lg font-black text-white">
                    {pendingContractRow.client}
                  </div>
                  <div className="text-xs text-slate-400 font-bold mt-0.5">
                    رقم العقد: <span className="font-mono text-amber-300 font-bold">{pendingContractRow.no}</span>
                  </div>
                </div>

                <div className="text-right sm:text-left bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
                  <div className="text-[10px] text-slate-400 font-bold">اتجاه المعاملة</div>
                  <div className="text-xs font-black text-emerald-400">
                    {pendingContractRow.contract_direction_input === "علينا"
                      ? "🔴 علينا (مصروف / استحقاق)"
                      : pendingContractRow.contract_direction_input === "مصروفات عمالة"
                      ? "💼 مصروفات عمالة"
                      : "🟢 لنا (إيراد / تحصيل من عميل)"}
                  </div>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">رقم الهوية / الإقامة</span>
                  <span className="text-xs font-black text-white">{pendingContractRow.identity || "غير مدخل"}</span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">رقم الجوال</span>
                  <span className="text-xs font-black text-white" dir="ltr">{pendingContractRow.phone || "غير مدخل"}</span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">إجمالي مبلغ العقد</span>
                  <span className="text-sm font-black text-amber-400">
                    {Number(pendingContractRow.amount || 0).toLocaleString("ar-SA")} ريال
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">الدفعة المدفوعة مقدماً</span>
                  <span className="text-sm font-black text-emerald-400">
                    {Number(pendingContractRow.paid || 0).toLocaleString("ar-SA")} ريال
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">المبلغ المتبقي</span>
                  <span className="text-sm font-black text-rose-400">
                    {Number(pendingContractRow.remaining || 0).toLocaleString("ar-SA")} ريال
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">دورية السداد والقسط</span>
                  <span className="text-xs font-black text-cyan-300">
                    {pendingContractRow.cycle_input || "يومي"}
                    {pendingContractRow.installment ? ` — ${Number(pendingContractRow.installment).toLocaleString("ar-SA")} ريال` : ""}
                    {pendingContractRow.periods ? ` (${pendingContractRow.periods} فترة)` : ""}
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">الخزنة والمنطقة</span>
                  <span className="text-xs font-black text-white">
                    🏦 {pendingContractRow.treasury_input || "خزنة التحصيل"}
                    {pendingContractRow.region_input ? ` (${pendingContractRow.region_input})` : ""}
                  </span>
                </div>

                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 block">المشروع المرتبط</span>
                  <span className="text-xs font-black text-white">
                    🏗️ {pendingContractRow.project || "غير مرتبط بمشروع"}
                  </span>
                </div>

                {Number(pendingContractRow.capital_input || 0) > 0 && (
                  <div className="sm:col-span-2 bg-amber-950/20 border border-amber-500/20 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-400 block">تمويل رأس المال المبدئي (تأسيس العقد)</span>
                    <span className="text-xs font-black text-amber-200">
                      💰 {Number(pendingContractRow.capital_input).toLocaleString("ar-SA")} ريال — المصدر: {pendingContractRow.capital_source_input}
                    </span>
                  </div>
                )}

                {pendingContractRow.notes && (
                  <div className="sm:col-span-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <span className="text-[10px] font-bold text-slate-400 block">ملاحظات العقد</span>
                    <span className="text-xs font-semibold text-slate-300">{pendingContractRow.notes}</span>
                  </div>
                )}

              </div>

              {/* Caution alert */}
              <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                <span>عند الضغط على "تأكيد وحفظ العقد"، سيتم حفظ بيانات العقد وتحديث السجلات والقيود المالية المرتبطة تلقائياً.</span>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingContractRow(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                تعديل البيانات
              </button>

              <button
                type="button"
                disabled={isSavingContract}
                onClick={handleConfirmSave}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingContract ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    تأكيد وحفظ العقد النهائي
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dedicated Contract Renewal Modal */}
      {renewTarget && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Renewal Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black text-lg">
                  <RotateCw className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    تجديد وتمديد العقد — {renewTarget.client}
                  </h3>
                  <p className="text-xs text-cyan-300/80 font-bold">
                    إنشاء دورة تجديد جديدة أو تمديد فترة العقد السابق رقم (<span className="font-mono text-white">{renewTarget.no}</span>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewTarget(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Renewal Modal Body */}
            <form onSubmit={handleExecuteRenewal} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-6 text-right">
                
                {/* Old Contract Snapshot Card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <span className="text-xs font-black text-slate-300">📋 بيانات العقد السابق المراد تجديده</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      الحالة: {renewTarget.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400">رقم العقد:</span>
                      <span className="font-mono text-white font-black">{renewTarget.no}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400">إجمالي المبلغ:</span>
                      <span className="font-mono text-amber-400 font-bold">{Number(renewTarget.amount || 0).toLocaleString()} ريال</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400">المحصل سابقاً:</span>
                      <span className="font-mono text-emerald-400 font-bold">{Number(renewTarget.paid || 0).toLocaleString()} ريال</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400">المتبقي السابق:</span>
                      <span className="font-mono text-rose-400 font-black">{Number(renewTarget.remaining || 0).toLocaleString()} ريال</span>
                    </div>
                  </div>
                </div>

                {/* Renewal Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-300">اختر آلية التجديد المطلوبة:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRenewMode("new_contract")}
                      className={`p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                        renewMode === "new_contract"
                          ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <span className={`p-2 rounded-xl text-sm ${renewMode === "new_contract" ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                        📄
                      </span>
                      <div>
                        <span className="block font-black text-xs">إنشاء عقد جديد مرتبط (موصى به)</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          توليد عقد مستقل برقم جديد مع ربطه بالعقد السابق وسجلاته المحاسبية
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRenewMode("extend_contract")}
                      className={`p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                        renewMode === "extend_contract"
                          ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <span className={`p-2 rounded-xl text-sm ${renewMode === "extend_contract" ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                        ⏱️
                      </span>
                      <div>
                        <span className="block font-black text-xs">تمديد فترة وسداد نفس العقد</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          تحديث تاريخ الانتهاء وزيادة عدد الأقساط والقيمة لنفس العقد الحالي
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Form Fields for Renewal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {renewMode === "new_contract" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-slate-300">رقم العقد الجديد (تلقائي)</label>
                      <input
                        type="text"
                        value={renewNewContractNo}
                        onChange={(e) => setRenewNewContractNo(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-cyan-500/40 rounded-xl text-xs font-mono font-bold text-cyan-300 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-300">تاريخ بدء التجديد</label>
                    <input
                      type="date"
                      value={renewStartDate}
                      onChange={(e) => setRenewStartDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-300">دورية السداد</label>
                    <select
                      value={renewCycle}
                      onChange={(e) => setRenewCycle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="يومي">يومي</option>
                      <option value="اسبوعي">أسبوعي</option>
                      <option value="نصف شهر">نصف شهري (كل 15 يوم)</option>
                      <option value="شهري">شهري</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-300">
                      {renewMode === "new_contract" ? "عدد فترات/أقساط العقد الجديد" : "إضافة فترات/أقساط إضافية"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={renewPeriods}
                      onChange={(e) => setRenewPeriods(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-300">
                      {renewMode === "new_contract" ? "قيمة العقد الجديد الأساسية (ريال)" : "قيمة التمديد الإضافية (ريال)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={renewAmount}
                      onChange={(e) => setRenewAmount(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-black text-amber-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {renewMode === "new_contract" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-slate-300">الدفعة المقدمة المدفوعة فوراً (ريال)</label>
                      <input
                        type="number"
                        min={0}
                        value={renewDownPayment}
                        onChange={(e) => setRenewDownPayment(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-black text-emerald-400 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}
                </div>

                {/* Balance Adjustment & Migration Options (Add to new contract or deduct from new contract) */}
                <div className="space-y-3 p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span>معالجة رصيد العقد السابق (إضافة أو خصم):</span>
                    </label>
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      متبقي العقد السابق: {Number(renewTarget.remaining || 0).toLocaleString()} ريال
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Option 1: No adjustment */}
                    <button
                      type="button"
                      onClick={() => setRenewBalanceAction("none")}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        renewBalanceAction === "none"
                          ? "bg-slate-800 border-cyan-500 text-white font-bold"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${renewBalanceAction === "none" ? "border-cyan-400 bg-cyan-400" : "border-slate-600"}`}>
                          {renewBalanceAction === "none" && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
                        </span>
                        <span className="text-xs font-black">بدون تسوية رصيد</span>
                      </div>
                      <span className="block text-[10px] text-slate-500 mt-1 mr-5">بدء العقد الجديد بالقيمة المدخلة فقط</span>
                    </button>

                    {/* Option 2: Add remaining to new contract */}
                    <button
                      type="button"
                      onClick={() => setRenewBalanceAction("add_remaining")}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        renewBalanceAction === "add_remaining"
                          ? "bg-amber-950/40 border-amber-500 text-amber-200 font-bold shadow-md shadow-amber-950/40"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${renewBalanceAction === "add_remaining" ? "border-amber-400 bg-amber-400" : "border-slate-600"}`}>
                          {renewBalanceAction === "add_remaining" && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
                        </span>
                        <span className="text-xs font-black text-amber-300">➕ إضافة للعقد الجديد</span>
                      </div>
                      <span className="block text-[10px] text-amber-400/80 mt-1 mr-5">
                        إضافة +{Number(renewTarget.remaining || 0).toLocaleString()} ريال لإجمالي العقد
                      </span>
                    </button>

                    {/* Option 3: Deduct remaining from new contract */}
                    <button
                      type="button"
                      onClick={() => setRenewBalanceAction("deduct_remaining")}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        renewBalanceAction === "deduct_remaining"
                          ? "bg-rose-950/40 border-rose-500 text-rose-200 font-bold shadow-md shadow-rose-950/40"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${renewBalanceAction === "deduct_remaining" ? "border-rose-400 bg-rose-400" : "border-slate-600"}`}>
                          {renewBalanceAction === "deduct_remaining" && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
                        </span>
                        <span className="text-xs font-black text-rose-300">➖ خصم من العقد الجديد</span>
                      </div>
                      <span className="block text-[10px] text-rose-400/80 mt-1 mr-5">
                        خصم -{Number(renewTarget.remaining || 0).toLocaleString()} ريال من قيمة العقد
                      </span>
                    </button>
                  </div>

                  {/* Custom discount / extra discount row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-850/60">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-slate-300">خصم إضافي / تخفيض تسوية (ريال)</label>
                      <input
                        type="number"
                        min={0}
                        value={renewDiscount}
                        onChange={(e) => setRenewDiscount(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-rose-400 focus:outline-none focus:border-cyan-500"
                        placeholder="0"
                      />
                    </div>

                    {renewMode === "new_contract" && (
                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={renewCloseOld}
                            onChange={(e) => setRenewCloseOld(e.target.checked)}
                            className="w-4 h-4 rounded text-cyan-500 focus:ring-0 focus:outline-none cursor-pointer"
                          />
                          <span>إغلاق العقد القديم وتعيينه (<span className="text-emerald-400">مكتمل</span>)</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-300">ملاحظات التجديد</label>
                  <input
                    type="text"
                    value={renewNotes}
                    onChange={(e) => setRenewNotes(e.target.value)}
                    placeholder="ملاحظات توثيق التجديد..."
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Computed Renewal Financial Summary */}
                {(() => {
                  const periodsNum = Number(renewPeriods || 0);
                  const baseAmount = Number(renewAmount || 0);
                  const oldRemaining = Number(renewTarget.remaining || 0);

                  let balanceAdjustment = 0;
                  if (renewBalanceAction === "add_remaining") {
                    balanceAdjustment = oldRemaining;
                  } else if (renewBalanceAction === "deduct_remaining") {
                    balanceAdjustment = -oldRemaining;
                  }

                  const totalAmount = Math.max(0, baseAmount + (balanceAdjustment > 0 ? balanceAdjustment : 0));
                  const downPaymentNum = Number(renewDownPayment || 0);
                  const discountNum = Number(renewDiscount || 0) + (balanceAdjustment < 0 ? Math.abs(balanceAdjustment) : 0);
                  const finalRemaining = Math.max(0, totalAmount - downPaymentNum - discountNum);
                  const installmentVal = periodsNum > 0 ? Math.ceil(finalRemaining / periodsNum) : 0;

                  let calcEndDate = "";
                  if (periodsNum > 0 && renewStartDate) {
                    const d = new Date(renewStartDate);
                    if (renewCycle === "اسبوعي") {
                      d.setDate(d.getDate() + (periodsNum * 7) - 1);
                    } else if (renewCycle === "نصف شهر") {
                      d.setDate(d.getDate() + (periodsNum * 15) - 1);
                    } else if (renewCycle === "شهري") {
                      d.setMonth(d.getMonth() + periodsNum);
                      d.setDate(d.getDate() - 1);
                    } else {
                      d.setDate(d.getDate() + periodsNum - 1);
                    }
                    calcEndDate = d.toISOString().slice(0, 10);
                  }

                  return (
                    <div className="p-4 bg-gradient-to-br from-cyan-950/30 to-slate-950 border border-cyan-500/30 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-[10px] font-black text-cyan-400 uppercase">
                          📊 المعاينة المالية للتجديد:
                        </span>
                        {renewBalanceAction === "add_remaining" && (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                            ➕ تم إضافة متبقي سابق (+{oldRemaining.toLocaleString()} ر.س)
                          </span>
                        )}
                        {renewBalanceAction === "deduct_remaining" && (
                          <span className="text-[10px] font-black text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                            ➖ تم خصم متبقي سابق (-{oldRemaining.toLocaleString()} ر.س)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="block text-[10px] text-slate-400">إجمالي المبلغ:</span>
                          <span className="font-mono text-amber-400 font-black">{totalAmount.toLocaleString()} ريال</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="block text-[10px] text-slate-400">المتبقي للتحصيل:</span>
                          <span className="font-mono text-rose-400 font-black">{finalRemaining.toLocaleString()} ريال</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="block text-[10px] text-slate-400">قيمة القسط ({renewCycle}):</span>
                          <span className="font-mono text-emerald-400 font-black">{installmentVal.toLocaleString()} ريال</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="block text-[10px] text-slate-400">تاريخ الانتهاء المتوقع:</span>
                          <span className="font-mono text-cyan-300 font-bold">{calcEndDate || "غير محدد"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Renewal Modal Footer Actions */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRenewTarget(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-black text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isRenewing}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRenewing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      جاري تنفيذ التجديد...
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-4 h-4" />
                      تأكيد وحفظ تجديد العقد
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Contract & Payments Transfer Modal */}
      {transferSourceContract && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="sticky top-0 bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <span>نقل العقد وسداداته إلى عقد آخر</span>
                    <span className="text-[11px] font-mono text-amber-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                      {transferSourceContract.no}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    نقل كافة سندات القبض والدفعات من العقد الحالي إلى أي عقد مستهدف مع إعادة احتساب المركز المالي فوراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferSourceContract(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleExecuteTransfer} className="p-6 space-y-6 flex-1">
              
              {/* Source Contract Summary Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <span>📤</span> بيانات العقد المصدر (المُراد نقله):
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    العميل: <strong className="text-white">{transferSourceContract.client}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 mb-0.5">قيمة العقد الكلية:</span>
                    <span className="font-mono text-white font-black">{Number(transferSourceContract.amount || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 mb-0.5">المدفوع الحالي:</span>
                    <span className="font-mono text-emerald-400 font-black">{Number(transferSourceContract.paid || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 mb-0.5">المتبقي المطلوب:</span>
                    <span className="font-mono text-rose-400 font-black">{Number(transferSourceContract.remaining || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <span className="block text-[10px] text-amber-300 mb-0.5">السندات المرتبطة للنقل:</span>
                    <span className="font-mono text-amber-400 font-black">
                      {sourceReceiptsList.length} سند ({sourceReceiptsSum.toLocaleString()} ريال)
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Contract Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>🎯</span> اختر العقد المستهدف (المحوّل إليه السدادات):
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (اختر من قائمة العقود المسجلة)
                  </span>
                </label>

                {/* Search filter for targets */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={transferSearchQuery}
                    onChange={(e) => setTransferSearchQuery(e.target.value)}
                    placeholder="ابحث برقم العقد، اسم العميل، رقم الهاتف أو الهوية..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Target contract select dropdown / list */}
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  size={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer scrollbar-thin divide-y divide-slate-850"
                  required
                >
                  {getAvailableTransferTargets().length > 0 ? (
                    getAvailableTransferTargets().map((tgt) => {
                      const tgtCompany = companies?.find(c => c.id === tgt.company_id)?.name || "";
                      return (
                        <option
                          key={tgt.id}
                          value={tgt.id}
                          className="p-2.5 hover:bg-slate-900 rounded-lg cursor-pointer text-white font-bold my-0.5 flex justify-between"
                        >
                          {tgt.no} — {tgt.client} | القيمة: {Number(tgt.amount || 0).toLocaleString()} ر.س | المتبقي: {Number(tgt.remaining || 0).toLocaleString()} ر.س {tgtCompany ? `(${tgtCompany})` : ""}
                        </option>
                      );
                    })
                  ) : (
                    <option disabled value="" className="p-3 text-center text-slate-500">
                      لا توجد عقود مطابقة لشروط البحث
                    </option>
                  )}
                </select>
              </div>

              {/* Target Contract Live Preview & Simulation */}
              {(() => {
                const target = installments.find(i => i.id === transferTargetId);
                if (!target) return null;

                const targetCurrentPaid = Number(target.paid || 0);
                const targetCurrentAmount = Number(target.amount || 0);
                const targetCurrentRemaining = Number(target.remaining || 0);
                const targetNewPaid = targetCurrentPaid + sourceReceiptsSum;
                const sourceRemaining = Number(transferSourceContract.remaining || 0);
                const targetNewAmount = targetCurrentAmount + (transferDebtTogether ? sourceRemaining : 0);
                const targetNewRemaining = Math.max(0, targetNewAmount - targetNewPaid);

                return (
                  <div className="bg-gradient-to-br from-blue-950/40 to-slate-950 border border-blue-500/30 rounded-2xl p-4.5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                      <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                        <span>📥</span> معاينة العقد المستهدف بعد استلام السدادات:
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        [{target.no} - {target.client}]
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="block text-[10px] text-slate-400 mb-0.5">القيمة الإجمالية الجديدة:</span>
                        <span className="font-mono text-white font-black">{targetNewAmount.toLocaleString()} ريال</span>
                        {transferDebtTogether && sourceRemaining > 0 && (
                          <span className="block text-[9px] text-amber-300 mt-0.5">+{sourceRemaining.toLocaleString()} دمج مديونية</span>
                        )}
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="block text-[10px] text-slate-400 mb-0.5">المدفوع الجديد:</span>
                        <span className="font-mono text-emerald-400 font-black">{targetNewPaid.toLocaleString()} ريال</span>
                        <span className="block text-[9px] text-emerald-300 mt-0.5">+{sourceReceiptsSum.toLocaleString()} سندات منقولة</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="block text-[10px] text-slate-400 mb-0.5">المتبقي المطلوب الجديد:</span>
                        <span className="font-mono text-cyan-300 font-black">{targetNewRemaining.toLocaleString()} ريال</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">السابق: {targetCurrentRemaining.toLocaleString()} ريال</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="block text-[10px] text-slate-400 mb-0.5">حالة العقد المتوقعة:</span>
                        <span className={`text-xs font-black ${targetNewRemaining <= 0 ? "text-emerald-400" : "text-blue-300"}`}>
                          {targetNewRemaining <= 0 ? "✅ مكتمل ومسدد بالكامل" : "⚡ جاري / منتظم"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Execution Options */}
              <div className="space-y-4 pt-1 border-t border-slate-850">
                <span className="block text-xs font-black text-slate-300">⚙️ خيارات المعالجة والإجراء على العقد المصدر:</span>

                <div className="space-y-2.5">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                    transferAction === "close_as_transferred" ? "bg-amber-500/10 border-amber-500/40 text-white" : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="transfer_action"
                      checked={transferAction === "close_as_transferred"}
                      onChange={() => setTransferAction("close_as_transferred")}
                      className="mt-1 accent-amber-500 cursor-pointer"
                    />
                    <div>
                      <strong className="block text-xs text-amber-300">إغلاق وتصفير العقد المصدر كعقد مدمج ومنقول (موصى به)</strong>
                      <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        يتم تحويل حالة العقد المصدر إلى "مكتمل" وتصفير المتبقي مع توثيق عملية النقل في الأرشيف لضمان السلامة الرقابية.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                    transferAction === "delete_source" ? "bg-rose-500/10 border-rose-500/40 text-white" : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="transfer_action"
                      checked={transferAction === "delete_source"}
                      onChange={() => setTransferAction("delete_source")}
                      className="mt-1 accent-rose-500 cursor-pointer"
                    />
                    <div>
                      <strong className="block text-xs text-rose-300">حذف العقد المصدر نهائياً من النظام بعد ترحيل كافة السندات</strong>
                      <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        يتم ترحيل جميع السندات والدفعات أولاً ثم حذف بطاقة العقد المصدر بالكامل من قاعدة البيانات.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                    transferAction === "keep_and_recalc" ? "bg-blue-500/10 border-blue-500/40 text-white" : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}>
                    <input
                      type="radio"
                      name="transfer_action"
                      checked={transferAction === "keep_and_recalc"}
                      onChange={() => setTransferAction("keep_and_recalc")}
                      className="mt-1 accent-blue-500 cursor-pointer"
                    />
                    <div>
                      <strong className="block text-xs text-blue-300">إبقاء العقد المصدر نشطاً مع إعادة احتساب رصيده المتبقي</strong>
                      <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        يتم نقل السندات فقط إلى العقد المستهدف، وإعادة احتساب رصيد العقد المصدر وفق السندات المتبقية لديه.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Transfer Files & Notes Option */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-amber-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={transferFilesAndNotes}
                    onChange={(e) => setTransferFilesAndNotes(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="text-white font-bold">📁 نقل ودمج ملفات ومرفقات وبيانات العقد: </span>
                    <span className="text-amber-300">ترحيل الملاحظات، الكفيل، مقر العمل، والبيانات التعريفية للعقد المستهدف.</span>
                  </div>
                </label>

                {/* Transfer Debt Option */}
                {Number(transferSourceContract.remaining || 0) > 0 && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-amber-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={transferDebtTogether}
                      onChange={(e) => setTransferDebtTogether(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="text-white font-bold">دمج المديونية المتبقية: </span>
                      <span className="text-amber-300 font-mono font-bold">
                        إضافة مبلغ ({Number(transferSourceContract.remaining || 0).toLocaleString()} ريال)
                      </span>
                      <span className="text-slate-400"> إلى إجمالي قيمة العقد المستهدف.</span>
                    </div>
                  </label>
                )}

                {/* Reason Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    السبب أو البيان لعملية النقل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="مثال: دمج ملفات العميل وسداداته، تسوية تعاقدية..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 -mx-6 -mb-6 flex items-center justify-end gap-3 rounded-b-3xl shrink-0">
                <button
                  type="button"
                  onClick={() => setTransferSourceContract(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-black text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isTransferring || !transferTargetId}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isTransferring ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>جاري تنفيذ النقل وتحديث القيود...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>تأكيد وتنفيذ نقل العقد والسدادات</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Migrate Contract to another Company Modal */}
      {migrateCompanyContract && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <span>نقل وترحيل العقد إلى شركة أخرى</span>
                  </h4>
                  <p className="text-xs text-blue-300/80 font-bold">
                    عقد رقم ({migrateCompanyContract.no || "بدون رقم"}) — العميل: {migrateCompanyContract.client}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMigrateCompanyContract(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleExecuteCompanyMigration} className="space-y-4 pt-4 overflow-y-auto pr-1">
              
              {/* Contract Summary Box */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs border-b border-slate-850 pb-2">
                  <span className="text-slate-400 font-bold">الشركة الحالية للعقد:</span>
                  <span className="text-blue-400 font-black bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                    🏢 {companies?.find(c => c.id === migrateCompanyContract.company_id)?.name || "غير محدد"}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">قيمة العقد</span>
                    <span className="text-white font-mono font-black">{Number(migrateCompanyContract.amount || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-emerald-400 block font-bold">المدفوع</span>
                    <span className="text-emerald-400 font-mono font-black">{Number(migrateCompanyContract.paid || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-rose-400 block font-bold">المتبقي</span>
                    <span className="text-rose-400 font-mono font-black">{Number(migrateCompanyContract.remaining || 0).toLocaleString()} ريال</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-850">
                  <span>سندات القبض والدفعات المُرتبطة:</span>
                  <strong className="text-amber-400 font-bold">
                    {migrateReceiptsList.length} سند ({migrateReceiptsSum.toLocaleString()} ريال)
                  </strong>
                </div>
              </div>

              {/* Target Company Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  اختر الشركة المستهدفة لنقل العقد إليها <span className="text-rose-400">*</span>
                </label>
                <select
                  value={targetMigrateCompanyId}
                  onChange={(e) => setTargetMigrateCompanyId(e.target.value)}
                  className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-3.5 py-3 text-xs text-white font-black focus:outline-none focus:border-blue-400 cursor-pointer shadow-inner"
                  required
                >
                  <option value="" disabled className="text-slate-500">
                    -- اضغط لاختيار الشركة المستهدفة --
                  </option>
                  {companies
                    ?.filter((c) => c.id !== migrateCompanyContract.company_id)
                    .map((comp) => (
                      <option key={comp.id} value={comp.id} className="text-white font-bold py-1">
                        🏢 {comp.name} {comp.code ? `(${comp.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              {/* Auto Transfer Details Card */}
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-3.5 space-y-2 text-xs">
                <h6 className="font-black text-blue-300 flex items-center gap-1.5 text-xs">
                  <span>⚡</span>
                  <span>ما الذي يتم نقله وترحيله آلياً؟</span>
                </h6>
                <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
                  <li>ترحيل بطاقة العقد بالكامل وبيانات الأقساط إلى الشركة المختارة.</li>
                  <li>نقل جميع سندات القبض والدفعات المسجلة تحت هذا العقد للشركة الجديدة.</li>
                  <li>نقل المصروفات المسجلة تحت مشروع هذا العقد.</li>
                  <li>تحديث المركز المالي وميزانية الشركتين فورياً وبشكل موثق رقابياً.</li>
                </ul>
              </div>

              {/* Reason Input (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  السبب أو الملاحظة لنقل العقد (اختياري)
                </label>
                <input
                  type="text"
                  value={migrateCompanyReason}
                  onChange={(e) => setMigrateCompanyReason(e.target.value)}
                  placeholder="مثال: إعادة هيكلة المحافظ، نقل حساب العميل للفرع الآخر..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 -mx-6 -mb-6 flex items-center justify-end gap-3 rounded-b-3xl shrink-0">
                <button
                  type="button"
                  onClick={() => setMigrateCompanyContract(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-black text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isMigratingCompany || !targetMigrateCompanyId}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isMigratingCompany ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>جاري نقل العقد وسنداته للشركة الجديدة...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>تأكيد نقل العقد للشركة الجديدة</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
