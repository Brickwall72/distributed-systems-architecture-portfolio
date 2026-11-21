// File: ui-shells/domain-shells/topology-shell/src/components/NavigationTabs.tsx
import { Link, useLocation } from 'react-router-dom';

export default function NavigationTabs() {
  const location = useLocation();
  const isRegistration = location.pathname === '/asset-registration' || location.pathname === '/';
  const isHistory = location.pathname === '/transfer-history';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Link
        to="/asset-registration"
        className={`ui-nav-tab ${isRegistration ? 'ui-nav-tab-active' : 'ui-nav-tab-inactive'}`}
      >
        Register Assets
      </Link>
      <Link
        to="/transfer-history"
        className={`ui-nav-tab ${isHistory ? 'ui-nav-tab-active' : 'ui-nav-tab-inactive'}`}
      >
        View Transfer History
      </Link>
    </div>
  );
}