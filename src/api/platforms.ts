export const PLATFORMS = ['telegram', 'vk'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const INITIAL_PLATFORMS: readonly Platform[] = ['telegram', 'vk'];

export const PLATFORM_LABEL: Record<Platform, string> = {
  telegram: 'Telegram',
  vk: 'VK',
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function platformUrl(platform: Platform, name: string): string {
  const slug = encodeURIComponent(name);
  return platform === 'telegram' ? `https://t.me/${slug}` : `https://vk.com/${slug}`;
}
