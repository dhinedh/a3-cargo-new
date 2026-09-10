import React, { useState, useEffect } from 'react';
import {
  BarChart3, DollarSign, TrendingUp, ShieldAlert,
  Ship, ArrowUpRight
} from 'lucide-react';
import type { DashboardSummary } from '../types';
import { apiClient } from '../api/client';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading SI Analytics Dashboard...</div>;
  }

  if (!summary) {
    return <div className="text-center py-12 text-slate-500">No dashboard data available.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>STEP 14 &bull; SI DASHBOARD & FINANCIAL REPORTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics & Profitability Overview</h1>
          <p className="text-sm text-slate-500">Comprehensive report of sales, duty, profits, loss, customer performance & financial year summaries</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Shipments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Shipments</span>
            <div className="text-2xl font-bold text-slate-800 mt-1">{summary.total_shipments}</div>
            <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 mt-1">
              <Ship className="w-3 h-3" /> Active Operations
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Ship className="w-6 h-6" />
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Revenue (LKR)</span>
            <div className="text-xl font-mono font-bold text-blue-900 mt-1">
              LKR {summary.total_sales_lkr.toLocaleString()}
            </div>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Gross Invoiced
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Duty */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Customs Duty</span>
            <div className="text-xl font-mono font-bold text-amber-900 mt-1">
              LKR {summary.total_duty_lkr.toLocaleString()}
            </div>
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-1">
              Customs Paid
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net Profit (LKR)</span>
            <div className="text-xl font-mono font-bold text-emerald-700 mt-1">
              LKR {summary.total_profit_lkr.toLocaleString()}
            </div>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Net Earnings
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Customer-wise Performance Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Customer-wise Profitability & Outstanding Balances</h3>
            <p className="text-xs text-slate-500">Breakdown of orders, sales, total costs, net profit, and estimated pending collection</p>
          </div>
        </div>

        {summary.customer_summaries.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">No customer transactions recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold">
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Code</th>
                  <th className="p-3 text-center">Shipments</th>
                  <th className="p-3 text-right">Total Sales (LKR)</th>
                  <th className="p-3 text-right">Total Cost (LKR)</th>
                  <th className="p-3 text-right">Net Profit (LKR)</th>
                  <th className="p-3 text-right">Pending Balance (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.customer_summaries.map(c => (
                  <tr key={c.customer_id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{c.customer_name}</td>
                    <td className="p-3 font-mono font-semibold text-blue-600">{c.customer_code}</td>
                    <td className="p-3 text-center font-semibold">{c.total_shipments}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">LKR {c.total_sales_lkr.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-600">LKR {c.total_cost_lkr.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">LKR {c.total_profit_lkr.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-amber-700 font-semibold">LKR {c.pending_amount_lkr.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Year-wise Summary Breakdown */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-lg font-bold text-slate-800">Financial Year-wise Summary Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(summary.year_wise_summary).map(([fy, stats]: [string, any]) => (
            <div key={fy} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-sm text-blue-900">FY {fy}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  {stats.shipments_count} Shipments
                </span>
              </div>

              <div className="space-y-1 text-xs pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sales Invoiced:</span>
                  <span className="font-mono font-bold">LKR {stats.sales_lkr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Costs:</span>
                  <span className="font-mono">LKR {stats.cost_lkr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Net FY Profit:</span>
                  <span className="font-mono text-emerald-700">LKR {stats.profit_lkr.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
