import { Company, Quote, OfficialLetter } from "../types";
import { safeStorage } from "../safeStorage";

export type QuoteTemplateId =
  | "classic_formal"
  | "modern_executive"
  | "compact_grid"
  | "luxury_minimal"
  | "colored_blocks";

export type LetterheadTemplateId =
  | "auto"
  | "royal_navy"
  | "executive_band"
  | "modern_minimal"
  | "official_seal"
  | "geometric_modern"
  | "custom_image";

export interface ColorPaletteOption {
  id: string;
  name: string;
  primary: string;
  accent: string;
  softBg: string;
}

export interface QuoteTemplateOption {
  id: QuoteTemplateId;
  name: string;
  subtitle: string;
  badge: string;
}

export interface LetterheadTemplateOption {
  id: LetterheadTemplateId;
  name: string;
  subtitle: string;
  badge: string;
}

export interface CompanyDesignPrefs {
  quote_template: QuoteTemplateId;
  quote_primary_color: string;
  quote_accent_color: string;
  letterhead_template: LetterheadTemplateId;
  letterhead_primary_color: string;
  letterhead_accent_color: string;
}

export const DEFAULT_PRIMARY_COLOR = "#071838";
export const DEFAULT_ACCENT_COLOR = "#c59b27";

export const COLOR_PALETTES: ColorPaletteOption[] = [
  { id: "royal_gold", name: "كحلي ملكي وذهبي", primary: "#071838", accent: "#c59b27", softBg: "#f8fafc" },
  { id: "emerald_amber", name: "زمردي عميق وذهبي", primary: "#064e3b", accent: "#d97706", softBg: "#f0fdf4" },
  { id: "sapphire_sky", name: "أزرق تقني وسماوي", primary: "#1e3a8a", accent: "#0284c7", softBg: "#eff6ff" },
  { id: "charcoal_amber", name: "فحمي فاخر وعنبر", primary: "#18181b", accent: "#f59e0b", softBg: "#fafafa" },
  { id: "crimson_bronze", name: "عنابي دبلوماسي وبرونز", primary: "#7f1d1d", accent: "#b45309", softBg: "#fef2f2" },
  { id: "teal_slate", name: "تيل هندسي وحديدي", primary: "#134e4a", accent: "#0d9488", softBg: "#f0fdfa" },
  { id: "plum_silver", name: "بنفسجي مؤسسي وفضي", primary: "#3b0764", accent: "#7c3aed", softBg: "#faf5ff" },
  { id: "forest_olive", name: "أخضر وطني رسمي", primary: "#14532d", accent: "#16a34a", softBg: "#f0fdf4" },
];

export const QUOTE_TEMPLATES: QuoteTemplateOption[] = [
  {
    id: "classic_formal",
    name: "الشكل الرسمي المتكامل",
    subtitle: "بطاقات عميل ثلاثية، جدول كميات مؤطر، وملخص مالي متوازن",
    badge: "كلاسيكي",
  },
  {
    id: "modern_executive",
    name: "الشكل التنفيذي العصري",
    subtitle: "رأسية عصرية مقسمة، صفوف جدول مخططة وأنيقة، وإجمالي جانبي بارز",
    badge: "عصري",
  },
  {
    id: "compact_grid",
    name: "الشكل الهندسي الشبكي",
    subtitle: "جدول مواصفات هندسي دقيق، بيانات متراصة، وختم اعتماد جانبي",
    badge: "هندسي",
  },
  {
    id: "luxury_minimal",
    name: "الشكل الفاخر البسيط",
    subtitle: "مساحات بيضاء واسعة، خطوط رفيعة راقية، وبطاقة إجمالي نظيفة",
    badge: "فاخر",
  },
  {
    id: "colored_blocks",
    name: "الشكل الملون التفصيلي",
    subtitle: "ترويسات وعناوين ملونة بالكامل مع إبراز الحساب البنكي والآيبان",
    badge: "ملون",
  },
];

export const LETTERHEAD_TEMPLATES: LetterheadTemplateOption[] = [
  {
    id: "auto",
    name: "التلقائي الذكي للشركة",
    subtitle: "يستخدم الصورة المرفوعة إن وُجدت، وإلا يبني ترويسة الشركة تلقائياً",
    badge: "تلقائي",
  },
  {
    id: "royal_navy",
    name: "الكليشة الملكية الهندسية",
    subtitle: "شريط علوي مائل وإطار مزدوج وشعار بارز مع تذييل رسمي أنيق",
    badge: "ملكي",
  },
  {
    id: "executive_band",
    name: "كليشة الشريط التنفيذي العريض",
    subtitle: "رأسية ملونة كاملة العرض مع شريط جانبي وإبراز السجل والضريبي",
    badge: "تنفيذي",
  },
  {
    id: "modern_minimal",
    name: "الكليشة العصرية المبسطة",
    subtitle: "خطوط رفيعة نظيفة، توزيع متباعد حديث، وتذييل خفيف وأنيق",
    badge: "مبسط",
  },
  {
    id: "official_seal",
    name: "كليشة الديوان والاعتماد الرسمي",
    subtitle: "إطار صفحة رسمي مزدوج، ترويسة ثنائية الجانب مع علامة مائية خفيفة",
    badge: "ديواني",
  },
  {
    id: "geometric_modern",
    name: "الكليشة الهندسية الحديثة",
    subtitle: "زوايا هندسية مائلة علوية وسفلية متدرجة الألوان مع ختم مدمج",
    badge: "هندسي",
  },
  {
    id: "custom_image",
    name: "صورة كليشة A4 مرفوعة من الجهاز",
    subtitle: "استخدام صورة الكليشة الكاملة المرفوعة في بطاقة الشركة أو الخطابات",
    badge: "صورة مرفوعة",
  },
];

export function getCompanyDesignPrefs(company?: Partial<Company> | null): CompanyDesignPrefs {
  let stored: Partial<CompanyDesignPrefs> = {};
  if (company?.id) {
    try {
      const raw = safeStorage.getItem(`aw_company_design_${company.id}`);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = {};
    }
  }

  return {
    quote_template: (company?.quote_template || stored.quote_template || "classic_formal") as QuoteTemplateId,
    quote_primary_color: company?.quote_primary_color || stored.quote_primary_color || DEFAULT_PRIMARY_COLOR,
    quote_accent_color: company?.quote_accent_color || stored.quote_accent_color || DEFAULT_ACCENT_COLOR,
    letterhead_template: (company?.letterhead_template || stored.letterhead_template || "auto") as LetterheadTemplateId,
    letterhead_primary_color: company?.letterhead_primary_color || stored.letterhead_primary_color || company?.quote_primary_color || DEFAULT_PRIMARY_COLOR,
    letterhead_accent_color: company?.letterhead_accent_color || stored.letterhead_accent_color || company?.quote_accent_color || DEFAULT_ACCENT_COLOR,
  };
}

