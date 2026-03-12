import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-grey-50 px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-grey-300">404</h1>
        <p className="text-xl font-semibold text-grey-900 mt-4">Page not found</p>
        <p className="text-sm text-grey-500 mt-2">The page you are looking for does not exist or has been moved.</p>
        <Link to="/dashboard"
          className="inline-flex items-center gap-2 h-10 px-5 mt-6 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Home size={16} /> Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
