import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  MapPin,
  Mail,
  Phone,
  Tag,
  X,
  Building2,
  CreditCard,
  Edit,
  Trash2,
  Layers,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  AlertCircle,
  Package,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Vendor, UnifiedProductSearchResult } from '../types';

// Categories and sub-categories stream mapping tailored for A3 Express Software project
const CATEGORY_STREAMS: Record<string, string[]> = {
  'Raw Materials': [
    'Spices & Masala',
    'Grains & Millets',
    'Urad & Dal Flours',
    'Edible Oils & Fats',
    'Salt & Additives',
    'Raw Agricultural Produce'
  ],
  'Spices & Condiments': [
    'Spices & Masala',
    'Pepper & Chillies',
    'Cardamom & Cloves',
    'Cinnamon & Nutmeg',
    'Turmeric & Ginger',
    'Cumin & Mustard',
    'Salt & Additives',
    'Pickles & Sauces'
  ],
  'Grains, Cereals & Pulses': [
    'Grains & Millets',
    'Urad & Dal Flours',
    'Rice & Paddy',
    'Wheat & Flours',
    'Pulses & Chickpeas',
    'Maize & Corn Products'
  ],
  'Edible Oils & Fats': [
    'Edible Oils & Fats',
    'Coconut Oil',
    'Mustard & Sesame Oil',
    'Palm & Sunflower Oil',
    'Ghee & Vanaspati'
  ],
  'Foodstuffs & Confectionery': [
    'Confectionery & Bakery',
    'Biscuits & Wafers',
    'Chocolates & Sweets',
    'Instant Food Mixes',
    'Beverages & Tea/Coffee'
  ],
  'Packaging & Freight Supplies': [
    'Corrugated Boxes & Cartons',
    'Flexible Poly Bags',
    'Glass Jars & Bottles',
    'Wooden Pallets & Strapping',
    'Labels & Packaging Film'
  ],
  'General Import/Export Goods': [
    'Customs Tariff Goods',
    'Electrical & Machinery',
    'Textiles & Fabrics',
    'Hardware & Tools',
    'Chemical Compounds'
  ]
};

// Popular Quick Product Suggestions for fast tagging from Excel Catalog
const POPULAR_PRODUCTS = [
  'Special Chilli Powder',
  'Ragi Flour',
  'Daniya Powder',
  '50-50 Biscuit',
  'Ghee',
  'Honey',
  'Sakthi Chicken Masala',
  'Naga Gram Flour',
  'Marie Gold',
  'Turmeric Powder',
  'Black Pepper',
  'White Sugar',
  'Urad Dal',
  'Toor Dal',
  'Chana Dal',
  'Cardamom',
  'Coriander Seeds',
  'Mustard Seeds',
  'Refined Sunflower Oil',
  'Basmati Rice',
  'Raw Cashew Nuts',
  'Cloves',
];

// Helper function to auto-generate vendor code based on business name
const autoGenerateVendorCode = (vendorName: string, existingCount: number = 0): string => {
  if (!vendorName || !vendorName.trim()) return '';
  
  // Remove common corporate suffixes
  const cleaned = vendorName
    .replace(/\b(private|limited|pvt|ltd|inc|co|llp|corp|corporation|company|enterprises|traders|exports|imports)\b/gi, '')
    .trim();
  
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  let nameTag = '';
  
  if (words.length === 1) {
    nameTag = words[0].substring(0, 4).toUpperCase();
  } else if (words.length >= 2) {
    nameTag = (words[0].substring(0, 3) + words[1].substring(0, 3)).toUpperCase();
  } else {
    nameTag = vendorName.substring(0, 4).toUpperCase();
  }

  nameTag = nameTag.replace(/[^A-Z0-9]/g, '');
  if (!nameTag) nameTag = 'VEND';

  const num = String(existingCount + 1).padStart(3, '0');
  return `VEND-${nameTag}-${num}`;
};

