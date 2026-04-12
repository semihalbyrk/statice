import { create } from 'zustand';
import { getCarriers } from '../api/carriers';
import { getSuppliers } from '../api/suppliers';
import { getEntities } from '../api/entities';
import { getWasteStreams, getProductCategories } from '../api/wasteStreams';
import { listFractions, listMaterials } from '../api/catalogue';
import { listFees } from '../api/fees';

const useMasterDataStore = create((set, get) => ({
  carriers: [],
  suppliers: [],
  suppliersWithContract: [],
  entities: [],
  wasteStreams: [],
  productCategories: [],
  materials: [],
  fractions: [],
  productTypes: [],
  fees: [],
  loading: false,

  fetchCarriers: async () => {
    const { data } = await getCarriers({ limit: 100, active: 'true' });
    set({ carriers: data.data });
  },

  fetchSuppliers: async () => {
    const { data } = await getSuppliers({ limit: 100, active: 'true' });
    set({ suppliers: data.data });
  },

  fetchSuppliersWithContract: async () => {
    const { data } = await getSuppliers({ limit: 100, active: 'true', hasActiveContract: 'true' });
    set({ suppliersWithContract: data.data });
  },

  fetchWasteStreams: async () => {
    const { data } = await getWasteStreams({ active: 'true' });
    set({ wasteStreams: data.data });
  },

  fetchProductCategories: async () => {
    const { data } = await getProductCategories({ active: 'true' });
    set({ productCategories: data.data });
  },

  fetchMaterials: async () => {
    const [materialsRes, fractionsRes] = await Promise.all([
      listMaterials({ active: 'true' }),
      listFractions({ active: 'true' }),
    ]);
    set({
      materials: materialsRes.data.data,
      fractions: fractionsRes.data.data,
      productTypes: materialsRes.data.data,
    });
  },

  fetchProductTypes: async () => {
    const { data } = await listMaterials({ active: 'true' });
    set({ materials: data.data, productTypes: data.data });
  },

  fetchFees: async () => {
    const { data } = await listFees({ active: 'true' });
    set({ fees: data.data });
  },

  loadAll: async () => {
    set({ loading: true });
    try {
      const [carriersRes, suppliersRes, suppliersWithContractRes, streamsRes, categoriesRes, materialsRes, fractionsRes, feesRes, entitiesRes] = await Promise.all([
        getCarriers({ limit: 100, active: 'true' }),
        getSuppliers({ limit: 100, active: 'true' }),
        getSuppliers({ limit: 100, active: 'true', hasActiveContract: 'true' }),
        getWasteStreams({ active: 'true' }),
        getProductCategories({ active: 'true' }),
        listMaterials({ active: 'true' }),
        listFractions({ active: 'true' }),
        listFees({ active: 'true' }).catch(() => ({ data: { data: [] } })),
        getEntities({ limit: 200, status: 'ACTIVE' }).catch(() => ({ data: { data: [] } })),
      ]);
      set({
        carriers: carriersRes.data.data,
        suppliers: suppliersRes.data.data,
        suppliersWithContract: suppliersWithContractRes.data.data,
        wasteStreams: streamsRes.data.data,
        productCategories: categoriesRes.data.data,
        materials: materialsRes.data.data,
        fractions: fractionsRes.data.data,
        productTypes: materialsRes.data.data,
        fees: feesRes.data.data,
        entities: entitiesRes.data.data,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  getSupplierEntities: () => get().entities.filter(e => e.is_supplier && e.status === 'ACTIVE'),
  getTransporterEntities: () => get().entities.filter(e => e.is_transporter && e.status === 'ACTIVE'),
  getDisposerEntities: () => get().entities.filter(e => e.is_disposer && e.status === 'ACTIVE'),
  getAllActiveEntities: () => get().entities.filter(e => e.status === 'ACTIVE'),
}));

export default useMasterDataStore;
