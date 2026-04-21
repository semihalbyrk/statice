const prisma = require('../utils/prismaClient');

describe('SortingSession loss tracking', () => {
  it('persists fase1_loss fields on the session model', async () => {
    const session = await prisma.sortingSession.findFirst();
    expect(session).toBeTruthy();

    await prisma.sortingSession.update({
      where: { id: session.id },
      data: {
        fase1_loss_kg: 1.25,
        fase1_loss_reason: 'MOISTURE',
        fase1_loss_notes: 'expected drying',
      },
    });

    const updated = await prisma.sortingSession.findUnique({ where: { id: session.id } });
    expect(Number(updated.fase1_loss_kg)).toBe(1.25);
    expect(updated.fase1_loss_reason).toBe('MOISTURE');
    expect(updated.fase1_loss_notes).toBe('expected drying');

    // reset
    await prisma.sortingSession.update({
      where: { id: session.id },
      data: { fase1_loss_kg: null, fase1_loss_reason: null, fase1_loss_notes: null },
    });
  });

  it('persists fase2_loss fields on the session model', async () => {
    const session = await prisma.sortingSession.findFirst();
    await prisma.sortingSession.update({
      where: { id: session.id },
      data: {
        fase2_loss_kg: 0.5,
        fase2_loss_reason: 'MEASUREMENT_VARIANCE',
      },
    });
    const updated = await prisma.sortingSession.findUnique({ where: { id: session.id } });
    expect(Number(updated.fase2_loss_kg)).toBe(0.5);
    expect(updated.fase2_loss_reason).toBe('MEASUREMENT_VARIANCE');

    await prisma.sortingSession.update({
      where: { id: session.id },
      data: { fase2_loss_kg: null, fase2_loss_reason: null },
    });
  });
});
