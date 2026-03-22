import { create } from 'zustand';
import { getCarriers } from '../api/carriers';
import { getSuppliers } from '../api/suppliers';
import { getWasteStreams, getProductCategories } from '../api/wasteStreams';
import { listFractions, listMaterials } from '../api/catalogue';

const useMasterDataStore = create((set) => ({
  carriers: [],
  suppliers: [],
  wasteStreams: [],
  productCategories: [],
  materials: [],
  fractions: [],
  productTypes: [],
  loading: false,

  fetchCarriers: async () => {
    const { data } = await getCarriers({ limit: 100, active: 'true' });
    set({ carriers: data.data });
  },

  fetchSuppliers: async () => {
    const { data } = await getSuppliers({ limit: 100, active: 'true' });
    set({ suppliers: data.data });
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

  loadAll: async () => {
    set({ loading: true });
    try {
      const [carriersRes, suppliersRes, streamsRes, categoriesRes, materialsRes, fractionsRes] = await Promise.all([
        getCarriers({ limit: 100, active: 'true' }),
        getSuppliers({ limit: 100, active: 'true' }),
        getWasteStreams({ active: 'true' }),
        getProductCategories({ active: 'true' }),
        listMaterials({ active: 'true' }),
        listFractions({ active: 'true' }),
      ]);
      set({
        carriers: carriersRes.data.data,
        suppliers: suppliersRes.data.data,
        wasteStreams: streamsRes.data.data,
        productCategories: categoriesRes.data.data,
        materials: materialsRes.data.data,
        fractions: fractionsRes.data.data,
        productTypes: materialsRes.data.data,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));

export default useMasterDataStore;
