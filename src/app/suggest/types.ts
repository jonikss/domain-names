import type { Zone } from '../../api/zones';

export type Phase = 'idle' | 'generating' | 'checking' | 'done' | 'error';

export type AvailableDomain = {
  fqdn: string;
  base: string;
  zone: Zone;
  rationale: string;
};

export type CheckEvent = {
  fqdn: string;
  base: string;
  zone: Zone;
  available: boolean | null;
  rationale: string;
  checked: number;
  total: number;
};

export type ZoneGroup = { zone: Zone; list: AvailableDomain[] };
