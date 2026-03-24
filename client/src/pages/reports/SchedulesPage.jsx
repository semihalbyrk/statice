import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, CalendarClock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useReportsStore from '../../store/reportsStore';
import { createSchedule, updateSchedule, deleteSchedule } from '../../api/reports';
import AppStatusBadge from '../../components/ui/StatusBadge';

const REPORT_TYPE_CODES = ['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-05', 'RPT-06', 'RPT-07'];

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const FORMATS = ['PDF', 'XLSX', 'BOTH'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-xs font-medium text-grey-600 mb-1.5';
const btnPrimary = 'inline-flex items-center gap-2 h-9 px-4 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = 'inline-flex items-center gap-2 h-9 px-4 border border-grey-300 text-grey-700 text-sm font-medium rounded-md hover:bg-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function FrequencyBadge({ frequency }) {
  const colors = {
    DAILY: 'bg-blue-50 text-blue-700',
    WEEKLY: 'bg-purple-50 text-purple-700',
    MONTHLY: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[frequency] || 'bg-grey-100 text-grey-600'}`}>
      {frequency}
    </span>
  );
}

// ---- Schedule Form Modal ----
function ScheduleFormModal({ schedule, onClose, onSuccess }) {
  const { t } = useTranslation('reports');
  const isEdit = !!schedule;
  const [form, setForm] = useState({
    report_type: schedule?.report_type || 'RPT-01',
    frequency: schedule?.frequency || 'WEEKLY',
    day_of_week: schedule?.day_of_week ?? 1,
    day_of_month: schedule?.day_of_month ?? 1,
    recipient_emails: schedule?.recipient_emails?.join(', ') || '',
    format: schedule?.format || 'PDF',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const emails = form.recipient_emails.split(',').map((e) => e.trim()).filter(Boolean);
    if (!emails.length) {
      toast.error(t('schedules.validation.emailRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        report_type: form.report_type,
        frequency: form.frequency,
        recipient_emails: emails,
        format: form.format,
        parameters: {},
      };
      if (form.frequency === 'WEEKLY') payload.day_of_week = parseInt(form.day_of_week);
      if (form.frequency === 'MONTHLY') payload.day_of_month = parseInt(form.day_of_month);

      if (isEdit) {
        await updateSchedule(schedule.id, payload);
        toast.success(t('schedules.toast.updated'));
      } else {
        await createSchedule(payload);
        toast.success(t('schedules.toast.created'));
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || t('schedules.toast.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
          <h3 className="text-base font-semibold text-grey-900">{isEdit ? t('schedules.editSchedule') : t('schedules.newSchedule')}</h3>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>{t('fields.reportTypeField')}</label>
            <select name="report_type" className={selectClass} value={form.report_type} onChange={handleChange}>
              {REPORT_TYPE_CODES.map((code) => (
                <option key={code} value={code}>{code} — {t(`types.${code}.name`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('fields.frequency')}</label>
            <div className="flex gap-3">
              {FREQUENCIES.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                  <input type="radio" name="frequency" value={f} checked={form.frequency === f} onChange={handleChange} className="text-green-500" />
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </div>

          {form.frequency === 'WEEKLY' && (
            <div>
              <label className={labelClass}>{t('fields.dayOfWeek')}</label>
              <select name="day_of_week" className={selectClass} value={form.day_of_week} onChange={handleChange}>
                {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </div>
          )}

          {form.frequency === 'MONTHLY' && (
            <div>
              <label className={labelClass}>{t('fields.dayOfMonth')}</label>
              <input
                type="number"
                name="day_of_month"
                className={inputClass}
                min={1}
                max={28}
                value={form.day_of_month}
                onChange={handleChange}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>{t('fields.recipientEmails')}</label>
            <input
              type="text"
              name="recipient_emails"
              className={inputClass}
              placeholder={t('fields.recipientEmailsPlaceholder')}
              value={form.recipient_emails}
              onChange={handleChange}
            />
            <p className="text-xs text-grey-400 mt-1">{t('fields.recipientEmailsHint')}</p>
          </div>

          <div>
            <label className={labelClass}>{t('fields.outputFormat')}</label>
            <div className="flex gap-3">
              {FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                  <input type="radio" name="format" value={f} checked={form.format === f} onChange={handleChange} className="text-green-500" />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-grey-200">
            <button type="button" className={btnSecondary} onClick={onClose}>{t('common:buttons.cancel', 'Cancel')}</button>
            <button type="submit" className={btnPrimary} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isEdit ? t('schedules.updateSchedule') : t('schedules.createSchedule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function SchedulesPage() {
  const { t } = useTranslation('reports');
  const navigate = useNavigate();
  const { schedules, schedulesLoading, fetchSchedules } = useReportsStore();
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setEditSchedule(null);
    fetchSchedules();
  }, [fetchSchedules]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm(t('schedules.confirm.deactivate'))) return;
    try {
      await deleteSchedule(id);
      toast.success(t('schedules.toast.deactivated'));
      fetchSchedules();
    } catch {
      toast.error(t('schedules.toast.deleteFailed'));
    }
  }, [fetchSchedules, t]);

  const handleEdit = useCallback((schedule) => {
    setEditSchedule(schedule);
    setShowModal(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="text-grey-400 hover:text-grey-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-grey-900">{t('schedules.title')}</h1>
            <p className="text-sm text-grey-500 mt-0.5">{t('schedules.subtitle')}</p>
          </div>
        </div>
        <button className={btnPrimary} onClick={() => { setEditSchedule(null); setShowModal(true); }}>
          <Plus size={16} /> {t('schedules.newSchedule')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
        {schedulesLoading ? (
          <div className="flex items-center justify-center py-16 text-grey-400">
            <Loader2 size={20} className="animate-spin mr-2" /> {t('schedules.loadingSchedules')}
          </div>
        ) : !schedules.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-grey-400">
            <CalendarClock size={32} strokeWidth={1.5} className="mb-2" />
            <p className="text-sm">{t('schedules.noSchedules')}</p>
            <button className={`${btnPrimary} mt-4`} onClick={() => setShowModal(true)}>
              <Plus size={16} /> {t('schedules.createFirstSchedule')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.reportType')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.frequency')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.nextRun')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.recipients')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.format')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.status')}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('schedules.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const typeName = t(`types.${s.report_type}.name`, s.report_type);
                  return (
                    <tr key={s.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-grey-900">{s.report_type}</div>
                        <div className="text-xs text-grey-400">{typeName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <FrequencyBadge frequency={s.frequency} />
                        {s.frequency === 'WEEKLY' && <span className="text-xs text-grey-500 ml-1.5">{DAY_NAMES[s.day_of_week]}</span>}
                        {s.frequency === 'MONTHLY' && <span className="text-xs text-grey-500 ml-1.5">{t('schedules.dayOf', { day: s.day_of_month })}</span>}
                      </td>
                      <td className="px-4 py-3 text-grey-600">
                        {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-grey-600 max-w-[200px] truncate">
                        {(s.recipient_emails || []).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-grey-600">{s.format}</td>
                      <td className="px-4 py-3"><AppStatusBadge status={s.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(s)} className="text-grey-400 hover:text-green-600 transition-colors">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="text-grey-400 hover:text-red-500 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ScheduleFormModal
          schedule={editSchedule}
          onClose={() => { setShowModal(false); setEditSchedule(null); }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
