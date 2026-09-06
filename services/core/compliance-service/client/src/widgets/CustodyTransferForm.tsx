// File: services/core/compliance-service/client/src/widgets/CustodyTransferForm.tsx
import React, { useState } from 'react';
import { 
  Organization, 
  Asset, 
  DD1149TemplateData, 
  DD1149TemplateDataSchema 
} from '@contracts/domain';
import '@shared/styles';

interface CustodyTransferFormProps {
  readonly sourceOrg: Organization | null;
  readonly targetOrg: Organization | null;
  readonly asset: Asset | null;
  readonly children: (payload: DD1149TemplateData | null, isValid: boolean) => React.ReactNode;
}

export default function CustodyTransferForm({ 
  sourceOrg, 
  targetOrg, 
  asset, 
  children 
}: CustodyTransferFormProps) {
  const [requisitionNumber, setRequisitionNumber] = useState<string>('REQ-2026-001');

  const transferDate = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const rawPayload = {
    fromEntityName: sourceOrg?.name || '',
    fromAddressLine1: sourceOrg?.addressLine1 || '',
    fromAddressLine2: sourceOrg?.addressLine2 || '',
    toEntityName: targetOrg?.name || '',
    toAddressLine1: targetOrg?.addressLine1 || '',
    toAddressLine2: targetOrg?.addressLine2 || '',
    requisitionNumber,
    transferDate,
    items: asset ? [{
      itemNumber: 1,
      nomenclature: asset.nomenclature,
      serialNumber: asset.serialNumber,
      unit: 'EA',
      quantity: 1
    }] : []
  };

  const validationResult = DD1149TemplateDataSchema.safeParse(rawPayload);
  const isValid = validationResult.success;
  const payload = isValid ? validationResult.data : null;

  return (
    <div className="custody-transfer-form max-w-[600px] mx-auto p-6 bg-white rounded-lg shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-6">DD-1149 Custody Transfer Orchestrator</h2>

      <div className="mb-4">
        <label htmlFor="requisition-number" className="block font-semibold text-gray-700 mb-1.5">
          Requisition Control Number
        </label>
        <input 
          type="text" 
          id="requisition-number"
          value={requisitionNumber} 
          onChange={(e) => setRequisitionNumber(e.target.value)}
          className="w-full p-2 text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      {/* Render Actions / Children (Where the Shell passes the Selector components in) */}
      <div className="form-actions mt-6">
        {children(payload, isValid)}
      </div>
    </div>
  );
}