import { Link, useLocation } from 'react-router-dom';

export default function NavigationTabs() {
  const location = useLocation();
  const isTransfer = location.pathname === '/' || location.pathname === '/transfer';
  const isPreview = location.pathname === '/preview';

  return (
    <div className="flex items-center space-x-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
      <Link
        to="/"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isTransfer
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Custody Transfer
      </Link>
      <Link
        to="/preview"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isPreview
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Document Preview
      </Link>
    </div>
  );
}