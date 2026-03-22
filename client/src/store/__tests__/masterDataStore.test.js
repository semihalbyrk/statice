import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMasterDataStore from '../masterDataStore';

// Mock API modules
const mockGetCarriers = vi.fn();
const mockGetSuppliers = vi.fn();
const mockGetWasteStreams = vi.fn();
const mockGetProductCategories = vi.fn();
const mockListMaterials = vi.fn();
const mockListFractions = vi.fn();

vi.mock('../../api/carriers', () => ({
  getCarriers: (...args) => mockGetCarriers(...args),
}));
vi.mock('../../api/suppliers', () => ({
  getSuppliers: (...args) => mockGetSuppliers(...args),
}));
vi.mock('../../api/wasteStreams', () => ({
  getWasteStreams: (...args) => mockGetWasteStreams(...args),
  getProductCategories: (...args) => mockGetProductCategories(...args),
}));
vi.mock('../../api/catalogue', () => ({
  listMaterials: (...args) => mockListMaterials(...args),
  listFractions: (...args) => mockListFractions(...args),
}));

describe('masterDataStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMasterDataStore.setState({
      carriers: [],
      suppliers: [],
      wasteStreams: [],
      productCategories: [],
      materials: [],
      fractions: [],
      productTypes: [],
      loading: false,
    });
  });

  it('has correct initial state', () => {
    const state = useMasterDataStore.getState();
    expect(state.carriers).toEqual([]);
    expect(state.suppliers).toEqual([]);
    expect(state.wasteStreams).toEqual([]);
    expect(state.productCategories).toEqual([]);
    expect(state.materials).toEqual([]);
    expect(state.fractions).toEqual([]);
    expect(state.productTypes).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('fetchCarriers fetches and stores carriers', async () => {
    const carriers = [{ id: 'c1', name: 'DHL Express' }];
    mockGetCarriers.mockResolvedValue({ data: { data: carriers } });

    await useMasterDataStore.getState().fetchCarriers();

    expect(mockGetCarriers).toHaveBeenCalledWith({ limit: 100, active: 'true' });
    expect(useMasterDataStore.getState().carriers).toEqual(carriers);
  });

  it('fetchSuppliers fetches and stores suppliers', async () => {
    const suppliers = [{ id: 's1', name: 'Recycler BV' }];
    mockGetSuppliers.mockResolvedValue({ data: { data: suppliers } });

    await useMasterDataStore.getState().fetchSuppliers();

    expect(mockGetSuppliers).toHaveBeenCalledWith({ limit: 100, active: 'true' });
    expect(useMasterDataStore.getState().suppliers).toEqual(suppliers);
  });

  it('fetchWasteStreams fetches and stores waste streams', async () => {
    const streams = [{ id: 'ws1', name_en: 'LHA', code: 'LHA' }];
    mockGetWasteStreams.mockResolvedValue({ data: { data: streams } });

    await useMasterDataStore.getState().fetchWasteStreams();

    expect(mockGetWasteStreams).toHaveBeenCalledWith({ active: 'true' });
    expect(useMasterDataStore.getState().wasteStreams).toEqual(streams);
  });

  it('fetchProductCategories fetches and stores categories', async () => {
    const categories = [{ id: 'pc1', code_cbs: 'LHA-01', description_en: 'Washing Machines' }];
    mockGetProductCategories.mockResolvedValue({ data: { data: categories } });

    await useMasterDataStore.getState().fetchProductCategories();

    expect(mockGetProductCategories).toHaveBeenCalledWith({ active: 'true' });
    expect(useMasterDataStore.getState().productCategories).toEqual(categories);
  });

  it('fetchMaterials fetches and stores materials and fractions', async () => {
    const materials = [{ id: 'm1', name_en: 'Copper', code: 'CU' }];
    const fractions = [{ id: 'f1', name_en: 'Ferrous', code: 'FE' }];
    mockListMaterials.mockResolvedValue({ data: { data: materials } });
    mockListFractions.mockResolvedValue({ data: { data: fractions } });

    await useMasterDataStore.getState().fetchMaterials();

    expect(useMasterDataStore.getState().materials).toEqual(materials);
    expect(useMasterDataStore.getState().fractions).toEqual(fractions);
    expect(useMasterDataStore.getState().productTypes).toEqual(materials);
  });

  it('loadAll fetches all data in parallel', async () => {
    const carriers = [{ id: 'c1', name: 'DHL' }];
    const suppliers = [{ id: 's1', name: 'Recycler BV' }];
    const streams = [{ id: 'ws1', name_en: 'LHA' }];
    const categories = [{ id: 'pc1', code_cbs: 'LHA-01' }];
    const materials = [{ id: 'm1', name_en: 'Copper' }];
    const fractions = [{ id: 'f1', name_en: 'Ferrous' }];

    mockGetCarriers.mockResolvedValue({ data: { data: carriers } });
    mockGetSuppliers.mockResolvedValue({ data: { data: suppliers } });
    mockGetWasteStreams.mockResolvedValue({ data: { data: streams } });
    mockGetProductCategories.mockResolvedValue({ data: { data: categories } });
    mockListMaterials.mockResolvedValue({ data: { data: materials } });
    mockListFractions.mockResolvedValue({ data: { data: fractions } });

    await useMasterDataStore.getState().loadAll();

    const state = useMasterDataStore.getState();
    expect(state.carriers).toEqual(carriers);
    expect(state.suppliers).toEqual(suppliers);
    expect(state.wasteStreams).toEqual(streams);
    expect(state.productCategories).toEqual(categories);
    expect(state.materials).toEqual(materials);
    expect(state.fractions).toEqual(fractions);
    expect(state.loading).toBe(false);
  });

  it('loadAll sets loading to true then false', async () => {
    mockGetCarriers.mockResolvedValue({ data: { data: [] } });
    mockGetSuppliers.mockResolvedValue({ data: { data: [] } });
    mockGetWasteStreams.mockResolvedValue({ data: { data: [] } });
    mockGetProductCategories.mockResolvedValue({ data: { data: [] } });
    mockListMaterials.mockResolvedValue({ data: { data: [] } });
    mockListFractions.mockResolvedValue({ data: { data: [] } });

    const loadPromise = useMasterDataStore.getState().loadAll();
    // loading should be true while loading
    expect(useMasterDataStore.getState().loading).toBe(true);

    await loadPromise;
    expect(useMasterDataStore.getState().loading).toBe(false);
  });

  it('loadAll handles errors gracefully and resets loading', async () => {
    mockGetCarriers.mockRejectedValue(new Error('Network error'));
    mockGetSuppliers.mockResolvedValue({ data: { data: [] } });
    mockGetWasteStreams.mockResolvedValue({ data: { data: [] } });
    mockGetProductCategories.mockResolvedValue({ data: { data: [] } });
    mockListMaterials.mockResolvedValue({ data: { data: [] } });
    mockListFractions.mockResolvedValue({ data: { data: [] } });

    await useMasterDataStore.getState().loadAll();

    expect(useMasterDataStore.getState().loading).toBe(false);
  });

  it('fetchProductTypes populates materials and productTypes', async () => {
    const materials = [{ id: 'm1', name_en: 'Copper', code: 'CU' }];
    mockListMaterials.mockResolvedValue({ data: { data: materials } });

    await useMasterDataStore.getState().fetchProductTypes();

    expect(useMasterDataStore.getState().materials).toEqual(materials);
    expect(useMasterDataStore.getState().productTypes).toEqual(materials);
  });
});
