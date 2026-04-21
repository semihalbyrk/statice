import { useTranslation } from 'react-i18next';

export default function IdleWarningModal({ open, secondsRemaining, onStay, onLogout }) {
  const { t } = useTranslation('common');

  if (!open) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        className="w-full max-w-md rounded-lg bg-white shadow-lg border border-grey-200 p-6"
      >
        <h2 id="idle-warning-title" className="text-lg font-semibold text-grey-900">
          {t('idleWarning.title', 'You will be signed out soon')}
        </h2>
        <p className="mt-2 text-sm text-grey-600">
          {t(
            'idleWarning.body',
            'For security, we will sign you out after a period of inactivity.'
          )}
        </p>
        <p className="mt-4 text-center text-2xl font-semibold text-grey-900 tabular-nums">
          {timeStr}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="h-9 px-4 rounded-md border border-grey-300 text-sm font-medium text-grey-700 hover:bg-grey-50 transition-colors"
          >
            {t('idleWarning.signOut', 'Sign out')}
          </button>
          <button
            type="button"
            onClick={onStay}
            className="h-9 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            {t('idleWarning.stay', 'Stay signed in')}
          </button>
        </div>
      </div>
    </div>
  );
}
