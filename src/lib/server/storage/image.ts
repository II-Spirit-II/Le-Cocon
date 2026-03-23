// Lazy-load sharp (native module) — avoids ~1-2s cold start penalty

interface SharpPipeline {
  resize(width: number, height: number | undefined, options?: { fit?: string; withoutEnlargement?: boolean }): SharpPipeline;
  webp(options?: { quality?: number }): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (input: Buffer) => SharpPipeline;

let _sharp: SharpFactory | null = null;

async function getSharp(): Promise<SharpFactory> {
  if (!_sharp) {
    _sharp = ((await import('sharp')) as unknown as { default: SharpFactory }).default;
  }
  return _sharp;
}

export async function processAvatar(buffer: Buffer): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(buffer)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function processNewsPhoto(buffer: Buffer): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(buffer)
    .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
