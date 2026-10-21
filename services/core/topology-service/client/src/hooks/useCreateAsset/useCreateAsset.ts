// File: services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.ts
import { useState } from 'react';
import { apiClient } from '../../api';
import type { AssetDTO } from '@contracts/topology';

export function useCreateAsset() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAsset = async (assetData: AssetDTO): Promise<AssetDTO | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.createAsset({
        body: assetData,
      });

      if (response.status === 201 && response.body) {
        return response.body;
      } else {
        const errBody = response.body as { error?: string; message?: string } | null | undefined;
        setError(errBody?.error || errBody?.message || 'Failed to register asset');
        return null;
      }
    } catch (err: unknown) {
      const message = err instanceof Error && err.message.trim() !== '' 
        ? err.message 
        : 'Failed to register asset';

      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { createAsset, isLoading, error };
}