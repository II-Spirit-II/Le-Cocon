import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageAdapter } from './types';

const BASE_DIR = join(process.cwd(), 'static', 'uploads');

export class LocalAdapter implements StorageAdapter {
  async upload(bucket: 'avatars' | 'news', key: string, buffer: Buffer): Promise<void> {
    const dir = join(BASE_DIR, bucket);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, key), buffer);
  }

  async delete(bucket: 'avatars' | 'news', key: string): Promise<boolean> {
    try {
      await unlink(join(BASE_DIR, bucket, key));
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(bucket: 'avatars' | 'news', key: string): string {
    return `/uploads/${bucket}/${key}`;
  }

  async getSignedUrl(bucket: 'news', key: string): Promise<string | null> {
    // In dev, serve directly — no signing needed
    return `/uploads/${bucket}/${key}`;
  }
}
