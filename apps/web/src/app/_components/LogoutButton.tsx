'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@nexus/ui';

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
