import toast from 'react-hot-toast';

export const showSuccess = (msg) => toast.success(msg);
export const showError = (msg) => toast.error(msg);
export const showApiError = (err, fallback = 'Something went wrong') =>
  toast.error(err?.response?.data?.error || fallback);
