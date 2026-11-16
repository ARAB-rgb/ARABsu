import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../db";
import { Company, CompanyFile, CompanyMessage, User as AuthUser } from "../types";
import {
  CheckCheck,
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  Reply,
  Search,
  Send,
  Trash2,
  UploadCloud,
  Users,
  X,
  ArrowRight,
  Building2,
} from "lucide-react";

interface InternalMessagingProps {
  currentUser: AuthUser;
  users: AuthUser[];
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany?: (companyId: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  isSuperAdmin?: boolean;
  onOpenExcelFile?: (file: { name: string; dataUrl: string }) => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DIRECT_DATA_LIMIT = 520_000; // ~520 KB fits safely inside 1 Firestore document (< 1 MB)
const CHUNK_CHAR_SIZE = 500_000;

const FOLDERS = ["مستندات عامة", "عقود واتفاقيات", "فواتير وسندات", "مرفقات المراسلات"] as const;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMsgTime(ms: number): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateLabel(ms: number): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getRoleArabicLabel(u: AuthUser): string {
  if (u.account_type === "individual") return "حساب شخصي";
  if (u.role === "admin") {
    return u.entity_type === "مؤسسة" ? "المدير العام للمؤسسة" : "المدير العام للشركة";
  }
  if (u.role === "supervisor") return "مشرف";
  if (u.role === "cashier") return "كاشير / أمين صندوق";
  return "موظف";
}

function getDmChannelId(companyId: string, uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  return `dm_${companyId}_${sorted[0]}_${sorted[1]}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف المحدد"));
    reader.readAsDataURL(file);
  });
}

function createImageThumbnail(dataUrl: string, maxDim = 640, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve("");
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

export const InternalMessaging: React.FC<InternalMessagingProps> = ({
  currentUser,
  users,
  companies,
  selectedCompanyId,
  onSelectCompany,
  showToast,
  isSuperAdmin = false,
  onOpenExcelFile,
}) => {
  // Determine strictly isolated active company ID
  const activeCompanyId = useMemo(() => {
    if (selectedCompanyId && selectedCompanyId !== "all") return selectedCompanyId;
    if (currentUser.company_id && currentUser.company_id !== "all" && currentUser.company_id !== "global") {
      return currentUser.company_id;
    }
    return companies[0]?.id || "";
  }, [selectedCompanyId, currentUser.company_id, companies]);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId),
    [companies, activeCompanyId]
  );

  // Colleagues strictly scoped to activeCompanyId ONLY
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

  const generalChannelId = activeCompanyId ? `general_${activeCompanyId}` : "";

  const [viewMode, setViewMode] = useState<"chat" | "vault">("chat");
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [mobileShowThread, setMobileShowThread] = useState<boolean>(false);

  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loadingSync, setLoadingSync] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);

  const [msgText, setMsgText] = useState("");
  const [replyTo, setReplyTo] = useState<CompanyMessage | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // File Vault states
  const [vaultFolderFilter, setVaultFolderFilter] = useState<string>("الكل");
  const [vaultSearch, setVaultSearch] = useState<string>("");
  const [vaultUploadFolder, setVaultUploadFolder] = useState<string>(FOLDERS[0]);
  const [uploadingVaultFile, setUploadingVaultFile] = useState<boolean>(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const vaultFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Read tracking per user & channel stored locally for unread counters
  const readStorageKey = `aw_chat_reads_${currentUser.id}_${activeCompanyId}`;
  const [lastReads, setLastReads] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`aw_chat_reads_${currentUser.id}_${activeCompanyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(readStorageKey);
      setLastReads(raw ? JSON.parse(raw) : {});
    } catch {
      setLastReads({});
    }
  }, [readStorageKey]);

  // Reset active channel when switching company
  useEffect(() => {
    if (generalChannelId) {
      setActiveChannelId(generalChannelId);
      setReplyTo(null);
      setPendingAttachment(null);
    }
  }, [generalChannelId]);

