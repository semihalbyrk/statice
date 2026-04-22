const service = require('../services/outboundLineService');

describe('outboundLineService', () => {
  it('exports the expected public API', () => {
    expect(typeof service.listByOutbound).toBe('function');
    expect(typeof service.createLine).toBe('function');
    expect(typeof service.updateLine).toBe('function');
    expect(typeof service.deleteLine).toBe('function');
  });
});
