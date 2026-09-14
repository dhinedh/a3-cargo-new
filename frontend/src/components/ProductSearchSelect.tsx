import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X, Tag, FileText, Check, Sparkles } from 'lucide-react';
import { apiClient } from '../api/client';
import type { ItemEntry } from '../types';

export interface ProductOption {
  item_name: string;
  hs_code?: string;
  item_category?: string;
  unit?: string;
  general_duty_rate?: string;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  source?: string;
}

interface ProductSearchSelectProps {
  value: string;
  onChange: (val: string) => void;
  onSelectProduct?: (product: ProductOption) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ProductSearchSelect: React.FC<ProductSearchSelectProps> = ({
  value,
  onChange,
  onSelectProduct,
  placeholder = "Search product name, HSN code, or category...",
  label,
  required = false,
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value change
  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search results on input change
  useEffect(() => {
    let isSubscribed = true;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        if (!searchQuery.trim()) {
          // Fetch initial top 30 item master items
          const res = await apiClient.getItemEntries({ page: 1, page_size: 30 });
          if (isSubscribed) {
            setOptions(
              res.items.map((i: ItemEntry) => ({
                item_name: i.item_name,
                hs_code: i.hs_code || '',
                item_category: i.item_category || 'General Cargo',
                unit: i.unit || 'KG',
                general_duty_rate: i.general_duty_rate || '20%',
                vat_rate: i.vat_rate || '18%',
                pal_rate: i.pal_rate || 'Ex',
                cess_rate: i.cess_rate || '10%',
                sscl_rate: i.sscl_rate || '2.5%',
                source: 'Item Master'
              }))
            );
          }
        } else {
          // Search across Item Master & Tariff
          const unified = await apiClient.searchAllProducts(searchQuery, 30);
          if (isSubscribed) {
            setOptions(
              unified.map((u) => ({
                item_name: u.item_name,
                hs_code: u.hs_code || '',
                item_category: u.item_category || u.source || 'Tariff Schedule',
                unit: u.unit || 'KG',
                general_duty_rate: u.general_duty_rate || '20%',
                vat_rate: u.vat_rate || '18%',
                pal_rate: u.pal_rate || 'Ex',
                cess_rate: u.cess_rate || '10%',
                sscl_rate: u.sscl_rate || '2.5%',
                source: u.source
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error searching products:', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    const timer = setTimeout(fetchOptions, 180);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSelect = (option: ProductOption) => {
    onChange(option.item_name);
    setSearchQuery(option.item_name);
    if (onSelectProduct) {
      onSelectProduct(option);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % Math.max(1, options.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlightedIndex]) {
        handleSelect(options[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          {label} {required && <span className="text-emerald-400">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4 text-emerald-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200 shadow-inner"
        />

        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1 text-slate-400">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Typeahead Search Select Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Searching Master Products & Tariff...
            </div>
          ) : options.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              No matching products found for "{searchQuery}".
              <div className="text-xs text-slate-500 mt-1">
                You can press Enter to use "{searchQuery}" as a custom item name.
              </div>
            </div>
          ) : (
            options.map((opt, idx) => {
              const isSelected = value.toLowerCase() === opt.item_name.toLowerCase();
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={`${opt.item_name}-${opt.hs_code}-${idx}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-3 cursor-pointer transition-colors duration-150 ${
                    isHighlighted
                      ? 'bg-emerald-950/40 text-emerald-200 border-l-4 border-emerald-500'
                      : isSelected
                      ? 'bg-slate-800/80 text-white'
                      : 'hover:bg-slate-800/50 text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-100 truncate flex items-center gap-1.5">
                        <span>{opt.item_name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        {opt.hs_code && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 font-mono font-medium border border-emerald-700/50">
                            <FileText className="w-3 h-3 text-emerald-400" />
                            HS: {opt.hs_code}
                          </span>
                        )}

                        {opt.item_category && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            <Tag className="w-3 h-3 text-amber-400" />
                            {opt.item_category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Duty Rate Preview Badge */}
                    {opt.general_duty_rate && (
                      <div className="text-right text-[11px] text-slate-400 font-mono bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800 flex-shrink-0">
                        <div className="text-emerald-400 font-semibold">GEN: {opt.general_duty_rate}</div>
                        <div>VAT: {opt.vat_rate || '18%'}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
