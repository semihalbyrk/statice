import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart, FileText, FileSpreadsheet, Download, Trash2, Loader2, CheckCircle2,
  ClipboardList, Recycle, Link2, Scale, BarChart3, Box, Calendar, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useReportsStore from '../../store/reportsStore';
import useMasterDataStore from '../../store/masterDataStore';
import useAuthStore from '../../store/authStore';
import { downloadReport } from '../../api/reports';

const REPORT_TYPES = [
  { code: 'RPT-01', name: 'Supplier Circularity Statement', icon: ClipboardList, description: 'Per-supplier recycling and recovery rates' },
  { code: 'RPT-02', name: 'Material Recovery Summary', icon: Recycle, description: 'Aggregate recovery by product category' },
  { code: 'RPT-03', name: 'Chain of Custody', icon: Link2, description: 'Full traceability per consignment' },
  { code: 'RPT-04', name: 'Inbound Weight Register', icon: Scale, description: 'Weighing events with carrier/stream subtotals' },
  { code: 'RPT-05', name: 'Waste Stream Analysis', icon: BarChart3, description: 'Breakdown by waste stream and category' },
  { code: 'RPT-06', name: 'Skip Asset Utilisation', icon: Box, description: 'Asset usage, counts, and top containers' },
];

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-xs font-medium text-grey-600 mb-1.5';
const btnPrimary = 'inline-flex items-center gap-2 h-9 px-4 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = 'inline-flex items-center gap-2 h-9 px-4 border border-grey-300 text-grey-700 text-sm font-medium rounded-md hover:bg-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// ---- Report Type Nav ----
function ReportTypeNav({ selected, onSelect }) {
  return (
    <div className="space-y-0.5">
      {REPORT_TYPES.map((rt) => {
        const Icon = rt.icon;
        const active = selected === rt.code;
        return (
          <button
            key={rt.code}
            onClick={() => onSelect(rt.code)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
              active
                ? 'bg-green-500/10 text-green-700 font-semibold'
                : 'text-grey-600 hover:bg-grey-100 hover:text-grey-900'
            }`}
          >
            <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-sm leading-tight">{rt.code}</div>
              <div className={`text-xs mt-0.5 ${active ? 'text-green-600' : 'text-grey-400'}`}>{rt.name}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Config Forms ----
function RPT01Config({ params, onChange, suppliers, categories }) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Supplier *</label>
        <select className={selectClass} value={params.supplierId || ''} onChange={(e) => onChange({ ...params, supplierId: e.target.value })}>
          <option value="">Select supplier...</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date From *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Date To *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Product Categories (optional)</label>
        <select
          className={selectClass}
          multiple
          size={4}
          value={params.categoryIds || []}
          onChange={(e) => onChange({ ...params, categoryIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.code_cbs} — {c.description_en}</option>)}
        </select>
        <p className="text-xs text-grey-400 mt-1">Hold Cmd/Ctrl to select multiple. Leave empty for all.</p>
      </div>
    </div>
  );
}

function RPT02Config({ params, onChange, wasteStreams }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date From *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Date To *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Waste Streams (optional)</label>
        <select
          className={selectClass}
          multiple
          size={3}
          value={params.wasteStreamIds || []}
          onChange={(e) => onChange({ ...params, wasteStreamIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name_en}</option>)}
        </select>
      </div>
    </div>
  );
}

function RPT03Config({ params, onChange }) {
  const mode = params.orderId ? 'single' : 'batch';
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Mode</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
            <input type="radio" name="rpt03mode" checked={mode === 'single'} onChange={() => onChange({ orderId: '', dateFrom: '', dateTo: '' })} className="text-green-500" />
            Single Order
          </label>
          <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
            <input type="radio" name="rpt03mode" checked={mode === 'batch'} onChange={() => onChange({ dateFrom: monthAgo(), dateTo: today() })} className="text-green-500" />
            Batch (Date Range)
          </label>
        </div>
      </div>
      {mode === 'single' ? (
        <div>
          <label className={labelClass}>Order ID *</label>
          <input type="text" className={inputClass} placeholder="Enter order ID..." value={params.orderId || ''} onChange={(e) => onChange({ ...params, orderId: e.target.value })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date From *</label>
            <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Date To *</label>
            <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

function RPT04Config({ params, onChange, carriers, wasteStreams }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date From *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Date To *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Carrier (optional)</label>
          <select className={selectClass} value={params.carrierId || ''} onChange={(e) => onChange({ ...params, carrierId: e.target.value })}>
            <option value="">All carriers</option>
            {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Waste Stream (optional)</label>
          <select className={selectClass} value={params.wasteStreamId || ''} onChange={(e) => onChange({ ...params, wasteStreamId: e.target.value })}>
            <option value="">All streams</option>
            {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name_en}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function RPT05Config({ params, onChange, wasteStreams }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date From *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Date To *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Waste Streams (optional)</label>
        <select
          className={selectClass}
          multiple
          size={3}
          value={params.wasteStreamIds || []}
          onChange={(e) => onChange({ ...params, wasteStreamIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name_en}</option>)}
        </select>
      </div>
    </div>
  );
}

function RPT06Config({ params, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date From *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Date To *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Skip Type (optional)</label>
        <select className={selectClass} value={params.skipType || ''} onChange={(e) => onChange({ ...params, skipType: e.target.value })}>
          <option value="">All types</option>
          <option value="OPEN_TOP">Open Top</option>
          <option value="CLOSED">Closed</option>
          <option value="ROLL_ON">Roll-on</option>
          <option value="COMPACTOR">Compactor</option>
          <option value="WHEELIE_BIN">Wheelie Bin</option>
          <option value="PALLET_BOX">Pallet Box</option>
          <option value="IBC">IBC</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
    </div>
  );
}

// ---- Generate Buttons ----
function GenerateButtons({ generating, onGenerate }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-grey-200">
      <button className={btnPrimary} disabled={generating} onClick={() => onGenerate('pdf')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        Generate PDF
      </button>
      <button className={btnSecondary} disabled={generating} onClick={() => onGenerate('xlsx')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        Generate XLSX
      </button>
      <button className={btnSecondary} disabled={generating} onClick={() => onGenerate('both')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Generate Both
      </button>
    </div>
  );
}

// ---- Success Banner ----
function SuccessBanner({ report, onDownload, onDismiss }) {
  if (!report) return null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={20} className="text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">Report generated successfully</p>
          <p className="text-xs text-green-600 mt-0.5">{report.typeName} — {new Date(report.generatedAt).toLocaleString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {report.hasPdf && (
          <button className={btnSecondary} onClick={() => onDownload(report.id, 'pdf')}>
            <FileText size={14} /> PDF
          </button>
        )}
        {report.hasXlsx && (
          <button className={btnSecondary} onClick={() => onDownload(report.id, 'xlsx')}>
            <FileSpreadsheet size={14} /> XLSX
          </button>
        )}
        <button className="text-grey-400 hover:text-grey-600 text-xs ml-2" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

// ---- Recent Reports Table ----
function RecentReportsTable({ reports, loading, onDownload, onDelete, userRole }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-grey-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading reports...
      </div>
    );
  }
  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-grey-400">
        <FileBarChart size={32} strokeWidth={1.5} className="mb-2" />
        <p className="text-sm">No reports generated yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-grey-50 border-b border-grey-200">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Type</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Generated</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">By</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Files</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
              <td className="px-4 py-3 font-medium text-grey-900">{r.type}</td>
              <td className="px-4 py-3 text-grey-600">{r.typeName}</td>
              <td className="px-4 py-3 text-grey-600">{new Date(r.generatedAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-grey-600">{r.generatedBy || '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {r.hasPdf && (
                    <button onClick={() => onDownload(r.id, 'pdf')} className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                      <FileText size={13} /> PDF
                    </button>
                  )}
                  {r.hasXlsx && (
                    <button onClick={() => onDownload(r.id, 'xlsx')} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      <FileSpreadsheet size={13} /> XLSX
                    </button>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                {userRole === 'ADMIN' && (
                  <button onClick={() => onDelete(r.id)} className="text-grey-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main Page ----
export default function ReportsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { selectedType, setSelectedType, reports, totalCount, loading, generating, generatedReport, clearGenerated, fetchReports, deleteReport: deleteReportAction } = useReportsStore();
  const generateReport = useReportsStore((s) => s.generateReport);
  const { suppliers, carriers, wasteStreams, productCategories, loadAll } = useMasterDataStore();

  const [params, setParams] = useState({ dateFrom: monthAgo(), dateTo: today() });

  useEffect(() => {
    loadAll();
    fetchReports({ page: 1, limit: 20 });
  }, []);

  // Reset params when type changes
  useEffect(() => {
    setParams({ dateFrom: monthAgo(), dateTo: today() });
  }, [selectedType]);

  const handleGenerate = useCallback(async (format) => {
    try {
      await generateReport({ type: selectedType, format, parameters: params });
      toast.success('Report generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    }
  }, [selectedType, params, generateReport]);

  const handleDownload = useCallback(async (id, format) => {
    try {
      const { data } = await downloadReport(id, format);
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${id.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this report permanently?')) return;
    try {
      await deleteReportAction(id);
      toast.success('Report deleted');
    } catch {
      toast.error('Delete failed');
    }
  }, [deleteReportAction]);

  const currentType = REPORT_TYPES.find((rt) => rt.code === selectedType);

  const configForm = (() => {
    switch (selectedType) {
      case 'RPT-01': return <RPT01Config params={params} onChange={setParams} suppliers={suppliers} categories={productCategories} />;
      case 'RPT-02': return <RPT02Config params={params} onChange={setParams} wasteStreams={wasteStreams} />;
      case 'RPT-03': return <RPT03Config params={params} onChange={setParams} />;
      case 'RPT-04': return <RPT04Config params={params} onChange={setParams} carriers={carriers} wasteStreams={wasteStreams} />;
      case 'RPT-05': return <RPT05Config params={params} onChange={setParams} wasteStreams={wasteStreams} />;
      case 'RPT-06': return <RPT06Config params={params} onChange={setParams} />;
      default: return null;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-grey-900">Reports</h1>
          <p className="text-sm text-grey-500 mt-0.5">Generate and download compliance reports</p>
        </div>
        <button className={btnSecondary} onClick={() => navigate('/reports/schedules')}>
          <CalendarClock size={16} /> Scheduled Reports
        </button>
      </div>

      {/* Success Banner */}
      <SuccessBanner report={generatedReport} onDownload={handleDownload} onDismiss={clearGenerated} />

      {/* Two-panel config area */}
      <div className="flex gap-0 rounded-lg border border-grey-200 bg-white shadow-sm overflow-hidden">
        {/* Left nav */}
        <div className="w-[260px] bg-grey-50 border-r border-grey-200 p-3 shrink-0">
          <div className="px-3 pb-2 mb-2 border-b border-grey-200">
            <span className="text-[10px] font-semibold text-grey-500 uppercase tracking-wider">Report Type</span>
          </div>
          <ReportTypeNav selected={selectedType} onSelect={setSelectedType} />
        </div>

        {/* Right config */}
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-5">
            {currentType && <currentType.icon size={20} className="text-green-600" />}
            <div>
              <h2 className="text-base font-semibold text-grey-900">{currentType?.name}</h2>
              <p className="text-xs text-grey-500">{currentType?.description}</p>
            </div>
          </div>

          {configForm}

          <GenerateButtons generating={generating} onGenerate={handleGenerate} />
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
        <div className="px-4 py-3 border-b border-grey-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-grey-900">Recent Reports</h3>
          <span className="text-xs text-grey-400">{totalCount} total</span>
        </div>
        <RecentReportsTable
          reports={reports}
          loading={loading}
          onDownload={handleDownload}
          onDelete={handleDelete}
          userRole={user?.role}
        />
      </div>
    </div>
  );
}
