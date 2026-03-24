import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Globe size={14} className="text-grey-400 flex-shrink-0" />
      <select
        value={i18n.language?.startsWith('nl') ? 'nl' : 'en'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="w-full bg-transparent text-sm text-grey-300 border-0 outline-none cursor-pointer hover:text-white transition-colors appearance-none"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-grey-800 text-grey-100">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
