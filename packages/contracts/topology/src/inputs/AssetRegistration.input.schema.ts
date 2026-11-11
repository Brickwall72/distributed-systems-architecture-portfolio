// File: packages/contracts/topology/src/inputs/AssetRegistration.input.schema.ts
import type { ReactNode } from 'react';
import { z } from 'zod';

export const AssetRegistrationInputSchema = z.object({
  /** Empty while no organization is selected; registration requires a non-empty ID. */
  organizationId: z.string().trim(),
});

export type AssetRegistrationInputs = z.input<typeof AssetRegistrationInputSchema>;
export type AssetRegistrationProps = AssetRegistrationInputs & {
  /** Content rendered in the organization selector's position inside the form. */
  readonly children?: ReactNode;
};
