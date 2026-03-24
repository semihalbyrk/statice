import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation('errors');

  return (
    <div className="min-h-screen flex items-center justify-center bg-grey-50 px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-grey-300">{t('notFound.title')}</h1>
        <p className="text-xl font-semibold text-grey-900 mt-4">{t('notFound.message')}</p>
        <p className="text-sm text-grey-500 mt-2">{t('notFound.description')}</p>
        <Link to="/dashboard"
          className="inline-flex items-center gap-2 h-10 px-5 mt-6 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Home size={16} /> {t('notFound.goHome')}
        </Link>
      </div>
    </div>
  );
}
