// File: ui-shells/domain-shells/topology-shell/src/components/NavigationTabs.tsx
import { Link, useLocation } from 'react-router-dom';

export default function NavigationTabs() {
  const location = useLocation();
  const isRegistration = location.pathname === '/asset-registration' || location.pathname === '/';
  const isHistory = location.pathname === '/transfer-history';

  return (
    <div className="flex items-center space-x-2">
      <Link
        to="/asset-registration"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isRegistration
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Asset Registration
      </Link>
      <Link
        to="/transfer-history"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isHistory
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Transfer History
      </Link>
    </div>
  );
}