/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart, Package, Truck, ReceiptText, Barcode, Search, Plus, Trash2,
  Edit2, Calendar, Check, X, AlertCircle, Printer, Download, Coins, Briefcase,
  Eye, ClipboardList, Settings, TrendingUp, RefreshCw, Minus, PlusCircle,
  CreditCard, Landmark, Clock, FileText, ChevronDown, CheckCircle2, AlertTriangle,
  Building, Phone, ArrowRight, User, Layers, Tag, Sliders, ShieldCheck, EyeOff,
  Sparkles, Store, Lock, Unlock, HelpCircle
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { sb, generateNextNo } from "../db";
import {
  User as AuthUser, Company, Installment, Product, Supplier,
  PurchaseInvoice, PurchaseItem, PosSale, PosSaleItem, PosCategory, PosCompanyConfig
} from "../types";

interface PosCashierModuleProps {
  currentUser: AuthUser | null;
  companies: Company[];
  selectedCompanyId: string;
  clients: Installment[];
  treasuries: string[];
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onRefreshEverything?: () => Promise<void>;
}

// Preset Activity Packs for quick initialization
export const ACTIVITY_PRESETS: {
  [key: string]: {
    label: string;
    icon: string;
    description: string;
    defaultUnits: string[];
    hideBarcode: boolean;
    categories: { name: string; icon: string; color: string; description: string }[];
  };
} = {
  "بقالة / تموينات": {
    label: "بقالة وسوبرماركت ومواد غذائية",
    icon: "🏪",
    description: "مناسب للبقالات ومحلات التموينات والتجزئة السريعة مع دعم الباركود والمبيعات النقدية والشبكة السريعة",
    defaultUnits: ["حبة", "كرتون", "شريط", "كيلو", "كيس", "حزمة"],
    hideBarcode: false,
    categories: [
      { name: "ألبان وأجبان", icon: "🧀", color: "blue", description: "حليب، أجبان، زبادي ومشتقاتها" },
      { name: "معلبات وزيوت", icon: "🥫", color: "amber", description: "زيوت الطبخ، معلبات وتونة وبقوليات" },
      { name: "مشروبات ومياه", icon: "🥤", color: "sky", description: "مياه معبأة، عصائر ومشروبات غازية" },
      { name: "مخبوزات وتوست", icon: "🍞", color: "orange", description: "خبز، صامولي، كيك وتوست" },
      { name: "خضار وفواكه", icon: "🍎", color: "emerald", description: "خضروات وفاكهة طازجة بالوزن والعدد" },
      { name: "حلويات وتسالي", icon: "🍫", color: "rose", description: "شوكولاتة، بسكويت، شيبس ومكسرات" },
      { name: "منظفات وعناية", icon: "🧼", color: "purple", description: "صابون، معقمات ومستلزمات نظافة" },
      { name: "عام وتجزئة", icon: "📦", color: "slate", description: "أصناف عامة واستهلاكية متنوعة" },
    ]
  },
  "مغسلة ملابس": {
    label: "مغسلة ملابس ودراي كلين",
    icon: "👔",
    description: "مخصص للمغاسل والتنظيف الجاف بدون الحاجة لباركود، مع أزرار خدمات سريعة بالقطعة وتتبع العملاء",
    defaultUnits: ["قطعة", "طقم", "حبة", "متر", "زوج"],
    hideBarcode: true,
    categories: [
      { name: "غسيل وكوي", icon: "👔", color: "blue", description: "خدمة غسيل وكوي الملابس العادية" },
      { name: "كوي فقط", icon: "♨️", color: "amber", description: "كوي الملابس بالبخار والكبس" },
      { name: "غسيل جاف (دراي كلين)", icon: "✨", color: "purple", description: "تنظيف جاف للبدل والفساتين والصوف" },
      { name: "بطانيات ومفارش", icon: "🛏️", color: "indigo", description: "غسيل المفارش والبطانيات والوسائد" },
      { name: "سجاد وموكيت", icon: "🧶", color: "emerald", description: "غسيل السجاد والموكيت بالمتر أو القطعة" },
      { name: "أشمغة وثياب", icon: "👘", color: "sky", description: "غسيل وتنشية الأشمغة والثياب البيضاء" },
      { name: "خدمة مستعجلة (VIP)", icon: "⚡", color: "rose", description: "تسليم فوري خلال ساعات معدودة" },
    ]
  },
  "مواد بناء وتوريد": {
    label: "مواد بناء وتشطيب ومقاولات",
    icon: "🏗️",
    description: "مخصص لمستودعات مواد البناء والتوريد بالطن والكيس والمتر مع دعم البيع الآجل وعقود المشاريع",
    defaultUnits: ["كيس", "طن", "متر", "حبة", "لوح", "سطل", "كرتون"],
    hideBarcode: false,
    categories: [
      { name: "أسمنت وبحص", icon: "🏗️", color: "slate", description: "أسمنت بورتلاندي ومقاوم وبحص ورمل" },
      { name: "حديد تسليح وشبك", icon: "🧱", color: "amber", description: "حديد تسليح بمختلف المقاسات وشبك أرضيات" },
      { name: "سباكة وعوازل", icon: "🚰", color: "blue", description: "مواسير، محابس وعوازل مائية وحرارية" },
      { name: "كهرباء وإنارة", icon: "💡", color: "yellow", description: "أسلاك، قواطع ولمبات وأفياش كهربائية" },
      { name: "دهانات وبويات", icon: "🎨", color: "rose", description: "دهانات أساسية وديكورية ومعجون" },
      { name: "أدوات ومعدات", icon: "🔨", color: "emerald", description: "دريلات، مناشير، مسامير ومعدات يدوية" },
      { name: "بلاط وسيراميك", icon: "🔲", color: "purple", description: "سيراميك وبورسلان وغراء وفواصل" },
    ]
  },
  "خدمات عامة ومقاولات": {
    label: "خدمات عامة واستشارات وصيانة",
    icon: "🔧",
    description: "مخصص للأنشطة الخدمية والمقاولات والصيانة وإصدار الفواتير للشركات والجهات",
    defaultUnits: ["خدمة", "عقد", "ساعة", "يومية", "مستخلص", "تقرير"],
    hideBarcode: true,
    categories: [
      { name: "عقود تشغيل وصيانة", icon: "👷", color: "blue", description: "عقود سنوية وشهرية لتشغيل المباني" },
      { name: "صيانة سباكة وكهرباء", icon: "🔧", color: "amber", description: "أعمال الصيانة الدورية والطارئة" },
      { name: "استشارات ومعاينات", icon: "📋", color: "purple", description: "كشوفات هندسية وفنية ميدانية" },
      { name: "أتعاب إدارية وتعقيب", icon: "📑", color: "emerald", description: "رسوم الخدمات الإدارية والتخليص" },
      { name: "توريد عمالة وفنيين", icon: "👥", color: "sky", description: "عمالة تشغيلية ومساعدين للمشاريع" },
      { name: "معدات ونقل ميداني", icon: "🚜", color: "orange", description: "أجرة معدات ونقل لوجستي" },
    ]
  },
  "مقهى ومطعم": {
    label: "مقهى ومطعم وبوفيه",
    icon: "☕",
    description: "مناسب للمقاهي والمطاعم مع أزرار وجبات سريعة وإضافات وحساب سريع للضريبة والمبالغ",
    defaultUnits: ["كوب", "وجبة", "حبة", "علبة", "ساندوتش"],
    hideBarcode: false,
    categories: [
      { name: "مشروبات ساخنة", icon: "☕", color: "amber", description: "قهوة، شاي، لاتيه ومشروبات دافئة" },
      { name: "عصائر ومشروبات باردة", icon: "🧃", color: "sky", description: "عصائر طازجة، موهيتو ومشروبات غازية" },
      { name: "وجبات وساندوتشات", icon: "🍔", color: "orange", description: "برجر، شاورما وساندوتشات ساخنة" },
      { name: "حلا ومخبوزات", icon: "🍰", color: "rose", description: "كيك، كوكيز وكرواسون وحلويات" },
      { name: "مقبلات وإضافات", icon: "🍟", color: "emerald", description: "بطاطس، صوصات ومقبلات جانبية" },
    ]
  },
  "تجارة عامة": {
    label: "تجارة عامة وتجزئة متنوعة",
    icon: "🛍️",
    description: "مناسب لمتاجر الإلكترونيات، الإكسسوارات، العطور، والأنشطة التجارية الشاملة",
    defaultUnits: ["قطعة", "حبة", "كرتون", "طقم", "درزن"],
    hideBarcode: false,
    categories: [
      { name: "إلكترونيات وإكسسوارات", icon: "📱", color: "blue", description: "شواحن، كابلات وسماعات وملحقات" },
      { name: "عطور ومستحضرات", icon: "✨", color: "rose", description: "عطور شرقية وغربية وعناية شخصية" },
      { name: "ملابس وأقمشة", icon: "👗", color: "purple", description: "أقمشة وملابس جاهزة وإكسسوارات" },
      { name: "قرطاسية ومكتبيات", icon: "📚", color: "amber", description: "دفاتر، أقلام ومستلزمات مكتبية" },
      { name: "أصناف متنوعة", icon: "🏷️", color: "emerald", description: "بضائع عامة ومتنوعة" },
    ]
  }
};

