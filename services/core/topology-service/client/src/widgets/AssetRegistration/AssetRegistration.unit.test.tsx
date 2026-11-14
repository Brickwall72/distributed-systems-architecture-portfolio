// File: services/core/topology-service/client/src/widgets/AssetRegistration/AssetRegistration.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetRegistrationWidget, { TOPOLOGY_MUTATION_EVENT } from './AssetRegistration';
import { useCreateAsset } from '../../hooks';
import { AssetDTOSchema, AssetRegistrationInputSchema } from '@contracts/topology';
import { mockFromSchema, setTestSession } from '@shared/testing';
import { writeSession } from '@contracts/auth';

const organizationId = 'org-jeb-junkyard';

vi.mock('../../hooks', () => ({
  useCreateAsset: vi.fn(),
}));

describe('AssetRegistrationWidget', () => {
  const mockCreateAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession();
    vi.mocked(useCreateAsset).mockReturnValue({
      createAsset: mockCreateAsset,
      isLoading: false,
      error: null,
    });
  });

  it('renders correctly and shows validation error when submitting empty form', async () => {
    render(<AssetRegistrationWidget organizationId=""><span>Organization child</span></AssetRegistrationWidget>);

    expect(screen.getByText('Register New Asset')).toBeInTheDocument();
    expect(screen.getByText('Organization child').closest('form')).toBeInTheDocument();
    expect(screen.getByText('Organization child').parentElement?.previousElementSibling)
      .toContainElement(screen.getByLabelText(/Control Type/i));
    expect(screen.getByText('Organization child').parentElement?.nextElementSibling)
      .toBe(screen.getByRole('button', { name: /Register & Assign Custody/i }));

    const form = screen.getByRole('button', { name: /Register & Assign Custody/i }).closest('form')!;
    
    // Dispatch submit event directly to bypass HTML5 required validation blocking in JSDOM
    fireEvent.submit(form);

    expect(
      await screen.findByText('All fields including holding organization custody are required.')
    ).toBeInTheDocument();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('does not allow auditors to register assets', () => {
    writeSession({
      accessToken: 'auditor-test-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      identity: { id: 'auditor', displayName: 'Auditor', orgId: null, roles: ['auditor'], signerId: 'auditor' },
    });
    render(<AssetRegistrationWidget organizationId={organizationId} />);
    expect(screen.getByRole('button', { name: /Register & Assign Custody/i })).toBeDisabled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('successfully submits valid asset payload, dispatches mutation event, and resets form', async () => {
    // Text inputs drop line breaks, so keep generated values single-line
    const singleLine = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
    const generated = mockFromSchema(AssetDTOSchema, { name: 'GPS Navigation Unit', currentOwnerId: organizationId, id: 'asset-gps-12' });
    const asset = { ...generated, nomenclature: singleLine(generated.nomenclature), serialNumber: singleLine(generated.serialNumber) };
    mockCreateAsset.mockResolvedValueOnce({ id: asset.id });
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<AssetRegistrationWidget organizationId={` ${organizationId} `} />);

    fireEvent.change(screen.getByLabelText(/Asset ID \(UUID \/ URI\)/i), { target: { value: asset.id } });
    fireEvent.change(screen.getByLabelText(/Asset Name/i), { target: { value: asset.name } });
    fireEvent.change(screen.getByLabelText(/Nomenclature/i), { target: { value: asset.nomenclature } });
    fireEvent.change(screen.getByLabelText(/Serial Number/i), { target: { value: asset.serialNumber } });
    fireEvent.change(screen.getByLabelText(/Asset Type Information/i), { target: { value: singleLine(asset.type) } });
    fireEvent.change(screen.getByLabelText(/Control Type/i), { target: { value: asset.controlType } });
    fireEvent.click(screen.getByRole('button', { name: /Register & Assign Custody/i }));

    await waitFor(() => {
      expect(mockCreateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: asset.id,
          name: asset.name,
          nomenclature: asset.nomenclature,
          serialNumber: asset.serialNumber,
          type: singleLine(asset.type),
          status: 'AVAILABLE',
          controlType: asset.controlType,
          currentOwnerId: organizationId,
        })
      );
    });
    expect(AssetDTOSchema.safeParse(mockCreateAsset.mock.calls[0][0]).success).toBe(true);

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: TOPOLOGY_MUTATION_EVENT }));
    expect(screen.getByLabelText(/Asset ID \(UUID \/ URI\)/i)).toHaveValue('');
  });

  it('displays API error when createAsset hook reports an error', () => {
    vi.mocked(useCreateAsset).mockReturnValue({
      createAsset: mockCreateAsset,
      isLoading: false,
      error: 'Conflict: Asset ID already exists',
    });

    render(<AssetRegistrationWidget organizationId="" />);

    expect(screen.getByText('Conflict: Asset ID already exists')).toBeInTheDocument();
  });

  it('requires an organization even when every other field is filled and uses updated props', async () => {
    mockCreateAsset.mockResolvedValue({ id: 'asset-1' });
    const { rerender } = render(<AssetRegistrationWidget organizationId="  " />);
    fireEvent.change(screen.getByLabelText(/Asset ID/i), { target: { value: 'asset-1' } });
    fireEvent.change(screen.getByLabelText(/Asset Name/i), { target: { value: 'Asset' } });
    fireEvent.change(screen.getByLabelText(/Nomenclature/i), { target: { value: 'Nomenclature' } });
    fireEvent.change(screen.getByLabelText(/Serial Number/i), { target: { value: 'serial-1' } });
    fireEvent.change(screen.getByLabelText(/Asset Type Information/i), { target: { value: 'Radio' } });
    fireEvent.change(screen.getByLabelText(/Control Type/i), { target: { value: 'LOCAL' } });

    fireEvent.click(screen.getByRole('button', { name: /Register & Assign Custody/i }));
    expect(await screen.findByText('All fields including holding organization custody are required.')).toBeInTheDocument();
    expect(mockCreateAsset).not.toHaveBeenCalled();

    rerender(<AssetRegistrationWidget organizationId="org-previous" />);
    rerender(<AssetRegistrationWidget organizationId="" />);
    fireEvent.click(screen.getByRole('button', { name: /Register & Assign Custody/i }));
    expect(mockCreateAsset).not.toHaveBeenCalled();

    rerender(<AssetRegistrationWidget organizationId="org-current" />);
    fireEvent.click(screen.getByRole('button', { name: /Register & Assign Custody/i }));
    await waitFor(() => expect(mockCreateAsset).toHaveBeenCalledWith(
      expect.objectContaining({ currentOwnerId: 'org-current' }),
    ));
  });

  it('parses organization input and rejects missing or invalid values', () => {
    expect(AssetRegistrationInputSchema.parse({ organizationId: ` ${organizationId} ` })).toEqual({ organizationId });
    expect(AssetRegistrationInputSchema.parse({ organizationId: '' })).toEqual({ organizationId: '' });
    expect(AssetRegistrationInputSchema.parse({ organizationId: ' ' })).toEqual({ organizationId: '' });
    expect(AssetRegistrationInputSchema.safeParse({}).success).toBe(false);
    expect(AssetRegistrationInputSchema.safeParse({ organizationId: null }).success).toBe(false);
    expect(AssetRegistrationInputSchema.safeParse({ organizationId: 123 }).success).toBe(false);
    expect(() => {
      // @ts-expect-error Runtime callers can violate the federation contract.
      AssetRegistrationWidget({ organizationId: 123 });
    }).toThrow();
  });
});