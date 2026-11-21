// File: ui-shells/domain-shells/compliance-shell/src/components/NavigationTabs.tsx
import { Link, useLocation } from 'react-router-dom';

export default function NavigationTabs() {
  const location = useLocation();
  const isCustody = location.pathname === '/transfer-authorizations' || location.pathname === '/';
  const isDocuments = location.pathname === '/documents';
  const isTransferReceipt = location.pathname === '/transfer-receipts';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Link
        to="/transfer-authorizations"
        className={`ui-nav-tab ${isCustody ? 'ui-nav-tab-active' : 'ui-nav-tab-inactive'}`}
      >
        Authorize Transfers
      </Link>
      <Link
        to="/transfer-receipts"
        className={`ui-nav-tab ${isTransferReceipt ? 'ui-nav-tab-active' : 'ui-nav-tab-inactive'}`}
      >
        Receive Transfers
      </Link>
      <Link
        to="/documents"
        className={`ui-nav-tab ${isDocuments ? 'ui-nav-tab-active' : 'ui-nav-tab-inactive'}`}
      >
        View Documents
      </Link>
    </div>
  );
}