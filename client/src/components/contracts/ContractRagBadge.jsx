const RAG_CONFIG = {
  GREEN: { label: 'Green', dotClass: 'bg-green-500', bgClass: 'bg-green-25 text-green-700 border-green-300' },
  AMBER: { label: 'Amber', dotClass: 'bg-orange-500', bgClass: 'bg-orange-25 text-orange-700 border-orange-300' },
  RED: { label: 'Red', dotClass: 'bg-red-500', bgClass: 'bg-red-25 text-red-700 border-red-300' },
};

export default function ContractRagBadge({ status, showLabel = true }) {
  if (!status) return null;
  const config = RAG_CONFIG[status] || RAG_CONFIG.GREEN;
  if (!showLabel) {
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`} title={config.label} />;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgClass}`}>
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}
