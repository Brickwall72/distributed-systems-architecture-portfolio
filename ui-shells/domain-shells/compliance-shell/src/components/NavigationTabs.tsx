// File: ui-shells/domain-shells/compliance-shell/src/components/NavigationTabs.tsx
import { Link, useLocation } from 'react-router-dom';

export default function NavigationTabs() {
  const location = useLocation();
  const isCustody = location.pathname === '/transfer-authorizations' || location.pathname === '/';
  const isDocuments = location.pathname === '/documents';
  const isTransferReceipt = location.pathname === '/transfer-receipts';

  return (
    <div className="flex items-center space-x-2">
      <Link
        to="/transfer-authorizations"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isCustody
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Custody Preview
      </Link>
      <Link
        to="/documents"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isDocuments
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Database Twin
      </Link>
      <Link
        to="/transfer-receipts"
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
          isTransferReceipt
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        Transfer Receipts
      </Link>
    </div>
  );
}