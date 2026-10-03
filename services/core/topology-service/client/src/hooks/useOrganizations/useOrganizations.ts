// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.ts
import { useEffect, useState } from 'react';
import { Organization } from '@contracts/custody';
import { fetchOrganizations, GetOrganizationsParams } from '../../api';

export function useOrganizations(params?: GetOrganizationsParams) {
  const [items, setItems] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract primitive values for safe dependency tracking
  const parentId = params?.parentId;
  const excludeId = params?.excludeId;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        // Pass the extracted values down to the fetch call
        const data = await fetchOrganizations({ parentId, excludeId });
        if (isMounted) setItems(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load organizations');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [parentId, excludeId]); // Track primitive dependencies

  return { items, isLoading, error };
}