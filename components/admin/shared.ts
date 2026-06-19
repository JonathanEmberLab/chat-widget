import type { SiteConfig } from '@/lib/types';

/** Locale-aware date/time formatter shared across admin tables. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** <Select> options for filtering by site. */
export function siteOptions(sites: SiteConfig[]) {
  return sites.map((s) => ({ label: s.name, value: s.site_key }));
}
