'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal } from 'lucide-react';
import { Badge, cn } from '@nexus/ui';
import { IS_DEMO_MODE } from '@nexus/shared/env';
import { ThemeToggle } from './ThemeToggle';
import { LogoutButton } from './LogoutButton';

const TABS = [
  { href: '/dashboard', label: 'Tasks' },
  { href: '/settings/integrations', label: 'Integrations' },
];

/** Shared top bar for the authenticated app — brand, section tabs, theme + session controls. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-page px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
          <Terminal className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight">Nexus</span>
      </Link>
      <nav className="hidden items-center gap-6 md:flex">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'border-b-2 pb-1 text-sm transition-colors',
                active
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {IS_DEMO_MODE && <Badge tone="warn">Demo mode</Badge>}
        <ThemeToggle />
        {!IS_DEMO_MODE && <LogoutButton />}
      </div>
    </header>
  );
}
