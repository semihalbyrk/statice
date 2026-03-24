import i18n from '../i18n';

const LOCALE_MAP = { en: 'en-GB', nl: 'nl-NL' };

function getLocale() {
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  return LOCALE_MAP[lang];
}

export function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(getLocale(), {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(getLocale(), {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatNumber(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString(getLocale());
}
