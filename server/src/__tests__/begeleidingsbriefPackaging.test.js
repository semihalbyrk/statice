const { formatPackaging } = require('../services/begeleidingsbriefService');

describe('formatPackaging (lines)', () => {
  it('groups same volume+uom: 2 x 40m³', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 40, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³');
  });

  it('keeps different volumes separate: 1 x 40m³, 1 x 60m³', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 60, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('1 x 40m³, 1 x 60m³');
  });

  it('mixes M3 and L: 2 x 40m³, 3 x 200L', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 40, volume_uom: 'M3' },
      { volume: 200, volume_uom: 'L' },
      { volume: 200, volume_uom: 'L' },
      { volume: 200, volume_uom: 'L' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³, 3 x 200L');
  });

  it('ignores container_type in grouping', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3', container_type: 'OPEN_TOP' },
      { volume: 40, volume_uom: 'M3', container_type: 'CLOSED_TOP' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³');
  });

  it('returns empty string for no lines', () => {
    expect(formatPackaging([])).toBe('');
    expect(formatPackaging(undefined)).toBe('');
  });

  it('sorts by uom asc then volume asc: M3 before L; smaller before larger', () => {
    const lines = [
      { volume: 500, volume_uom: 'L' },
      { volume: 60, volume_uom: 'M3' },
      { volume: 200, volume_uom: 'L' },
      { volume: 40, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('1 x 40m³, 1 x 60m³, 1 x 200L, 1 x 500L');
  });
});