export function saveCompanyDesignPrefs(companyId: string, prefs: Partial<CompanyDesignPrefs>) {
  if (!companyId) return;
  try {
    const existingRaw = safeStorage.getItem(`aw_company_design_${companyId}`);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    safeStorage.setItem(`aw_company_design_${companyId}`, JSON.stringify({ ...existing, ...prefs }));
  } catch {
    // ignore storage errors
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "#071838").replace("#", "").trim();
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 7;
  const g = parseInt(full.slice(2, 4), 16) || 24;
  const b = parseInt(full.slice(4, 6), 16) || 56;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface LetterheadRenderContext {
  templateId: LetterheadTemplateId;
  primary: string;
  accent: string;
  companyName: string;
  compActivity: string;
  crNumber: string;
  taxNumber: string;
  compPhone: string;
  compAddress: string;
  compEmail: string;
  compWebsite: string;
  customLogo: string;
  customLetterhead: string;
  isArabWorld: boolean;
  docBadgeTitle: string;
  docNo: string;
  docDate: string;
  extraMetaHtml?: string;
}

export function resolveEffectiveLetterheadMode(
  templateId: LetterheadTemplateId,
  customLetterhead: string,
  isArabWorld: boolean
): { useBgImage: boolean; bgImageUrl: string; builtInStyle: Exclude<LetterheadTemplateId, "auto" | "custom_image"> } {
  if (templateId === "custom_image") {
    if (customLetterhead) {
      return { useBgImage: true, bgImageUrl: customLetterhead, builtInStyle: "royal_navy" };
    }
    if (isArabWorld) {
      return { useBgImage: true, bgImageUrl: `${window.location.origin}/assets/letterhead_arab_world.png`, builtInStyle: "royal_navy" };
    }
    return { useBgImage: false, bgImageUrl: "", builtInStyle: "royal_navy" };
  }

  if (templateId === "auto") {
    if (customLetterhead) {
      return { useBgImage: true, bgImageUrl: customLetterhead, builtInStyle: "royal_navy" };
    }
    if (isArabWorld) {
      return { useBgImage: true, bgImageUrl: `${window.location.origin}/assets/letterhead_arab_world.png`, builtInStyle: "royal_navy" };
    }
    return { useBgImage: false, bgImageUrl: "", builtInStyle: "royal_navy" };
  }

  return { useBgImage: false, bgImageUrl: "", builtInStyle: templateId };
}

function buildLetterheadParts(ctx: LetterheadRenderContext) {
  const mode = resolveEffectiveLetterheadMode(ctx.templateId, ctx.customLetterhead, ctx.isArabWorld);
  const p = ctx.primary || DEFAULT_PRIMARY_COLOR;
  const a = ctx.accent || DEFAULT_ACCENT_COLOR;
  const pTint = hexToRgba(p, 0.06);
  const aTint = hexToRgba(a, 0.1);

  if (mode.useBgImage) {
    return {
      useBgImage: true,
      bgHtml: `<img class="letterhead-bg" src="${mode.bgImageUrl}" alt="كليشة الشركة" />`,
      extraPageFrameCss: "",
      headerHtml: `
        <div class="top-header-row">
          <div class="doc-header-block">
            <div class="doc-badge">${ctx.docBadgeTitle}</div>
            <div class="meta-line"><span>الجهة المصدرة:</span> <b style="font-family: inherit; color: ${a};">${ctx.companyName}</b></div>
            <div class="meta-line"><span>رقم المستند:</span> <b>${ctx.docNo}</b></div>
            <div class="meta-line"><span>تاريخ الإصدار:</span> <b>${ctx.docDate}</b></div>
            ${ctx.crNumber ? `<div class="meta-line"><span>السجل التجاري:</span> <b>${ctx.crNumber}</b></div>` : ""}
            ${ctx.taxNumber ? `<div class="meta-line"><span>الرقم الضريبي:</span> <b>${ctx.taxNumber}</b></div>` : ""}
            ${ctx.extraMetaHtml || ""}
          </div>
        </div>`,
      footerHtml: "",
    };
  }

  const logoBlock = ctx.customLogo
    ? `<img src="${ctx.customLogo}" alt="${ctx.companyName}" style="max-height:60px; max-width:130px; object-fit:contain; border-radius:6px;" />`
    : `<div style="width:52px;height:52px;border-radius:12px;background:${p};border:2px solid ${a};display:flex;align-items:center;justify-content:center;font-size:24px;color:${a};box-shadow:0 3px 10px ${hexToRgba(p, 0.2)};">🏢</div>`;

  const logoWhiteBlock = ctx.customLogo
    ? `<img src="${ctx.customLogo}" alt="${ctx.companyName}" style="max-height:56px; max-width:130px; object-fit:contain; background:#fff; padding:4px 6px; border-radius:8px;" />`
    : `<div style="width:50px;height:50px;border-radius:10px;background:#ffffff;border:2px solid ${a};display:flex;align-items:center;justify-content:center;font-size:24px;color:${p};">🏢</div>`;

  let bgDecor = "";
  let extraPageFrameCss = "";
  let headerHtml = "";
  let footerHtml = "";

  const footerContactItems = [
    ctx.compAddress ? `<span>📍 ${ctx.compAddress}</span>` : "",
    ctx.compPhone ? `<span>📞 ${ctx.compPhone}</span>` : "",
    ctx.compEmail ? `<span>✉️ ${ctx.compEmail}</span>` : "",
    ctx.compWebsite ? `<span>🌐 ${ctx.compWebsite}</span>` : "",
  ].filter(Boolean).join("");

  switch (mode.builtInStyle) {
    case "executive_band":
      bgDecor = `
        <div style="position:absolute;top:0;right:0;width:8px;height:100%;background:linear-gradient(180deg, ${p}, ${a}, ${p});z-index:2;"></div>
      `;
      headerHtml = `
        <div style="background:${p};color:#fff;padding:14px 18px;border-radius:10px;border-bottom:4px solid ${a};display:flex;justify-content:space-between;align-items:center;margin-bottom:5mm;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${logoWhiteBlock}
            <div>
              <div style="font-size:19px;font-weight:900;color:#ffffff;">${ctx.companyName}</div>
              ${ctx.compActivity ? `<div style="font-size:11px;font-weight:700;color:${a};margin-top:2px;">${ctx.compActivity}</div>` : ""}
              <div style="display:flex;gap:12px;font-size:10px;color:#e2e8f0;margin-top:4px;font-weight:700;">
                ${ctx.crNumber ? `<span>س.ت: <b style="font-family:monospace;color:#fff;">${ctx.crNumber}</b></span>` : ""}
                ${ctx.taxNumber ? `<span>الضريبي: <b style="font-family:monospace;color:#fff;">${ctx.taxNumber}</b></span>` : ""}
              </div>
            </div>
          </div>
          <div style="text-align:left;background:rgba(255,255,255,0.1);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);">
            <div style="font-size:12px;font-weight:900;color:${a};margin-bottom:4px;">${ctx.docBadgeTitle}</div>
            <div style="font-size:11px;color:#fff;">الرقم: <b style="font-family:monospace;">${ctx.docNo}</b></div>
            <div style="font-size:11px;color:#fff;">التاريخ: <b style="font-family:monospace;">${ctx.docDate}</b></div>
            ${ctx.extraMetaHtml ? `<div style="font-size:10px;color:#e2e8f0;">${ctx.extraMetaHtml}</div>` : ""}
          </div>
        </div>
      `;
      footerHtml = `
        <div style="margin-top:auto;background:${pTint};border-top:2px solid ${p};border-radius:6px;padding:7px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:${p};font-weight:700;">
            <span style="font-weight:900;">${ctx.companyName}</span>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">${footerContactItems}</div>
          </div>
        </div>
      `;
      break;

    case "modern_minimal":
      headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:1.5px solid ${hexToRgba(p, 0.25)};margin-bottom:5mm;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${logoBlock}
            <div>
              <div style="font-size:18px;font-weight:900;color:${p};letter-spacing:-0.2px;">${ctx.companyName}</div>
              ${ctx.compActivity ? `<div style="font-size:10.5px;font-weight:700;color:${a};margin-top:1px;">${ctx.compActivity}</div>` : ""}
              <div style="font-size:10px;color:#64748b;margin-top:3px;font-weight:600;">
                ${ctx.crNumber ? `س.ت: ${ctx.crNumber}` : ""} ${ctx.crNumber && ctx.taxNumber ? " · " : ""} ${ctx.taxNumber ? `ضريبي: ${ctx.taxNumber}` : ""}
              </div>
            </div>
          </div>
          <div style="text-align:left;">
            <div style="display:inline-block;font-size:12px;font-weight:900;color:${p};border-bottom:2.5px solid ${a};padding-bottom:3px;margin-bottom:4px;">${ctx.docBadgeTitle}</div>
            <div class="meta-line"><span>الرقم:</span> <b>${ctx.docNo}</b></div>
            <div class="meta-line"><span>التاريخ:</span> <b>${ctx.docDate}</b></div>
            ${ctx.extraMetaHtml || ""}
          </div>
        </div>
      `;
      footerHtml = `
        <div style="margin-top:auto;border-top:1px solid ${hexToRgba(p, 0.2)};padding-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748b;font-weight:600;">
          <span style="color:${p};font-weight:800;">${ctx.companyName}</span>
          <div style="display:flex;gap:10px;">${footerContactItems}</div>
        </div>
      `;
      break;

    case "official_seal":
      extraPageFrameCss = `
        .page-inner-frame {
          position: absolute;
          inset: 7mm;
          border: 1.5px solid ${p};
          outline: 1px solid ${a};
          outline-offset: 2px;
          pointer-events: none;
          z-index: 2;
        }
      `;
      bgDecor = `
        <div class="page-inner-frame"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;opacity:0.045;">
          ${ctx.customLogo ? `<img src="${ctx.customLogo}" style="width:260px;height:260px;object-fit:contain;" />` : `<div style="font-size:110px;font-weight:900;color:${p};transform:rotate(-20deg);">${ctx.companyName}</div>`}
        </div>
      `;
      headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px 12px;border-bottom:3px double ${p};margin-bottom:4mm;">
          <div style="text-align:right;max-width:45%;">
            <div style="font-size:17px;font-weight:900;color:${p};">${ctx.companyName}</div>
            ${ctx.compActivity ? `<div style="font-size:10.5px;font-weight:700;color:${a};margin-top:2px;">${ctx.compActivity}</div>` : ""}
            <div style="font-size:10px;color:#334155;font-weight:700;margin-top:3px;">
              ${ctx.crNumber ? `السجل التجاري: <b>${ctx.crNumber}</b>` : ""}
              ${ctx.taxNumber ? `<br/>الرقم الضريبي: <b>${ctx.taxNumber}</b>` : ""}
            </div>
          </div>
          <div style="text-align:center;">
            ${logoBlock}
          </div>
          <div style="text-align:left;min-width:140px;">
            <div class="doc-badge" style="margin-bottom:6px;">${ctx.docBadgeTitle}</div>
            <div class="meta-line"><span>الرقم:</span> <b>${ctx.docNo}</b></div>
            <div class="meta-line"><span>التاريخ:</span> <b>${ctx.docDate}</b></div>
            ${ctx.extraMetaHtml || ""}
          </div>
        </div>
      `;
      footerHtml = `
        <div style="margin-top:auto;border-top:3px double ${p};padding-top:6px;text-align:center;font-size:10px;color:${p};font-weight:700;">
          <div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;">
            <span><b>${ctx.companyName}</b></span>
            ${footerContactItems}
          </div>
        </div>
      `;
      break;

    case "geometric_modern":
      bgDecor = `
        <svg viewBox="0 0 800 112" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:34mm;z-index:1;pointer-events:none;">
          <polygon points="0,0 800,0 800,68 480,98 0,34" fill="${p}" />
          <polygon points="0,34 480,98 800,68 800,78 480,108 0,42" fill="${a}" />
        </svg>
        <svg viewBox="0 0 800 50" preserveAspectRatio="none" style="position:absolute;bottom:0;left:0;width:100%;height:16mm;z-index:1;pointer-events:none;">
          <polygon points="0,50 800,50 800,15 300,38 0,8" fill="${p}" />
          <polygon points="0,8 300,38 800,15 800,10 300,32 0,3" fill="${a}" />
        </svg>
      `;
      headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;min-height:26mm;margin-bottom:4mm;padding-top:2px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${logoWhiteBlock}
            <div>
              <div style="font-size:18px;font-weight:900;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${ctx.companyName}</div>
              ${ctx.compActivity ? `<div style="font-size:10.5px;font-weight:700;color:${a};">${ctx.compActivity}</div>` : ""}
              <div style="font-size:10px;color:#e2e8f0;font-weight:700;margin-top:2px;">
                ${ctx.crNumber ? `س.ت: ${ctx.crNumber}` : ""} ${ctx.taxNumber ? ` | ضريبي: ${ctx.taxNumber}` : ""}
              </div>
            </div>
          </div>
          <div style="text-align:left;background:#ffffff;padding:7px 12px;border-radius:8px;border:1.5px solid ${a};box-shadow:0 3px 10px rgba(0,0,0,0.12);">
            <div style="font-size:12px;font-weight:900;color:${p};margin-bottom:2px;">${ctx.docBadgeTitle}</div>
            <div class="meta-line"><span>الرقم:</span> <b>${ctx.docNo}</b></div>
            <div class="meta-line"><span>التاريخ:</span> <b>${ctx.docDate}</b></div>
            ${ctx.extraMetaHtml || ""}
          </div>
        </div>
      `;
      footerHtml = `
        <div style="margin-top:auto;padding:4px 6px;color:#ffffff;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:700;">
          <span>${ctx.companyName}</span>
          <div style="display:flex;gap:12px;">${footerContactItems}</div>
        </div>
      `;
      break;

    case "royal_navy":
    default:
      headerHtml = `
        <div class="corp-header-row" style="border-bottom-color:${p};">
          <div class="corp-brand-side">
            ${logoBlock}
            <div class="corp-brand-text">
              <div class="corp-brand-name" style="color:${p};">${ctx.companyName}</div>
              ${ctx.compActivity ? `<div class="corp-brand-activity" style="color:${a};">${ctx.compActivity}</div>` : ""}
              <div class="corp-brand-meta">
                ${ctx.crNumber ? `<span>سجل تجاري: <b style="color:${p};">${ctx.crNumber}</b></span>` : ""}
                ${ctx.taxNumber ? `<span>الرقم الضريبي: <b style="color:${p};">${ctx.taxNumber}</b></span>` : ""}
              </div>
            </div>
          </div>
          <div class="corp-meta-side">
            <div class="doc-badge">${ctx.docBadgeTitle}</div>
            <div class="meta-line"><span>الرقم:</span> <b>${ctx.docNo}</b></div>
            <div class="meta-line"><span>تاريخ الإصدار:</span> <b>${ctx.docDate}</b></div>
            ${ctx.extraMetaHtml || ""}
          </div>
        </div>
        <div class="corp-gold-bar" style="background:linear-gradient(90deg, ${a}, ${p}, ${a});"></div>
      `;
      footerHtml = `
        <div class="corp-footer" style="border-top-color:${p};">
          <div class="corp-footer-accent" style="background:${a};"></div>
          <div class="corp-footer-grid">
            <div class="corp-footer-comp" style="color:${p};">${ctx.companyName}</div>
            <div class="corp-footer-contact">${footerContactItems}</div>
          </div>
          <div class="corp-footer-note">وثيقة رسمية صادرة ومعتمدة من المنظومة المالية</div>
        </div>
      `;
      break;
  }

  return {
    useBgImage: false,
    bgHtml: bgDecor,
    extraPageFrameCss,
    headerHtml,
    footerHtml,
  };
}

export function buildQuotePrintHtml(params: {
  quote: Quote;
  items: any[];
  notesText: string;
  company?: Company | null;
  templateStyle: QuoteTemplateId;
  letterheadTemplate: LetterheadTemplateId;
  primaryColor: string;
  accentColor: string;
  customLetterhead: string;
  customLogo: string;
  isArabWorld: boolean;
}): string {
  const { quote: q, items, notesText, company, templateStyle, letterheadTemplate, primaryColor, accentColor, customLetterhead, customLogo, isArabWorld } = params;
  const p = primaryColor || DEFAULT_PRIMARY_COLOR;
  const a = accentColor || DEFAULT_ACCENT_COLOR;
  const pSoft = hexToRgba(p, 0.05);
  const pMid = hexToRgba(p, 0.12);
  const aSoft = hexToRgba(a, 0.12);

  const companyName = company?.name || (isArabWorld ? "شركة عرب وورلد للمقاولات" : "الشركة المعتمدة");
  const crNumber = company?.commercial_register || company?.record_no || "";
  const taxNumber = company?.tax_no || "";
  const compPhone = company?.phone || (isArabWorld ? "0539853287" : "");
  const compAddress = company?.address || "المملكة العربية السعودية";
  const compEmail = company?.email || (isArabWorld ? "info@arab1000.online" : "");
  const compWebsite = company?.website || "";
  const compActivity = company?.activity || company?.sub_title || "";
  const compBank = company?.bank_name || "";
  const compIban = company?.iban || "";

  const vatAmount = Math.round(Number(q.amount || 0) * (Number(q.vat || 0) / 100));

  const lh = buildLetterheadParts({
    templateId: letterheadTemplate,
    primary: p,
    accent: a,
    companyName,
    compActivity,
    crNumber,
    taxNumber,
    compPhone,
    compAddress,
    compEmail,
    compWebsite,
    customLogo,
    customLetterhead,
    isArabWorld,
    docBadgeTitle: "وثيقة عرض سعر مالي وتشغيلي",
    docNo: q.no,
    docDate: q.date,
  });

  const rowsHtml = items
    .map((item: any, idx: number) => {
      const zebraBg = idx % 2 === 1 ? pSoft : "#ffffff";
      if (templateStyle === "modern_executive") {
        return `
          <tr style="background:${zebraBg};">
            <td style="font-weight:800;color:${p};width:6%;">${idx + 1}</td>
            <td style="text-align:right;padding:8px 12px;font-weight:700;color:#0f172a;width:42%;">${item.description || "بند توريد وتركيب"}</td>
            <td style="font-weight:700;color:${a};width:14%;">${item.unit || "وحدة قطوعة"}</td>
            <td style="font-weight:800;color:${p};width:10%;">${item.quantity || 1}</td>
            <td style="font-weight:700;color:#334155;width:14%;">${Number(item.price || 0).toLocaleString()} ريال</td>
            <td style="font-weight:900;color:${p};width:14%;">${Number(item.total || 0).toLocaleString()} ريال</td>
          </tr>`;
      }
      if (templateStyle === "luxury_minimal") {
        return `
          <tr style="border-bottom:1px solid ${hexToRgba(p, 0.14)};">
            <td style="font-weight:700;color:#64748b;width:5%;">${idx + 1}</td>
            <td style="text-align:right;padding:9px 10px;font-weight:700;color:${p};width:43%;">${item.description || "بند توريد وتركيب"}</td>
            <td style="font-weight:600;color:${a};width:14%;">${item.unit || "وحدة قطوعة"}</td>
            <td style="font-weight:700;color:#0f172a;width:10%;">${item.quantity || 1}</td>
            <td style="font-weight:700;color:#334155;width:14%;">${Number(item.price || 0).toLocaleString()} ريال</td>
            <td style="font-weight:900;color:${p};width:14%;">${Number(item.total || 0).toLocaleString()} ريال</td>
          </tr>`;
      }
      if (templateStyle === "colored_blocks") {
        return `
          <tr style="background:${idx % 2 === 1 ? pSoft : "#ffffff"};">
            <td style="font-weight:900;color:#fff;background:${p};width:5%;">${idx + 1}</td>
            <td style="text-align:right;padding:7px 10px;font-weight:700;color:${p};width:43%;">${item.description || "بند توريد وتركيب"}</td>
            <td style="font-weight:800;color:${p};background:${aSoft};width:14%;">${item.unit || "وحدة قطوعة"}</td>
            <td style="font-weight:800;color:${p};width:10%;">${item.quantity || 1}</td>
            <td style="font-weight:800;color:${p};width:14%;">${Number(item.price || 0).toLocaleString()} ريال</td>
            <td style="font-weight:900;color:${p};background:${pSoft};width:14%;">${Number(item.total || 0).toLocaleString()} ريال</td>
          </tr>`;
      }
      return `
        <tr>
          <td style="font-weight:800;color:${p};width:5%;">${idx + 1}</td>
          <td style="text-align:right;padding:7px 10px;font-weight:700;color:${p};width:43%;line-height:1.4;">${item.description || "بند توريد وتركيب مواد وأعمال عامة"}</td>
          <td style="font-weight:800;color:${a};background:${aSoft};width:14%;">${item.unit || "وحدة قطوعة"}</td>
          <td style="font-weight:800;color:${p};width:10%;">${item.quantity || 1}</td>
          <td style="font-weight:800;color:${p};width:14%;">${Number(item.price || 0).toLocaleString()} ريال</td>
          <td style="font-weight:900;color:${p};background:${pSoft};width:14%;">${Number(item.total || 0).toLocaleString()} ريال</td>
        </tr>`;
    })
    .join("");

  // Build Client & Summary Layout based on chosen templateStyle
  let bodyContentHtml = "";

  if (templateStyle === "modern_executive") {
    bodyContentHtml = `
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-bottom:8px;background:${pSoft};border:1px solid ${pMid};border-right:4px solid ${a};border-radius:10px;padding:10px 14px;">
        <div>
          <div style="font-size:10px;color:${a};font-weight:800;">عرض سعر موجه إلى السادة:</div>
          <div style="font-size:15px;font-weight:900;color:${p};margin:2px 0;">${q.client}</div>
          <div style="font-size:11px;color:#475569;font-weight:700;">المشروع: <b style="color:${p};">${q.project || "مشروع عام"}</b></div>
        </div>
        <div style="text-align:left;display:flex;flex-direction:column;justify-content:center;gap:3px;font-size:11px;color:#334155;font-weight:700;">
          <div>الجوال: <b style="font-family:monospace;color:${p};">${q.phone || "غير مسجل"}</b></div>
          <div>حالة العرض: <b style="color:${a};">${q.status}</b></div>
          <div>الضريبة المعتمدة: <b style="font-family:monospace;color:${p};">${q.vat || 15}%</b></div>
        </div>
      </div>

      <table class="q-table modern-table">
        <thead>
          <tr>
            <th style="width:6%">#</th>
            <th style="width:42%;text-align:right;padding-right:12px;">الوصف والبيان الفني</th>
            <th style="width:14%">الوحدة</th>
            <th style="width:10%">الكمية</th>
            <th style="width:14%">سعر الوحدة</th>
            <th style="width:14%">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:stretch;gap:12px;margin-top:8px;">
        <div style="flex:1.2;">
          ${notesText ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;height:100%;">
            <div style="font-size:11px;font-weight:900;color:${p};margin-bottom:4px;border-bottom:1px solid ${aSoft};padding-bottom:3px;">الشروط والأحكام</div>
            <div style="font-size:10.5px;color:#334155;line-height:1.6;white-space:pre-wrap;">${notesText}</div>
          </div>` : ""}
        </div>
        <div style="flex:0.85;background:${p};color:#fff;border-radius:10px;padding:10px 14px;border-bottom:4px solid ${a};">
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.12);">
            <span>المجموع الفرعي:</span><b>${Number(q.amount || 0).toLocaleString()} ريال</b>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.12);">
            <span>الضريبة (${q.vat || 15}%):</span><b>${vatAmount.toLocaleString()} ريال</b>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:${a};padding-top:6px;">
            <span>الإجمالي النهائي:</span><span>${Number(q.total || 0).toLocaleString()} ريال</span>
          </div>
        </div>
      </div>
    `;
  } else if (templateStyle === "compact_grid") {
    bodyContentHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px;">
        <tr>
          <td style="border:1.5px solid ${p};padding:6px 10px;background:${pSoft};width:34%;"><b style="color:${a};font-size:10px;display:block;">العميل / الجهة:</b><span style="font-weight:900;color:${p};font-size:12.5px;">${q.client}</span></td>
          <td style="border:1.5px solid ${p};padding:6px 10px;background:#fff;width:33%;"><b style="color:${a};font-size:10px;display:block;">المشروع / الموقع:</b><span style="font-weight:800;color:${p};">${q.project || "غير مسجل"}</span></td>
          <td style="border:1.5px solid ${p};padding:6px 10px;background:${pSoft};width:33%;"><b style="color:${a};font-size:10px;display:block;">رقم التواصل:</b><span style="font-weight:800;font-family:monospace;color:${p};">${q.phone || "غير مسجل"}</span></td>
        </tr>
      </table>

      <table class="q-table compact-table">
        <thead>
          <tr>
            <th style="width:5%">م</th>
            <th style="width:43%;text-align:right;padding-right:10px;">البند والمواصفة الهندسية</th>
            <th style="width:14%">الوحدة</th>
            <th style="width:10%">الكمية</th>
            <th style="width:14%">الفئة</th>
            <th style="width:14%">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;margin-top:8px;">
        <div style="border:1.5px solid ${p};padding:7px 10px;background:#fff;">
          <div style="font-size:10.5px;font-weight:900;color:${p};border-bottom:1px solid ${a};padding-bottom:3px;margin-bottom:4px;">الملاحظات والشروط الهندسية:</div>
          <div style="font-size:10px;color:#334155;line-height:1.55;white-space:pre-wrap;">${notesText || "تطبق المواصفات القياسية ومعايير الجودة المعتمدة."}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <tr><td style="border:1.5px solid ${p};padding:5px 8px;background:${pSoft};font-weight:800;color:${p};">الصافي قبل الضريبة</td><td style="border:1.5px solid ${p};padding:5px 8px;text-align:center;font-weight:900;font-family:monospace;">${Number(q.amount || 0).toLocaleString()} ريال</td></tr>
          <tr><td style="border:1.5px solid ${p};padding:5px 8px;background:#fff;font-weight:800;color:${p};">ضريبة القيمة المضافة (${q.vat || 15}%)</td><td style="border:1.5px solid ${p};padding:5px 8px;text-align:center;font-weight:900;font-family:monospace;">${vatAmount.toLocaleString()} ريال</td></tr>
          <tr><td style="border:1.5px solid ${p};padding:7px 8px;background:${p};color:#fff;font-weight:900;">الإجمالي النهائي المستحق</td><td style="border:1.5px solid ${p};padding:7px 8px;text-align:center;background:${aSoft};color:${p};font-weight:900;font-size:13.5px;font-family:monospace;">${Number(q.total || 0).toLocaleString()} ريال</td></tr>
        </table>
      </div>
    `;
  } else if (templateStyle === "luxury_minimal") {
    bodyContentHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0 12px;border-bottom:1px solid ${hexToRgba(p, 0.2)};margin-bottom:10px;">
        <div>
          <div style="font-size:10px;color:${a};font-weight:800;letter-spacing:0.5px;">إلى السادة</div>
          <div style="font-size:16px;font-weight:900;color:${p};margin-top:2px;">${q.client}</div>
          ${q.phone ? `<div style="font-size:11px;color:#64748b;margin-top:2px;font-family:monospace;">${q.phone}</div>` : ""}
        </div>
        <div style="text-align:left;">
          <div style="font-size:10px;color:${a};font-weight:800;">المشروع</div>
          <div style="font-size:13px;font-weight:800;color:${p};margin-top:2px;">${q.project || "عرض عام"}</div>
        </div>
      </div>

      <table class="q-table minimal-table">
        <thead>
          <tr>
            <th style="width:5%">#</th>
            <th style="width:43%;text-align:right;padding-right:10px;">البند والبيان</th>
            <th style="width:14%">الوحدة</th>
            <th style="width:10%">الكمية</th>
            <th style="width:14%">سعر الوحدة</th>
            <th style="width:14%">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <div style="width:280px;border-top:2px solid ${p};border-bottom:2px solid ${a};padding:8px 0;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;padding:3px 0;"><span>المجموع قبل الضريبة</span><b>${Number(q.amount || 0).toLocaleString()} ريال</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;padding:3px 0;"><span>الضريبة (${q.vat || 15}%)</span><b>${vatAmount.toLocaleString()} ريال</b></div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:${p};padding-top:6px;margin-top:4px;border-top:1px dashed ${hexToRgba(p, 0.3)};"><span>الإجمالي النهائي</span><span style="color:${a};">${Number(q.total || 0).toLocaleString()} ريال</span></div>
        </div>
      </div>

      ${notesText ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid ${hexToRgba(p, 0.15)};">
        <div style="font-size:11px;font-weight:900;color:${p};margin-bottom:3px;">الشروط والملاحظات</div>
        <div style="font-size:10.5px;color:#475569;line-height:1.65;white-space:pre-wrap;">${notesText}</div>
      </div>` : ""}
    `;
  } else if (templateStyle === "colored_blocks") {
    bodyContentHtml = `
      <div class="sec-title">بيانات عميل عرض السعر والمشروع</div>
      <div class="grid3">
        <div class="cbox" style="background:${pSoft}!important;border-top:3px solid ${a}!important;"><b>السادة / العميل الكريم:</b><span>${q.client}</span></div>
        <div class="cbox" style="background:${aSoft}!important;border-top:3px solid ${p}!important;"><b>رقم الجوال والتواصل:</b><span>${q.phone || "غير مسجل"}</span></div>
        <div class="cbox" style="background:${pSoft}!important;border-top:3px solid ${a}!important;"><b>المشروع والموقع التابع:</b><span>${q.project || "غير مسجل"}</span></div>
      </div>

      <div class="sec-title">جدول الكميات والأسعار المعتمد</div>
      <table class="q-table">
        <thead>
          <tr>
            <th style="width:5%">م</th>
            <th style="width:43%;text-align:right;padding-right:12px;">البند والبيان الفني للمواد والأعمال</th>
            <th style="width:14%">الوحدة</th>
            <th style="width:10%">الكمية</th>
            <th style="width:14%">سعر الوحدة</th>
            <th style="width:14%">الإجمالي الكلي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div class="sum-grid">
        <div class="sum-card" style="background:${pSoft}!important;"><b>المبلغ قبل الضريبة</b><span>${Number(q.amount || 0).toLocaleString()} ريال</span></div>
        <div class="sum-card" style="background:${aSoft}!important;"><b>ضريبة القيمة المضافة (${q.vat || 15}%)</b><span>${vatAmount.toLocaleString()} ريال</span></div>
        <div class="sum-card" style="background:${p}!important;border-color:${a}!important;"><b style="color:${a}!important;">الإجمالي النهائي الشامل</b><span style="color:#ffffff!important;font-size:16px;">${Number(q.total || 0).toLocaleString()} ريال</span></div>
      </div>

      ${(compBank || compIban) ? `
      <div style="background:${pSoft};border:1px solid ${pMid};border-right:4px solid ${p};border-radius:6px;padding:6px 12px;margin:5px 0;font-size:10.5px;display:flex;justify-content:space-between;align-items:center;">
        <b style="color:${p};">🏦 بيانات التحويل البنكي: ${compBank || "الحساب الرسمي للشركة"}</b>
        ${compIban ? `<span style="font-family:monospace;font-weight:900;color:${p};direction:ltr;">IBAN: ${compIban}</span>` : ""}
      </div>` : ""}

      ${notesText ? `<div class="sec-title" style="margin-top:5px;">الشروط والأحكام وملاحظات إضافية</div><div class="notes-body">${notesText}</div>` : ""}
    `;
  } else {
    // classic_formal
    bodyContentHtml = `
      <div class="sec-title">بيانات عميل عرض السعر والمشروع</div>
      <div class="grid3">
        <div class="cbox"><b>السادة / العميل الكريم:</b><span>${q.client}</span></div>
        <div class="cbox"><b>رقم الجوال والتواصل:</b><span>${q.phone || "غير مسجل"}</span></div>
        <div class="cbox"><b>المشروع والموقع التابع:</b><span>${q.project || "غير مسجل"}</span></div>
      </div>

      <div class="sec-title">بنود وجدول كميات وأسعار العرض المالي والتشغيلي</div>
      <table class="q-table">
        <thead>
          <tr>
            <th style="width:5%">م</th>
            <th style="width:43%;text-align:right;padding-right:12px;">البند والبيان الفني للمواد والأعمال</th>
            <th style="width:14%">الوحدة</th>
            <th style="width:10%">الكمية</th>
            <th style="width:14%">سعر الوحدة</th>
            <th style="width:14%">الإجمالي الكلي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div class="sum-grid">
        <div class="sum-card"><b>المبلغ قبل الضريبة</b><span>${Number(q.amount || 0).toLocaleString()} ريال</span></div>
        <div class="sum-card"><b>ضريبة القيمة المضافة (${q.vat || 15}%)</b><span>${vatAmount.toLocaleString()} ريال</span></div>
        <div class="sum-card grand-card"><b>الإجمالي النهائي الشامل</b><span>${Number(q.total || 0).toLocaleString()} ريال</span></div>
      </div>

      ${notesText ? `<div class="sec-title" style="margin-top:6px;">الشروط والأحكام وملاحظات إضافية</div><div class="notes-body">${notesText}</div>` : ""}
    `;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عرض سعر رسمي رقم ${q.no} - ${companyName} - ${q.client}</title>
<style>
* { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
body { margin: 0; background: #cbd5e1; color: ${p}; padding: 20px 0; }
.page { width: 210mm; height: 297mm; margin: 0 auto 20px; background: #ffffff; position: relative; box-shadow: 0 12px 40px rgba(0,0,0,0.18); overflow: hidden; }
.letterhead-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: 1; pointer-events: none; }
${lh.extraPageFrameCss}
.page-content { position: relative; z-index: 10; height: 297mm; display: flex; flex-direction: column; }
.content-with-bg { padding: 10mm 15mm 24mm 15mm; }
.content-corporate { padding: 12mm 15mm 14mm 15mm; }
.top-header-row { display: flex; justify-content: flex-start; align-items: flex-start; min-height: 28mm; margin-bottom: 3mm; }
.doc-header-block { width: 44%; text-align: right; padding-top: 2mm; }
.doc-badge { display: inline-block; background: ${p} !important; color: #ffffff !important; padding: 5px 14px; border-radius: 5px; font-size: 13px; font-weight: 900; margin-bottom: 5px; border-right: 4px solid ${a} !important; box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
.meta-line { font-size: 11px; color: ${p} !important; margin: 2px 0; font-weight: 700; }
.meta-line span { color: #475569 !important; margin-left: 6px; }
.meta-line b { color: ${p} !important; font-family: monospace; font-size: 11.5px; }
.corp-header-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 2.5px solid ${p}; margin-bottom: 4mm; }
.corp-gold-bar { height: 3px; margin-top: -2.5px; margin-bottom: 4mm; border-radius: 2px; }
.corp-brand-side { display: flex; align-items: center; gap: 12px; }
.corp-brand-text { text-align: right; }
.corp-brand-name { font-size: 18px; font-weight: 900; line-height: 1.2; }
.corp-brand-activity { font-size: 11px; font-weight: 700; margin-top: 2px; }
.corp-brand-meta { display: flex; gap: 10px; font-size: 10.5px; color: #475569; font-weight: 700; margin-top: 3px; }
.corp-brand-meta b { font-family: monospace; }
.corp-meta-side { text-align: left; }
.corp-footer { margin-top: auto; border-top: 2px solid ${p}; padding-top: 6px; position: relative; }
.corp-footer-accent { position: absolute; top: -2px; right: 0; width: 120px; height: 2px; }
.corp-footer-grid { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #334155; font-weight: 700; }
.corp-footer-comp { font-weight: 900; }
.corp-footer-contact { display: flex; gap: 12px; font-size: 10px; color: #475569; }
.corp-footer-note { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 4px; font-weight: 600; }
.sec-title { background: ${p} !important; color: #ffffff !important; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; margin: 6px 0 5px; border-right: 4px solid ${a} !important; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 6px; }
.cbox { border: 1px solid #cbd5e1 !important; border-top: 2.5px solid ${p} !important; background: #f8fafc !important; border-radius: 4px; padding: 5px 8px; min-height: 42px; }
.cbox b { display: block; font-size: 10px; color: ${a} !important; margin-bottom: 2px; font-weight: 800; }
.cbox span { font-size: 12px; font-weight: 800; color: ${p} !important; }
table.q-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
table.q-table th { background: ${p} !important; color: #ffffff !important; padding: 7px 4px; font-weight: 800; font-size: 11px; border: 1px solid ${p} !important; text-align: center; }
table.q-table td { border: 1px solid #94a3b8 !important; padding: 6px 4px; text-align: center; font-weight: 700; color: ${p} !important; font-size: 11px; }
table.q-table.modern-table th { border: none !important; padding: 9px 6px; border-bottom: 3px solid ${a} !important; }
table.q-table.modern-table td { border: none !important; border-bottom: 1px solid #e2e8f0 !important; }
table.q-table.minimal-table th { background: transparent !important; color: ${p} !important; border: none !important; border-top: 2px solid ${p} !important; border-bottom: 2px solid ${a} !important; padding: 8px 4px; }
table.q-table.minimal-table td { border: none !important; border-bottom: 1px solid #e2e8f0 !important; }
.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 6px 0; }
.sum-card { border: 1.5px solid #cbd5e1 !important; border-top: 3px solid ${a} !important; background: #f8fafc !important; border-radius: 6px; text-align: center; padding: 6px 4px; }
.sum-card b { display: block; color: ${p} !important; font-size: 10.5px; font-weight: 800; margin-bottom: 3px; }
.sum-card span { font-size: 14.5px; color: ${p} !important; font-weight: 900; }
.sum-card.grand-card { border-color: ${p} !important; border-top-color: ${a} !important; background: ${pSoft} !important; }
.sum-card.grand-card span { color: ${p} !important; font-size: 16px; }
.notes-body { border: 1px solid #cbd5e1 !important; background: #f8fafc !important; border-radius: 4px; padding: 6px 10px; font-size: 10.5px; line-height: 1.6; color: ${p} !important; font-weight: 600; white-space: pre-wrap; margin-bottom: 6px; }
.signs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: auto; padding-bottom: 4px; }
.sign-box { border-top: 1.5px dashed ${p} !important; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 800; color: ${p} !important; }
.no-print { position: fixed; top: 15px; left: 15px; display: flex; gap: 8px; z-index: 9999; }
.no-print button { border: 0; border-radius: 6px; padding: 8px 14px; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.btn-print { background: #16a34a; }
.btn-close { background: #475569; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  .page { box-shadow: none !important; margin: 0 !important; width: 210mm !important; height: 297mm !important; page-break-after: always; }
  .no-print { display: none !important; }
}
</style>
</head>
<body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">طباعة / حفظ PDF</button>
  <button class="btn-close" onclick="window.close()">إغلاق الصفحة</button>
</div>
<div class="page">
  ${lh.bgHtml}
  <div class="page-content ${lh.useBgImage ? "content-with-bg" : "content-corporate"}">
    ${lh.headerHtml}
    ${bodyContentHtml}
    <div class="signs-row">
      <div class="sign-box">
        <div>الطرف الأول (مقدم عرض السعر)</div>
        <div style="font-size:11px;margin-top:3px;color:${a};font-weight:800;">${companyName}</div>
        ${customLogo ? `<div style="margin-top:4px;"><img src="${customLogo}" style="max-height:28px;max-width:80px;opacity:0.85;object-fit:contain;" /></div>` : ""}
        <div style="font-size:10px;margin-top:8px;color:#666;">التوقيع والختم المعتمد</div>
      </div>
      <div class="sign-box">
        <div>الطرف الثاني (قبول واعتماد العميل)</div>
        <div style="font-size:11px;margin-top:3px;color:${p};font-weight:800;">السادة: ${q.client}</div>
        <div style="font-size:10px;margin-top:15px;color:#666;">التوقيع / المفوض بالاعتماد</div>
      </div>
    </div>
    ${lh.footerHtml}
  </div>
</div>
</body>
</html>`;
}

export function buildOfficialLetterPrintHtml(params: {
  letter: OfficialLetter;
  company?: Company | null;
  companyName: string;
  letterheadTemplate: LetterheadTemplateId;
  primaryColor: string;
  accentColor: string;
  customLetterhead: string;
  customLogo: string;
  isArabWorld: boolean;
}): string {
  const { letter, company, companyName, letterheadTemplate, primaryColor, accentColor, customLetterhead, customLogo, isArabWorld } = params;
  const p = primaryColor || DEFAULT_PRIMARY_COLOR;
  const a = accentColor || DEFAULT_ACCENT_COLOR;
  const pSoft = hexToRgba(p, 0.05);

  const crNumber = company?.commercial_register || company?.record_no || "";
  const taxNumber = company?.tax_no || "";
  const compPhone = company?.phone || (isArabWorld ? "0539853287" : "");
  const compAddress = company?.address || "المملكة العربية السعودية";
  const compEmail = company?.email || (isArabWorld ? "info@arab1000.online" : "");
  const compWebsite = company?.website || "";
  const compActivity = company?.activity || company?.sub_title || "";

  const lh = buildLetterheadParts({
    templateId: letterheadTemplate,
    primary: p,
    accent: a,
    companyName,
    compActivity,
    crNumber,
    taxNumber,
    compPhone,
    compAddress,
    compEmail,
    compWebsite,
    customLogo,
    customLetterhead,
    isArabWorld,
    docBadgeTitle: "خطاب رسمي معتمد",
    docNo: letter.no,
    docDate: letter.date,
    extraMetaHtml: `<div class="meta-line"><span>المرفقات:</span> <b>${letter.attachments || "لا يوجد"}</b></div>`,
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>خطاب رسمي رقم ${letter.no} - ${companyName} - ${letter.subject}</title>
<style>
* { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
body { margin: 0; background: #cbd5e1; color: ${p}; padding: 20px 0; }
.page { width: 210mm; height: 297mm; margin: 0 auto 20px; background: #ffffff; position: relative; box-shadow: 0 12px 40px rgba(0,0,0,0.18); overflow: hidden; }
.letterhead-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: 1; pointer-events: none; }
${lh.extraPageFrameCss}
.page-content { position: relative; z-index: 10; height: 297mm; display: flex; flex-direction: column; }
.content-with-bg { padding: 12mm 18mm 25mm 18mm; }
.content-corporate { padding: 14mm 18mm 16mm 18mm; }
.top-header-row { display: flex; justify-content: flex-start; align-items: flex-start; min-height: 28mm; margin-bottom: 5mm; }
.doc-header-block { width: 44%; text-align: right; padding-top: 2mm; }
.doc-badge { display: inline-block; background: ${p} !important; color: #ffffff !important; padding: 5px 14px; border-radius: 5px; font-size: 13.5px; font-weight: 900; margin-bottom: 5px; border-right: 4px solid ${a} !important; box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
.meta-line { font-size: 11.5px; color: ${p} !important; margin: 2px 0; font-weight: 700; }
.meta-line span { color: #475569 !important; margin-left: 6px; }
.meta-line b { color: ${p} !important; font-family: monospace; }
.corp-header-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2.5px solid ${p}; margin-bottom: 4mm; }
.corp-gold-bar { height: 3px; margin-top: -2.5px; margin-bottom: 5mm; border-radius: 2px; }
.corp-brand-side { display: flex; align-items: center; gap: 14px; }
.corp-brand-text { text-align: right; }
.corp-brand-name { font-size: 19px; font-weight: 900; line-height: 1.2; }
.corp-brand-activity { font-size: 11px; font-weight: 700; margin-top: 2px; }
.corp-brand-meta { display: flex; gap: 12px; font-size: 10.5px; color: #475569; font-weight: 700; margin-top: 3px; }
.corp-brand-meta b { font-family: monospace; }
.corp-meta-side { text-align: left; }
.corp-footer { margin-top: auto; border-top: 2px solid ${p}; padding-top: 8px; position: relative; }
.corp-footer-accent { position: absolute; top: -2px; right: 0; width: 120px; height: 2px; }
.corp-footer-grid { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #334155; font-weight: 700; }
.corp-footer-comp { font-weight: 900; }
.corp-footer-contact { display: flex; gap: 12px; font-size: 10px; color: #475569; }
.corp-footer-note { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 4px; font-weight: 600; }
.letter-recipient { margin: 6mm 0 3mm; font-size: 14px; font-weight: 800; color: ${p}; }
.letter-subject { background: ${pSoft}; border-right: 4px solid ${a}; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 8px 14px; margin: 3mm 0 5mm; font-size: 13.5px; font-weight: 900; color: ${p}; }
.letter-greeting { font-size: 13px; font-weight: 800; color: ${p}; margin-bottom: 4mm; }
.letter-body { font-size: 13px; line-height: 2; color: #1e293b; font-weight: 600; text-align: justify; margin-bottom: 6mm; white-space: pre-wrap; flex: 1; }
.letter-closing { margin: 4mm 0 6mm; font-size: 13px; line-height: 1.8; color: ${p}; font-weight: 700; text-align: center; }
.letter-signs { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-bottom: 4mm; }
.sign-issuer { text-align: right; font-size: 12px; color: ${p}; }
.sign-official { text-align: center; min-width: 55mm; border-top: 1.5px dashed ${p}; padding-top: 8px; font-size: 12px; color: ${p}; }
.no-print { position: fixed; top: 15px; left: 15px; display: flex; gap: 8px; z-index: 9999; }
.no-print button { border: 0; border-radius: 6px; padding: 8px 14px; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.btn-print { background: #16a34a; }
.btn-close { background: #475569; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  .page { box-shadow: none !important; margin: 0 !important; width: 210mm !important; height: 297mm !important; page-break-after: always; }
  .no-print { display: none !important; }
}
</style>
</head>
<body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">طباعة / حفظ PDF</button>
  <button class="btn-close" onclick="window.close()">إغلاق الصفحة</button>
</div>
<div class="page">
  ${lh.bgHtml}
  <div class="page-content ${lh.useBgImage ? "content-with-bg" : "content-corporate"}">
    ${lh.headerHtml}
    <div class="letter-recipient">
      <b>سعادة / السادة:</b> <span>${letter.recipient}</span> <span style="margin-right:6px;color:${a};">المحترمين</span>
    </div>
    <div class="letter-subject">
      <b>الموضوع:</b> <span>${letter.subject}</span>
    </div>
    <div class="letter-greeting">السلام عليكم ورحمة الله وبركاته ،،، وبعد:</div>
    <div class="letter-body">${letter.content}</div>
    <div class="letter-closing">
      شاكرين ومقدرين لكم كريم تعاونكم وحسن تجاوبكم الدائم،،،<br>
      <b>وتقبلوا فائق التحية والتقدير والامتنان،،،</b>
    </div>
    <div class="letter-signs">
      <div class="sign-issuer">
        <b>الجهة الطالبة والمصدرة للخطاب:</b><br>
        <span style="font-weight:800;color:${a};font-size:13.5px;display:inline-block;margin-top:3px;">${companyName}</span>
        ${crNumber ? `<div style="font-size:10.5px;color:#475569;margin-top:3px;font-weight:700;">سجل تجاري: ${crNumber}</div>` : ""}
        ${taxNumber ? `<div style="font-size:10px;color:#64748b;">الرقم الضريبي: ${taxNumber}</div>` : ""}
      </div>
      <div class="sign-official">
        <b>${letter.signatory_title || "المدير العام"}</b><br>
        <span style="display:block;margin-top:3px;font-weight:900;font-size:13px;">${letter.signatory_name || "م/ إدارة الشركة"}</span>
        ${customLogo ? `<div style="margin-top:6px;"><img src="${customLogo}" style="max-height:38px;max-width:90px;opacity:0.8;object-fit:contain;" /></div>` : ""}
        <div style="font-size:10px;color:#666;margin-top:8px;">الختم والتوقيع الرسمي المعتمد</div>
      </div>
    </div>
    ${lh.footerHtml}
  </div>
</div>
</body>
</html>`;
}
