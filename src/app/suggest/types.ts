import type { Platform } from '../../api/platforms';
import type { Zone } from '../../api/zones';

export type Phase = 'idle' | 'generating' | 'checking' | 'done' | 'error';

export type CheckTarget =
  | { kind: 'zone'; zone: Zone }
  | { kind: 'platform'; platform: Platform };

export type AvailableItem = {
  base: string;
  target: CheckTarget;
  url: string;
};

export type CheckEvent = {
  base: string;
  target: CheckTarget;
  url: string;
  available: boolean | null;
  rationale: string;
  checked: number;
  total: number;
};

export type CandidateCard = {
  base: string;
  segments: string[];
  rationale: string;
  zones: Array<{ zone: Zone; url: string }>;
  platforms: Array<{ platform: Platform; url: string }>;
};
