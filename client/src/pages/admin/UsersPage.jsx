import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, KeyRound, Search, X, Shield, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { getUsers, createUser, updateUser, resetUserPassword, getUserActivity } from '../../api/admin';

const ROLES = ['GATE_OPERATOR', 'LOGISTICS_PLANNER', 'REPORTING_MANAGER', 'ADMIN'];
const ROLE_LABELS = { GATE_OPERATOR: 'Gate Operator', LOGISTICS_PLANNER: 'Logistics Planner', REPORTING_MANAGER: 'Reporting Manager', ADMIN: 'Admin' };
const ROLE_COLORS = {
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-300',
  LOGISTICS_PLANNER: 'bg-blue-50 text-blue-700 border-blue-300',
  GATE_OPERATOR: 'bg-green-25 text-green-700 border-green-300',
  REPORTING_MANAGER: 'bg-orange-50 text-orange-700 border-orange-300',
};
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-sm font-medium text-grey-700 mb-1.5';

function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---- Create User Modal ----
function CreateUserModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '', role: 'GATE_OPERATOR' });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (!PASSWORD_REGEX.test(form.password)) {
      toast.error('Password must be at least 8 characters with one uppercase letter and one number');
      return;
    }
    setSubmitting(true);
    try {
      await createUser({ full_name: form.full_name, email: form.email, password: form.password, role: form.role });
      toast.success('User created');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">New User</h2>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required minLength={2} maxLength={100} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email <span className="text-red-500">*</span></label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role <span className="text-red-500">*</span></label>
            <select name="role" value={form.role} onChange={handleChange} className={selectClass}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Password <span className="text-red-500">*</span></label>
            <input name="password" type="password" value={form.password} onChange={handleChange} required className={inputClass} />
            <p className="text-xs text-grey-400 mt-1">Min 8 characters, at least one uppercase letter and one number</p>
          </div>
          <div>
            <label className={labelClass}>Confirm Password <span className="text-red-500">*</span></label>
            <input name="confirm_password" type="password" value={form.confirm_password} onChange={handleChange} required className={inputClass} />
            {form.confirm_password && form.password !== form.confirm_password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Edit User Modal ----
function EditUserModal({ user, currentUserId, onClose, onSuccess }) {
  const isSelf = user.id === currentUserId;
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, is_active: user.is_active });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateUser(user.id, form);
      toast.success('User updated');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">Edit User</h2>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input value={user.email} disabled className={`${inputClass} bg-grey-50 text-grey-500 cursor-not-allowed`} />
          </div>
          <div>
            <label className={labelClass}>Full Name</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required minLength={2} maxLength={100} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select name="role" value={form.role} onChange={handleChange} disabled={isSelf} className={`${selectClass} ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {isSelf && <p className="text-xs text-grey-400 mt-1">Cannot change your own role</p>}
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} disabled={isSelf}
              className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500" />
            <label className="text-sm text-grey-700">Active</label>
            {isSelf && <span className="text-xs text-grey-400">(Cannot deactivate yourself)</span>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Reset Password Modal ----
function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (!PASSWORD_REGEX.test(form.new_password)) {
      toast.error('Password must be at least 8 characters with one uppercase letter and one number');
      return;
    }
    setSubmitting(true);
    try {
      await resetUserPassword(user.id, { new_password: form.new_password });
      toast.success('Password reset successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal-panel max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">Reset Password</h2>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-sm text-grey-600">Reset password for <strong>{user.full_name}</strong></p>
          <div>
            <label className={labelClass}>New Password</label>
            <input type="password" value={form.new_password} onChange={(e) => setForm((p) => ({ ...p, new_password: e.target.value }))} required className={inputClass} />
            <p className="text-xs text-grey-400 mt-1">Min 8 characters, one uppercase, one number</p>
          </div>
          <div>
            <label className={labelClass}>Confirm Password</label>
            <input type="password" value={form.confirm_password} onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))} required className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Activity Drawer ----
function ActivityDrawer({ user, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserActivity(user.id).then(({ data }) => {
      setEntries(data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user.id]);

  const actionColors = {
    CREATE: 'text-green-600 bg-green-50',
    UPDATE: 'text-blue-600 bg-blue-50',
    DELETE: 'text-red-600 bg-red-50',
    STATUS_CHANGE: 'text-orange-600 bg-orange-50',
    PASSWORD_RESET: 'text-purple-600 bg-purple-50',
    WEIGHT_OVERRIDE: 'text-red-700 bg-red-50',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="app-drawer-overlay absolute inset-0" />
      <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-grey-200 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-semibold text-grey-900">Activity Log</h3>
            <p className="text-xs text-grey-500">{user.full_name}</p>
          </div>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-grey-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-grey-400 text-center py-12">No activity recorded</p>
          ) : (
            <div className="space-y-4">
              {entries.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${actionColors[e.action] || 'text-grey-500 bg-grey-100'}`}>
                    <Shield size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-grey-900 font-medium">{e.action}</p>
                    <p className="text-xs text-grey-500">{e.entity_type} &middot; {e.entity_id?.slice(0, 8)}</p>
                    <p className="text-xs text-grey-400 mt-0.5">{relativeTime(e.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [activityUser, setActivityUser] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search: search || undefined, role: roleFilter || undefined };
      if (statusFilter !== '') params.is_active = statusFilter;
      const { data } = await getUsers(params);
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  function handleSuccess() {
    setShowCreate(false);
    setEditUser(null);
    setResetUser(null);
    fetchData();
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-grey-900">User Management</h1>
          <p className="text-sm text-grey-500 mt-0.5">{total} users total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="app-list-filter-select">
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="app-list-filter-select">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Full Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Last Login</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-2.5">
                  <button onClick={() => setActivityUser(u)} className="font-medium text-grey-900 hover:text-green-600 transition-colors text-left">
                    {u.full_name}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-grey-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role] || 'bg-grey-100 text-grey-600 border-grey-300'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-green-25 text-green-700 border-green-300' : 'bg-grey-100 text-grey-500 border-grey-300'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-grey-500 text-xs">{relativeTime(u.last_login_at)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => setEditUser(u)} title="Edit user"
                    className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"><Pencil size={15} /></button>
                  <button onClick={() => setResetUser(u)} title="Reset password"
                    className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-orange-600 ml-1"><KeyRound size={15} /></button>
                  <button onClick={() => setActivityUser(u)} title="View activity"
                    className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-blue-600 ml-1"><Clock size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-grey-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="h-8 px-3 text-xs font-medium rounded-md border border-grey-300 text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="h-8 px-3 text-xs font-medium rounded-md border border-grey-300 text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSuccess={handleSuccess} />}
      {editUser && <EditUserModal user={editUser} currentUserId={currentUser?.id} onClose={() => setEditUser(null)} onSuccess={handleSuccess} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSuccess={() => { setResetUser(null); }} />}
      {activityUser && <ActivityDrawer user={activityUser} onClose={() => setActivityUser(null)} />}
    </div>
  );
}
