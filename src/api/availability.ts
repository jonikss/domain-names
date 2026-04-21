import net from 'node:net';
import { RDAP_ENDPOINTS, type Zone } from './zones';

const WHOIS_RU_HOST = 'whois.tcinet.ru';
const WHOIS_PORT = 43;
const RDAP_TIMEOUT_MS = 6000;
const WHOIS_TIMEOUT_MS = 8000;

export type AvailabilityResult = {
  fqdn: string;
  base: string;
  zone: Zone;
  available: boolean | null;
};

export async function checkAvailability(base: string, zone: Zone): Promise<AvailabilityResult> {
  const fqdn = `${base}.${zone}`;
  try {
    const available =
      zone === 'ru' ? await whoisRuAvailable(fqdn) : await rdapAvailable(fqdn, zone);
    return { fqdn, base, zone, available };
  } catch {
    return { fqdn, base, zone, available: null };
  }
}

async function rdapAvailable(fqdn: string, zone: Zone): Promise<boolean | null> {
  const endpoint = RDAP_ENDPOINTS[zone];
  if (!endpoint) return null;
  const url = endpoint + encodeURIComponent(fqdn);
  const res = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (res.status === 404) return true;
  if (res.status === 200) return false;
  return null;
}

function whoisRuAvailable(fqdn: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: boolean | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
      sock.destroy();
    };
    const sock = net.createConnection({ host: WHOIS_RU_HOST, port: WHOIS_PORT });
    sock.setTimeout(WHOIS_TIMEOUT_MS);
    const chunks: Buffer[] = [];
    sock.on('connect', () => sock.write(`${fqdn}\r\n`));
    sock.on('data', (chunk) => chunks.push(chunk));
    sock.on('timeout', () => done(null));
    sock.on('error', () => done(null));
    sock.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').toLowerCase();
      if (text.includes('no entries found')) return done(true);
      if (/state:\s*registered/.test(text) || /nserver:/.test(text)) return done(false);
      done(null);
    });
  });
}

export async function checkAllStreaming(
  bases: string[],
  zones: Zone[],
  onResult: (result: AvailabilityResult) => void,
  concurrency = 12,
): Promise<void> {
  const pairs: Array<{ base: string; zone: Zone }> = [];
  for (const base of bases) {
    for (const zone of zones) pairs.push({ base, zone });
  }

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= pairs.length) return;
      const result = await checkAvailability(pairs[index].base, pairs[index].zone);
      onResult(result);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pairs.length) }, () => worker()),
  );
}
