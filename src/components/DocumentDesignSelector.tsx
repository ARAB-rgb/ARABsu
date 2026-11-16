import React from "react";
import {
  COLOR_PALETTES,
  QUOTE_TEMPLATES,
  LETTERHEAD_TEMPLATES,
  QuoteTemplateId,
  LetterheadTemplateId,
  hexToRgba,
} from "../utils/documentTemplates";
import { Palette, LayoutTemplate, FileText, Check, RotateCcw } from "lucide-react";

interface DocumentDesignSelectorProps {
  mode: "company" | "quote" | "letter";
  companyName?: string;
  quoteTemplate: QuoteTemplateId;
  onChangeQuoteTemplate?: (val: QuoteTemplateId) => void;
  letterheadTemplate: LetterheadTemplateId;
  onChangeLetterheadTemplate: (val: LetterheadTemplateId) => void;
  primaryColor: string;
  onChangePrimaryColor: (val: string) => void;
  accentColor: string;
  onChangeAccentColor: (val: string) => void;
  hasUploadedLetterhead?: boolean;
  customLogoUrl?: string;
  compact?: boolean;
  stacked?: boolean;
  onResetToCompanyDefault?: () => void;
}

export const DocumentDesignSelector: React.FC<DocumentDesignSelectorProps> = ({
  mode,
  companyName = "اسم الشركة",
  quoteTemplate,
  onChangeQuoteTemplate,
  letterheadTemplate,
  onChangeLetterheadTemplate,
  primaryColor,
  onChangePrimaryColor,
  accentColor,
  onChangeAccentColor,
  hasUploadedLetterhead,
  customLogoUrl,
  compact = false,
  stacked = false,
  onResetToCompanyDefault,
}) => {
  const showQuoteShapes = mode === "company" || mode === "quote";
  const showLetterheadTemplates = mode === "company" || mode === "letter" || mode === "quote";

  return (
    <div
      className={`bg-slate-950/60 border border-slate-800 rounded-2xl ${
        compact || stacked ? "p-3.5 space-y-3.5" : "p-5 space-y-5"
      }`}
      dir="rtl"
    >
      {/* Title Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <h4 className="text-xs font-black text-white">
              {mode === "company"
                ? "هوية وتصميم الكليشة وعروض الأسعار للشركة"
                : mode === "quote"
                ? "تخصيص شكل عرض السعر والألوان والكليشة"
                : "تغيير نموذج الكليشة والألوان الرسمية"}
            </h4>
            <p className="text-[10px] text-slate-400">
              اختر القالب الهندسي والألوان المعتمدة وشاهد المعاينة المباشرة قبل الطباعة
            </p>
          </div>
        </div>
        {onResetToCompanyDefault && (
          <button
            type="button"
            onClick={onResetToCompanyDefault}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>استعادة تصميم الشركة</span>
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 ${stacked ? "" : compact ? "lg:grid-cols-12" : "xl:grid-cols-12"} gap-4 items-start`}>
        {/* Controls Column */}
        <div className={`${stacked ? "" : compact ? "lg:col-span-8" : "xl:col-span-8"} space-y-4`}>
          {/* 1. Color Palettes + Custom Color Pickers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-amber-400 flex items-center gap-1.5">
                <span>🎨</span>
                <span>الألوان المستخدمة (لوحة جاهزة أو تخصيص حر)</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg cursor-pointer">
                  <span>أساسي</span>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => onChangePrimaryColor(e.target.value)}
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                    title="اختر اللون الأساسي"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg cursor-pointer">
                  <span>ثانوي</span>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => onChangeAccentColor(e.target.value)}
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                    title="اختر اللون الثانوي / التمييز"
                  />
                </label>
              </div>
            </div>

            <div className={`grid ${stacked ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"} gap-2`}>
              {COLOR_PALETTES.map((pal) => {
                const isSelected =
                  pal.primary.toLowerCase() === primaryColor.toLowerCase() &&
                  pal.accent.toLowerCase() === accentColor.toLowerCase();
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => {
                      onChangePrimaryColor(pal.primary);
                      onChangeAccentColor(pal.accent);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "bg-slate-900 border-amber-400 shadow-md shadow-amber-500/10"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex -space-x-1 space-x-reverse shrink-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 inline-block"
                        style={{ backgroundColor: pal.primary }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 inline-block"
                        style={{ backgroundColor: pal.accent }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-200 truncate flex-1">{pal.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Quote Layout Shape Selector */}
          {showQuoteShapes && onChangeQuoteTemplate && (
            <div className="space-y-2 pt-1 border-t border-slate-800/70">
              <label className="text-[11px] font-black text-blue-400 flex items-center gap-1.5">
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>شكل وتصميم عرض السعر</span>
              </label>
              <div className={`grid ${stacked ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"} gap-2`}>
                {QUOTE_TEMPLATES.map((tpl) => {
                  const isActive = quoteTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => onChangeQuoteTemplate(tpl.id)}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer space-y-1 ${
                        isActive
                          ? "bg-blue-500/15 border-blue-400 shadow-md shadow-blue-500/10"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-black text-white truncate">{tpl.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">{tpl.badge}</span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-snug line-clamp-2">{tpl.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Letterhead Templates Selector (نماذج الكليشة القابلة للتغيير) */}
          {showLetterheadTemplates && (
            <div className="space-y-2 pt-1 border-t border-slate-800/70">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>نماذج الكليشة القابلة للتغيير</span>
                </label>
                {hasUploadedLetterhead && (
                  <span className="text-[9.5px] text-emerald-300 font-bold">
                    ✓ تتوفر كليشة صورة مرفوعة للشركة
                  </span>
                )}
              </div>
              <div className={`grid ${stacked ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"} gap-2`}>
                {LETTERHEAD_TEMPLATES.map((lh) => {
                  const isActive = letterheadTemplate === lh.id;
                  return (
                    <button
                      key={lh.id}
                      type="button"
                      onClick={() => onChangeLetterheadTemplate(lh.id)}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer space-y-1 ${
                        isActive
                          ? "bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/10"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-black text-white truncate">{lh.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">{lh.badge}</span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-snug line-clamp-2">{lh.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live A4 Mini-Preview Column */}
        <div className={`${stacked ? "" : compact ? "lg:col-span-4" : "xl:col-span-4"}`}>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>معاينة حية للشكل والألوان (A4)</span>
              <span className="font-mono text-amber-300">
                {mode === "letter"
                  ? LETTERHEAD_TEMPLATES.find((l) => l.id === letterheadTemplate)?.badge || "كليشة"
                  : QUOTE_TEMPLATES.find((t) => t.id === quoteTemplate)?.badge || "رسمي"}
              </span>
            </div>

            {/* Scaled A4 Wireframe */}
            <div
              className="w-full aspect-[210/270] bg-white rounded-lg shadow-inner overflow-hidden border border-slate-300 flex flex-col relative p-3 text-right"
              style={{ color: primaryColor }}
            >
              {/* Frame for official_seal */}
              {letterheadTemplate === "official_seal" && (
                <div
                  className="absolute inset-1.5 pointer-events-none rounded-sm"
                  style={{ border: `1.5px solid ${primaryColor}`, outline: `1px solid ${accentColor}`, outlineOffset: "1px" }}
                />
              )}

              {/* Stripe for executive_band */}
              {letterheadTemplate === "executive_band" && (
                <div
                  className="absolute top-0 right-0 w-1.5 h-full"
                  style={{ background: `linear-gradient(180deg, ${primaryColor}, ${accentColor})` }}
                />
              )}

              {/* Geometric Top Shape */}
              {letterheadTemplate === "geometric_modern" && (
                <div
                  className="absolute top-0 inset-x-0 h-10"
                  style={{
                    background: primaryColor,
                    clipPath: "polygon(0 0, 100% 0, 100% 70%, 55% 100%, 0 45%)",
                    borderBottom: `2px solid ${accentColor}`,
                  }}
                />
              )}

              {/* Preview Header */}
              <div
                className="relative z-10 flex items-center justify-between pb-2 mb-2"
                style={{
                  backgroundColor:
                    letterheadTemplate === "executive_band" ? primaryColor : "transparent",
                  color:
                    letterheadTemplate === "executive_band" || letterheadTemplate === "geometric_modern"
                      ? "#ffffff"
                      : primaryColor,
                  padding: letterheadTemplate === "executive_band" ? "6px 8px" : "0 0 6px 0",
                  borderRadius: letterheadTemplate === "executive_band" ? "6px" : "0",
                  borderBottom:
                    letterheadTemplate === "executive_band" || letterheadTemplate === "geometric_modern"
                      ? `2px solid ${accentColor}`
                      : letterheadTemplate === "official_seal"
                      ? `2px double ${primaryColor}`
                      : `2px solid ${primaryColor}`,
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="" className="w-5 h-5 object-contain rounded bg-white p-0.5 shrink-0" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black shrink-0"
                      style={{ backgroundColor: accentColor, color: "#fff" }}
                    >
                      🏢
                    </div>
                  )}
                  <div className="truncate">
                    <div className="text-[8.5px] font-black truncate">{companyName || "شركة الأعمال"}</div>
                    <div className="text-[6.5px] opacity-80 truncate">س.ت: 1010xxxxxx</div>
                  </div>
                </div>
                <div
                  className="text-[6.5px] font-black px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor:
                      letterheadTemplate === "executive_band" ? accentColor : primaryColor,
                    color: "#ffffff",
                    borderRight: `2px solid ${accentColor}`,
                  }}
                >
                  {mode === "letter" ? "خطاب رسمي" : "عرض سعر"}
                </div>
              </div>

              {/* Preview Body (Quote vs Letter) */}
              {mode === "letter" ? (
                <div className="relative z-10 flex-1 flex flex-col gap-1.5 mt-1">
                  <div className="text-[7px] font-bold">سعادة / السادة المحترمين</div>
                  <div
                    className="p-1.5 text-[7px] font-black rounded-sm"
                    style={{
                      backgroundColor: hexToRgba(primaryColor, 0.08),
                      borderRight: `3px solid ${accentColor}`,
                    }}
                  >
                    الموضوع: خطاب رسمي معتمد
                  </div>
                  <div className="space-y-1 mt-1 opacity-55">
                    <div className="h-1.5 bg-slate-300 rounded w-full" />
                    <div className="h-1.5 bg-slate-300 rounded w-11/12" />
                    <div className="h-1.5 bg-slate-300 rounded w-10/12" />
                    <div className="h-1.5 bg-slate-300 rounded w-8/12" />
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex-1 flex flex-col gap-1.5">
                  {/* Client Block reflecting Quote Shape */}
                  {quoteTemplate === "modern_executive" ? (
                    <div
                      className="p-1.5 rounded flex justify-between items-center text-[7px]"
                      style={{ backgroundColor: hexToRgba(primaryColor, 0.08), borderRight: `3px solid ${accentColor}` }}
                    >
                      <span className="font-black">بيانات العميل</span>
                      <span className="font-bold opacity-75">المشروع</span>
                    </div>
                  ) : quoteTemplate === "luxury_minimal" ? (
                    <div className="flex justify-between pb-1 border-b border-slate-200 text-[7px]">
                      <span className="font-black">إلى السادة: العميل</span>
                      <span style={{ color: accentColor }} className="font-bold">المشروع</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-4 rounded-sm border border-slate-200"
                          style={{
                            backgroundColor:
                              quoteTemplate === "colored_blocks" && n === 2
                                ? hexToRgba(accentColor, 0.14)
                                : hexToRgba(primaryColor, 0.06),
                            borderTop: `2px solid ${n === 2 && quoteTemplate === "colored_blocks" ? accentColor : primaryColor}`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="rounded-sm overflow-hidden border border-slate-200 mt-0.5">
                    <div
                      className="h-3.5 flex items-center justify-between px-1.5 text-[6px] font-black"
                      style={{
                        backgroundColor: quoteTemplate === "luxury_minimal" ? "transparent" : primaryColor,
                        color: quoteTemplate === "luxury_minimal" ? primaryColor : "#ffffff",
                        borderBottom: `1.5px solid ${accentColor}`,
                      }}
                    >
                      <span>البند والمواصفات</span>
                      <span>الإجمالي</span>
                    </div>
                    {[0, 1, 2].map((r) => (
                      <div
                        key={r}
                        className="h-3 flex items-center justify-between px-1.5 text-[5.5px] border-t border-slate-100"
                        style={{
                          backgroundColor: r % 2 === 1 ? hexToRgba(primaryColor, 0.05) : "#ffffff",
                        }}
                      >
                        <span className="w-16 h-1.5 bg-slate-300 rounded" />
                        <span className="w-8 h-1.5 rounded" style={{ backgroundColor: hexToRgba(accentColor, 0.45) }} />
                      </div>
                    ))}
                  </div>

                  {/* Summary Preview */}
                  <div
                    className={`mt-auto p-1.5 rounded flex justify-between items-center text-[7px] font-black ${
                      quoteTemplate === "modern_executive" || quoteTemplate === "colored_blocks" ? "text-white" : ""
                    }`}
                    style={{
                      backgroundColor:
                        quoteTemplate === "modern_executive" || quoteTemplate === "colored_blocks"
                          ? primaryColor
                          : hexToRgba(primaryColor, 0.08),
                      borderTop: `2px solid ${accentColor}`,
                    }}
                  >
                    <span>الإجمالي الشامل</span>
                    <span style={{ color: quoteTemplate === "modern_executive" || quoteTemplate === "colored_blocks" ? accentColor : primaryColor }}>
                      15,000 ريال
                    </span>
                  </div>
                </div>
              )}

              {/* Preview Footer */}
              <div
                className="relative z-10 mt-2 pt-1 flex justify-between items-center text-[5.5px] font-bold"
                style={{ borderTop: `1.5px solid ${primaryColor}` }}
              >
                <span className="truncate">{companyName || "اسم الشركة"}</span>
                <span style={{ color: accentColor }}>05xxxxxxxx</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
