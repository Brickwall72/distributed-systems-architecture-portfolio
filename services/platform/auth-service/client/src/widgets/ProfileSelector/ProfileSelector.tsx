// File: services/platform/auth-service/client/src/widgets/ProfileSelector/ProfileSelector.tsx
import { Select } from '@shared/ui-components';
import { useProfileSession } from '../../hooks';

export function ProfileSelector() {
  const { identities, activeIdentity, isLoading, error, signIn } = useProfileSession();

  return (
    <Select
      label="Signed in as"
      options={identities.map((i) => ({ id: i.id, name: i.displayName }))}
      selectedId={activeIdentity?.id}
      onSelection={(id) => void signIn(id)}
      isLoading={isLoading}
      error={error}
      placeholderText="-- Select profile --"
    />
  );
}

export default ProfileSelector;
