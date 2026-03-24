import { useTranslation } from 'react-i18next';

const TYPE_CONFIG = {
  PRO: { className: 'bg-green-25 text-green-700 border-green-400' },
  THIRD_PARTY: { className: 'bg-blue-25 text-blue-700 border-blue-300' },
  PRIVATE_INDIVIDUAL: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
};

export default function SupplierTypeBadge({ type }) {
  const { t } = useTranslation('common');

  if (!type) return null;

  const { className } = TYPE_CONFIG[type] || { className: 'bg-grey-100 text-grey-700 border-grey-300' };
  const label = t('supplierTypes.' + type, { defaultValue: type });

  return (
    <span className={`inline-flex h-7 w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${className}`}>
      {label}
    </span>
  );
}
