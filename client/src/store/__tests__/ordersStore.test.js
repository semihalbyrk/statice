import { describe, it, expect, vi, beforeEach } from 'vitest';
import useOrdersStore from '../ordersStore';

// Mock API module
const mockGetOrders = vi.fn();
const mockGetOrder = vi.fn();
const mockCreateOrder = vi.fn();
const mockUpdateOrder = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock('../../api/orders', () => ({
  getOrders: (...args) => mockGetOrders(...args),
  getOrder: (...args) => mockGetOrder(...args),
  createOrder: (...args) => mockCreateOrder(...args),
  updateOrder: (...args) => mockUpdateOrder(...args),
  cancelOrder: (...args) => mockCancelOrder(...args),
}));

describe('ordersStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrdersStore.setState({
      orders: [],
      totalCount: 0,
      currentOrder: null,
      filters: { status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' },
      loading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useOrdersStore.getState();
    expect(state.orders).toEqual([]);
    expect(state.totalCount).toBe(0);
    expect(state.currentOrder).toBeNull();
    expect(state.filters).toEqual({ status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' });
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setFilters merges filters and resets page to 1', () => {
    useOrdersStore.getState().setFilters({ status: 'PLANNED', search: 'Wecycle' });

    const state = useOrdersStore.getState();
    expect(state.filters.status).toBe('PLANNED');
    expect(state.filters.search).toBe('Wecycle');
    expect(state.filters.page).toBe(1);
    expect(state.filters.limit).toBe(20);
  });

  it('setFilters preserves explicit page number', () => {
    useOrdersStore.getState().setFilters({ page: 3 });
    expect(useOrdersStore.getState().filters.page).toBe(3);
  });

  it('clearFilters resets all filters to default', () => {
    useOrdersStore.getState().setFilters({ status: 'COMPLETED', search: 'LHA', page: 5 });
    useOrdersStore.getState().clearFilters();

    const state = useOrdersStore.getState();
    expect(state.filters).toEqual({ status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' });
  });

  it('fetchOrders fetches and stores orders list', async () => {
    const orders = [
      { id: 'ord-1', order_number: 'ORD-2026-0001', status: 'PLANNED' },
      { id: 'ord-2', order_number: 'ORD-2026-0002', status: 'ARRIVED' },
    ];
    mockGetOrders.mockResolvedValue({ data: { data: orders, total: 42 } });

    await useOrdersStore.getState().fetchOrders();

    expect(mockGetOrders).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(useOrdersStore.getState().orders).toEqual(orders);
    expect(useOrdersStore.getState().totalCount).toBe(42);
    expect(useOrdersStore.getState().loading).toBe(false);
  });

  it('fetchOrders passes active filters as params', async () => {
    useOrdersStore.setState({
      filters: { status: 'COMPLETED', search: 'Wecycle', page: 2, limit: 20, date_from: '2026-01-01', date_to: '2026-03-01' },
    });
    mockGetOrders.mockResolvedValue({ data: { data: [], total: 0 } });

    await useOrdersStore.getState().fetchOrders();

    expect(mockGetOrders).toHaveBeenCalledWith({
      status: 'COMPLETED',
      search: 'Wecycle',
      page: 2,
      limit: 20,
      date_from: '2026-01-01',
      date_to: '2026-03-01',
    });
  });

  it('fetchOrders sets loading true then false', async () => {
    mockGetOrders.mockResolvedValue({ data: { data: [], total: 0 } });

    const promise = useOrdersStore.getState().fetchOrders();
    expect(useOrdersStore.getState().loading).toBe(true);

    await promise;
    expect(useOrdersStore.getState().loading).toBe(false);
  });

  it('fetchOrders handles errors gracefully', async () => {
    mockGetOrders.mockRejectedValue({ response: { data: { error: 'Unauthorized' } } });

    await useOrdersStore.getState().fetchOrders();

    expect(useOrdersStore.getState().error).toBe('Unauthorized');
    expect(useOrdersStore.getState().loading).toBe(false);
  });

  it('fetchOrders uses fallback error message when no response data', async () => {
    mockGetOrders.mockRejectedValue(new Error('Network error'));

    await useOrdersStore.getState().fetchOrders();

    expect(useOrdersStore.getState().error).toBe('Failed to fetch orders');
  });

  it('fetchOrder fetches and stores a single order', async () => {
    const order = {
      id: 'ord-1',
      order_number: 'ORD-2026-0001',
      status: 'PLANNED',
      supplier: { id: 's1', name: 'Wecycle BV' },
    };
    mockGetOrder.mockResolvedValue({ data: order });

    await useOrdersStore.getState().fetchOrder('ord-1');

    expect(mockGetOrder).toHaveBeenCalledWith('ord-1');
    expect(useOrdersStore.getState().currentOrder).toEqual(order);
    expect(useOrdersStore.getState().loading).toBe(false);
  });

  it('fetchOrder handles errors gracefully', async () => {
    mockGetOrder.mockRejectedValue({ response: { data: { error: 'Order not found' } } });

    await useOrdersStore.getState().fetchOrder('nonexistent');

    expect(useOrdersStore.getState().error).toBe('Order not found');
    expect(useOrdersStore.getState().loading).toBe(false);
  });

  it('createOrder calls API and returns created order', async () => {
    const newOrder = { id: 'ord-new', order_number: 'ORD-2026-0003', status: 'PLANNED' };
    mockCreateOrder.mockResolvedValue({ data: newOrder });

    const result = await useOrdersStore.getState().createOrder({
      supplier_id: 's1',
      scheduled_date: '2026-04-01',
    });

    expect(mockCreateOrder).toHaveBeenCalledWith({ supplier_id: 's1', scheduled_date: '2026-04-01' });
    expect(result).toEqual(newOrder);
  });

  it('updateOrder calls API and returns updated order', async () => {
    const updated = { id: 'ord-1', status: 'IN_PROGRESS' };
    mockUpdateOrder.mockResolvedValue({ data: updated });

    const result = await useOrdersStore.getState().updateOrder('ord-1', { status: 'IN_PROGRESS' });

    expect(mockUpdateOrder).toHaveBeenCalledWith('ord-1', { status: 'IN_PROGRESS' });
    expect(result).toEqual(updated);
  });

  it('cancelOrder calls API and returns result', async () => {
    const cancelled = { id: 'ord-1', status: 'CANCELLED' };
    mockCancelOrder.mockResolvedValue({ data: cancelled });

    const result = await useOrdersStore.getState().cancelOrder('ord-1');

    expect(mockCancelOrder).toHaveBeenCalledWith('ord-1');
    expect(result).toEqual(cancelled);
  });
});
