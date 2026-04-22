import net from 'node:net';
import { platformUrl, type Platform } from './platforms';
import { RDAP_ENDPOINTS, type Zone } from './zones';

const WHOIS_RU_HOST = 'whois.tcinet.ru';
const WHOIS_PORT = 43;
const RDAP_TIMEOUT_MS = 6000;
const WHOIS_TIMEOUT_MS = 8000;
const HTTP_TIMEOUT_MS = 6000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; DomainNamesBot/1.0; +https://github.com/joniks/domain-names)';

export type AvailabilityTarget =
  | { kind: 'zone'; zone: Zone }
  | { kind: 'platform'; platform: Platform };

export type AvailabilityResult = {
  base: string;
  target: AvailabilityTarget;
  url: string;
  available: boolean | null;
};

export async function checkAvailability(
  base: string,
  target: AvailabilityTarget,
): Promise<AvailabilityResult> {
  if (target.kind === 'zone') {
    const fqdn = `${base}.${target.zone}`;
    try {
      const available =
        target.zone === 'ru' ? await whoisRuAvailable(fqdn) : await rdapAvailable(fqdn, target.zone);
      return { base, target, url: fqdn, available };
    } catch {
      return { base, target, url: fqdn, available: null };
    }
  }
  const url = platformUrl(target.platform, base);
  try {
    const available =
      target.platform === 'telegram'
        ? await telegramHandleAvailable(base)
        : await vkHandleAvailable(base);
    return { base, target, url, available };
  } catch {
    return { base, target, url, available: null };
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

async function telegramHandleAvailable(name: string): Promise<boolean | null> {
  const res = await fetch(`https://t.me/${encodeURIComponent(name)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.includes('tgme_page_title')) return false;
  if (text.includes('tgme_icon_user') || text.includes('tgme_username_link')) return true;
  return null;
}

async function vkHandleAvailable(name: string): Promise<boolean | null> {
  const res = await fetch(`https://vk.com/${encodeURIComponent(name)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (res.status === 404) return true;
  if (res.status === 200) return false;
  return null;
}

export async function checkAllStreaming(
  bases: string[],
  targets: AvailabilityTarget[],
  onResult: (result: AvailabilityResult) => void,
  options: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const concurrency = options.concurrency ?? 12;
  const pairs: Array<{ base: string; target: AvailabilityTarget }> = [];
  for (const base of bases) {
    for (const target of targets) pairs.push({ base, target });
  }

  let cursor = 0;
  const worker = async () => {
    while (true) {
      if (options.signal?.aborted) return;
      const index = cursor++;
      if (index >= pairs.length) return;
      const result = await checkAvailability(pairs[index].base, pairs[index].target);
      if (options.signal?.aborted) return;
      onResult(result);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pairs.length) }, () => worker()),
  );
}
