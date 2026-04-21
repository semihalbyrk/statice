const DEFAULT_FASE1 = 0.05;
const DEFAULT_FASE2 = 0.05;

function parseRatio(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

function getBalanceThresholds() {
  return {
    fase1: parseRatio(process.env.BALANCE_TOLERANCE_FASE1, DEFAULT_FASE1),
    fase2: parseRatio(process.env.BALANCE_TOLERANCE_FASE2, DEFAULT_FASE2),
  };
}

module.exports = { getBalanceThresholds };
