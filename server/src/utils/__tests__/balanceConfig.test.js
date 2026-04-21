const { getBalanceThresholds } = require('../balanceConfig');

describe('balanceConfig', () => {
  const originalFase1 = process.env.BALANCE_TOLERANCE_FASE1;
  const originalFase2 = process.env.BALANCE_TOLERANCE_FASE2;

  afterEach(() => {
    if (originalFase1 === undefined) delete process.env.BALANCE_TOLERANCE_FASE1;
    else process.env.BALANCE_TOLERANCE_FASE1 = originalFase1;
    if (originalFase2 === undefined) delete process.env.BALANCE_TOLERANCE_FASE2;
    else process.env.BALANCE_TOLERANCE_FASE2 = originalFase2;
  });

  it('returns defaults when env missing', () => {
    delete process.env.BALANCE_TOLERANCE_FASE1;
    delete process.env.BALANCE_TOLERANCE_FASE2;
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.05);
    expect(t.fase2).toBe(0.05);
  });

  it('reads env values when present', () => {
    process.env.BALANCE_TOLERANCE_FASE1 = '0.03';
    process.env.BALANCE_TOLERANCE_FASE2 = '0.02';
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.03);
    expect(t.fase2).toBe(0.02);
  });

  it('falls back to default on invalid env values', () => {
    process.env.BALANCE_TOLERANCE_FASE1 = 'not-a-number';
    process.env.BALANCE_TOLERANCE_FASE2 = '-0.1';
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.05);
    expect(t.fase2).toBe(0.05);
  });
});
