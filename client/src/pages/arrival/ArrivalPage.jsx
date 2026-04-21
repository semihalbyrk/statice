import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Clock, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchPlate } from '../../api/orders';
import { createInbound } from '../../api/weighingEvents';
import StatusBadge from '../../components/ui/StatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import OrderFormModal from '../../components/orders/OrderFormModal';
import { format } from 'date-fns';

export default function ArrivalPage() {
  const { t } = useTranslation('arrival');
  const [plate, setPlate] = useState('');
  const [matchResult, setMatchResult] = useState({
    exact_same_day: [],
    exact_window: [],
    manual_override_candidates: [],
    ranked_candidates: [],
  });
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchPlate = useCallback(async (query) => {
    if (query.length < 2) {
      setMatchResult({ exact_same_day: [], exact_window: [], manual_override_candidates: [], ranked_candidates: [] });
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const { data } = await matchPlate(query);
      setMatchResult(data.data);
      setSearched(true);
    } catch {
      setMatchResult({ exact_same_day: [], exact_window: [], manual_override_candidates: [], ranked_candidates: [] });
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPlate(plate), 300);
    return () => clearTimeout(timer);
  }, [plate, searchPlate]);

  async function handleAddInbound(order, options = {}) {
    setSubmitting(true);
    try {
      const { data } = await createInbound({
        order_id: order.id,
        registration_plate: plate,
        match_strategy: options.matchStrategy || order.match_strategy || 'MANUAL',
        is_manual_match: Boolean(options.isManualMatch),
      });
      toast.success(t('toast.inboundCreated'));
      window.open(`/inbounds/${data.data.id}`, '_blank');
      // Refresh match results so the new inbound appears in the order card
      await searchPlate(plate);
    } catch (err) {
      toast.error(err.response?.data?.error || t('toast.inboundFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const exactSameDay = matchResult.exact_same_day || [];
  const exactWindow = matchResult.exact_window || [];
  const manualOverrides = matchResult.manual_override_candidates || [];
  const rankedCandidates = matchResult.ranked_candidates || [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-grey-900 mb-6 text-center">{t('title')}</h1>

      {/* License Plate Card */}
      <div className="bg-white rounded-xl border border-grey-200 shadow-sm p-8 mb-6">
        <div className="text-center mb-4">
          <h2 className="text-base font-semibold text-grey-900 mb-1">{t('subtitle')}</h2>
          <p className="text-xs text-grey-400">{t('description')}</p>
        </div>

        {/* EU License Plate */}
        <div className="mx-auto" style={{ maxWidth: 580 }}>
          <div className="flex items-stretch rounded-lg border-[3px] border-grey-900 shadow-md bg-[#F5A623]">
            {/* EU country badge */}
            <div className="w-20 min-w-[80px] bg-[#003399] flex flex-col items-center justify-center shrink-0 py-3 gap-1.5 rounded-l-[5px]">
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="12" fill="none" stroke="#FFD700" strokeWidth="0.5" opacity="0.3" />
                {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg) => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x = 15 + 10 * Math.cos(rad);
                  const y = 15 + 10 * Math.sin(rad);
                  return <text key={deg} x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#FFD700" fontSize="6" fontFamily="serif">&#9733;</text>;
                })}
              </svg>
              <span className="text-[13px] font-bold text-white tracking-[0.15em]">{t('countryCode')}</span>
            </div>
            {/* Plate input */}
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder={t('platePlaceholder')}
              autoFocus
              className="flex-1 bg-[#F5A623] text-center text-4xl font-bold font-mono text-grey-900 placeholder:text-[#D4891A]/60 py-5 px-6 outline-none tracking-[0.2em] border-none"
            />
          </div>
        </div>

        {searching && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-grey-400">{t('search.searching')}</span>
          </div>
        )}

      </div>

      {/* Matching orders */}
      {searched && rankedCandidates.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-grey-900">{t('matchingOrders')}</h2>
            <span className="text-xs bg-green-25 text-green-700 border border-green-200 rounded-md px-2 py-0.5 font-medium">{t('candidates', { count: rankedCandidates.length })}</span>
          </div>
          {exactSameDay.length > 0 && (
            <MatchSection
              title={t('match.exactPlateToday.title')}
              description={t('match.exactPlateToday.description')}
              orders={exactSameDay}
              submitting={submitting}
              onSelect={(order) => handleAddInbound(order, { matchStrategy: 'EXACT_SAME_DAY', isManualMatch: false })}
            />
          )}
          {exactWindow.length > 0 && (
            <MatchSection
              title={t('match.exactPlateNearby.title')}
              description={t('match.exactPlateNearby.description')}
              orders={exactWindow}
              submitting={submitting}
              onSelect={(order) => handleAddInbound(order, { matchStrategy: 'EXACT_WINDOW', isManualMatch: false })}
            />
          )}
          {manualOverrides.length > 0 && (
            <MatchSection
              title={t('match.manualOverride.title')}
              description={t('match.manualOverride.description')}
              orders={manualOverrides}
              variant="manual"
              submitting={submitting}
              onSelect={(order) => handleAddInbound(order, { matchStrategy: 'MANUAL', isManualMatch: true })}
            />
          )}
          {!showAdhoc && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAdhoc(true)}
                className="inline-flex items-center gap-2 h-9 px-5 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
              >
                <Plus size={16} />
                {t('actions.createAdHocOrderInstead')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {searched && rankedCandidates.length === 0 && plate.length >= 2 && (
        <div className="bg-white rounded-xl border border-grey-200 shadow-sm p-8 text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-grey-100 mb-3">
            <Package size={22} className="text-grey-400" />
          </div>
          <p className="text-sm font-medium text-grey-700 mb-1">
            {t('match.noMatch.message', { plate })}
          </p>
          <p className="text-xs text-grey-400 mb-4">{t('match.noMatch.plateExactRequired')}</p>
          {!showAdhoc && (
            <button
              onClick={() => setShowAdhoc(true)}
              className="inline-flex items-center gap-2 h-9 px-5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              {t('actions.createAdHocOrder')}
            </button>
          )}
        </div>
      )}

      {/* Ad-hoc order modal */}
      {showAdhoc && (
        <OrderFormModal
          mode="adhoc"
          order={{ vehicle_plate: plate }}
          onClose={() => setShowAdhoc(false)}
          onSuccess={() => {
            setShowAdhoc(false);
            searchPlate(plate);
          }}
        />
      )}
    </div>
  );
}

function MatchSection({ title, description, orders, submitting, onSelect, variant = 'exact' }) {
  const { t } = useTranslation('arrival');
  const containerClass = variant === 'manual'
    ? 'border-orange-200 bg-orange-25/40'
    : 'border-grey-200 bg-white';

  return (
    <section className={`rounded-xl border shadow-sm overflow-hidden ${containerClass}`}>
      <div className="px-5 py-3 border-b border-grey-100">
        <h3 className="text-sm font-semibold text-grey-900">{title}</h3>
        <p className="text-xs text-grey-500 mt-0.5">{description}</p>
      </div>
      <div className="divide-y divide-grey-100">
        {orders.map((order) => (
          <div key={order.id} className="p-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-base font-bold text-grey-900">{order.order_number}</span>
                <StatusBadge status={order.status} />
                <span className={`text-[11px] font-medium rounded-md px-2 py-0.5 border ${variant === 'manual' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-25 text-blue-700 border-blue-200'}`}>
                  {order.match_label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-grey-400">
                <Clock size={12} />
                {format(new Date(order.planned_date), 'dd MMM yyyy')}
                {order.planned_time_window_start && order.planned_time_window_end && (
                  <span>, {format(new Date(order.planned_time_window_start), 'HH:mm')}-{format(new Date(order.planned_time_window_end), 'HH:mm')}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.orderType')}</span>
                <p className="text-sm font-medium text-grey-900 mt-0.5">Incoming</p>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.supplier')}</span>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-sm font-medium text-grey-900">{order.entity_supplier?.company_name || order.supplier?.name || '—'}</p>
                  <SupplierTypeBadge type={order.supplier?.supplier_type} />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.transporter')}</span>
                <p className="text-sm font-medium text-grey-900 mt-0.5">{order.transporter?.company_name || order.carrier?.name || '—'}</p>
              </div>
              <div>
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.vehiclePlate')}</span>
                <p className="text-sm font-mono font-medium text-grey-900 mt-0.5">{order.vehicle_plate || '—'}</p>
              </div>
              <div>
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.wasteStream')}</span>
                <p className="text-sm font-medium text-grey-900 mt-0.5">{order.waste_stream?.name || '—'}</p>
              </div>
              {order.waste_stream?.afvalstroomnummer && (
                <div>
                  <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.asn')}</span>
                  <p className="text-sm font-medium text-grey-900 mt-0.5">{order.waste_stream.afvalstroomnummer}</p>
                </div>
              )}
              {order.waste_stream?.processing_method && (
                <div>
                  <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.processingMethod')}</span>
                  <p className="text-sm font-medium text-grey-900 mt-0.5">{order.waste_stream.processing_method}</p>
                </div>
              )}
              <div>
                <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">{t('fields.parcelProgress')}</span>
                <p className="text-sm font-medium text-grey-900 mt-0.5">
                  {order.received_asset_count || 0} / {order.expected_asset_count || order.expected_skip_count || 0}
                </p>
              </div>
            </div>
            {order.inbounds && order.inbounds.length > 0 && (
              <div className="mt-3 border-t border-grey-100 pt-3">
                <p className="text-xs font-medium text-grey-500 mb-1">{t('fields.inbounds')}:</p>
                <div className="space-y-1">
                  {order.inbounds.map((ib) => (
                    <div key={ib.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={ib.status} size="xs" />
                        <span className="font-medium text-grey-700">{ib.inbound_number}</span>
                      </div>
                      <span className="text-grey-500 tabular-nums">
                        {ib.net_weight_kg ? `${Number(ib.net_weight_kg).toLocaleString()} kg` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-grey-50 border border-grey-100 rounded-lg mt-4 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <span className="text-xs font-mono text-grey-500 tracking-wide">{order.vehicle_plate || 'PLATE NOT SET'}</span>
                {order.is_partial_delivery && (
                  <p className="text-xs text-orange-600">{t('fields.partialDelivery')}</p>
                )}
              </div>
              <button
                onClick={() => onSelect(order)}
                disabled={submitting}
                className={`h-9 px-5 rounded-md text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 ${variant === 'manual' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-700 text-white'}`}
              >
                <Truck size={15} />
                {variant === 'manual' ? t('actions.useManualOverride') : t('actions.addInbound')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
