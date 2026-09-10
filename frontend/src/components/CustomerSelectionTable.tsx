import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  Search,
  Building2,
  MapPin,
  Phone,
  Mail,
  Shield,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles
} from 'lucide-react';
import type { Customer } from '../types';
import type { CustomerFormData } from './CustomerSearchInput';

interface CustomerSelectionTableProps {
  customers: CustomerFormData[];
  onChange: (updated: CustomerFormData[]) => void;
  allCustomers?: Customer[];
  title?: string;
  subtitle?: string;
}

export const CustomerSelectionTable: React.FC<CustomerSelectionTableProps> = ({
  customers = [],
  onChange,
  allCustomers = [],
  title = 'Shipment Customers',
  subtitle = 'Edit inline or click Details to update full consignee address & tax info'
}) => {
  // Modal editor state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Search filter for table rows
  const [filterQuery, setFilterQuery] = useState('');

  // Active autocomplete dropdown for specific row
  const [activeDropdownRow, setActiveDropdownRow] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdownRow(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdownRow(null);
        setEditingIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Change total customer count directly (e.g. typing 18)
  const handleCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(50, count));
    const next = [...customers];
    while (next.length < validCount) {
      next.push({
        name: `Customer ${next.length + 1}`,
        country: 'Sri Lanka'
      });
    }
    onChange(next.slice(0, validCount));
  };

  // Update a single field in a customer row
  const updateRow = (index: number, patch: Partial<CustomerFormData>) => {
    const next = [...customers];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  // Add a new row
  const handleAddRow = (preset?: Partial<CustomerFormData>) => {
    const newIdx = customers.length;
    const newCustomer: CustomerFormData = {
      name: preset?.name || `Customer ${newIdx + 1}`,
      code: preset?.code || '',
      country: preset?.country || 'Sri Lanka',
      phone: preset?.phone || '',
      email: preset?.email || '',
      address: preset?.address || '',
      tax_id: preset?.tax_id || ''
    };
    onChange([...customers, newCustomer]);
  };

  // Delete a specific row
  const handleDeleteRow = (index: number) => {
    if (customers.length <= 1) {
      alert('At least one customer is required for this shipment.');
      return;
    }
    const next = customers.filter((_, i) => i !== index);
    onChange(next);
    if (editingIdx !== null) {
      if (editingIdx === index) setEditingIdx(null);
      else if (editingIdx > index) setEditingIdx(editingIdx - 1);
    }
  };

  // Quick add from customer master
  const handleQuickAddMaster = (customerId: number) => {
    const cust = allCustomers.find(c => c.id === customerId);
    if (!cust) return;

    // If only 1 customer exists and is still placeholder, update it
    if (customers.length === 1 && (!customers[0].name.trim() || customers[0].name === 'Customer 1')) {
      updateRow(0, {
        name: cust.name,
        code: cust.code,
        phone: cust.phone || '',
        email: cust.email || '',
        address: cust.address || '',
        country: cust.country || 'Sri Lanka',
        tax_id: cust.tax_id || ''
      });
      return;
    }

    // Check if already in list
    const existingIdx = customers.findIndex(
      p => (cust.code && p.code === cust.code) || p.name.trim().toLowerCase() === cust.name.trim().toLowerCase()
    );
    if (existingIdx >= 0) {
      setEditingIdx(existingIdx);
      return;
    }

    handleAddRow({
      name: cust.name,
      code: cust.code,
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      country: cust.country || 'Sri Lanka',
      tax_id: cust.tax_id || ''
    });
  };

  // Filtered rows
  const filteredCustomers = customers
    .map((c, index) => ({ customer: c, originalIndex: index }))
    .filter(({ customer }) => {
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        customer.name.toLowerCase().includes(q) ||
        (customer.code && customer.code.toLowerCase().includes(q)) ||
        (customer.country && customer.country.toLowerCase().includes(q)) ||
        (customer.phone && customer.phone.toLowerCase().includes(q))
      );
    });

  // Autocomplete filtering for active row
  const getSuggestions = (query: string) => {
    if (!query.trim()) return allCustomers.slice(0, 8);
    const q = query.toLowerCase();
    return allCustomers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  const editingCustomer = editingIdx !== null ? customers[editingIdx] : null;

  return (
    <div className="space-y-3 pt-2">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/90 p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{title}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full border border-blue-200">
                {customers.length} {customers.length === 1 ? 'Customer' : 'Customers'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Count Adjuster (Directly set number of customers, e.g. 18) */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-600">Count:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={customers.length}
              onChange={e => handleCountChange(parseInt(e.target.value) || 1)}
              className="w-11 text-center text-xs font-bold text-blue-700 focus:outline-hidden"
              title="Set total customer count (e.g. 18)"
            />
          </div>

          {/* Quick Filter */}
          {customers.length > 5 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Filter customers..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                className="w-36 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 pr-7"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Quick Select from Customer Master */}
          {allCustomers.length > 0 && (
            <select
              onChange={e => {
                if (e.target.value) {
                  handleQuickAddMaster(Number(e.target.value));
                  e.target.value = '';
                }
              }}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer max-w-[190px] truncate"
            >
              <option value="">⚡ + Add from Master...</option>
              {allCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ''}{c.name}
                </option>
              ))}
            </select>
          )}

          {/* Add Row Button */}
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[52vh] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[220px]">Customer Name *</th>
                <th className="py-2.5 px-2 w-28">Code</th>
                <th className="py-2.5 px-2 w-32">Country</th>
                <th className="py-2.5 px-2 w-36">Phone / Mobile</th>
                <th className="py-2.5 px-3 min-w-[200px]">Address & Tax Details</th>
                <th className="py-2.5 px-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredCustomers.map(({ customer, originalIndex }) => {
                const hasAddress = Boolean(customer.address?.trim());
                const hasTax = Boolean(customer.tax_id?.trim());
                const hasPhone = Boolean(customer.phone?.trim());
                const hasEmail = Boolean(customer.email?.trim());
                const isDropdownOpen = activeDropdownRow === originalIndex;
                const isDropUp = originalIndex >= filteredCustomers.length - 2 && filteredCustomers.length > 2;

                return (
                  <tr
                    key={originalIndex}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-2 px-3 text-center">
                      <span className="w-6 h-6 mx-auto rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center">
                        {originalIndex + 1}
                      </span>
                    </td>

                    {/* Customer Name with Autocomplete */}
                    <td className="py-2 px-3 relative">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={customer.name}
                          onFocus={() => setActiveDropdownRow(originalIndex)}
                          onChange={e => {
                            updateRow(originalIndex, { name: e.target.value });
                            setActiveDropdownRow(originalIndex);
                          }}
                          placeholder={`Customer ${originalIndex + 1} name...`}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 pr-7 shadow-2xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Autocomplete Dropdown */}
                      {isDropdownOpen && (
                        <div
                          ref={dropdownRef}
                          className={`absolute left-3 right-3 ${isDropUp ? 'bottom-11' : 'top-11'} bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs`}
                        >
                          {getSuggestions(customer.name).length === 0 ? (
                            <div className="p-2.5 text-[11px] text-slate-500 italic">
                              No match found. Typing "<b>{customer.name}</b>" creates a new customer profile.
                            </div>
                          ) : (
                            getSuggestions(customer.name).map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  updateRow(originalIndex, {
                                    name: c.name,
                                    code: c.code,
                                    phone: c.phone || '',
                                    email: c.email || '',
                                    address: c.address || '',
                                    country: c.country || 'Sri Lanka',
                                    tax_id: c.tax_id || ''
                                  });
                                  setActiveDropdownRow(null);
                                }}
                                className="p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors space-y-0.5"
                              >
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>{c.name}</span>
                                  </span>
                                  <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                    {c.code}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{c.address || c.country || 'Sri Lanka'}</span>
                                  {c.phone && <span className="text-slate-400">• {c.phone}</span>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </td>

                    {/* Code */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={customer.code || ''}
                        onChange={e => updateRow(originalIndex, { code: e.target.value })}
                        placeholder="Auto"
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Country */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={customer.country || 'Sri Lanka'}
                        onChange={e => updateRow(originalIndex, { country: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Phone */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={customer.phone || ''}
                        onChange={e => updateRow(originalIndex, { phone: e.target.value })}
                        placeholder="Phone..."
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Address & Tax Preview Chip */}
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => setEditingIdx(originalIndex)}
                        className="w-full text-left p-1.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-blue-50/60 hover:border-blue-200 transition-colors cursor-pointer group-hover:border-slate-300"
                      >
                        {hasAddress ? (
                          <div className="flex items-center gap-1.5 text-slate-700 truncate">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate text-[11px] font-medium">{customer.address}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 italic text-[11px]">
                            <Plus className="w-3 h-3" />
                            <span>Add address & tax ID...</span>
                          </div>
                        )}

                        {(hasTax || hasEmail) && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            {hasTax && <span>Tax: {customer.tax_id}</span>}
                            {hasEmail && <span className="truncate">{customer.email}</span>}
                          </div>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingIdx(originalIndex)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit full address & contact details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {customers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(originalIndex)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete customer"
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

        {/* Table Bottom Action Bar */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="px-3 py-1.5 text-blue-700 hover:bg-blue-100/60 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Customer</span>
          </button>

          <span className="text-[11px] text-slate-500 font-medium">
            {customers.filter(c => c.name.trim()).length} of {customers.length} customers ready
          </span>
        </div>
      </div>

      {/* MODAL: Full Customer Details Editor */}
      {editingIdx !== null && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                  Consignee #{editingIdx + 1} of {customers.length}
                </div>
                <h3 className="text-base font-extrabold truncate">
                  {editingCustomer.name || `Customer ${editingIdx + 1}`}
                </h3>
              </div>

              {/* Step Navigation & Close */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={editingIdx === 0}
                  onClick={() => setEditingIdx(editingIdx - 1)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Previous Customer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={editingIdx === customers.length - 1}
                  onClick={() => setEditingIdx(editingIdx + 1)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Next Customer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIdx(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer transition-colors ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Form Fields */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Name */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-700">Customer / Company Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.name}
                    onChange={e => updateRow(editingIdx, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Customer Code */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Customer Code</label>
                  <input
                    type="text"
                    value={editingCustomer.code || ''}
                    onChange={e => updateRow(editingIdx, { code: e.target.value })}
                    placeholder="e.g. CUST-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Country */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Country *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editingCustomer.country || 'Sri Lanka'}
                      onChange={e => updateRow(editingIdx, { country: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 pr-8"
                    />
                    <Globe className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Full Address */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-700">Full Delivery / Registered Address</label>
                  <textarea
                    rows={2}
                    value={editingCustomer.address || ''}
                    onChange={e => updateRow(editingIdx, { address: e.target.value })}
                    placeholder="Street, City, Postal Code, District..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Phone / Mobile</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editingCustomer.phone || ''}
                      onChange={e => updateRow(editingIdx, { phone: e.target.value })}
                      placeholder="+94 77 123 4567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 pr-8"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={editingCustomer.email || ''}
                      onChange={e => updateRow(editingIdx, { email: e.target.value })}
                      placeholder="customer@domain.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 pr-8"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Tax ID */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-700">Tax ID / VAT / GST / Business Reg No.</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editingCustomer.tax_id || ''}
                      onChange={e => updateRow(editingIdx, { tax_id: e.target.value })}
                      placeholder="e.g. VAT12345678 / TIN987654"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 pr-8"
                    />
                    <Shield className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Changes are saved automatically
              </div>

              <div className="flex items-center gap-2">
                {editingIdx < customers.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setEditingIdx(editingIdx + 1)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Next Customer</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingIdx(null)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
