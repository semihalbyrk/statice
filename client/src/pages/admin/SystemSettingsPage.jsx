import { useState, useEffect } from 'react';
import { Save, Loader2, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../../api/admin';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const labelClass = 'block text-sm font-medium text-grey-700 mb-1.5';

function SettingsCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
      <div className="px-6 py-4 border-b border-grey-200">
        <h3 className="text-base font-semibold text-grey-900">{title}</h3>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function IntegrationBadge({ label, configured, statusText }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        {configured ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-grey-400" />}
        <span className="text-sm text-grey-700">{label}</span>
      </div>
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        configured === 'simulated'
          ? 'bg-orange-50 text-orange-700 border-orange-300'
          : configured
            ? 'bg-green-25 text-green-700 border-green-300'
            : 'bg-grey-100 text-grey-500 border-grey-300'
      }`}>
        {statusText}
      </span>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingFacility, setSavingFacility] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    getSettings().then(({ data }) => {
      setSettings(data.data);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load settings');
      setLoading(false);
    });
  }, []);

  function handleChange(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function saveFacility() {
    setSavingFacility(true);
    try {
      const { data } = await updateSettings({
        facility_name: settings.facility_name,
        facility_address: settings.facility_address,
        facility_permit_number: settings.facility_permit_number,
        facility_kvk: settings.facility_kvk,
      });
      setSettings(data.data);
      toast.success('Facility settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSavingFacility(false);
    }
  }

  async function saveDefaults() {
    setSavingDefaults(true);
    try {
      const { data } = await updateSettings({
        report_footer_text: settings.report_footer_text,
        max_skips_per_event: settings.max_skips_per_event,
        require_downstream_processor: settings.require_downstream_processor,
      });
      setSettings(data.data);
      toast.success('Report defaults saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSavingDefaults(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-grey-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-grey-900">System Settings</h1>
        <p className="text-sm text-grey-500 mt-0.5">Facility configuration and system defaults</p>
      </div>

      {/* Facility Information */}
      <SettingsCard title="Facility Information">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Facility Name</label>
            <input value={settings.facility_name} onChange={(e) => handleChange('facility_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <textarea value={settings.facility_address} onChange={(e) => handleChange('facility_address', e.target.value)}
              rows={2} className={`${inputClass} h-auto py-2.5`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Permit Number</label>
              <input value={settings.facility_permit_number} onChange={(e) => handleChange('facility_permit_number', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>KvK Number</label>
              <input value={settings.facility_kvk} onChange={(e) => handleChange('facility_kvk', e.target.value)}
                maxLength={8} pattern="\d{8}" className={inputClass} />
              <p className="text-xs text-grey-400 mt-1">Exactly 8 digits</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={saveFacility} disabled={savingFacility}
              className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {savingFacility ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Facility Settings
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Report Defaults */}
      <SettingsCard title="Report Defaults">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Report Footer Text</label>
            <input value={settings.report_footer_text} onChange={(e) => handleChange('report_footer_text', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Max Parcels per Event</label>
              <input type="number" min={1} max={20} value={settings.max_skips_per_event}
                onChange={(e) => handleChange('max_skips_per_event', parseInt(e.target.value) || 1)} className={inputClass} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.require_downstream_processor}
                  onChange={(e) => handleChange('require_downstream_processor', e.target.checked)}
                  className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500" />
                <span className="text-sm text-grey-700">Require downstream processor</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={saveDefaults} disabled={savingDefaults}
              className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {savingDefaults ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Report Defaults
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Integration Status */}
      <SettingsCard title="Integration Status">
        <div className="divide-y divide-grey-100">
          <IntegrationBadge label="Pfister Weighbridge" configured={true} statusText="CONNECTED" />
          <IntegrationBadge label="DIWASS API" configured={false} statusText="NOT CONFIGURED" />
          <IntegrationBadge label="Email (SMTP)" configured={settings.smtp_configured} statusText={settings.smtp_configured ? 'CONFIGURED' : 'NOT CONFIGURED'} />
        </div>
        <p className="text-xs text-grey-400 mt-4">
          Integration settings are configured via environment variables and cannot be changed here.
        </p>
      </SettingsCard>
    </div>
  );
}
