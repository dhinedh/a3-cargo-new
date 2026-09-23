import React, { useState, useRef, useEffect } from 'react';
import {
  Ship,
  Users,
  Truck,
  BarChart3,
  ChevronDown,
  Plus,
  Package,
  History,
  Database,
  Search,
  HelpCircle,
  Settings,
  Boxes,
  GitFork
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCreateShipment: () => void;
  onOpenAddVendor: () => void;
  onOpenAddCustomer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateShipment,
  onOpenAddVendor,
  onOpenAddCustomer
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menuName: string) => {
    setOpenMenu(prev => (prev === menuName ? null : menuName));
  };

  const handleMenuClick = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  return (
    <header className="bg-[#091E42] text-white border-b border-[#253858] sticky top-0 z-40 font-sans shadow-xs">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Section: Brand Logo & Context Navigation */}
        <div className="flex items-center gap-4" ref={navRef}>
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer py-1 select-none shrink-0"
            onClick={() => setActiveTab('shipments')}
            title="A3 Express Cargo - Home"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0C66E4] hover:bg-[#0052CC] text-white flex items-center justify-center shadow-xs transition-colors">
              <Ship className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white font-mono">
                A3 EXPRESS
              </span>
              <span className="text-[10px] font-bold bg-[#172B4D] text-[#4C9AFF] px-1.5 py-0.5 rounded border border-[#253858] font-mono">
                CARGO
              </span>
            </div>
          </div>

          {/* Navigation Menus (Atlassian Dropdowns) */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* 1. SHIPMENTS */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('shipment')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'shipments' || activeTab === 'shipment_workspace' || activeTab === 'shipment_detail' || openMenu === 'shipment'
                    ? 'bg-[#172B4D] text-[#4C9AFF]'
                    : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
                }`}
              >
                <span>Shipments</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${openMenu === 'shipment' ? 'rotate-180' : ''}`} />
              </button>

              {openMenu === 'shipment' && (
                <div className="absolute left-0 mt-1.5 w-60 bg-[#091E42] border border-[#253858] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleMenuClick(onOpenCreateShipment)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[#4C9AFF] hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Plus className="w-4 h-4 text-[#4C9AFF]" />
                    <span>Create New Shipment</span>
                  </button>
                  <button
                    onClick={() => handleMenuClick(() => setActiveTab('shipments'))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#DEEBFF] hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>All Shipments Hub</span>
                  </button>
                  <button
                    onClick={() => handleMenuClick(() => setActiveTab('shipments'))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#DEEBFF] hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <History className="w-4 h-4 text-purple-400" />
                    <span>Completed Archive</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. CUSTOMERS */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('customer')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'customers' || openMenu === 'customer'
                    ? 'bg-[#172B4D] text-[#4C9AFF]'
                    : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
                }`}
              >
                <span>Customers</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${openMenu === 'customer' ? 'rotate-180' : ''}`} />
              </button>

              {openMenu === 'customer' && (
                <div className="absolute left-0 mt-1.5 w-56 bg-[#091E42] border border-[#253858] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleMenuClick(() => setActiveTab('customers'))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#DEEBFF] hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Customer Directory</span>
                  </button>
                  <button
                    onClick={() => handleMenuClick(onOpenAddCustomer)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Add New Customer</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. VENDORS */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('vendor')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'vendors' || openMenu === 'vendor'
                    ? 'bg-[#172B4D] text-[#4C9AFF]'
                    : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
                }`}
              >
                <span>Vendors</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${openMenu === 'vendor' ? 'rotate-180' : ''}`} />
              </button>

              {openMenu === 'vendor' && (
                <div className="absolute left-0 mt-1.5 w-56 bg-[#091E42] border border-[#253858] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleMenuClick(() => setActiveTab('vendors'))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#DEEBFF] hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>Vendor Management</span>
                  </button>
                  <button
                    onClick={() => handleMenuClick(onOpenAddVendor)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-[#172B4D] rounded-lg transition-all cursor-pointer text-left"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Add New Vendor</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. MASTER ITEMS */}
            <button
              onClick={() => setActiveTab('items')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'items'
                  ? 'bg-[#172B4D] text-[#4C9AFF]'
                  : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 opacity-80" />
              <span>Item Catalog</span>
            </button>

            {/* 5. TARIFF DATABASE */}
            <button
              onClick={() => setActiveTab('tariff')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'tariff'
                  ? 'bg-[#172B4D] text-[#4C9AFF]'
                  : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 opacity-80" />
              <span>Tariff Explorer</span>
            </button>

            {/* 6. TRACKING & TRACEABILITY */}
            <button
              onClick={() => setActiveTab('tracking')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'tracking'
                  ? 'bg-[#172B4D] text-[#4C9AFF]'
                  : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 text-[#4C9AFF]" />
              <span>Tracking</span>
              <span className="text-[9px] bg-[#0C66E4] text-white px-1 rounded-full ml-0.5">NEW</span>
            </button>

            {/* 7. ANALYTICS */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#172B4D] text-[#4C9AFF]'
                  : 'text-[#DEEBFF] hover:bg-[#172B4D]/60 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 opacity-80" />
              <span>Analytics</span>
            </button>
          </nav>

          {/* Atlassian Primary "+ Create" Button */}
          <button
            type="button"
            onClick={onOpenCreateShipment}
            className="bg-[#0C66E4] hover:bg-[#0052CC] text-white font-bold text-xs px-3.5 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ml-1 active:scale-95"
            title="Create New Shipment Pipeline"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create</span>
          </button>
        </div>

        {/* Right Section: Search Bar & User / Utility Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Search Input */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search HS code, shipment..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 lg:w-64 pl-8 pr-8 py-1 text-xs bg-[#172B4D] border border-[#253858] rounded-md text-white placeholder-slate-400 focus:outline-hidden focus:bg-[#091E42] focus:border-[#4C9AFF] transition-all"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono bg-[#091E42]/80 px-1 py-0.5 rounded border border-[#253858]">
              ⌘K
            </kbd>
          </div>

          {/* Settings Icon */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-[#172B4D] rounded-md cursor-pointer transition-colors"
            title="Settings & Dashboard"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Help Icon */}
          <button
            type="button"
            onClick={() => alert('A3 Express Cargo Enterprise v2.0\nRefer to the Sidebar pipeline steps to manage customer requirements, vendor allocations, and export documents.')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-[#172B4D] rounded-md cursor-pointer transition-colors"
            title="Help & Guidance"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('profile')}
              className="w-7 h-7 rounded-full bg-[#0052CC] text-white font-bold text-[11px] flex items-center justify-center ring-2 ring-[#4C9AFF]/30 hover:ring-[#4C9AFF] transition-all cursor-pointer"
              title="A3 Express Admin Profile"
            >
              AS
            </button>

            {openMenu === 'profile' && (
              <div className="absolute right-0 mt-1.5 w-64 bg-[#091E42] border border-[#253858] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-[#253858]">
                  <div className="w-9 h-9 rounded-xl bg-[#0C66E4] text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                    AS
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">A3 Cargo Administrator</div>
                    <div className="text-[10px] text-slate-400">admin@a3expresscargo.com</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs font-medium">
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>Role:</span>
                    <span className="font-bold text-[#4C9AFF]">Operations Admin</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>Region:</span>
                    <span className="font-bold text-emerald-400">India &bull; Sri Lanka</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>Platform:</span>
                    <span className="font-bold text-amber-400">Atlassian Cloud ADS</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