  // Real-time Firestore subscriptions strictly isolated to activeCompanyId
  useEffect(() => {
    if (!activeCompanyId) {
      setMessages([]);
      setFiles([]);
      setLoadingSync(false);
      return;
    }

    setLoadingSync(true);
    setSyncError(null);

    const msgsQuery = query(
      collection(db, "company_messages"),
      where("company_id", "==", activeCompanyId)
    );
    const filesQuery = query(
      collection(db, "company_files"),
      where("company_id", "==", activeCompanyId)
    );

    const unsubMsgs = onSnapshot(
      msgsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as CompanyMessage))
          .filter((m) => m.company_id === activeCompanyId);
        list.sort((a, b) => (a.created_ms || 0) - (b.created_ms || 0));
        setMessages(list);
        setLoadingSync(false);
      },
      (err) => {
        console.error("Messaging sync error:", err);
        setSyncError("تعذر الاتصال بقناة المراسلات الفورية لهذه الشركة.");
        setLoadingSync(false);
        try {
          handleFirestoreError(err, OperationType.LIST, "company_messages");
        } catch {
          // logged cleanly via handleFirestoreError
        }
      }
    );

    const unsubFiles = onSnapshot(
      filesQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as CompanyFile))
          .filter((f) => f.company_id === activeCompanyId);
        list.sort((a, b) => (b.created_ms || 0) - (a.created_ms || 0));
        setFiles(list);
      },
      (err) => {
        console.error("Company files sync error:", err);
        try {
          handleFirestoreError(err, OperationType.LIST, "company_files");
        } catch {
          // logged cleanly via handleFirestoreError
        }
      }
    );

    return () => {
      unsubMsgs();
      unsubFiles();
    };
  }, [activeCompanyId]);

  // Mark active channel as read when messages update
  useEffect(() => {
    if (!activeChannelId || !activeCompanyId || viewMode !== "chat") return;
    const now = Date.now();
    setLastReads((prev) => {
      const updated = { ...prev, [activeChannelId]: now };
      try {
        localStorage.setItem(readStorageKey, JSON.stringify(updated));
      } catch {
        // ignore storage quota
      }
      return updated;
    });
  }, [activeChannelId, messages.length, viewMode, activeCompanyId, readStorageKey]);

  // Auto-scroll to bottom when opening a thread or receiving a message
  useEffect(() => {
    if (viewMode === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChannelId, messages.length, viewMode]);

  // Upload helper: stores small files inline, chunks > 520 KB across company_file_chunks (all tagged with activeCompanyId)
  const storeIsolatedCompanyFile = async (
    file: File,
    folder: string,
    channelId?: string
  ): Promise<{ fileDoc: CompanyFile; previewThumb?: string }> => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`حجم الملف (${formatBytes(file.size)}) يتجاوز الحد المسموح به (5 MB).`);
    }

    const rawDataUrl = await readFileAsDataUrl(file);
    const fileId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const isImg = file.type.startsWith("image/");

    let previewThumb: string | undefined;
    if (isImg) {
      previewThumb = await createImageThumbnail(rawDataUrl, 520, 0.72);
      if (previewThumb.length > 260_000) {
        previewThumb = await createImageThumbnail(rawDataUrl, 360, 0.6);
      }
    }

    const isChunked = rawDataUrl.length > DIRECT_DATA_LIMIT;
    let chunkCount = 0;

    if (isChunked) {
      chunkCount = Math.ceil(rawDataUrl.length / CHUNK_CHAR_SIZE);
      for (let i = 0; i < chunkCount; i++) {
        const chunkData = rawDataUrl.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE);
        const chunkId = `${fileId}_part_${i}`;
        try {
          await setDoc(doc(db, "company_file_chunks", chunkId), {
            id: chunkId,
            company_id: activeCompanyId,
            file_id: fileId,
            chunk_index: i,
            data: chunkData,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "company_file_chunks");
        }
      }
    }

    const fileDoc: CompanyFile = {
      id: fileId,
      company_id: activeCompanyId,
      channel_id: channelId,
      folder,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      data_url: isChunked ? undefined : rawDataUrl,
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

    try {
      await setDoc(doc(db, "company_files", fileId), cleanFileDoc);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "company_files");
    }

    return {
      fileDoc,
      previewThumb: previewThumb || (!isChunked && isImg ? rawDataUrl : undefined),
    };
  };

  // Resolve full data URL (reassembling chunks if needed) strictly for activeCompanyId
  const resolveFileDataUrl = async (fileId: string): Promise<{ url: string; name: string; mime: string } | null> => {
    const fileRecord = files.find((f) => f.id === fileId && f.company_id === activeCompanyId);
    if (!fileRecord) {
      showToast("تعذر العثور على الملف داخل نطاق هذه الشركة.", "error");
      return null;
    }

    if (fileRecord.data_url && !fileRecord.is_chunked) {
      return {
        url: fileRecord.data_url,
        name: fileRecord.file_name,
        mime: fileRecord.mime_type,
      };
    }

    const qChunks = query(
      collection(db, "company_file_chunks"),
      where("company_id", "==", activeCompanyId),
      where("file_id", "==", fileId)
    );
    const snap = await getDocs(qChunks);
    const parts = snap.docs
      .map((d) => d.data() as { chunk_index: number; data: string })
      .sort((a, b) => a.chunk_index - b.chunk_index);

    if (parts.length === 0) {
      showToast("تعذر استرجاع أجزاء الملف من قاعدة البيانات.", "error");
      return null;
    }

    return {
      url: parts.map((p) => p.data).join(""),
      name: fileRecord.file_name,
      mime: fileRecord.mime_type,
    };
  };

  const isExcelAttachment = (name?: string) => /\.(xlsx|xls|csv)$/i.test(name || "");

  const handleDownloadFile = async (fileId: string, fallbackName?: string) => {
    setDownloadingFileId(fileId);
    try {
      const resolved = await resolveFileDataUrl(fileId);
      if (!resolved) return;
      const a = document.createElement("a");
      a.href = resolved.url;
      a.download = resolved.name || fallbackName || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`تم تجهيز تحميل الملف: ${resolved.name}`, "success");
    } catch (err: any) {
      showToast(err?.message || "حدث خطأ أثناء تحميل الملف", "error");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleOpenInExcel = async (fileId: string, fallbackName?: string) => {
    if (!onOpenExcelFile) return;
    setDownloadingFileId(fileId);
    try {
      const resolved = await resolveFileDataUrl(fileId);
      if (!resolved) return;
      onOpenExcelFile({ name: resolved.name || fallbackName || "sheet.xlsx", dataUrl: resolved.url });
    } catch (err: any) {
      showToast(err?.message || "تعذر فتح ملف الإكسل", "error");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleOpenImagePreview = async (fileId: string | undefined, fallbackThumb?: string, name?: string) => {
    if (fallbackThumb && !fileId) {
      setPreviewImage({ url: fallbackThumb, name: name || "صورة مرفقة" });
      return;
    }
    if (fileId) {
      setDownloadingFileId(fileId);
      try {
        const resolved = await resolveFileDataUrl(fileId);
        if (resolved) {
          setPreviewImage({ url: resolved.url, name: resolved.name });
          return;
        }
      } finally {
        setDownloadingFileId(null);
      }
    }
    if (fallbackThumb) {
      setPreviewImage({ url: fallbackThumb, name: name || "صورة مرفقة" });
    }
  };

  const handleDeleteMessage = async (msg: CompanyMessage) => {
    const isAllowed =
      msg.sender_id === currentUser.id ||
      currentUser.role === "admin" ||
      isSuperAdmin;
    if (!isAllowed || msg.company_id !== activeCompanyId) return;

    try {
      await deleteDoc(doc(db, "company_messages", msg.id));
      showToast("تم حذف الرسالة بنجاح", "info");
    } catch (err: any) {
      showToast("فشل حذف الرسالة: " + (err?.message || err), "error");
    }
  };

  const handleDeleteVaultFile = async (f: CompanyFile) => {
    const isAllowed =
      f.uploaded_by_id === currentUser.id ||
      currentUser.role === "admin" ||
      isSuperAdmin;
    if (!isAllowed || f.company_id !== activeCompanyId) {
      showToast("لا تملك صلاحية حذف هذا الملف.", "error");
      return;
    }

    try {
      await deleteDoc(doc(db, "company_files", f.id));
      if (f.is_chunked) {
        const qChunks = query(
          collection(db, "company_file_chunks"),
          where("company_id", "==", activeCompanyId),
          where("file_id", "==", f.id)
        );
        const snap = await getDocs(qChunks);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }
      showToast(`تم حذف الملف «${f.file_name}» من خزنة الشركة`, "info");
    } catch (err: any) {
      showToast("تعذر حذف الملف: " + (err?.message || err), "error");
    }
  };

  // Active target partner info (null when in general company channel)
  const activePartner = useMemo(() => {
    if (!activeChannelId || activeChannelId === generalChannelId) return null;
    return companyMembers.find(
      (m) => getDmChannelId(activeCompanyId, currentUser.id, m.id) === activeChannelId
    ) || null;
  }, [activeChannelId, generalChannelId, companyMembers, activeCompanyId, currentUser.id]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCompanyId || !activeChannelId) return;
    const cleanText = msgText.trim();
    if (!cleanText && !pendingAttachment) return;

    setSending(true);
    try {
      let uploadedFileId: string | undefined;
      let uploadedFileName: string | undefined;
      let uploadedFileSize: number | undefined;
      let uploadedFileMime: string | undefined;
      let uploadedPreviewUrl: string | undefined;

      if (pendingAttachment) {
        const stored = await storeIsolatedCompanyFile(
          pendingAttachment,
          "مرفقات المراسلات",
          activeChannelId
        );
        uploadedFileId = stored.fileDoc.id;
        uploadedFileName = stored.fileDoc.file_name;
        uploadedFileSize = stored.fileDoc.file_size;
        uploadedFileMime = stored.fileDoc.mime_type;
        uploadedPreviewUrl = stored.previewThumb;
      }

      const nowMs = Date.now();
      const msgId = `msg_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      const isGeneral = activeChannelId === generalChannelId;

      const payload: CompanyMessage = {
        id: msgId,
        company_id: activeCompanyId,
        channel_id: activeChannelId,
        channel_type: isGeneral ? "general" : "dm",
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_role_label: getRoleArabicLabel(currentUser),
        recipient_id: isGeneral ? undefined : activePartner?.id,
        recipient_name: isGeneral ? undefined : activePartner?.name,
        text: cleanText,
        reply_to_id: replyTo?.id,
        reply_to_sender: replyTo?.sender_name,
        reply_to_text: replyTo ? (replyTo.text || replyTo.file_name || "مرفق") : undefined,
        file_id: uploadedFileId,
        file_name: uploadedFileName,
        file_size: uploadedFileSize,
        file_mime: uploadedFileMime,
        file_preview_url: uploadedPreviewUrl,
        created_at: new Date(nowMs).toISOString(),
        created_ms: nowMs,
      };

      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      );

      await setDoc(doc(db, "company_messages", msgId), cleanPayload);

      setMsgText("");
      setPendingAttachment(null);
      setReplyTo(null);
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
    } catch (err: any) {
      showToast(err?.message || "حدث خطأ أثناء إرسال الرسالة", "error");
    } finally {
      setSending(false);
    }
  };

  const handleVaultFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;
    setUploadingVaultFile(true);
    try {
      await storeIsolatedCompanyFile(file, vaultUploadFolder);
      showToast(`تم رفع الملف «${file.name}» داخل خزنة الشركة بنجاح!`, "success");
    } catch (err: any) {
      showToast(err?.message || "فشل في رفع الملف", "error");
    } finally {
      setUploadingVaultFile(false);
      if (vaultFileInputRef.current) vaultFileInputRef.current.value = "";
    }
  };

  // Channel stats & unread counts
  const channelStats = useMemo(() => {
    const map = new Map<string, { lastMsg?: CompanyMessage; unread: number }>();
    for (const m of messages) {
      const existing = map.get(m.channel_id) || { unread: 0 };
      if (!existing.lastMsg || (m.created_ms || 0) >= (existing.lastMsg.created_ms || 0)) {
        existing.lastMsg = m;
      }
      const lastRead = lastReads[m.channel_id] || 0;
      if (
        m.sender_id !== currentUser.id &&
        (m.created_ms || 0) > lastRead &&
        m.channel_id !== activeChannelId
      ) {
        existing.unread += 1;
      }
      map.set(m.channel_id, existing);
    }
    return map;
  }, [messages, lastReads, currentUser.id, activeChannelId]);

  const activeThreadMessages = useMemo(() => {
    let list = messages.filter((m) => m.channel_id === activeChannelId);
    if (chatSearch.trim()) {
      const q = chatSearch.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.text || "").toLowerCase().includes(q) ||
          (m.file_name || "").toLowerCase().includes(q) ||
          (m.sender_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, activeChannelId, chatSearch]);

  const filteredMembers = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return companyMembers;
    return companyMembers.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.code || "").toLowerCase().includes(q) ||
        getRoleArabicLabel(m).toLowerCase().includes(q)
    );
  }, [companyMembers, sidebarSearch]);

  const filteredVaultFiles = useMemo(() => {
    let list = files;
    if (vaultFolderFilter !== "الكل") {
      list = list.filter((f) => f.folder === vaultFolderFilter);
    }
    if (vaultSearch.trim()) {
      const q = vaultSearch.trim().toLowerCase();
      list = list.filter(
        (f) =>
          (f.file_name || "").toLowerCase().includes(q) ||
          (f.uploaded_by_name || "").toLowerCase().includes(q) ||
          (f.folder || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [files, vaultFolderFilter, vaultSearch]);

  const renderFileBadgeIcon = (mime: string, name: string) => {
    const lower = (name || "").toLowerCase();
    if (mime.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (mime.includes("pdf") || lower.endsWith(".pdf")) return <FileText className="w-5 h-5 text-rose-400 shrink-0" />;
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />;
    return <FileIcon className="w-5 h-5 text-amber-400 shrink-0" />;
  };

  if (!activeCompanyId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3" dir="rtl">
        <Building2 className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">اختر الشركة لعرض مراسلاتها وملفاتها المعزولة</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          جميع المحادثات والملفات معزولة تماماً لكل منشأة. اختر الشركة من القائمة أدناه للدخول إلى مساحة المراسلات الخاصة بها.
        </p>
        {companies.length > 0 && onSelectCompany && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCompany(c.id)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Compact Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base font-bold text-white">
              المراسلات الداخلية وخزنة الملفات المعزولة
            </h2>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>نطاق معزول حصرياً لـ:</span>
            <span className="text-amber-300 font-semibold">
              {activeCompany?.name || (currentUser.account_type === "individual" ? `حساب شخصي (${currentUser.name})` : activeCompanyId)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{companyMembers.length + 1} عضو نشط</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{files.length} ملف محفوظ</span>
          </p>
        </div>

        {/* Mode Switcher Tabs + Super Admin quick company switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && companies.length > 1 && onSelectCompany && (
            <select
              value={activeCompanyId}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs font-semibold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-950 text-slate-100">
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("chat")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                viewMode === "chat"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>المحادثات الفورية</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("vault")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                viewMode === "vault"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>ملفات الشركة ({files.length})</span>
            </button>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="bg-rose-950/50 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl text-xs font-medium">
          {syncError}
        </div>
      )}

      {/* MAIN CONTENT VIEW */}
      {viewMode === "chat" ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-270px)] min-h-[540px]">
          {/* Conversations Sidebar */}
          <aside
            className={`lg:col-span-4 border-b lg:border-b-0 lg:border-l border-slate-800 bg-slate-950/60 flex flex-col overflow-hidden ${
              mobileShowThread ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* Sidebar Search */}
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث عن موظف أو محادثة..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full h-9 pr-9 pl-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Channel & Member List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {/* General Company Group Channel */}
              {(() => {
                const stats = channelStats.get(generalChannelId);
                const isSelected = activeChannelId === generalChannelId;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChannelId(generalChannelId);
                      setMobileShowThread(true);
                    }}
                    className={`w-full px-4 py-3.5 text-right flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-emerald-950/50" : "hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          القناة العامة للشركة
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                          {stats?.lastMsg ? formatMsgTime(stats.lastMsg.created_ms) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[11px] text-slate-400 truncate">
                          {stats?.lastMsg
                            ? `${stats.lastMsg.sender_name}: ${stats.lastMsg.text || stats.lastMsg.file_name || "مرفق"}`
                            : "مراسلة جماعية لجميع أعضاء هذه الشركة"}
                        </p>
                        {!!stats?.unread && stats.unread > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center tabular-nums shrink-0">
                            {stats.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* Direct 1-on-1 Members */}
              {filteredMembers.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium">
                    لا يوجد أعضاء آخرون مسجلون داخل هذه الشركة حالياً.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    يمكنك استخدام القناة العامة لحفظ الملاحظات ورفع ملفات الشركة.
                  </p>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const dmId = getDmChannelId(activeCompanyId, currentUser.id, member.id);
                  const stats = channelStats.get(dmId);
                  const isSelected = activeChannelId === dmId;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setActiveChannelId(dmId);
                        setMobileShowThread(true);
                      }}
                      className={`w-full px-4 py-3 text-right flex items-start gap-3 transition-colors cursor-pointer ${
                        isSelected ? "bg-emerald-950/50" : "hover:bg-slate-900/80"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                        {(member.name || "م")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">{member.name}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            {stats?.lastMsg ? formatMsgTime(stats.lastMsg.created_ms) : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-[10px] text-amber-400/90 truncate">
                            {getRoleArabicLabel(member)}
                          </span>
                          {!!stats?.unread && stats.unread > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center tabular-nums shrink-0">
                              {stats.unread}
                            </span>
                          )}
                        </div>
                        {stats?.lastMsg && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {stats.lastMsg.sender_id === currentUser.id ? "أنت: " : ""}
                            {stats.lastMsg.text || stats.lastMsg.file_name || "مرفق"}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Active Chat Conversation Viewport */}
          <section
            className={`lg:col-span-8 flex flex-col bg-[#0b141a] overflow-hidden ${
              mobileShowThread ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Chat Thread Header */}
            <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileShowThread(false)}
                  className="lg:hidden p-1.5 bg-slate-800 rounded-lg text-slate-200 cursor-pointer"
                  title="العودة لقائمة المحادثات"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm shrink-0">
                  {activePartner ? (activePartner.name || "م")[0] : <Users className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {activePartner ? activePartner.name : "القناة العامة للشركة"}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {activePartner
                      ? `${getRoleArabicLabel(activePartner)} · محادثة خاصة داخل المنشأة`
                      : `${companyMembers.length + 1} عضو · محادثة جماعية معزولة`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowChatSearch((v) => !v)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    showChatSearch
                      ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="بحث داخل المحادثة"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("vault")}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-amber-300 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>ملفات الشركة</span>
                </button>
              </div>
            </div>

            {/* In-chat Search Bar */}
            {showChatSearch && (
              <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="ابحث في نص الرسائل أو أسماء الملفات المرفقة..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="flex-1 h-8 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                {chatSearch && (
                  <button
                    type="button"
                    onClick={() => setChatSearch("")}
                    className="text-xs text-slate-400 hover:text-white px-2 cursor-pointer"
                  >
                    مسح
                  </button>
                )}
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingSync ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  جاري تحميل المراسلات الآمنة...
                </div>
              ) : activeThreadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-6">
                  <MessageSquare className="w-10 h-10 text-slate-700" />
                  <p className="text-sm font-semibold text-slate-300">لا توجد رسائل في هذه المحادثة بعد</p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    ابدأ المراسلة الفورية أو أرسل ملفات ومستندات العمل — جميع الرسائل والملفات مشفرة ومعزولة تماماً داخل هذه الشركة.
                  </p>
                </div>
              ) : (
                activeThreadMessages.map((msg, idx) => {
                  const isMine = msg.sender_id === currentUser.id;
                  const prevMsg = idx > 0 ? activeThreadMessages[idx - 1] : null;
                  const dateLabel = formatDateLabel(msg.created_ms);
                  const prevDateLabel = prevMsg ? formatDateLabel(prevMsg.created_ms) : "";
                  const showDateDivider = dateLabel && dateLabel !== prevDateLabel;
                  const canDelete = isMine || currentUser.role === "admin" || isSuperAdmin;
                  const isImage = !!(msg.file_mime || "").startsWith("image/");

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="flex justify-center py-2">
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-lg tabular-nums">
                            {dateLabel}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`group max-w-[82%] sm:max-w-[68%] rounded-2xl px-3.5 py-2.5 border space-y-1.5 relative ${
                            isMine
                              ? "bg-[#005c4b] border-emerald-500/30 text-white rounded-tr-sm"
                              : "bg-slate-800/95 border-slate-700 text-slate-100 rounded-tl-sm"
                          }`}
                        >
                          {/* Sender label for group or incoming */}
                          {(!isMine || activeChannelId === generalChannelId) && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className={`font-bold ${isMine ? "text-emerald-200" : "text-amber-300"}`}>
                                {isMine ? "أنت" : msg.sender_name}
                              </span>
                              {msg.sender_role_label && (
                                <span className="text-slate-300/70">· {msg.sender_role_label}</span>
                              )}
                            </div>
                          )}

                          {/* Quoted Reply Box */}
                          {msg.reply_to_text && (
                            <div className="bg-black/25 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px]">
                              <span className="block font-bold text-amber-300">{msg.reply_to_sender}</span>
                              <span className="block text-slate-200/85 truncate">{msg.reply_to_text}</span>
                            </div>
                          )}

                          {/* Attachment Preview or File Card */}
                          {msg.file_id && (
                            <div className="space-y-2 pt-0.5">
                              {isImage && msg.file_preview_url && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenImagePreview(msg.file_id, msg.file_preview_url, msg.file_name)
                                  }
                                  className="block rounded-xl overflow-hidden border border-white/15 bg-black/20 cursor-pointer max-w-xs"
                                >
                                  <img
                                    src={msg.file_preview_url}
                                    alt={msg.file_name || "صورة مرفقة"}
                                    referrerPolicy="no-referrer"
                                    className="max-h-60 w-auto object-contain"
                                  />
                                </button>
                              )}

                              <div className="flex items-center justify-between gap-3 bg-black/25 border border-white/10 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {renderFileBadgeIcon(msg.file_mime || "", msg.file_name || "")}
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">
                                      {msg.file_name || "ملف مرفق"}
                                    </p>
                                    <p className="text-[10px] text-slate-300/80 tabular-nums">
                                      {formatBytes(msg.file_size || 0)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {onOpenExcelFile && isExcelAttachment(msg.file_name) && (
                                    <button
                                      type="button"
                                      disabled={downloadingFileId === msg.file_id}
                                      onClick={() => handleOpenInExcel(msg.file_id!, msg.file_name)}
                                      className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/30 text-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                    >
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                      <span>فتح بالإكسل</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={downloadingFileId === msg.file_id}
                                    onClick={() => handleDownloadFile(msg.file_id!, msg.file_name)}
                                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{downloadingFileId === msg.file_id ? "جاري..." : "تحميل"}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Text Body */}
                          {msg.text && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}

                          {/* Message Footer: Timestamp + Status + Quick Actions */}
                          <div className="flex items-center justify-between gap-4 pt-0.5">
                            <div className="flex items-center gap-1.5 opacity-80 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => setReplyTo(msg)}
                                className="p-1 rounded hover:bg-black/20 text-slate-200 cursor-pointer"
                                title="رد على الرسالة"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg)}
                                  className="p-1 rounded hover:bg-rose-500/30 text-rose-200 cursor-pointer"
                                  title="حذف الرسالة"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-200/80 tabular-nums mr-auto">
                              <span>{formatMsgTime(msg.created_ms)}</span>
                              {isMine && <CheckCheck className="w-3.5 h-3.5 text-sky-300" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply / Pending Attachment Bars + Input Composer */}
            <form
              onSubmit={handleSendMessage}
              className="bg-slate-900 border-t border-slate-800 p-3 space-y-2 shrink-0"
            >
              {replyTo && (
                <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-400">الرد على {replyTo.sender_name}: </span>
                    <span className="text-slate-300 truncate">{replyTo.text || replyTo.file_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {pendingAttachment && (
                <div className="flex items-center justify-between gap-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderFileBadgeIcon(pendingAttachment.type, pendingAttachment.name)}
                    <span className="font-semibold text-white truncate">{pendingAttachment.name}</span>
                    <span className="text-slate-400 tabular-nums shrink-0">
                      ({formatBytes(pendingAttachment.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAttachment(null);
                      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
                    }}
                    className="p-1 text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > MAX_FILE_SIZE_BYTES) {
                      showToast(`حجم الملف (${formatBytes(f.size)}) يتجاوز الحد الأقصى المسموح به (5 MB).`, "error");
                      return;
                    }
                    setPendingAttachment(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  className="h-10 w-10 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center text-amber-300 shrink-0 cursor-pointer transition-colors"
                  title="إرفاق ملف أو صورة (حتى 5 ميجابايت)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder="اكتب رسالتك هنا..."
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  className="flex-1 h-10 px-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={sending || (!msgText.trim() && !pendingAttachment)}
                  className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 whitespace-nowrap transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? "جاري الإرسال..." : "إرسال"}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        /* COMPANY ISOLATED FILE VAULT VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Upload + Filter Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 pb-4 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {["الكل", ...FOLDERS].map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setVaultFolderFilter(folder)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    vaultFolderFilter === folder
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث باسم الملف أو الموظف..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="w-full h-9 pr-9 pl-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={vaultUploadFolder}
                onChange={(e) => setVaultUploadFolder(e.target.value)}
                className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-amber-300 focus:outline-none cursor-pointer"
              >
                {FOLDERS.map((f) => (
                  <option key={f} value={f} className="bg-slate-950 text-white">
                    مجلد: {f}
                  </option>
                ))}
              </select>

              <input
                ref={vaultFileInputRef}
                type="file"
                className="hidden"
                onChange={handleVaultFileUpload}
              />
              <button
                type="button"
                disabled={uploadingVaultFile}
                onClick={() => vaultFileInputRef.current?.click()}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{uploadingVaultFile ? "جاري الرفع..." : "رفع ملف للشركة"}</span>
              </button>
            </div>
          </div>

          {/* Files List */}
          {filteredVaultFiles.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300">لا توجد ملفات محفوظة في هذا التصنيف</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ارفع ملفات العقود، الفواتير، المخططات أو المستندات الخاصة بهذه الشركة (حتى 5 ميجابايت للملف) ليتمكن أعضاء الشركة فقط من استعراضها وتحميلها.
              </p>
              <button
                type="button"
                onClick={() => vaultFileInputRef.current?.click()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                رفع أول ملف الآن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-3 font-semibold">اسم الملف</th>
                    <th className="py-3 px-3 font-semibold">المجلد</th>
                    <th className="py-3 px-3 font-semibold">الحجم</th>
                    <th className="py-3 px-3 font-semibold">بواسطة</th>
                    <th className="py-3 px-3 font-semibold">التاريخ</th>
                    <th className="py-3 px-3 font-semibold text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredVaultFiles.map((f) => {
                    const canDelete =
                      f.uploaded_by_id === currentUser.id ||
                      currentUser.role === "admin" ||
                      isSuperAdmin;
                    return (
                      <tr key={f.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5 max-w-xs">
                            {renderFileBadgeIcon(f.mime_type, f.file_name)}
                            <span className="font-semibold text-white truncate">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{f.folder}</td>
                        <td className="py-3 px-3 text-slate-300 tabular-nums whitespace-nowrap">
                          {formatBytes(f.file_size)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{f.uploaded_by_name}</td>
                        <td className="py-3 px-3 text-slate-400 tabular-nums whitespace-nowrap">
                          {formatDateLabel(f.created_ms)} · {formatMsgTime(f.created_ms)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-2">
                            {f.mime_type.startsWith("image/") && (
                              <button
                                type="button"
                                onClick={() => handleOpenImagePreview(f.id, f.data_url, f.file_name)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                              >
                                معاينة
                              </button>
                            )}
                            {onOpenExcelFile && isExcelAttachment(f.file_name) && (
                              <button
                                type="button"
                                disabled={downloadingFileId === f.id}
                                onClick={() => handleOpenInExcel(f.id, f.file_name)}
                                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>تعديل بالشيت</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={downloadingFileId === f.id}
                              onClick={() => handleDownloadFile(f.id, f.file_name)}
                              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{downloadingFileId === f.id ? "جاري..." : "تحميل"}</span>
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteVaultFile(f)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer"
                                title="حذف الملف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-white truncate">{previewImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.name}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-slate-950 rounded-xl p-2 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
