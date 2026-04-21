export const DEFAULT_ZONES = ['ru', 'com', 'net', 'org', 'info', 'io', 'app', 'dev'] as const;
export type Zone = (typeof DEFAULT_ZONES)[number];

export const RDAP_ENDPOINTS: Partial<Record<Zone, string>> = {
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
  info: 'https://rdap.identitydigital.services/rdap/domain/',
  io: 'https://rdap.identitydigital.services/rdap/domain/',
  app: 'https://pubapi.registry.google/rdap/domain/',
  dev: 'https://pubapi.registry.google/rdap/domain/',
};

export function isZone(value: string): value is Zone {
  return (DEFAULT_ZONES as readonly string[]).includes(value);
}
