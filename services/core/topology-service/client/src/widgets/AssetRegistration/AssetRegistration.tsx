// File: services/core/topology-service/client/src/widgets/AssetRegistration/AssetRegistration.tsx
import { useState, type SyntheticEvent } from 'react';
import OrganizationSelector from '../OrganizationSelector';
import { useCreateAsset } from '../../hooks';
import type { AssetDTO, AssetStatus } from '@contracts/topology';
import { Button, Select } from '@shared/ui-components';
import '@shared/styles';

export const TOPOLOGY_MUTATION_EVENT = 'topology:graph-mutated';

export default function AssetRegistrationWidget() {
  const [assetId, setAssetId] = useState('');
  const [name, setName] = useState('');
  const [nomenclature, setNomenclature] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState<AssetStatus>('AVAILABLE');
  const [currentOwnerId, setCurrentOwnerId] = useState('');
  
  const { createAsset, isLoading, error: apiError } = useCreateAsset();
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!assetId.trim() || !name.trim() || !nomenclature.trim() || !serialNumber.trim() || !currentOwnerId.trim()) {
      setFormError('All fields including holding organization custody are required.');
      return;
    }

    const payload: AssetDTO = {
      id: assetId.trim(),
      name: name.trim(),
      nomenclature: nomenclature.trim(),
      serialNumber: serialNumber.trim(),
      status,
      currentOwnerId: currentOwnerId.trim(),
    };

    const newAsset = await createAsset(payload);

    if (newAsset) {
      window.dispatchEvent(new CustomEvent(TOPOLOGY_MUTATION_EVENT));

      setAssetId('');
      setName('');
      setNomenclature('');
      setSerialNumber('');
      setStatus('AVAILABLE');
      setCurrentOwnerId('');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-fit">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Register New Asset</h2>
      
      {(formError || apiError) && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded text-xs">
          {formError || apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="asset-id-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Asset ID (UUID / URI)</label>
          <input id="asset-id-input" type="text" value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="e.g. asset-gps-12" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
        </div>
        
        <div>
          <label htmlFor="asset-name-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Asset Name</label>
          <input id="asset-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GPS Navigation Unit" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
        </div>

        <div>
          <label htmlFor="nomenclature-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Nomenclature</label>
          <input id="nomenclature-input" type="text" value={nomenclature} onChange={(e) => setNomenclature(e.target.value)} placeholder="e.g. GPS-III SV" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
        </div>

        <div>
          <label htmlFor="serial-number-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Serial Number</label>
          <input id="serial-number-input" type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. SN-998273" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
        </div>

        <div>
          <Select
            label="Initial Status"
            selectedId={status}
            options={[
              { id: 'AVAILABLE', name: 'AVAILABLE' },
              { id: 'MAINTENANCE', name: 'MAINTENANCE' },
            ]}
            onSelection={(val) => {
              if (val) setStatus(val as AssetStatus);
            }}
            placeholderText="-- Select Status --"
          />
        </div>

        <div className="pt-1">
          <OrganizationSelector
            label="Holding Organization Custody"
            onSelect={(orgs) => setCurrentOwnerId(orgs[0]?.id ?? '')}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full shadow-md"
        >
          Register & Assign Custody
        </Button>
      </form>
    </div>
  );
}