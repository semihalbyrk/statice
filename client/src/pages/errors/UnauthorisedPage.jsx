import { Link } from 'react-router-dom';
import { Home, ShieldX } from 'lucide-react';

export default function UnauthorisedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-grey-50 px-4">
      <div className="text-center">
        <ShieldX size={48} className="mx-auto text-grey-300" />
        <h1 className="text-5xl font-bold text-grey-300 mt-4">403</h1>
        <p className="text-xl font-semibold text-grey-900 mt-4">Access Denied</p>
        <p className="text-sm text-grey-500 mt-2">You don't have permission to view this page.</p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => window.history.back()}
            className="h-10 px-5 border border-grey-300 text-grey-700 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            Go Back
          </button>
          <Link to="/dashboard"
            className="inline-flex items-center gap-2 h-10 px-5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
            <Home size={16} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
