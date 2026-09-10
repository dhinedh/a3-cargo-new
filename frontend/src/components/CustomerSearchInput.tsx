import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Phone, Mail, Shield, Building2, Globe, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Customer } from '../types';

export interface CustomerFormData {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  tax_id?: string;
}

interface CustomerSearchInputProps {
  label: string;
  customerData: CustomerFormData;
  onChange: (updated: CustomerFormData) => void;
  allCustomers?: Customer[];
  canRemove?: boolean;
  onRemove?: () => void;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CustomerSearchInput: React.FC<CustomerSearchInputProps> = ({
  label,
  customerData,
  onChange,
  allCustomers = [],
  canRemove = false,
  onRemove,
  collapsible = false,
  isExpanded,
  onToggleExpand
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const expanded = collapsible ? (isExpanded !== undefined ? isExpanded : localExpanded) : true;

  const toggleExpanded = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded(!localExpanded);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = allCustomers.filter(c => {
    if (!customerData.name.trim()) return true;
    const q = customerData.name.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q)) ||
      (c.tax_id && c.tax_id.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={wrapperRef} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5 relative">
      {/* Name & Code Header */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-slate-800 shrink-0">{label}:</span>
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            required
            value={customerData.name}
            onFocus={() => setIsOpen(true)}
            onChange={e => {
              onChange({ ...customerData, name: e.target.value });
              setIsOpen(true);
            }}
            placeholder={`Type or search ${label} name...`}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 pr-8 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {customerData.code && (
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-800 px-2 py-1.5 rounded-lg border border-blue-200 shrink-0">
            {customerData.code}
          </span>
        )}

        {/* Action Controls: Expand/Collapse & Delete */}
        <div className="flex items-center gap-1 shrink-0">
          {collapsible && (
            <button
              type="button"
              onClick={toggleExpanded}
              className="px-2 py-1 text-slate-500 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title={expanded ? "Hide extra details" : "Show address, phone & tax details"}
            >
              <span>{expanded ? 'Less' : 'Details'}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {canRemove && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Remove this customer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="absolute left-2 right-2 top-12 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 italic">
              No matching customers found. Typing "<b>{customerData.name}</b>" will register a new customer profile.
            </div>
          ) : (
            filtered.map(c => (
              <div
                key={c.id}
                onClick={() => {
                  onChange({
                    name: c.name,
                    code: c.code,
                    phone: c.phone || '',
                    email: c.email || '',
                    address: c.address || '',
                    country: c.country || 'Sri Lanka',
                    tax_id: c.tax_id || ''
                  });
                  setIsOpen(false);
                }}
                className="p-3 hover:bg-blue-50/80 cursor-pointer transition-colors space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{c.name}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                    {c.code}
                  </span>
                </div>

                {/* Address & Country */}
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{c.address ? `${c.address}, ` : ''}{c.country || 'Sri Lanka'}</span>
                </div>

                {/* Phone & Tax ID Details */}
                {(c.phone || c.tax_id || c.email) && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" /> {c.email}
                      </span>
                    )}
                    {c.tax_id && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-slate-400" /> Tax ID: {c.tax_id}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Collapsed State Summary Pills */}
      {!expanded && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 px-1 pt-0.5 border-t border-slate-50">
          <span className="flex items-center gap-1 truncate max-w-xs">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate font-medium text-slate-600">{customerData.address || 'No address set'}</span>
          </span>
          {customerData.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{customerData.phone}</span>
            </span>
          )}
          {customerData.email && (
            <span className="flex items-center gap-1 truncate max-w-[150px]">
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{customerData.email}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{customerData.country || 'Sri Lanka'}</span>
          </span>
          {customerData.tax_id && (
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Tax: {customerData.tax_id}</span>
            </span>
          )}
        </div>
      )}

      {/* Grid of All Customer Details (Shown when expanded) */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
          {/* Address Field */}
          <div className="sm:col-span-2 flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">Address:</span>
            <input
              type="text"
              value={customerData.address || ''}
              onChange={e => onChange({ ...customerData, address: e.target.value })}
              placeholder="Street address, city, region..."
              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Phone Field */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">Phone:</span>
            <input
              type="text"
              value={customerData.phone || ''}
              onChange={e => onChange({ ...customerData, phone: e.target.value })}
              placeholder="Phone / Mobile..."
              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Email Field */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">Email:</span>
            <input
              type="email"
              value={customerData.email || ''}
              onChange={e => onChange({ ...customerData, email: e.target.value })}
              placeholder="Email address..."
              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Country Field */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">Country:</span>
            <input
              type="text"
              value={customerData.country || 'Sri Lanka'}
              onChange={e => onChange({ ...customerData, country: e.target.value })}
              placeholder="Country..."
              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Tax ID Field */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">Tax ID:</span>
            <input
              type="text"
              value={customerData.tax_id || ''}
              onChange={e => onChange({ ...customerData, tax_id: e.target.value })}
              placeholder="GST / VAT / Tax ID..."
              className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