export const VendorManagementPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);

  // 4-Step Wizard State
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form State - Step 1: Business
  const [name, setName] = useState<string>('');
  const [legalName, setLegalName] = useState<string>('');
  const [tradeName, setTradeName] = useState<string>('');
  const [companyType, setCompanyType] = useState<string>('Proprietorship');
  const [code, setCode] = useState<string>('');

  // Form State - Step 2: Contact
  const [contactPerson, setContactPerson] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [country, setCountry] = useState<string>('India');

  // Form State - Step 3: Tax & Bank
  const [gstin, setGstin] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankIfscCode, setBankIfscCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankBranch, setBankBranch] = useState<string>('');

  // Form State - Step 4: Category, Specific Products & Status
  const [mainCategory, setMainCategory] = useState<string>('Raw Materials');
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [customSubCatInput, setCustomSubCatInput] = useState<string>('');
  const [productsSupplied, setProductsSupplied] = useState<string[]>([]);
  const [customProductInput, setCustomProductInput] = useState<string>('');
  const [status, setStatus] = useState<'Active Supplier' | 'Pending Review' | 'Inactive'>('Active Supplier');

  // Database Autocomplete state
  const [productSuggestions, setProductSuggestions] = useState<UnifiedProductSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  useEffect(() => {
    const searchCatalog = async () => {
      try {
        const query = customProductInput.trim();
        const results = await apiClient.searchAllProducts(query, 20);
        setProductSuggestions(results);
      } catch (err) {
        console.error('Failed to fetch product catalog suggestions:', err);
      }
    };
    searchCatalog();
  }, [customProductInput]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getVendors(searchQuery);
      setVendors(res);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [searchQuery]);

  const resetForm = () => {
    setEditingVendorId(null);
    setActiveStep(1);
    setName('');
    setLegalName('');
    setTradeName('');
    setCompanyType('Proprietorship');
    setCode('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCountry('India');
    setGstin('');
    setPanNumber('');
    setBankAccountNumber('');
    setBankIfscCode('');
    setBankName('');
    setBankBranch('');
    setMainCategory('Raw Materials');
    setSubCategories([]);
    setCustomSubCatInput('');
    setProductsSupplied([]);
    setCustomProductInput('');
    setStatus('Active Supplier');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEditModal = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setActiveStep(1);
    setName(vendor.name || '');
    setLegalName(vendor.legal_name || vendor.name || '');
    setTradeName(vendor.trade_name || '');
    setCompanyType(vendor.company_type || 'Proprietorship');
    setCode(vendor.code || '');
    setContactPerson(vendor.contact_person || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
    setAddress(vendor.address || '');
    setCountry(vendor.country || 'India');
    setGstin(vendor.gstin || '');
    setPanNumber(vendor.pan_number || '');
    setBankAccountNumber(vendor.bank_account_number || '');
    setBankIfscCode(vendor.bank_ifsc_code || '');
    setBankName(vendor.bank_name || '');
    setBankBranch(vendor.bank_branch || '');
    setMainCategory(vendor.main_category || 'Raw Materials');
    setSubCategories(vendor.sub_categories || []);
    setCustomSubCatInput('');
    setProductsSupplied(vendor.products_supplied || []);
    setCustomProductInput('');
    setStatus(vendor.status || 'Active Supplier');
    setShowAddModal(true);
  };

  const handleSaveVendor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = legalName.trim() || name.trim();
    if (!finalName || !code.trim()) {
      alert('Please fill in Vendor Legal Name and Vendor Code in Step 1 (Business Details).');
      setActiveStep(1);
      return;
    }

    const payload: Partial<Vendor> = {
      name: finalName,
      code: code.trim().toUpperCase(),
      legal_name: finalName,
      trade_name: tradeName.trim(),
      company_type: companyType,
      contact_person: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      country: country.trim() || 'India',
      gstin: gstin.trim(),
      pan_number: panNumber.trim(),
      bank_account_number: bankAccountNumber.trim(),
      bank_ifsc_code: bankIfscCode.trim(),
      bank_name: bankName.trim(),
      bank_branch: bankBranch.trim(),
      main_category: mainCategory,
      sub_categories: subCategories,
      products_supplied: productsSupplied,
      status: status
    };

    try {
      if (editingVendorId) {
        await apiClient.updateVendor(editingVendorId, payload);
      } else {
        await apiClient.createVendor(payload);
      }
      setShowAddModal(false);
      resetForm();
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save vendor details');
    }
  };

  const handleDeleteVendor = async (vendorId: number, vendorName: string) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendorName}"?`)) return;
    try {
      await apiClient.deleteVendor(vendorId);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete vendor');
    }
  };

  // Sub-category tag manipulation
  const toggleSubCategoryTag = (tag: string) => {
    if (subCategories.includes(tag)) {
      setSubCategories(subCategories.filter(t => t !== tag));
    } else {
      setSubCategories([...subCategories, tag]);
    }
  };

  const handleAddCustomSubCat = () => {
    if (!customSubCatInput.trim()) return;
    const cleanTag = customSubCatInput.trim();
    if (!subCategories.includes(cleanTag)) {
      setSubCategories([...subCategories, cleanTag]);
    }
    setCustomSubCatInput('');
  };

  // Products Supplied tag manipulation (Ragi, Maida, etc.)
  const toggleProductSuppliedTag = (prod: string) => {
    if (productsSupplied.includes(prod)) {
      setProductsSupplied(productsSupplied.filter(p => p !== prod));
    } else {
      setProductsSupplied([...productsSupplied, prod]);
    }
  };

  const handleAddCustomProduct = () => {
    if (!customProductInput.trim()) return;
    const cleanProd = customProductInput.trim();
    if (!productsSupplied.includes(cleanProd)) {
      setProductsSupplied([...productsSupplied, cleanProd]);
    }
    setCustomProductInput('');
  };

  const availableTags = CATEGORY_STREAMS[mainCategory] || [];
  void toggleSubCategoryTag;
  void handleAddCustomSubCat;
  void availableTags;

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Vendor Master Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage vendor profiles, specific product catalogs (e.g. Ragi, Maida), tax IDs, and category mappings for A3 Express Software.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vendor name, code, brand, product..."
              className="px-3 py-2 pl-9 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 w-64"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add New Vendor
          </button>
        </div>
      </div>

      {/* Vendor Directory Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading vendor directory...</div>
      ) : vendors.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Truck className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="text-base font-bold text-slate-700">No Vendors Found</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click "Add New Vendor" above to start registering suppliers, their contact info, product catalogs (Ragi, Maida, etc.), and tax IDs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vendors.map(v => (
            <div
              key={v.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1">
                      {v.legal_name || v.name}
                    </h3>
                    {v.trade_name && (
                      <div className="text-[11px] text-slate-500 font-medium">
                        Brand: <span className="text-slate-700">{v.trade_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {v.code}
                      </span>
                      {v.company_type && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {v.company_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                      v.status === 'Inactive'
                        ? 'bg-slate-100 text-slate-600 border-slate-300'
                        : v.status === 'Pending Review'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    {v.status || 'Active Supplier'}
                  </span>
                </div>

                {/* Contact Info Block */}
                <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-b border-slate-100 py-3">
                  {v.contact_person && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px] font-semibold w-16">Contact:</span>
                      <span className="text-slate-800 truncate">{v.contact_person}</span>
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-800">{v.phone}</span>
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-800 truncate">{v.email}</span>
                    </div>
                  )}
                  {v.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-700 line-clamp-2">{v.address}</span>
                    </div>
                  )}
                </div>

                {/* Specific Products Supplied Catalog */}
                {v.products_supplied && v.products_supplied.length > 0 && (
                  <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <Package className="w-3 h-3 text-indigo-600" />
                      Specific Products Supplied ({v.products_supplied.length}):
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {v.products_supplied.map((prod, pIdx) => (
                        <span
                          key={pIdx}
                          className="px-2 py-0.5 bg-white text-indigo-900 border border-indigo-200 rounded text-[10px] font-bold shadow-2xs"
                        >
                          {prod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statutory & Bank Information */}
                {(v.gstin || v.pan_number || v.bank_name || v.bank_account_number) && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-[11px] space-y-1">
                    {v.gstin && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">GSTIN:</span>
                        <span className="font-mono font-bold text-slate-700">{v.gstin}</span>
                      </div>
                    )}
                    {v.pan_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">PAN:</span>
                        <span className="font-mono font-semibold text-slate-700">{v.pan_number}</span>
                      </div>
                    )}
                    {v.bank_name && (
                      <div className="flex justify-between text-slate-600 pt-0.5 border-t border-slate-200/50">
                        <span className="text-slate-500">Bank:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[160px]">
                          {v.bank_name} {v.bank_account_number ? `(${v.bank_account_number.slice(-4)})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Categories */}
                <div className="space-y-1.5">
                  {v.main_category && (
                    <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>{v.main_category}</span>
                    </div>
                  )}

                  {v.sub_categories && v.sub_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.sub_categories.map((sub, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          <Tag className="w-2.5 h-2.5 text-emerald-600" />
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEditModal(v)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Vendor & Products
                </button>
                <button
                  onClick={() => handleDeleteVendor(v.id, v.legal_name || v.name)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4-Step Vendor Registration Onboarding Wizard Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
            
            {/* Modal Dark Navy Header */}
            <div className="bg-[#0b132b] text-white p-5 flex items-center justify-between relative">
              <div>
                <div className="text-[11px] font-bold tracking-wider text-orange-400 uppercase mb-1">
                  STEP {activeStep} OF 3
                </div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Building2 className="w-5 h-5 text-orange-400" />
                  {editingVendorId ? 'Edit Vendor & Product Catalog' : 'Vendor Registration Onboarding'}
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-3 bg-slate-100 text-xs font-bold border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className={`py-3 px-2 text-center transition-all border-b-2 ${
                  activeStep === 1
                    ? 'bg-white text-orange-600 border-orange-500 font-bold shadow-sm'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                1. Business & Products
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className={`py-3 px-2 text-center transition-all border-b-2 ${
                  activeStep === 2
                    ? 'bg-white text-orange-600 border-orange-500 font-bold shadow-sm'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                2. Contact
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className={`py-3 px-2 text-center transition-all border-b-2 ${
                  activeStep === 3
                    ? 'bg-white text-orange-600 border-orange-500 font-bold shadow-sm'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                3. Tax & Bank
              </button>
            </div>

            {/* Step Body Content */}
            <div className="p-6 space-y-5">
              
              {/* STEP 1: BUSINESS & PRODUCTS DETAILS */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    1. Business Details & Specific Products Supplied
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vendor Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={legalName}
                        onChange={e => {
                          const val = e.target.value;
                          setLegalName(val);
                          setName(val);
                          if (!editingVendorId) {
                            setCode(autoGenerateVendorCode(val, vendors.length));
                          }
                        }}
                        placeholder="e.g. Acme Spices Private Limited"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Trade Name / Brand Name
                      </label>
                      <input
                        type="text"
                        value={tradeName}
                        onChange={e => setTradeName(e.target.value)}
                        placeholder="e.g. Acme Foods (Optional if same as Legal Name)"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Company Type <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={companyType}
                          onChange={e => setCompanyType(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="Proprietorship">Proprietorship</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Private Limited">Private Limited</option>
                          <option value="Public Limited">Public Limited</option>
                          <option value="LLP">LLP (Limited Liability Partnership)</option>
                          <option value="Foreign Entity">Foreign Entity</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            Vendor Code <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setCode(autoGenerateVendorCode(legalName || tradeName || name, vendors.length))}
                            className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                            title="Auto-generate Vendor Code based on name"
                          >
                            ⚡ Auto-Generate
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={code}
                          onChange={e => setCode(e.target.value.toUpperCase())}
                          placeholder="Auto-generated e.g. VEND-ACMSPI-001"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SPECIFIC PRODUCTS SUPPLIED CATALOG (Ragi, Maida, etc.) MOVED TO STEP 1 */}
                  <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-indigo-600" />
                        Specific Products Supplied ({productsSupplied.length} Products Added)
                      </label>
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        e.g. Vendor 1: Ragi, Maida, Atta
                      </span>
                    </div>

                    {/* Active Selected Product Tags */}
                    {productsSupplied.length === 0 ? (
                      <div className="bg-white/80 border border-indigo-200 text-indigo-800 p-3 rounded-lg text-xs italic flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>No specific products registered yet. Type product names (e.g. Ragi, Maida) or click quick suggestions below.</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-lg border border-indigo-200 shadow-2xs">
                        {productsSupplied.map(prod => (
                          <span
                            key={prod}
                            onClick={() => toggleProductSuppliedTag(prod)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-2xs cursor-pointer hover:bg-rose-600 transition-all"
                            title="Click to remove product"
                          >
                            <span>{prod}</span>
                            <X className="w-3 h-3" />
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick Product Suggestions */}
                    <div>
                      <div className="text-[11px] font-semibold text-indigo-900 mb-1.5">
                        Quick Add Common Products:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_PRODUCTS.map(p => {
                          const isSelected = productsSupplied.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => toggleProductSuppliedTag(p)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                isSelected
                                  ? 'bg-indigo-700 text-white border-indigo-700 font-bold shadow-2xs'
                                  : 'bg-white text-indigo-900 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100/60'
                              }`}
                            >
                              {isSelected ? `✓ ${p}` : `+ ${p}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Product Input with Letter-by-Letter Autocomplete */}
                    <div className="relative pt-2 border-t border-indigo-200/60">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={customProductInput}
                            onFocus={() => setShowSuggestions(true)}
                            onChange={e => {
                              setCustomProductInput(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomProduct();
                                setShowSuggestions(false);
                              }
                            }}
                            placeholder="Type product name letter by letter (e.g. Ragi, Maida, Atta)..."
                            className="w-full px-3 py-1.5 border border-indigo-200 rounded-xl text-xs bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 pr-7"
                          />
                          {customProductInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomProductInput('');
                                setShowSuggestions(true);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleAddCustomProduct();
                            setShowSuggestions(false);
                          }}
                          className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-orange-400" />
                          + Register Product
                        </button>
                      </div>

                      {/* Real-time Autocomplete Dropdown with HSN Codes & Categories */}
                      {showSuggestions && productSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-20 mt-1 bg-white border border-indigo-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-indigo-50 text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between sticky top-0 border-b border-indigo-100">
                            <span>Matching Database Products ({productSuggestions.length})</span>
                            <span>Click to Add</span>
                          </div>
                          {productSuggestions.map((item) => {
                            const pName = item.item_name;
                            const isAdded = productsSupplied.includes(pName);
                            return (
                              <button
                                key={`${item.id || item.hs_code || pName}-${pName}`}
                                type="button"
                                onClick={() => {
                                  if (!productsSupplied.includes(pName)) {
                                    setProductsSupplied([...productsSupplied, pName]);
                                  }
                                  if (item.product_category && !subCategories.includes(item.product_category)) {
                                    setSubCategories([...subCategories, item.product_category]);
                                  }
                                  setCustomProductInput('');
                                  setShowSuggestions(false);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span className="font-semibold text-slate-800">{pName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 ml-5">
                                    {item.product_category && (
                                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-100">
                                        {item.product_category}
                                      </span>
                                    )}
                                    {item.hs_code && (
                                      <span className="font-mono text-indigo-800 font-bold bg-indigo-100/80 px-1.5 py-0.5 rounded border border-indigo-200">
                                        HSN: {item.hs_code}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isAdded
                                    ? 'text-emerald-700 bg-emerald-100 border border-emerald-200'
                                    : 'text-indigo-600 bg-indigo-100'
                                }`}>
                                  {isAdded ? '✓ Added' : '+ Add Tag'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CONTACT INFORMATION */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-orange-500" />
                    2. Contact Information
                  </h3>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Primary Contact Person <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contactPerson}
                          onChange={e => setContactPerson(e.target.value)}
                          placeholder="e.g. Rajesh Kumar"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="e.g. vendor@acmefoods.com"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                        <input
                          type="text"
                          value={country}
                          onChange={e => setCountry(e.target.value)}
                          placeholder="e.g. India / Sri Lanka"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Registered Office Address <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="Full street address, city, state, pincode..."
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: TAX & BANK DETAILS */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <CreditCard className="w-4 h-4 text-orange-500" />
                    3. Tax & Statutory Details
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN Number</label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={e => setGstin(e.target.value.toUpperCase())}
                          placeholder="22AAAAA0000A1Z5"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
                        <input
                          type="text"
                          value={panNumber}
                          onChange={e => setPanNumber(e.target.value.toUpperCase())}
                          placeholder="ABCDE1234F"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                        Bank Account Information
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={bankAccountNumber}
                            onChange={e => setBankAccountNumber(e.target.value)}
                            placeholder="Bank Account Number"
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                          <input
                            type="text"
                            value={bankIfscCode}
                            onChange={e => setBankIfscCode(e.target.value.toUpperCase())}
                            placeholder="SBIN0001234"
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={e => setBankName(e.target.value)}
                            placeholder="State Bank of India"
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
                          <input
                            type="text"
                            value={bankBranch}
                            onChange={e => setBankBranch(e.target.value)}
                            placeholder="Main Branch"
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                {activeStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep - 1)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium rounded-xl"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                {activeStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="px-5 py-2 bg-[#0b132b] hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md transition-all"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveVendor}
                    className="px-6 py-2 bg-[#0b132b] hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all font-sans"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {editingVendorId ? 'Save Vendor & Products' : 'Complete Registration'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
