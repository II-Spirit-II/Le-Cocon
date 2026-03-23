// Soie & Lumière palette backgrounds (miel, sienne, sable, warm)
const SOIE_BG = 'f5e6d0,fce8d5,f0d9c0,fdebd3,f5dcc4';

export function getChildAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed.trim());
  return `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encoded}&backgroundColor=${SOIE_BG}&backgroundType=gradientLinear`;
}

export function getAdultAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed.trim());
  return `https://api.dicebear.com/9.x/toon-head/svg?seed=${encoded}&backgroundColor=${SOIE_BG}&backgroundType=gradientLinear`;
}

/** @deprecated Use getChildAvatarUrl or getAdultAvatarUrl */
export const getDiceBearUrl = getChildAvatarUrl;
