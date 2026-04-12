import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileBarChart, FileText, FileSpreadsheet, Download, Trash2, Loader2, CheckCircle2,
  ClipboardList, Recycle, Link2, Scale, BarChart3, Box, Calendar, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useReportsStore from '../../store/reportsStore';
import useMasterDataStore from '../../store/masterDataStore';
import useAuthStore from '../../store/authStore';
import { downloadReport } from '../../api/reports';

const REPORT_TYPE_ICONS = {
  'RPT-01': ClipboardList,
  'RPT-02': Recycle,
  'RPT-03': Link2,
  'RPT-04': Scale,
  'RPT-05': BarChart3,
  'RPT-06': Box,
  'RPT-07': FileText,
};

const REPORT_TYPE_CODES = ['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-05', 'RPT-06', 'RPT-07'];

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
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-0.5">
      {REPORT_TYPE_CODES.map((code) => {
        const Icon = REPORT_TYPE_ICONS[code];
        const active = selected === code;
        return (
          <button
            key={code}
            onClick={() => onSelect(code)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
              active
                ? 'bg-green-500/10 text-green-700 font-semibold'
                : 'text-grey-600 hover:bg-grey-100 hover:text-grey-900'
            }`}
          >
            <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-sm leading-tight">{code}</div>
              <div className={`text-xs mt-0.5 ${active ? 'text-green-600' : 'text-grey-400'}`}>{t(`types.${code}.name`)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Config Forms ----
function RPT01Config({ params, onChange, suppliers, categories }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>{t('fields.supplier')} *</label>
        <select className={selectClass} value={params.supplierId || ''} onChange={(e) => onChange({ ...params, supplierId: e.target.value })}>
          <option value="">{t('fields.selectSupplier')}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('fields.productCategories')}</label>
        <select
          className={selectClass}
          multiple
          size={4}
          value={params.categoryIds || []}
          onChange={(e) => onChange({ ...params, categoryIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.code_cbs} — {c.description_en}</option>)}
        </select>
        <p className="text-xs text-grey-400 mt-1">{t('fields.holdCtrlHint')}</p>
      </div>
    </div>
  );
}

function RPT02Config({ params, onChange, wasteStreams }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('fields.wasteStreams')}</label>
        <select
          className={selectClass}
          multiple
          size={3}
          value={params.wasteStreamIds || []}
          onChange={(e) => onChange({ ...params, wasteStreamIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function RPT03Config({ params, onChange }) {
  const { t } = useTranslation('reports');
  const mode = params.orderId ? 'single' : 'batch';
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>{t('fields.mode')}</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
            <input type="radio" name="rpt03mode" checked={mode === 'single'} onChange={() => onChange({ orderId: '', dateFrom: '', dateTo: '' })} className="text-green-500" />
            {t('modes.singleOrder')}
          </label>
          <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
            <input type="radio" name="rpt03mode" checked={mode === 'batch'} onChange={() => onChange({ dateFrom: monthAgo(), dateTo: today() })} className="text-green-500" />
            {t('modes.batchDateRange')}
          </label>
        </div>
      </div>
      {mode === 'single' ? (
        <div>
          <label className={labelClass}>{t('fields.orderId')} *</label>
          <input type="text" className={inputClass} placeholder={t('fields.orderIdPlaceholder')} value={params.orderId || ''} onChange={(e) => onChange({ ...params, orderId: e.target.value })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('fields.dateFrom')} *</label>
            <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t('fields.dateTo')} *</label>
            <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

function RPT04Config({ params, onChange, transporters, wasteStreams }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.transporter')}</label>
          <select className={selectClass} value={params.carrierId || ''} onChange={(e) => onChange({ ...params, carrierId: e.target.value })}>
            <option value="">{t('fields.allTransporters')}</option>
            {transporters.map((c) => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('fields.wasteStream')}</label>
          <select className={selectClass} value={params.wasteStreamId || ''} onChange={(e) => onChange({ ...params, wasteStreamId: e.target.value })}>
            <option value="">{t('fields.allStreams')}</option>
            {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function RPT05Config({ params, onChange, wasteStreams }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('fields.wasteStreams')}</label>
        <select
          className={selectClass}
          multiple
          size={3}
          value={params.wasteStreamIds || []}
          onChange={(e) => onChange({ ...params, wasteStreamIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function RPT06Config({ params, onChange }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('fields.containerType')}</label>
        <select className={selectClass} value={params.skipType || ''} onChange={(e) => onChange({ ...params, skipType: e.target.value })}>
          <option value="">{t('fields.allTypes')}</option>
          <option value="OPEN_TOP">{t('containerTypes.OPEN_TOP')}</option>
          <option value="CLOSED">{t('containerTypes.CLOSED')}</option>
          <option value="ROLL_ON">{t('containerTypes.ROLL_ON')}</option>
          <option value="COMPACTOR">{t('containerTypes.COMPACTOR')}</option>
          <option value="WHEELIE_BIN">{t('containerTypes.WHEELIE_BIN')}</option>
          <option value="PALLET_BOX">{t('containerTypes.PALLET_BOX')}</option>
          <option value="IBC">{t('containerTypes.IBC')}</option>
          <option value="OTHER">{t('containerTypes.OTHER')}</option>
        </select>
      </div>
    </div>
  );
}

function RPT07Config({ params, onChange, suppliers, materials }) {
  const { t } = useTranslation('reports');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.supplier')} *</label>
          <select className={selectClass} value={params.supplierId || ''} onChange={(e) => onChange({ ...params, supplierId: e.target.value })}>
            <option value="">{t('fields.selectSupplier')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('fields.material')} *</label>
          <select className={selectClass} value={params.materialId || ''} onChange={(e) => onChange({ ...params, materialId: e.target.value })}>
            <option value="">{t('fields.selectMaterial')}</option>
            {materials.map((material) => <option key={material.id} value={material.id}>{material.code} — {material.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fields.dateFrom')} *</label>
          <input type="date" className={inputClass} value={params.dateFrom || ''} onChange={(e) => onChange({ ...params, dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t('fields.dateTo')} *</label>
          <input type="date" className={inputClass} value={params.dateTo || ''} onChange={(e) => onChange({ ...params, dateTo: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ---- Generate Buttons ----
function GenerateButtons({ generating, onGenerate }) {
  const { t } = useTranslation('reports');
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-grey-200">
      <button className={btnPrimary} disabled={generating} onClick={() => onGenerate('pdf')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {t('buttons.generatePdf')}
      </button>
      <button className={btnSecondary} disabled={generating} onClick={() => onGenerate('xlsx')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {t('buttons.generateXlsx')}
      </button>
      <button className={btnSecondary} disabled={generating} onClick={() => onGenerate('both')}>
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {t('buttons.generateBoth')}
      </button>
    </div>
  );
}

// ---- Success Banner ----
function SuccessBanner({ report, onDownload, onDismiss }) {
  const { t } = useTranslation(['reports', 'common']);
  if (!report) return null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={20} className="text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">{t('reports:generatedSuccessfully')}</p>
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
        <button className="text-grey-400 hover:text-grey-600 text-xs ml-2" onClick={onDismiss}>{t('common:buttons.dismiss')}</button>
      </div>
    </div>
  );
}

// ---- Recent Reports Table ----
function RecentReportsTable({ reports, loading, onDownload, onDelete, userRole }) {
  const { t } = useTranslation('reports');
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-grey-400">
        <Loader2 size={20} className="animate-spin mr-2" /> {t('loadingReports')}
      </div>
    );
  }
  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-grey-400">
        <FileBarChart size={32} strokeWidth={1.5} className="mb-2" />
        <p className="text-sm">{t('noReports')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-grey-50 border-b border-grey-200">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.type')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.name')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.generated')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.by')}</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.files')}</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('table.actions')}</th>
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
  const { t } = useTranslation('reports');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { selectedType, setSelectedType, reports, totalCount, loading, generating, generatedReport, clearGenerated, fetchReports, deleteReport: deleteReportAction } = useReportsStore();
  const generateReport = useReportsStore((s) => s.generateReport);
  const { suppliers, carriers, wasteStreams, productCategories, materials, loadAll } = useMasterDataStore();
  const transporterEntities = useMasterDataStore((s) => s.getTransporterEntities());
  const transporterOptions = transporterEntities.length > 0 ? transporterEntities : carriers.map(c => ({ id: c.id, company_name: c.name }));

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
      toast.success(t('toast.generated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('toast.generationFailed'));
    }
  }, [selectedType, params, generateReport, t]);

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
      toast.error(t('toast.downloadFailed'));
    }
  }, [t]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm(t('confirm.deleteReport'))) return;
    try {
      await deleteReportAction(id);
      toast.success(t('toast.deleted'));
    } catch {
      toast.error(t('toast.deleteFailed'));
    }
  }, [deleteReportAction, t]);

  const currentTypeCode = selectedType;
  const CurrentIcon = REPORT_TYPE_ICONS[currentTypeCode];

  const configForm = (() => {
    switch (selectedType) {
      case 'RPT-01': return <RPT01Config params={params} onChange={setParams} suppliers={suppliers} categories={productCategories} />;
      case 'RPT-02': return <RPT02Config params={params} onChange={setParams} wasteStreams={wasteStreams} />;
      case 'RPT-03': return <RPT03Config params={params} onChange={setParams} />;
      case 'RPT-04': return <RPT04Config params={params} onChange={setParams} transporters={transporterOptions} wasteStreams={wasteStreams} />;
      case 'RPT-05': return <RPT05Config params={params} onChange={setParams} wasteStreams={wasteStreams} />;
      case 'RPT-06': return <RPT06Config params={params} onChange={setParams} />;
      case 'RPT-07': return <RPT07Config params={params} onChange={setParams} suppliers={suppliers} materials={materials} />;
      default: return null;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-grey-900">{t('title')}</h1>
          <p className="text-sm text-grey-500 mt-0.5">{t('subtitle')}</p>
        </div>
        <button className={btnSecondary} onClick={() => navigate('/reports/schedules')}>
          <CalendarClock size={16} /> {t('scheduledReports')}
        </button>
      </div>

      {/* Success Banner */}
      <SuccessBanner report={generatedReport} onDownload={handleDownload} onDismiss={clearGenerated} />

      {/* Two-panel config area */}
      <div className="flex gap-0 rounded-lg border border-grey-200 bg-white shadow-sm overflow-hidden">
        {/* Left nav */}
        <div className="w-[260px] bg-grey-50 border-r border-grey-200 p-3 shrink-0">
          <div className="px-3 pb-2 mb-2 border-b border-grey-200">
            <span className="text-[10px] font-semibold text-grey-500 uppercase tracking-wider">{t('reportType')}</span>
          </div>
          <ReportTypeNav selected={selectedType} onSelect={setSelectedType} />
        </div>

        {/* Right config */}
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-5">
            {CurrentIcon && <CurrentIcon size={20} className="text-green-600" />}
            <div>
              <h2 className="text-base font-semibold text-grey-900">{currentTypeCode ? t(`types.${currentTypeCode}.name`) : ''}</h2>
              <p className="text-xs text-grey-500">{currentTypeCode ? t(`types.${currentTypeCode}.description`) : ''}</p>
            </div>
          </div>

          {configForm}

          <GenerateButtons generating={generating} onGenerate={handleGenerate} />
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
        <div className="px-4 py-3 border-b border-grey-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-grey-900">{t('recentReports')}</h3>
          <span className="text-xs text-grey-400">{t('totalCount', { count: totalCount })}</span>
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
