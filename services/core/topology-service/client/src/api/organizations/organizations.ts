// File: services/core/topology-service/client/src/api/organizations/organizations.ts
import { Organization } from '@contracts/custody';

export interface GetOrganizationsParams {
  parentId?: string;
  excludeId?: string;
}

export async function fetchOrganizations(params?: GetOrganizationsParams): Promise<Organization[]> {
  const searchParams = new URLSearchParams();
  if (params?.parentId) searchParams.append('parentId', params.parentId);
  if (params?.excludeId) searchParams.append('excludeId', params.excludeId);

  const queryString = searchParams.toString();
  const url = queryString 
    ? `/topology/api/v1/organizations?${queryString}` 
    : '/topology/api/v1/organizations';

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organizations (${response.status})`);
  }

  return response.json();
}