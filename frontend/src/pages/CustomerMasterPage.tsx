import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Search, Mail, Phone, MapPin, Shield } from 'lucide-react';
import type { Customer } from '../types';
import { apiClient } from '../api/client';

export const CustomerMasterPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    country: 'Sri Lanka',
    tax_id: ''
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm({
      name: '',
      code: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      email: '',
      phone: '',
      address: '',
      country: 'Sri Lanka',
      tax_id: ''
    });
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      code: c.code,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      country: c.country || 'Sri Lanka',
      tax_id: c.tax_id || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      alert('Customer Name and Code are required!');
      return;
    }

    try {
      if (editingCustomer) {
        await apiClient.updateCustomer(editingCustomer.id, form);
      } else {
        await apiClient.createCustomer(form);
      }
      setShowModal(false);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save customer');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete customer '${name}'?`)) return;
    try {
      await apiClient.deleteCustomer(id);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete customer');
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.country && c.country.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>STEP 2 &bull; CUSTOMER DIRECTORY</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Master</h1>
          <p className="text-sm text-slate-500">Manage client profiles for multi-customer shipment allocations</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Customer Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500">
          No customers found. Click <b>Add Customer</b> to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs font-semibold rounded-md border border-blue-200">
                    {c.code}
                  </span>
                  <h3 className="font-bold text-slate-800 text-lg mt-1">{c.name}</h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(c)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.country || 'Sri Lanka'}</span>
                </div>
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.tax_id && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tax ID: {c.tax_id}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Acme Trading Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Code *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <select
                    value={form.country}
                    onChange={e => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="India">India</option>
                    <option value="UAE">UAE</option>
                    <option value="Singapore">Singapore</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="client@acme.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+94 77 123 4567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, City, Country"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