export function PosCashierModule({
  currentUser,
  companies,
  selectedCompanyId,
  clients,
  treasuries,
  showToast,
  onRefreshEverything,
}: PosCashierModuleProps) {
  // Navigation sub-tabs
  type TabKey = "pos" | "products" | "suppliers" | "purchases" | "sales_history" | "categories" | "settings";
  const [activeTab, setActiveTab] = useState<TabKey>("pos");

  // Admin / Manager check
  const isAdminOrManager =
    currentUser?.role === "admin" ||
    currentUser?.role === "supervisor" ||
    !!(currentUser?.perms && (currentUser.perms as any).users);

  // Real Database Data State (NO mock data)
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [posConfigs, setPosConfigs] = useState<PosCompanyConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active Company Information
  const activeCompany = companies.find(c => c.id === selectedCompanyId) || companies[0] || {
    id: "arab_world",
    name: "شركة عرب وورلد للمقاولات والتجارة",
    tax_no: "300099988800003",
    commercial_register: "1010777555",
    phone: "0556446888",
    address: "المملكة العربية السعودية - الرياض"
  };

  // Resolve Company Configuration (or construct standard defaults)
  const activeCompanyConfig: PosCompanyConfig = posConfigs.find(c => c.company_id === activeCompany.id) || {
    id: `cfg_${activeCompany.id}`,
    company_id: activeCompany.id,
    activity_type: "بقالة / تموينات",
    is_enabled: true,
    show_barcode: true,
    show_cost_price: false, // Default false for cashiers; controlled exclusively by admin
    show_discount: true,
    show_customer_select: true,
    show_units: true,
    show_tax: true,
    allow_price_override: true,
    show_quick_amounts: true,
    show_notes: true,
    receipt_header: activeCompany.name,
    receipt_footer: "شكراً لتعاملكم معنا ويسعدنا دائماً خدمتكم",
    default_treasury: treasuries[0] || "خزنة الكاشير الرئيسية",
  };

  // Editable config state in settings tab
  const [editingConfig, setEditingConfig] = useState<PosCompanyConfig>(activeCompanyConfig);

  useEffect(() => {
    setEditingConfig(activeCompanyConfig);
  }, [activeCompany.id, posConfigs]);

  // ==========================================
  // DATA LOADING
  // ==========================================
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, suppRes, purRes, salesRes, catRes, cfgRes] = await Promise.all([
        sb.from("products").select("*").order("created_at", { ascending: false }),
        sb.from("suppliers").select("*").order("created_at", { ascending: false }),
        sb.from("purchases").select("*").order("created_at", { ascending: false }),
        sb.from("pos_sales").select("*").order("created_at", { ascending: false }),
        sb.from("pos_categories").select("*").order("sort_order", { ascending: true }),
        sb.from("pos_configs").select("*"),
      ]);

      const allProds: Product[] = prodRes.data || [];
      const allSupps: Supplier[] = suppRes.data || [];
      const allPurs: PurchaseInvoice[] = purRes.data || [];
      const allSales: PosSale[] = salesRes.data || [];
      const allCats: PosCategory[] = catRes.data || [];
      const allConfigs: PosCompanyConfig[] = cfgRes.data || [];

      // Filter by active company if specified
      const compFilter = (item: any) =>
        !selectedCompanyId || selectedCompanyId === "all" || !item.company_id || item.company_id === selectedCompanyId;

      setProducts(allProds.filter(compFilter));
      setSuppliers(allSupps.filter(compFilter));
      setPurchases(allPurs.filter(compFilter));
      setPosSales(allSales.filter(compFilter));
      setCategories(allCats.filter(compFilter));
      setPosConfigs(allConfigs);
    } catch (err: any) {
      console.error("Error loading POS data:", err);
      showToast("تعذر تحميل بيانات الكاشير: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedCompanyId]);

  // ==========================================
  // POS TERMINAL STATE
  // ==========================================
  interface CartItem extends PosSaleItem {
    max_stock: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [customerType, setCustomerType] = useState<"cash" | "client" | "custom">("cash");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customCustomerPhone, setCustomCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosSale["payment_method"]>("كاش");
  const [selectedTreasury, setSelectedTreasury] = useState(
    activeCompanyConfig.default_treasury || treasuries[0] || "خزنة الكاشير"
  );
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isVatEnabled, setIsVatEnabled] = useState(activeCompanyConfig.show_tax !== false);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [activeInvoiceForPrint, setActiveInvoiceForPrint] = useState<PosSale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [notes, setNotes] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync VAT toggle with company config
  useEffect(() => {
    setIsVatEnabled(activeCompanyConfig.show_tax !== false);
    if (activeCompanyConfig.default_treasury) {
      setSelectedTreasury(activeCompanyConfig.default_treasury);
    }
  }, [activeCompanyConfig]);

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const allowedDiscount = activeCompanyConfig.show_discount ? Number(discountAmount) || 0 : 0;
  const discountVal = Math.min(cartSubtotal, Math.max(0, allowedDiscount));
  const afterDiscount = Math.max(0, cartSubtotal - discountVal);
  const vatRate = isVatEnabled && activeCompanyConfig.show_tax !== false ? 0.15 : 0;
  const vatAmount = afterDiscount * vatRate;
  const grandTotal = Math.round((afterDiscount + vatAmount) * 100) / 100;
  const cashGiven = Number(cashTendered) || 0;
  const changeReturned =
    paymentMethod === "كاش" && cashGiven >= grandTotal ? Math.round((cashGiven - grandTotal) * 100) / 100 : 0;

  // Add Product to Cart
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.stock_qty <= 0) {
      showToast(`⚠️ تنبيه: مخزون المنتج (${product.name}) غير متوفر حالياً!`, "warning");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantityToAdd;
        if (newQty > product.stock_qty) {
          showToast(`⚠️ الكمية المطلوبة تتجاوز المتاح في المخزن (${product.stock_qty} ${product.unit})`, "warning");
          return prev;
        }
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: newQty,
                subtotal: Math.round(newQty * item.unit_price * 100) / 100,
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          product_id: product.id,
          product_name: product.name,
          barcode: product.barcode,
          unit: product.unit || "حبة",
          quantity: quantityToAdd,
          unit_price: product.selling_price,
          discount: 0,
          subtotal: Math.round(quantityToAdd * product.selling_price * 100) / 100,
          max_stock: product.stock_qty,
        };
        return [...prev, newItem];
      }
    });
  };

  const updateCartItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.product_id === productId) {
          if (newQty > item.max_stock) {
            showToast(`⚠️ الكمية المتاحة في المخزن فقط ${item.max_stock} ${item.unit}`, "warning");
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            subtotal: Math.round(newQty * item.unit_price * 100) / 100,
          };
        }
        return item;
      })
    );
  };

  const updateCartItemPrice = (productId: string, newPrice: number) => {
    // Only allow if admin or company allowed price override
    if (!isAdminOrManager && !activeCompanyConfig.allow_price_override) {
      showToast("⚠️ تعديل السعر المباشر مقفل من قِبل إدارة المنشأة!", "warning");
      return;
    }
    const cleanPrice = Math.max(0, newPrice);
    setCart(prev =>
      prev.map(item =>
        item.product_id === productId
          ? {
              ...item,
              unit_price: cleanPrice,
              subtotal: Math.round(item.quantity * cleanPrice * 100) / 100,
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setCashTendered("");
    setNotes("");
  };

  // Barcode Scanning / Manual Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const clean = barcodeInput.trim().toLowerCase();
    const matched = products.find(
      p =>
        p.barcode.toLowerCase() === clean ||
        p.barcode.toLowerCase().includes(clean) ||
        p.name.toLowerCase().includes(clean)
    );

    if (matched) {
      addToCart(matched, 1);
      setBarcodeInput("");
      showToast(`✓ تمت إضافة (${matched.name}) إلى السلة`, "success");
    } else {
      showToast("⚠️ لم يتم العثور على منتج بهذا الباركود!", "warning");
    }
    barcodeInputRef.current?.focus();
  };

  // Complete POS Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast("⚠️ سلة الكاشير فارغة! أضف منتجات أولاً لإتمام البيع", "warning");
      return;
    }

    if (paymentMethod === "كاش" && cashGiven < grandTotal && cashGiven > 0) {
      showToast("⚠️ المبلغ النقدي المستلم أقل من إجمالي الفاتورة!", "warning");
      return;
    }

    let customerName = "عميل نقدي";
    let customerPhone = "";
    let customerId = "";

    if (activeCompanyConfig.show_customer_select !== false) {
      if (customerType === "client") {
        const selectedClient = clients.find(c => c.id === selectedClientId);
        if (selectedClient) {
          customerName = selectedClient.client;
          customerPhone = selectedClient.phone;
          customerId = selectedClient.id;
        }
      } else if (customerType === "custom") {
        customerName = customCustomerName.trim() || "عميل نقدي";
        customerPhone = customCustomerPhone.trim();
      }
    }

    if (paymentMethod === "آجل / على الحساب" && customerType === "cash") {
      showToast("⚠️ البيع الآجل يتطلب تحديد العميل من القائمة أو إدخال بياناته!", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const nextNo = generateNextNo("AW-POS", posSales, "sale_no");
      const newSaleId = "pos_" + Date.now();

      const newSale: PosSale = {
        id: newSaleId,
        company_id: activeCompany.id,
        sale_no: nextNo,
        cashier_name: currentUser?.name || "الكاشير",
        cashier_id: currentUser?.id,
        date: new Date().toISOString().slice(0, 10),
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_id: customerId || undefined,
        items: cart.map(({ max_stock, ...rest }) => rest),
        subtotal: cartSubtotal,
        discount_amount: discountVal,
        tax_rate: vatRate,
        tax_amount: vatAmount,
        total: grandTotal,
        payment_method: paymentMethod,
        cash_amount: paymentMethod === "كاش" ? grandTotal : 0,
        card_amount: paymentMethod === "مدى / شبكة" ? grandTotal : 0,
        cash_tendered: paymentMethod === "كاش" ? cashGiven || grandTotal : undefined,
        change_returned: changeReturned,
        treasury: selectedTreasury,
        notes: notes.trim() || undefined,
        created_at: new Date().toISOString(),
      };

      // 1. Save Sale to pos_sales collection
      const { error: saleErr } = await sb.from("pos_sales").insert(newSale);
      if (saleErr) throw saleErr;

      // 2. Real-time Inventory Deduction: Deduct sold items from database products
      for (const item of cart) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const updatedStock = Math.max(0, prod.stock_qty - item.quantity);
          await sb
            .from("products")
            .update({ stock_qty: updatedStock, updated_at: new Date().toISOString() })
            .eq("id", prod.id);
        }
      }

      // 3. Update local state
      setPosSales(prev => [newSale, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const soldItem = cart.find(ci => ci.product_id === p.id);
          if (soldItem) {
            return { ...p, stock_qty: Math.max(0, p.stock_qty - soldItem.quantity) };
          }
          return p;
        })
      );

      // 4. Open Thermal Receipt Preview
      setActiveInvoiceForPrint(newSale);
      setShowReceiptModal(true);
      clearCart();

      showToast(`✓ تم تسجيل عملية البيع رقم (${newSale.sale_no}) وخصم المخزون بنجاح!`, "success");
      if (onRefreshEverything) {
        onRefreshEverything().catch(() => {});
      }
    } catch (err: any) {
      console.error("Error completing sale:", err);
      showToast("تعذر إتمام عملية البيع: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // DYNAMIC CATEGORY MANAGEMENT
  // ==========================================
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PosCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("🏷️");
  const [catColor, setCatColor] = useState("amber");
  const [catActivity, setCatActivity] = useState(activeCompanyConfig.activity_type || "بقالة / تموينات");
  const [catDescription, setCatDescription] = useState("");
  const [showPresetPackModal, setShowPresetPackModal] = useState(false);
  const [selectedPresetPackKey, setSelectedPresetPackKey] = useState(activeCompanyConfig.activity_type || "بقالة / تموينات");

  const EMOJI_OPTIONS = [
    "🏷️", "🧀", "🥫", "🥤", "🍞", "🍎", "🍫", "🧼", "👔", "♨️", "✨",
    "🛏️", "🧶", "👘", "⚡", "🏗️", "🧱", "🚰", "💡", "🎨", "🔨", "🔲",
    "👷", "🔧", "📋", "📑", "👥", "🚜", "☕", "🧃", "🍔", "🍰", "🍟",
    "📱", "👗", "📚", "🛒", "📦", "🏪", "🍽️", "🥩", "🍗", "🍚", "🧴"
  ];

  const COLOR_OPTIONS = [
    { label: "ذهبي / كهرماني", value: "amber", bg: "bg-amber-500", text: "text-amber-400" },
    { label: "أزرق سماوي", value: "blue", bg: "bg-blue-500", text: "text-blue-400" },
    { label: "زمردي أخضر", value: "emerald", bg: "bg-emerald-500", text: "text-emerald-400" },
    { label: "بنفسجي ملكي", value: "purple", bg: "bg-purple-500", text: "text-purple-400" },
    { label: "وردي قرمزي", value: "rose", bg: "bg-rose-500", text: "text-rose-400" },
    { label: "برتقالي دافئ", value: "orange", bg: "bg-orange-500", text: "text-orange-400" },
    { label: "فولاذي رمادي", value: "slate", bg: "bg-slate-500", text: "text-slate-400" },
  ];

  const handleOpenAddCategory = (initialActivity?: string) => {
    setEditingCategory(null);
    setCatName("");
    setCatIcon("🏷️");
    setCatColor("amber");
    setCatActivity(initialActivity || activeCompanyConfig.activity_type || "بقالة / تموينات");
    setCatDescription("");
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = (cat: PosCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || "🏷️");
    setCatColor(cat.color || "amber");
    setCatActivity(cat.activity_type || activeCompanyConfig.activity_type || "بقالة / تموينات");
    setCatDescription(cat.description || "");
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast("⚠️ اسم التصنيف حقل إجباري!", "warning");
      return;
    }

    const payload: PosCategory = {
      id: editingCategory ? editingCategory.id : `cat_${Date.now()}`,
      company_id: activeCompany.id,
      name: catName.trim(),
      icon: catIcon.trim() || "🏷️",
      color: catColor,
      activity_type: catActivity,
      description: catDescription.trim() || undefined,
      sort_order: editingCategory?.sort_order ?? categories.length,
      created_at: editingCategory?.created_at || new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      if (editingCategory) {
        const { error } = await sb.from("pos_categories").update(payload).eq("id", editingCategory.id);
        if (error) throw error;
        setCategories(prev => prev.map(c => (c.id === editingCategory.id ? payload : c)));
        showToast("✓ تم تحديث بيانات التصنيف بنجاح", "success");
      } else {
        const { error } = await sb.from("pos_categories").insert(payload);
        if (error) throw error;
        setCategories(prev => [...prev, payload]);
        showToast("✓ تم إنشاء التصنيف الجديد بنجاح", "success");
      }
      setShowCategoryModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حفظ التصنيف: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string, name: string) => {
    // Confirmation check
    const usedCount = products.filter(p => p.category === name).length;
    if (usedCount > 0) {
      showToast(`⚠️ لا يمكن حذف التصنيف (${name}) لأنه مرتبط بـ ${usedCount} منتج بالمخزون!`, "warning");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await sb.from("pos_categories").delete().eq("id", catId);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== catId));
      if (selectedCategory === name) setSelectedCategory("all");
      showToast(`✓ تم حذف التصنيف (${name}) بنجاح`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حذف التصنيف: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Instant apply preset category pack for selected activity
  const handleApplyPresetPack = async (packKey: string) => {
    const pack = ACTIVITY_PRESETS[packKey];
    if (!pack) return;

    setIsLoading(true);
    try {
      const newCats: PosCategory[] = [];
      let order = categories.length;

      for (const item of pack.categories) {
        const exists = categories.some(
          c => c.name.toLowerCase() === item.name.toLowerCase() && c.company_id === activeCompany.id
        );
        if (!exists) {
          const catItem: PosCategory = {
            id: `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            company_id: activeCompany.id,
            name: item.name,
            icon: item.icon,
            color: item.color,
            activity_type: packKey,
            description: item.description,
            sort_order: order++,
            created_at: new Date().toISOString(),
          };
          await sb.from("pos_categories").insert(catItem);
          newCats.push(catItem);
        }
      }

      setCategories(prev => [...prev, ...newCats]);
      setShowPresetPackModal(false);
      showToast(`✓ تم استيراد وتطبيق (${newCats.length}) تصنيفاً لنشاط "${packKey}" بنجاح!`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("تعذر تطبيق باقة التصنيفات: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // COMPANY POS CONFIGURATION SAVE
  // ==========================================
  const handleSavePosConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrManager) {
      showToast("⚠️ تعديل إعدادات الكاشير مقتصر على المدير والمسؤولين فقط!", "error");
      return;
    }

    setIsLoading(true);
    try {
      const payload: PosCompanyConfig = {
        ...editingConfig,
        id: `cfg_${activeCompany.id}`,
        company_id: activeCompany.id,
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.name || "المدير",
      };

      const { error } = await sb.from("pos_configs").upsert(payload);
      if (error) throw error;

      setPosConfigs(prev => {
        const idx = prev.findIndex(c => c.company_id === activeCompany.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [...prev, payload];
      });

      showToast(`✓ تم حفظ وتحديث إعدادات كاشير منشأة (${activeCompany.name}) بنجاح!`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حفظ إعدادات الكاشير: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // PRODUCTS CRUD
  // ==========================================
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodBarcode, setProdBarcode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("عام");
  const [prodUnit, setProdUnit] = useState("حبة");
  const [prodCostPrice, setProdCostPrice] = useState("");
  const [prodSellingPrice, setProdSellingPrice] = useState("");
  const [prodMinSellingPrice, setProdMinSellingPrice] = useState("");
  const [prodStockQty, setProdStockQty] = useState("");
  const [prodMinStockAlert, setProdMinStockAlert] = useState("5");
  const [prodSupplierId, setProdSupplierId] = useState("");
  const [prodLocation, setProdLocation] = useState("");
  const [prodNotes, setProdNotes] = useState("");

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdBarcode("AW-" + Math.floor(100000 + Math.random() * 900000));
    setProdName("");
    setProdCategory(categories[0]?.name || "عام");
    setProdUnit(
      ACTIVITY_PRESETS[activeCompanyConfig.activity_type]?.defaultUnits[0] || "حبة"
    );
    setProdCostPrice("");
    setProdSellingPrice("");
    setProdMinSellingPrice("");
    setProdStockQty("0");
    setProdMinStockAlert("5");
    setProdSupplierId("");
    setProdLocation("");
    setProdNotes("");
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdBarcode(prod.barcode);
    setProdName(prod.name);
    setProdCategory(prod.category || "عام");
    setProdUnit(prod.unit || "حبة");
    setProdCostPrice(String(prod.cost_price || ""));
    setProdSellingPrice(String(prod.selling_price || ""));
    setProdMinSellingPrice(String(prod.min_selling_price || ""));
    setProdStockQty(String(prod.stock_qty || "0"));
    setProdMinStockAlert(String(prod.min_stock_alert || "5"));
    setProdSupplierId(prod.supplier_id || "");
    setProdLocation(prod.location || "");
    setProdNotes(prod.notes || "");
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      showToast("⚠️ اسم المنتج حقل إجباري!", "warning");
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === prodSupplierId);

    const payload: Product = {
      id: editingProduct ? editingProduct.id : "prod_" + Date.now(),
      company_id: activeCompany.id,
      barcode: prodBarcode.trim() || `GEN-${Date.now().toString().slice(-6)}`,
      name: prodName.trim(),
      category: prodCategory.trim() || "عام",
      unit: prodUnit.trim() || "حبة",
      cost_price: Number(prodCostPrice) || 0,
      selling_price: Number(prodSellingPrice) || 0,
      min_selling_price: Number(prodMinSellingPrice) || Number(prodSellingPrice) || 0,
      stock_qty: Number(prodStockQty) || 0,
      min_stock_alert: Number(prodMinStockAlert) || 5,
      supplier_id: prodSupplierId || undefined,
      supplier_name: matchedSupplier ? matchedSupplier.name : undefined,
      location: prodLocation.trim() || undefined,
      notes: prodNotes.trim() || undefined,
      created_at: editingProduct?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      if (editingProduct) {
        const { error } = await sb.from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
        setProducts(prev => prev.map(p => (p.id === editingProduct.id ? payload : p)));
        showToast("✓ تم تحديث بيانات المنتج والمخزون بنجاح", "success");
      } else {
        const { error } = await sb.from("products").insert(payload);
        if (error) throw error;
        setProducts(prev => [payload, ...prev]);
        showToast("✓ تم تسجيل المنتج الجديد في المخزون بنجاح", "success");
      }
      setShowProductModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حفظ المنتج: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    setIsLoading(true);
    try {
      const { error } = await sb.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast(`✓ تم حذف المنتج (${name}) بنجاح`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حذف المنتج: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // SUPPLIERS CRUD
  // ==========================================
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [suppName, setSuppName] = useState("");
  const [suppPhone, setSuppPhone] = useState("");
  const [suppCr, setSuppCr] = useState("");
  const [suppTax, setSuppTax] = useState("");
  const [suppCity, setSuppCity] = useState("");
  const [suppAddress, setSuppAddress] = useState("");
  const [suppNotes, setSuppNotes] = useState("");

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSuppName("");
    setSuppPhone("");
    setSuppCr("");
    setSuppTax("");
    setSuppCity("الرياض");
    setSuppAddress("");
    setSuppNotes("");
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (supp: Supplier) => {
    setEditingSupplier(supp);
    setSuppName(supp.name);
    setSuppPhone(supp.phone);
    setSuppCr(supp.commercial_register || "");
    setSuppTax(supp.tax_number || "");
    setSuppCity(supp.city || "الرياض");
    setSuppAddress(supp.address || "");
    setSuppNotes(supp.notes || "");
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim() || !suppPhone.trim()) {
      showToast("⚠️ اسم المورد ورقم الجوال حقول إجبارية!", "warning");
      return;
    }

    const payload: Supplier = {
      id: editingSupplier ? editingSupplier.id : "supp_" + Date.now(),
      company_id: activeCompany.id,
      name: suppName.trim(),
      phone: suppPhone.trim(),
      commercial_register: suppCr.trim() || undefined,
      tax_number: suppTax.trim() || undefined,
      city: suppCity.trim() || undefined,
      address: suppAddress.trim() || undefined,
      balance: editingSupplier?.balance || 0,
      notes: suppNotes.trim() || undefined,
      created_at: editingSupplier?.created_at || new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      if (editingSupplier) {
        const { error } = await sb.from("suppliers").update(payload).eq("id", editingSupplier.id);
        if (error) throw error;
        setSuppliers(prev => prev.map(s => (s.id === editingSupplier.id ? payload : s)));
        showToast("✓ تم تحديث بيانات المورد بنجاح", "success");
      } else {
        const { error } = await sb.from("suppliers").insert(payload);
        if (error) throw error;
        setSuppliers(prev => [payload, ...prev]);
        showToast("✓ تم تسجيل المورد الحقيقي في الدليل بنجاح", "success");
      }
      setShowSupplierModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حفظ المورد: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // PURCHASES (STOCK REPLENISHMENT)
  // ==========================================
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purSupplierId, setPurSupplierId] = useState("");
  const [purInvoiceNo, setPurInvoiceNo] = useState("");
  const [purDate, setPurDate] = useState(new Date().toISOString().slice(0, 10));
  const [purPaymentMethod, setPurPaymentMethod] = useState<PurchaseInvoice["payment_method"]>("كاش");
  const [purTreasury, setPurTreasury] = useState(treasuries[0] || "خزنة الكاشير");
  const [purItems, setPurItems] = useState<PurchaseItem[]>([]);
  const [purPaidAmount, setPurPaidAmount] = useState("");
  const [purNotes, setPurNotes] = useState("");

  const handleOpenAddPurchase = () => {
    setPurSupplierId(suppliers[0]?.id || "");
    setPurInvoiceNo("PUR-" + Math.floor(1000 + Math.random() * 9000));
    setPurDate(new Date().toISOString().slice(0, 10));
    setPurPaymentMethod("كاش");
    setPurTreasury(treasuries[0] || "خزنة الكاشير");
    setPurItems([]);
    setPurPaidAmount("");
    setPurNotes("");
    setShowPurchaseModal(true);
  };

  const addPurchaseRow = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    setPurItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        barcode: prod.barcode,
        unit: prod.unit,
        quantity: 10,
        unit_cost: prod.cost_price || 0,
        subtotal: (prod.cost_price || 0) * 10,
      },
    ]);
  };

  const updatePurchaseRow = (index: number, field: "quantity" | "unit_cost", val: number) => {
    setPurItems(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const nextQty = field === "quantity" ? Math.max(0, val) : item.quantity;
        const nextCost = field === "unit_cost" ? Math.max(0, val) : item.unit_cost;
        return {
          ...item,
          quantity: nextQty,
          unit_cost: nextCost,
          subtotal: Math.round(nextQty * nextCost * 100) / 100,
        };
      })
    );
  };

  const removePurchaseRow = (index: number) => {
    setPurItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const purSubtotal = purItems.reduce((sum, item) => sum + item.subtotal, 0);
  const purTotal = purSubtotal;
  const purPaidNum = Number(purPaidAmount) || purTotal;
  const purRemaining = Math.max(0, purTotal - purPaidNum);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierId) {
      showToast("⚠️ يرجى اختيار المورد من القائمة!", "warning");
      return;
    }
    if (purItems.length === 0) {
      showToast("⚠️ يجب إضافة صنف واحد على الأقل في فاتورة الشراء!", "warning");
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === purSupplierId);
    const invoiceId = "pur_" + Date.now();

    const newPurchase: PurchaseInvoice = {
      id: invoiceId,
      company_id: activeCompany.id,
      invoice_no: purInvoiceNo.trim() || generateNextNo("PUR", purchases, "invoice_no"),
      supplier_id: purSupplierId,
      supplier_name: matchedSupplier ? matchedSupplier.name : "مورد عام",
      date: purDate,
      payment_method: purPaymentMethod,
      treasury: purPaymentMethod === "كاش" ? purTreasury : undefined,
      items: purItems,
      subtotal: purSubtotal,
      total: purTotal,
      paid_amount: purPaidNum,
      remaining_amount: purRemaining,
      status: purRemaining === 0 ? "مدفوعة بالكامل" : purPaidNum > 0 ? "مدفوعة جزئياً" : "آجلة معلقة",
      notes: purNotes.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      // 1. Insert Purchase Invoice
      const { error: purErr } = await sb.from("purchases").insert(newPurchase);
      if (purErr) throw purErr;

      // 2. Real-time Stock Replenishment: Add purchase quantity to product stock
      for (const item of purItems) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const newQty = prod.stock_qty + item.quantity;
          await sb
            .from("products")
            .update({
              stock_qty: newQty,
              cost_price: item.unit_cost > 0 ? item.unit_cost : prod.cost_price,
              updated_at: new Date().toISOString(),
            })
            .eq("id", prod.id);
        }
      }

      // 3. Update local state
      setPurchases(prev => [newPurchase, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const purItem = purItems.find(pi => pi.product_id === p.id);
          if (purItem) {
            return {
              ...p,
              stock_qty: p.stock_qty + purItem.quantity,
              cost_price: purItem.unit_cost > 0 ? purItem.unit_cost : p.cost_price,
            };
          }
          return p;
        })
      );

      setShowPurchaseModal(false);
      showToast(
        `✓ تم حفظ فاتورة الشراء وتوريد (${purItems.length}) أصناف وإضافة الكميات للمخزن بنجاح!`,
        "success"
      );
    } catch (err: any) {
      console.error(err);
      showToast("تعذر حفظ فاتورة الشراء: " + (err?.message || err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-amber-500/20 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">نظام الكاشير ونقاط البيع الذكي (POS)</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black flex items-center gap-1">
                  <span>{ACTIVITY_PRESETS[activeCompanyConfig.activity_type]?.icon || "🏪"}</span>
                  <span>{activeCompanyConfig.activity_type || "نشاط تجاري عام"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                إدارة مبيعات الكاشير، التصنيفات الديناميكية، المخزون الحقيقي، وفواتير التوريد لشركة:{" "}
                <b className="text-amber-300">{activeCompany.name}</b>
              </p>
            </div>
          </div>

          {/* Quick Actions & User Info */}
          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              title="تحديث بيانات المخزون والكاشير"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>الكاشير: {currentUser?.name || "المسؤول"}</span>
              {isAdminOrManager && (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black">
                  مدير النظام
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab("pos")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "pos"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>🛒 شاشة الكاشير السريعة</span>
            {cart.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">
                {cart.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "categories"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🏷️ التصنيفات والأنشطة ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "products"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>📦 المنتجات والمخزون ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("suppliers")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "suppliers"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>🏭 الموردين وحساباتهم ({suppliers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("purchases")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "purchases"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            <span>🚚 فواتير الشراء والتوريد ({purchases.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("sales_history")}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "sales_history"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>🧾 سجل المبيعات والوردية ({posSales.length})</span>
          </button>

          {/* Admin / Manager Exclusive Settings Tab */}
          {isAdminOrManager && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap mr-auto ${
                activeTab === "settings"
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black"
                  : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>⚙️ تخصيص الكاشير والخانات</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. POS TERMINAL (شاشة الكاشير السريعة) */}
      {/* ========================================================= */}
      {activeTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Center: Products Selection & Barcode Scanner (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barcode Scanner Bar (can be hidden by admin for service/laundry businesses) */}
            {activeCompanyConfig.show_barcode !== false && (
              <form
                onSubmit={handleBarcodeSubmit}
                className="bg-slate-900 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-2 shadow-lg shadow-amber-500/5"
              >
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Barcode className="w-5 h-5" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="امسح الباركود أو اكتب كود المنتج ثم اضغط Enter..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-sm font-bold focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  إضافة للسلة
                </button>
              </form>
            )}

            {/* Search and Dynamic Category Filters */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث عن منتج أو خدمة بالاسم أو الباركود..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Dynamic Categories Carousel / Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold scrollbar-none">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === "all"
                      ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                      : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span>✨ جميع الأقسام</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-950/30 text-[9px]">
                    {products.length}
                  </span>
                </button>

                {categories.map(cat => {
                  const count = products.filter(p => p.category === cat.name).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCategory === cat.name
                          ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                          : "bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span>{cat.icon || "🏷️"}</span>
                      <span>{cat.name}</span>
                      {count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                            selectedCategory === cat.name
                              ? "bg-slate-950/30 text-slate-950"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Inline Fast Add Category Button */}
                <button
                  onClick={() => handleOpenAddCategory()}
                  className="px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 flex items-center gap-1"
                  title="إضافة تصنيف جديد"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ تصنيف</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[58vh] overflow-y-auto pr-1">
              {products
                .filter(p => {
                  const matchSearch =
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.barcode.toLowerCase().includes(productSearch.toLowerCase());
                  const matchCat = selectedCategory === "all" || p.category === selectedCategory;
                  return matchSearch && matchCat;
                })
                .map(prod => {
                  const isOutOfStock = prod.stock_qty <= 0;
                  const isLowStock = prod.stock_qty > 0 && prod.stock_qty <= (prod.min_stock_alert || 5);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => !isOutOfStock && addToCart(prod, 1)}
                      className={`group relative p-3.5 rounded-2xl border transition-all text-right flex flex-col justify-between ${
                        isOutOfStock
                          ? "bg-slate-900/40 border-rose-500/20 opacity-60 cursor-not-allowed"
                          : "bg-slate-900/80 border-white/10 hover:border-amber-500/40 hover:bg-slate-850 hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-bold">
                            {prod.category}
                          </span>
                          {activeCompanyConfig.show_barcode !== false && (
                            <span className="font-mono text-slate-500 text-[9px]">{prod.barcode}</span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="pt-3 border-t border-white/5 mt-3 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-slate-400 font-bold">السعر:</span>
                          <span className="text-sm font-black text-amber-400 font-mono">
                            {prod.selling_price.toLocaleString()}{" "}
                            <span className="text-[9px] font-sans">ريال</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">
                            {activeCompanyConfig.show_units !== false ? prod.unit || "حبة" : "المتوفر:"}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-rose-400 font-bold">نفد من المخزن</span>
                          ) : (
                            <span className={isLowStock ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                              {prod.stock_qty} بالمخزن
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {products.length === 0 && (
                <div className="col-span-full p-12 text-center bg-slate-900/40 border border-white/10 rounded-2xl space-y-3">
                  <Package className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-sm font-black text-slate-300">لم يتم تسجيل أي منتجات أو خدمات بالمخزون بعد</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    يمكنك تسجيل المنتجات والخدمات الحقيقية عبر قسم "المنتجات والمخزون" لتظهر فوراً في شاشة الكاشير
                  </p>
                  <button
                    onClick={() => setActiveTab("products")}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                  >
                    + إضافة أول منتج الآن
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart, Invoice Total & Checkout Panel (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-amber-500/20 rounded-3xl p-5 space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">سلة الفاتورة الحالية</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                  {cart.length} أصناف
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ السلة</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
              {cart.map(item => (
                <div
                  key={item.product_id}
                  className="bg-slate-950/60 border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-2 text-right"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-black text-white truncate">{item.product_name}</h5>
                    <div className="flex items-center gap-2 text-[10px] text-amber-400 font-bold mt-0.5">
                      {/* Price override check */}
                      {activeCompanyConfig.allow_price_override || isAdminOrManager ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={e => updateCartItemPrice(item.product_id, Number(e.target.value))}
                            className="w-16 bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-amber-300 font-bold text-center text-[10px]"
                            title="تعديل السعر المباشر"
                          />
                          <span>ريال × {item.quantity}</span>
                        </div>
                      ) : (
                        <span>
                          {item.unit_price} ريال × {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartItemQty(item.product_id, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-7 text-center text-xs font-black text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItemQty(item.product_id, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-left w-20">
                    <b className="text-xs font-black text-white block">
                      {item.subtotal.toLocaleString()} <span className="text-[9px]">ريال</span>
                    </b>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                  <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold">السلة فارغة، اختر أصنافاً أو امسح الباركود</p>
                </div>
              )}
            </div>

            {/* Customer Details (Toggleable by admin) */}
            {activeCompanyConfig.show_customer_select !== false && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">العميل المستلم:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomerType("cash")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        customerType === "cash" ? "bg-amber-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      نقدي (مباشر)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerType("client")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        customerType === "client" ? "bg-amber-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      عميل مسجل
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerType("custom")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        customerType === "custom" ? "bg-amber-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      اسم مخصص
                    </button>
                  </div>
                </div>

                {customerType === "client" && (
                  <select
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="">-- اختر العميل من العقود المسجلة --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.client} - {c.no} ({c.phone})
                      </option>
                    ))}
                  </select>
                )}

                {customerType === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="اسم العميل..."
                      value={customCustomerName}
                      onChange={e => setCustomCustomerName(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl p-2 text-xs font-bold text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="رقم الجوال..."
                      value={customCustomerPhone}
                      onChange={e => setCustomCustomerPhone(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl p-2 text-xs font-mono font-bold text-white focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Payment Method & Treasury */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">طريقة السداد المستلمة:</label>
              <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                {[
                  { key: "كاش", label: "💵 نقدي", icon: Coins },
                  { key: "مدى / شبكة", label: "💳 مدى", icon: CreditCard },
                  { key: "تحويل بنكي", label: "🏦 تحويل", icon: Landmark },
                  { key: "آجل / على الحساب", label: "⏳ آجل", icon: Clock },
                ].map(pm => (
                  <button
                    key={pm.key}
                    type="button"
                    onClick={() => setPaymentMethod(pm.key as any)}
                    className={`p-2 rounded-xl text-center transition-all cursor-pointer border ${
                      paymentMethod === pm.key
                        ? "bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md shadow-amber-500/20"
                        : "bg-slate-950/60 text-slate-300 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              {/* Cash tendered & quick cash amounts (toggleable) */}
              {paymentMethod === "كاش" && (
                <div className="p-3 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">المبلغ المستلم من العميل:</span>
                    <input
                      type="number"
                      placeholder={grandTotal.toString()}
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      className="w-28 bg-slate-900 border border-amber-500/30 rounded-lg p-1.5 text-left text-xs font-mono font-bold text-amber-300 focus:outline-none"
                    />
                  </div>

                  {/* Fast Cash Tender Chips */}
                  {activeCompanyConfig.show_quick_amounts !== false && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500">سريع:</span>
                      {[10, 50, 100, 200, 500].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashTendered(val.toString())}
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-mono font-bold cursor-pointer"
                        >
                          {val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCashTendered(grandTotal.toString())}
                        className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-bold cursor-pointer"
                      >
                        المبلغ التام
                      </button>
                    </div>
                  )}

                  {cashGiven > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs font-black">
                      <span className="text-slate-400">الباقي للعميل:</span>
                      <span
                        className={`font-mono text-sm ${
                          changeReturned >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {changeReturned.toFixed(2)} ريال
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Treasury Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">الخزنة المستهدفة:</span>
                <select
                  value={selectedTreasury}
                  onChange={e => setSelectedTreasury(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl p-1.5 text-xs font-bold text-white focus:outline-none"
                >
                  {treasuries.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Input (toggleable) */}
              {activeCompanyConfig.show_discount !== false && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-bold">خصم مباشر على الفاتورة:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={cartSubtotal}
                      value={discountAmount || ""}
                      onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0.00"
                      className="w-24 bg-slate-950 border border-white/10 rounded-lg p-1 text-center font-mono text-xs text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">ريال</span>
                  </div>
                </div>
              )}

              {/* Optional Notes (toggleable) */}
              {activeCompanyConfig.show_notes !== false && (
                <input
                  type="text"
                  placeholder="ملاحظات أو بيان على الفاتورة..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              )}
            </div>

            {/* Invoice Totals Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400 font-bold">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-white">{cartSubtotal.toFixed(2)} ريال</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-rose-400 font-bold">
                  <span>الخصم الممنوح:</span>
                  <span className="font-mono">-{discountVal.toFixed(2)} ريال</span>
                </div>
              )}
              {activeCompanyConfig.show_tax !== false && (
                <div className="flex justify-between text-slate-400 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <button
                      type="button"
                      onClick={() => setIsVatEnabled(!isVatEnabled)}
                      className={`text-[9px] px-1.5 py-0.2 rounded font-black cursor-pointer ${
                        isVatEnabled ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-slate-500 line-through"
                      }`}
                    >
                      {isVatEnabled ? "محتسبة" : "معفية"}
                    </button>
                  </div>
                  <span className="font-mono text-white">{vatAmount.toFixed(2)} ريال</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-amber-400 border-t border-white/10 pt-2">
                <span>الإجمالي النهائي المستحق:</span>
                <span className="font-mono text-lg">{grandTotal.toFixed(2)} ريال</span>
              </div>
            </div>

            {/* Complete Sale Button */}
            <button
              onClick={handleCompleteSale}
              disabled={isLoading || cart.length === 0}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                cart.length === 0 || isLoading
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25 cursor-pointer transform active:scale-98"
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>إتمام البيع فوراً وإصدار الفاتورة الحرارية</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. DYNAMIC CATEGORIES TAB (التصنيفات والأنشطة) */}
      {/* ========================================================= */}
      {activeTab === "categories" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">إدارة وتخصيص تصنيفات الكاشير والمخزون</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-black">
                  {categories.length} تصنيف متاح
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                تصنيفات ديناميكية مخصصة لنشاط المنشأة (بقالة، مغسلة، مواد بناء، خدمات عامة، إلخ) تظهر فوراً في شاشة البيع
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowPresetPackModal(true)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ تطبيق باقة نشاط جاهزة</span>
              </button>
              <button
                onClick={() => handleOpenAddCategory()}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة تصنيف جديد</span>
              </button>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map(cat => {
              const count = products.filter(p => p.category === cat.name).length;
              return (
                <div
                  key={cat.id}
                  className="bg-slate-900/80 border border-white/10 hover:border-amber-500/30 rounded-2xl p-4 space-y-3 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{cat.icon || "🏷️"}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-slate-400">
                        {cat.activity_type || "نشاط عام"}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{cat.name}</h4>
                      {cat.description && (
                        <p className="text-[11px] text-slate-400 font-bold line-clamp-2 mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-amber-400">
                      📦 {count} منتجات مرتبطة
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 cursor-pointer"
                        title="تعديل التصنيف"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        title="حذف التصنيف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="col-span-full p-12 text-center bg-slate-900/40 border border-white/10 rounded-2xl space-y-4">
                <Layers className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-sm font-black text-white">لا توجد تصنيفات مخصصة لهذه المنشأة حتى الآن</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  يمكنك إضافة تصنيفات يدوية أو تطبيق باقة تصنيفات جاهزة بضغطة زر واحدة تناسب نشاط الشركة
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setShowPresetPackModal(true)}
                    className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                  >
                    🚀 استيراد باقة تصنيفات مقترحة
                  </button>
                  <button
                    onClick={() => handleOpenAddCategory()}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl cursor-pointer border border-white/10"
                  >
                    + إضافة تصنيف مخصص
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SETTINGS & FIELD VISIBILITY TAB (خاص بالمدير وسوبر الأدمن) */}
      {/* ========================================================= */}
      {activeTab === "settings" && isAdminOrManager && (
        <form onSubmit={handleSavePosConfig} className="space-y-6">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  إعدادات وتخصيص كاشير منشأة: <span className="text-amber-400">{activeCompany.name}</span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">
                التحكم بنوع النشاط التجاري، وإخفاء أو إظهار الخانات في شاشة الكاشير والتحكم بصلاحيات الموظفين
              </p>
            </div>

            {/* Activity Type Selection */}
            <div className="space-y-3">
              <label className="text-xs font-black text-white block">
                🏢 نوع النشاط التجاري المعتمد للمنشأة:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.keys(ACTIVITY_PRESETS).map(actKey => {
                  const act = ACTIVITY_PRESETS[actKey];
                  const isSelected = editingConfig.activity_type === actKey;
                  return (
                    <div
                      key={actKey}
                      onClick={() => {
                        setEditingConfig(prev => ({
                          ...prev,
                          activity_type: actKey,
                          show_barcode: act.hideBarcode ? false : prev.show_barcode,
                        }));
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right flex items-start gap-3 ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                          : "bg-slate-950/60 border-white/10 hover:border-white/20 text-slate-300"
                      }`}
                    >
                      <span className="text-2xl">{act.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-white">{actKey}</h4>
                          {isSelected && <Check className="w-4 h-4 text-amber-400 font-black" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{act.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Field Visibility Toggles (إظهار وإخفاء الخانات) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white">
                  التحكم بالخانات وشاشة البيع (إظهار / إخفاء حسب الصلاحية والنشاط):
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Barcode Scanner */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">🔍 شريط وقارئ الباركود</span>
                    <span className="text-[10px] text-slate-400">إخفاؤه يفيد المغاسل والخدمات العامة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_barcode !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_barcode: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 2. Cost Price & Margin (CRITICAL) */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-amber-500/30 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-amber-300 block">🔒 إظهار سعر التكلفة والأرباح</span>
                    <span className="text-[10px] text-slate-400">إخفاؤه يحجب أسعار التكلفة تماماً عن الكاشير</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_cost_price === true}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_cost_price: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 3. Direct Discount */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">🏷️ خانة الخصم المباشر</span>
                    <span className="text-[10px] text-slate-400">السماح بإعطاء خصومات في شاشة البيع</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_discount !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_discount: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 4. Customer Selection & Credit */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">👥 اختيار العميل والبيع الآجل</span>
                    <span className="text-[10px] text-slate-400">إخفاؤه يقفل المبيعات كنقدي مباشر للبقالات</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_customer_select !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_customer_select: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 5. Units */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">📏 خانة وحدة القياس</span>
                    <span className="text-[10px] text-slate-400">إظهار الحبة، الكيس، الطن، المتر...</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_units !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_units: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 6. VAT 15% */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">🧾 احتساب الضريبة (15%)</span>
                    <span className="text-[10px] text-slate-400">تفعيل أو إعفاء الضريبة من الفواتير</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_tax !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_tax: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 7. Allow Price Override */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">✏️ تعديل السعر المباشر في السلة</span>
                    <span className="text-[10px] text-slate-400">إلغاؤه يقفل الأسعار ويمنع تلاعب الكاشير</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.allow_price_override !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, allow_price_override: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 8. Quick Cash Amounts */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">💵 أزرار النقدية السريعة</span>
                    <span className="text-[10px] text-slate-400">فئات الكاش (10, 50, 100, 500 ريال)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_quick_amounts !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_quick_amounts: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 9. Show Notes */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block">📝 خانة الملاحظات والبيان</span>
                    <span className="text-[10px] text-slate-400">إمكانية تدوين ملاحظة على الفاتورة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingConfig.show_notes !== false}
                    onChange={e => setEditingConfig(prev => ({ ...prev, show_notes: e.target.checked }))}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Header & Footer Customization */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black text-white">🖨️ تخصيص الإيصال الحراري 80mm والخزنة:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400">ترويسة الإيصال الحراري (اسم المحل أو الترحيب)</label>
                  <input
                    type="text"
                    value={editingConfig.receipt_header || ""}
                    onChange={e => setEditingConfig(prev => ({ ...prev, receipt_header: e.target.value }))}
                    placeholder={activeCompany.name}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400">تذييل الإيصال وشكر العميل</label>
                  <input
                    type="text"
                    value={editingConfig.receipt_footer || ""}
                    onChange={e => setEditingConfig(prev => ({ ...prev, receipt_footer: e.target.value }))}
                    placeholder="شكراً لتعاملكم معنا ونسعد بخدمتكم دائماً"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-400">الخزنة الافتراضية المعتمدة للمبيعات النقدية</label>
                  <select
                    value={editingConfig.default_treasury || treasuries[0] || ""}
                    onChange={e => setEditingConfig(prev => ({ ...prev, default_treasury: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    {treasuries.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Save Config Button */}
            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4 font-black" />
                <span>حفظ وتطبيق إعدادات كاشير المنشأة فوراً</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 4. PRODUCTS TAB (المنتجات والمخزون) */}
      {/* ========================================================= */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-sm font-black text-white">إدارة المنتجات والمخزون الفعلي</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                سجل الأصناف الحقيقية مع تتبع الكميات، التكلفة، أسعار البيع، وهامش الربح
              </p>
            </div>
            <button
              onClick={handleOpenAddProduct}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج حقيقي جديد</span>
            </button>
          </div>

          {/* Products Table */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/5">
                  <tr>
                    {activeCompanyConfig.show_barcode !== false && <th className="p-3.5">الباركود</th>}
                    <th className="p-3.5">اسم المنتج</th>
                    <th className="p-3.5">القسم</th>
                    {activeCompanyConfig.show_units !== false && <th className="p-3.5">الوحدة</th>}
                    {/* Only show cost price & profit if admin AND enabled in config */}
                    {isAdminOrManager && activeCompanyConfig.show_cost_price !== false && (
                      <th className="p-3.5">سعر التكلفة</th>
                    )}
                    <th className="p-3.5">سعر البيع</th>
                    {isAdminOrManager && activeCompanyConfig.show_cost_price !== false && (
                      <th className="p-3.5">هامش الربح</th>
                    )}
                    <th className="p-3.5">الكمية بالمخزن</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {products
                    .filter(
                      p =>
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                        p.barcode.toLowerCase().includes(productSearch.toLowerCase())
                    )
                    .map(prod => {
                      const profit = prod.selling_price - prod.cost_price;
                      const isOutOfStock = prod.stock_qty <= 0;
                      const isLowStock = prod.stock_qty > 0 && prod.stock_qty <= (prod.min_stock_alert || 5);

                      return (
                        <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                          {activeCompanyConfig.show_barcode !== false && (
                            <td className="p-3.5 font-mono text-amber-400 dir-ltr">{prod.barcode}</td>
                          )}
                          <td className="p-3.5 font-black text-white">{prod.name}</td>
                          <td className="p-3.5 text-slate-400 font-bold">{prod.category}</td>
                          {activeCompanyConfig.show_units !== false && (
                            <td className="p-3.5 text-slate-300">{prod.unit}</td>
                          )}
                          {isAdminOrManager && activeCompanyConfig.show_cost_price !== false && (
                            <td className="p-3.5 font-bold text-slate-300">
                              {prod.cost_price.toLocaleString()} ريال
                            </td>
                          )}
                          <td className="p-3.5 font-black text-amber-300">
                            {prod.selling_price.toLocaleString()} ريال
                          </td>
                          {isAdminOrManager && activeCompanyConfig.show_cost_price !== false && (
                            <td className="p-3.5 font-bold text-emerald-400">+{profit.toLocaleString()} ريال</td>
                          )}
                          <td className="p-3.5 font-black text-white text-base">{prod.stock_qty}</td>
                          <td className="p-3.5">
                            {isOutOfStock ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                نفد من المخزن
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                قارب على النفاد
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                متوفر بالمخزن
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 cursor-pointer"
                                title="تعديل المنتج"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                title="حذف المنتج"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {products.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 font-bold">
                        لا توجد أي منتجات مسجلة حتى الآن. انقر على "إضافة منتج حقيقي جديد" أعلاه.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SUPPLIERS TAB (الموردين وحساباتهم) */}
      {/* ========================================================= */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-sm font-black text-white">دليل الموردين المعتمدين والمستحقات</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                سجل الشركات والموردين الحقيقيين ومتابعة كشف الحساب وفواتير التوريد
              </p>
            </div>
            <button
              onClick={handleOpenAddSupplier}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مورد حقيقي جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(supp => (
              <div
                key={supp.id}
                className="bg-slate-900/80 border border-white/10 hover:border-amber-500/30 rounded-2xl p-4 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-black">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{supp.name}</h4>
                      <span className="text-[10px] text-slate-400 font-bold block">{supp.city || "المملكة"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditSupplier(supp)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>رقم الجوال:</span>
                    <span className="font-mono text-white font-bold">{supp.phone}</span>
                  </div>
                  {supp.commercial_register && (
                    <div className="flex justify-between text-slate-400">
                      <span>السجل التجاري:</span>
                      <span className="font-mono text-slate-300">{supp.commercial_register}</span>
                    </div>
                  )}
                  {supp.tax_number && (
                    <div className="flex justify-between text-slate-400">
                      <span>الرقم الضريبي:</span>
                      <span className="font-mono text-slate-300">{supp.tax_number}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">الفواتير المسجلة:</span>
                  <span className="font-black text-amber-400">
                    {purchases.filter(p => p.supplier_id === supp.id).length} فواتير
                  </span>
                </div>
              </div>
            ))}

            {suppliers.length === 0 && (
              <div className="col-span-full p-12 text-center bg-slate-900/40 border border-white/10 rounded-2xl space-y-3">
                <Truck className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm font-black text-slate-300">لا يوجد أي موردين مسجلين بعد</p>
                <button
                  onClick={handleOpenAddSupplier}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  + تسجيل أول مورد الآن
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. PURCHASES TAB (فواتير الشراء والتوريد للمخزون) */}
      {/* ========================================================= */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-sm font-black text-white">فواتير الشراء وتوريد المخزون الفعلي</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                توثيق فواتير المشتريات من الموردين وتحديث رصيد المخزون آلياً فور الحفظ
              </p>
            </div>
            <button
              onClick={handleOpenAddPurchase}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل فاتورة شراء وتوريد</span>
            </button>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/5">
                  <tr>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5">المورد</th>
                    <th className="p-3.5">التاريخ</th>
                    <th className="p-3.5">الأصناف الموردة</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">إجمالي الفاتورة</th>
                    <th className="p-3.5">المدفوع</th>
                    <th className="p-3.5">المتبقي</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {purchases.map(pur => (
                    <tr key={pur.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 font-mono text-amber-400 font-bold">{pur.invoice_no}</td>
                      <td className="p-3.5 font-black text-white">{pur.supplier_name}</td>
                      <td className="p-3.5 text-slate-400 font-mono">{pur.date}</td>
                      <td className="p-3.5 text-slate-300">{pur.items?.length || 0} أصناف</td>
                      <td className="p-3.5 text-slate-300 font-bold">{pur.payment_method}</td>
                      <td className="p-3.5 font-mono text-white font-bold">{pur.total.toLocaleString()} ريال</td>
                      <td className="p-3.5 font-mono text-emerald-400 font-bold">
                        {pur.paid_amount.toLocaleString()} ريال
                      </td>
                      <td className="p-3.5 font-mono text-rose-400 font-bold">
                        {pur.remaining_amount.toLocaleString()} ريال
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            pur.remaining_amount === 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {pur.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {purchases.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                        لا توجد فواتير شراء مسجلة حتى الآن. انقر على "تسجيل فاتورة شراء وتوريد".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. SALES HISTORY TAB (سجل المبيعات والوردية) */}
      {/* ========================================================= */}
      {activeTab === "sales_history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div>
              <h3 className="text-sm font-black text-white">سجل مبيعات الكاشير والعمليات المنفذة</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                استعراض فواتير البيع الصادرة وإعادة طباعة الإيصالات الحرارية
              </p>
            </div>
            <div className="text-left font-mono">
              <span className="text-xs text-slate-400 block font-sans">إجمالي المبيعات المعتمدة:</span>
              <b className="text-sm font-black text-amber-400">
                {posSales.reduce((sum, s) => sum + s.total, 0).toLocaleString()} ريال
              </b>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/5">
                  <tr>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">الكاشير</th>
                    <th className="p-3.5">العميل</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">عدد البنود</th>
                    <th className="p-3.5">الضريبة</th>
                    <th className="p-3.5">الإجمالي الكلي</th>
                    <th className="p-3.5 text-center">الإيصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {posSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 font-mono text-amber-400 font-bold">{sale.sale_no}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {sale.created_at ? new Date(sale.created_at).toLocaleString("ar-SA") : sale.date}
                      </td>
                      <td className="p-3.5 text-white font-bold">{sale.cashier_name}</td>
                      <td className="p-3.5 text-slate-300 font-bold">{sale.customer_name}</td>
                      <td className="p-3.5 text-amber-300 font-bold">{sale.payment_method}</td>
                      <td className="p-3.5 text-slate-400">{sale.items?.length || 0} بنود</td>
                      <td className="p-3.5 font-mono text-slate-300">{(sale.tax_amount || 0).toFixed(2)} ريال</td>
                      <td className="p-3.5 font-mono font-black text-white text-sm">
                        {sale.total.toFixed(2)} ريال
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            setActiveInvoiceForPrint(sale);
                            setShowReceiptModal(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-black cursor-pointer border border-amber-500/20 inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>عرض وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {posSales.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                        لم يتم تسجيل أي عمليات بيع حتى الآن.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT DYNAMIC CATEGORY */}
      {/* ========================================================= */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  {editingCategory ? "تعديل بيانات التصنيف" : "إضافة تصنيف ونشاط جديد"}
                </h3>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-slate-300">اسم التصنيف * (مثال: ألبان، غسيل وكوي، أسمنت، وجبات...)</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="اكتب اسم التصنيف..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">نوع النشاط التجاري المرتبط بالتصنيف:</label>
                <select
                  value={catActivity}
                  onChange={e => setCatActivity(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                >
                  {Object.keys(ACTIVITY_PRESETS).map(act => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                  <option value="أخرى">نشاط مخصص آخر</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">الأيقونة التعبيرية (Emoji Icon):</label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl p-2 bg-slate-950 rounded-xl border border-white/10">{catIcon}</span>
                  <input
                    type="text"
                    value={catIcon}
                    onChange={e => setCatIcon(e.target.value)}
                    className="flex-1 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                    placeholder="اختر أو اكتب أيقونة..."
                  />
                </div>
                {/* Fast Emoji Picker */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-white/5 max-h-24 overflow-y-auto">
                  {EMOJI_OPTIONS.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setCatIcon(emo)}
                      className={`w-7 h-7 rounded text-base flex items-center justify-center cursor-pointer transition-colors ${
                        catIcon === emo ? "bg-amber-500/20 border border-amber-500" : "hover:bg-white/10"
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">لون التمييز:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCatColor(c.value)}
                      className={`p-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                        catColor === c.value
                          ? "bg-slate-800 border-amber-400 text-white font-black"
                          : "bg-slate-950/60 border-white/5 text-slate-400"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.bg}`} />
                      <span>{c.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">وصف إضافي (اختياري)</label>
                <input
                  type="text"
                  value={catDescription}
                  onChange={e => setCatDescription(e.target.value)}
                  placeholder="وصف مختصر للأصناف التابعة لهذا القسم..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {editingCategory ? "حفظ التعديلات" : "إضافة التصنيف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PRESET CATEGORY PACK SELECTION */}
      {/* ========================================================= */}
      {showPresetPackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">استيراد باقة تصنيفات جاهزة فوراً</h3>
              </div>
              <button
                onClick={() => setShowPresetPackModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-bold">
              اختر نشاط منشأتك لتوليد حزمة متكاملة من التصنيفات الجاهزة والأيقونات بضغطة زر واحدة:
            </p>

            <div className="space-y-3">
              {Object.keys(ACTIVITY_PRESETS).map(key => {
                const act = ACTIVITY_PRESETS[key];
                const isSelected = selectedPresetPackKey === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPresetPackKey(key)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/60 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{act.icon}</span>
                        <div>
                          <h4 className="text-xs font-black text-white">{key}</h4>
                          <span className="text-[10px] text-slate-400">{act.description}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-amber-300">
                        {act.categories.length} تصنيف جاهز
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-white/5">
                      {act.categories.map(c => (
                        <span
                          key={c.name}
                          className="px-2 py-0.5 rounded bg-slate-900 text-[10px] text-slate-300 font-bold border border-white/5"
                        >
                          {c.icon} {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPresetPackModal(false)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetPack(selectedPresetPackKey)}
                disabled={isLoading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer text-xs shadow-lg shadow-amber-500/20"
              >
                ⚡ تطبيق وتوليد التصنيفات الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT PRODUCT */}
      {/* ========================================================= */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white">
                {editingProduct ? "تعديل بيانات المنتج والمخزون" : "تسجيل منتج أو خدمة جديدة بالمخزن"}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Barcode (optional if company hid barcode) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300">الباركود</label>
                    <button
                      type="button"
                      onClick={() => setProdBarcode("AW-" + Math.floor(100000 + Math.random() * 900000))}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      🎲 توليد تلقائي
                    </button>
                  </div>
                  <input
                    type="text"
                    value={prodBarcode}
                    onChange={e => setProdBarcode(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                    placeholder="امسح أو اكتب الباركود..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">اسم المنتج / الخدمة *</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={e => setProdName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="مثال: غسيل ثوب / كيس أسمنت / زيت طبخ..."
                  />
                </div>

                {/* Dynamic Category Selector with Fast Inline Add */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300">القسم / التصنيف</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddCategory()}
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      + تصنيف جديد
                    </button>
                  </div>
                  <select
                    value={prodCategory}
                    onChange={e => setProdCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.icon || "🏷️"} {c.name}
                      </option>
                    ))}
                    {categories.length === 0 && <option value="عام">عام</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">وحدة القياس</label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={e => setProdUnit(e.target.value)}
                    placeholder="حبة، قطعة، كيس، متر، طن..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>

                {/* Cost price: only editable/visible if admin/manager */}
                {isAdminOrManager && (
                  <div className="space-y-1">
                    <label className="text-slate-300">سعر التكلفة والشراء (ريال)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={prodCostPrice}
                      onChange={e => setProdCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-slate-300">سعر البيع المعتمد (ريال) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={prodSellingPrice}
                    onChange={e => setProdSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-amber-500/30 rounded-xl p-2.5 text-amber-300 font-mono font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">الكمية الافتتاحية الحالية بالمخزن</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={prodStockQty}
                    onChange={e => setProdStockQty(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">تنبيه عند انخفاض الرصيد عن</label>
                  <input
                    type="number"
                    min="0"
                    value={prodMinStockAlert}
                    onChange={e => setProdMinStockAlert(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300">المورد المعتمد للمنتج (اختياري)</label>
                  <select
                    value={prodSupplierId}
                    onChange={e => setProdSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="">-- بدون مورد محدد --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300">ملاحظات أو مكان التخزين بالمستودع</label>
                  <input
                    type="text"
                    value={prodNotes}
                    onChange={e => setProdNotes(e.target.value)}
                    placeholder="مثال: رف رقم 4 - قسم التجهيز..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {editingProduct ? "حفظ التعديلات" : "تسجيل المنتج بالمخزن"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT SUPPLIER */}
      {/* ========================================================= */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white">
                {editingSupplier ? "تعديل بيانات المورد" : "تسجيل مورد حقيقي جديد"}
              </h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-slate-300">اسم المورد / الشركة الموردة *</label>
                <input
                  type="text"
                  required
                  value={suppName}
                  onChange={e => setSuppName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  placeholder="اسم الشركة أو المؤسسة الموردة..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">رقم الجوال / التواصل *</label>
                  <input
                    type="text"
                    required
                    value={suppPhone}
                    onChange={e => setSuppPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">المدينة / المقر</label>
                  <input
                    type="text"
                    value={suppCity}
                    onChange={e => setSuppCity(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                    placeholder="الرياض، جدة..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">السجل التجاري</label>
                  <input
                    type="text"
                    value={suppCr}
                    onChange={e => setSuppCr(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">الرقم الضريبي</label>
                  <input
                    type="text"
                    value={suppTax}
                    onChange={e => setSuppTax(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">ملاحظات وبيان الحساب</label>
                <input
                  type="text"
                  value={suppNotes}
                  onChange={e => setSuppNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  placeholder="ملاحظات حول المورد والاتفاقيات..."
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {editingSupplier ? "حفظ التعديلات" : "حفظ المورد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD PURCHASE INVOICE & STOCK REPLENISHMENT */}
      {/* ========================================================= */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-white">تسجيل فاتورة شراء وتوريد بضاعة للمخزن</h3>
                <p className="text-[11px] text-amber-400 font-bold mt-0.5">
                  تلقائياً: سيتم زيادة رصيد الكميات بالمخزن وتحديث متوسط التكلفة فور الحفظ
                </p>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">المورد المعتمد *</label>
                  <select
                    required
                    value={purSupplierId}
                    onChange={e => setPurSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="">-- اختر المورد --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">رقم فاتورة الشراء</label>
                  <input
                    type="text"
                    value={purInvoiceNo}
                    onChange={e => setPurInvoiceNo(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">تاريخ التوريد</label>
                  <input
                    type="date"
                    value={purDate}
                    onChange={e => setPurDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Add Items to Purchase Invoice */}
              <div className="space-y-2 border border-white/10 rounded-2xl p-3 bg-slate-950/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400">بنود وأصناف التوريد:</span>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          addPurchaseRow(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                    >
                      <option value="">+ اختر منتج لإضافته للفاتورة...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {purItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2 rounded-xl text-xs"
                    >
                      <div className="col-span-5 font-black text-white truncate">{item.product_name}</div>
                      <div className="col-span-2">
                        <label className="text-[9px] text-slate-500 block">الكمية ({item.unit})</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updatePurchaseRow(idx, "quantity", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-white/10 rounded p-1 text-center font-mono font-bold text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] text-slate-500 block">سعر التكلفة</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unit_cost}
                          onChange={e => updatePurchaseRow(idx, "unit_cost", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-white/10 rounded p-1 text-center font-mono font-bold text-amber-300"
                        />
                      </div>
                      <div className="col-span-2 text-left font-mono font-black text-white">
                        {item.subtotal.toLocaleString()} ريال
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removePurchaseRow(idx)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {purItems.length === 0 && (
                    <p className="text-center py-4 text-slate-500 font-bold">
                      لم تتم إضافة أصناف بعد. اختر المنتجات من القائمة المنسدلة أعلاه.
                    </p>
                  )}
                </div>

                {/* Subtotals */}
                <div className="pt-2 border-t border-white/10 flex justify-between font-black text-white">
                  <span>إجمالي قيمة المشتريات:</span>
                  <span className="font-mono text-amber-400 text-sm">{purTotal.toLocaleString()} ريال</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300">طريقة السداد للمورد</label>
                  <select
                    value={purPaymentMethod}
                    onChange={e => setPurPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="كاش">كاش نقدي</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="آجل على الحساب">آجل على الحساب</option>
                    <option value="شيك">شيك مصرفي</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">المبلغ المدفوع فعلياً (ريال)</label>
                  <input
                    type="number"
                    step="any"
                    value={purPaidAmount}
                    onChange={e => setPurPaidAmount(e.target.value)}
                    placeholder={purTotal.toString()}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-emerald-400 font-mono font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300">الخزنة المسحوب منها</label>
                  <select
                    value={purTreasury}
                    onChange={e => setPurTreasury(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    {treasuries.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">ملاحظات الفاتورة والتوريد</label>
                <input
                  type="text"
                  value={purNotes}
                  onChange={e => setPurNotes(e.target.value)}
                  placeholder="ملاحظات حول الشحنة والمستودع..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  حفظ وتوريد الكميات للمخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: 80mm ZATCA THERMAL RECEIPT MODAL */}
      {/* ========================================================= */}
      {showReceiptModal && activeInvoiceForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-sm max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Printer className="w-4 h-4" />
                <span>إيصال كاشير حراري معتمد (80mm)</span>
              </span>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Receipt Paper Layout */}
            <div
              id="thermal-receipt-printable"
              className="bg-white text-slate-950 p-4 rounded-xl shadow-lg font-mono text-xs space-y-3 border border-slate-200"
              dir="rtl"
            >
              {/* Header */}
              <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3">
                <h4 className="font-black text-sm font-sans">
                  {activeCompanyConfig.receipt_header || activeCompany.name}
                </h4>
                <p className="text-[10px] text-slate-600">{activeCompany.address}</p>
                <p className="text-[10px] text-slate-600">هاتف: {activeCompany.phone}</p>
                <p className="text-[10px] text-slate-700 font-bold">
                  الرقم الضريبي: {activeCompany.tax_no || "300099988800003"}
                </p>
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black font-sans mt-1">
                  فاتورة ضريبية مبسطة (POS)
                </span>
              </div>

              {/* Meta */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-bold">{activeInvoiceForPrint.sale_no}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span>
                    {activeInvoiceForPrint.created_at
                      ? new Date(activeInvoiceForPrint.created_at).toLocaleString("ar-SA")
                      : activeInvoiceForPrint.date}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>الكاشير:</span>
                  <span>{activeInvoiceForPrint.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-bold">{activeInvoiceForPrint.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold">{activeInvoiceForPrint.payment_method}</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-[10px] border-b border-dashed border-slate-400 pb-2">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-700">
                    <th className="text-right py-1">الصنف</th>
                    <th className="text-center py-1">الكمية</th>
                    <th className="text-center py-1">السعر</th>
                    <th className="text-left py-1">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeInvoiceForPrint.items?.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-bold font-sans">{item.product_name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-center">{item.unit_price}</td>
                      <td className="py-1 text-left font-bold">{item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="text-[11px] space-y-1 font-bold">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{activeInvoiceForPrint.subtotal.toFixed(2)} ريال</span>
                </div>
                {activeInvoiceForPrint.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم الممنوح:</span>
                    <span>-{activeInvoiceForPrint.discount_amount.toFixed(2)} ريال</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span>{activeInvoiceForPrint.tax_amount.toFixed(2)} ريال</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1 text-slate-950">
                  <span>الإجمالي المستحق:</span>
                  <span>{activeInvoiceForPrint.total.toFixed(2)} ريال</span>
                </div>

                {activeInvoiceForPrint.payment_method === "كاش" && activeInvoiceForPrint.cash_tendered && (
                  <>
                    <div className="flex justify-between text-[9px] pt-1 text-slate-600">
                      <span>المبلغ المستلم:</span>
                      <span>{activeInvoiceForPrint.cash_tendered} ريال</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-emerald-700">
                      <span>الباقي للعميل:</span>
                      <span>{(activeInvoiceForPrint.change_returned || 0).toFixed(2)} ريال</span>
                    </div>
                  </>
                )}
              </div>

              {/* ZATCA QR Code & Footer */}
              <div className="text-center space-y-2 pt-1">
                <div className="flex justify-center p-2 bg-white rounded-lg">
                  <QRCodeSVG
                    value={`Seller: ${activeCompany.name}\nTax: ${activeCompany.tax_no}\nTime: ${activeInvoiceForPrint.created_at}\nTotal: ${activeInvoiceForPrint.total}\nVAT: ${activeInvoiceForPrint.tax_amount}`}
                    size={90}
                    level="M"
                  />
                </div>
                <p className="text-[9px] text-slate-600 font-bold leading-tight">
                  {activeCompanyConfig.receipt_footer || "شكراً لتعاملكم معنا ويسعدنا دائماً خدمتكم"}
                </p>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال فوراً</span>
              </button>

              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-bold rounded-xl text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
