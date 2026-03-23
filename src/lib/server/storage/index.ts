import { env } from '$env/dynamic/private';
import type { DrizzleDB } from '$lib/server/db';
import type { StorageAdapter } from './types';
import { LocalAdapter } from './local';
import { processAvatar, processNewsPhoto } from './image';

// -- Singleton adapter --

let _adapter: StorageAdapter | null = null;
let _adapterPromise: Promise<StorageAdapter> | null = null;

async function initAdapter(): Promise<StorageAdapter> {
  if (env.STORAGE_PROVIDER === 's3') {
    const { S3Adapter } = await import('./s3');
    return new S3Adapter({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      bucketAvatars: env.S3_BUCKET_AVATARS!,
      bucketNews: env.S3_BUCKET_NEWS!,
    });
  }
  return new LocalAdapter();
}

async function getAdapter(): Promise<StorageAdapter> {
  if (_adapter) return _adapter;
  if (!_adapterPromise) {
    _adapterPromise = initAdapter().then(a => { _adapter = a; return a; });
  }
  return _adapterPromise;
}

// -- URL cache (avoids repeated S3 signature generation) --

const URL_CACHE_TTL = 55 * 60_000; // 55 min (signed URLs expire at 60 min)
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function getCachedUrl(key: string): string | null {
  const entry = urlCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) urlCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCachedUrl(key: string, url: string): void {
  urlCache.set(key, { url, expiresAt: Date.now() + URL_CACHE_TTL });
  // Cleanup stale entries when cache grows
  if (urlCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of urlCache) {
      if (now > v.expiresAt) urlCache.delete(k);
    }
  }
}

// -- Validation --

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;      // 2MB
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;  // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

function validateImageFile(file: File, maxSize: number): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Type non supporté. Acceptés : JPEG, PNG, WebP, GIF` };
  }
  if (file.size > maxSize) {
    return { valid: false, error: `Fichier trop lourd. Max : ${Math.round(maxSize / (1024 * 1024))}Mo` };
  }
  return { valid: true };
}

// -- Public API (same signatures as before) --

export async function uploadProfileAvatar(_db: DrizzleDB, _userId: string, file: File): Promise<UploadResult> {
  const v = validateImageFile(file, MAX_AVATAR_SIZE);
  if (!v.valid) return { success: false, error: v.error };

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processAvatar(buffer);
  const key = `${crypto.randomUUID()}.webp`;

  const adapter = await getAdapter();
  await adapter.upload('avatars', key, processed, 'image/webp');
  return { success: true, path: key };
}

export async function uploadChildAvatar(_db: DrizzleDB, _childId: string, file: File): Promise<UploadResult> {
  const v = validateImageFile(file, MAX_AVATAR_SIZE);
  if (!v.valid) return { success: false, error: v.error };

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processAvatar(buffer);
  const key = `${crypto.randomUUID()}.webp`;

  const adapter = await getAdapter();
  await adapter.upload('avatars', key, processed, 'image/webp');
  return { success: true, path: key };
}

export async function uploadNewsAttachment(_db: DrizzleDB, _childId: string, _newsId: string, file: File): Promise<UploadResult> {
  const v = validateImageFile(file, MAX_ATTACHMENT_SIZE);
  if (!v.valid) return { success: false, error: v.error };

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processNewsPhoto(buffer);
  const key = `${crypto.randomUUID()}.webp`;

  const adapter = await getAdapter();
  await adapter.upload('news', key, processed, 'image/webp');
  return { success: true, path: key };
}

export async function deleteStorageFile(_db: DrizzleDB, bucket: 'avatars' | 'news', path: string): Promise<boolean> {
  urlCache.delete(`${bucket === 'avatars' ? 'avatar' : 'news'}:${path}`);
  const adapter = await getAdapter();
  return adapter.delete(bucket, path);
}

export async function getAvatarPublicUrl(_db: DrizzleDB, _recordId: string, filename: string): Promise<string> {
  const cacheKey = `avatar:${filename}`;
  const cached = getCachedUrl(cacheKey);
  if (cached) return cached;

  const adapter = await getAdapter();
  const url = adapter.getPublicUrl('avatars', filename);
  setCachedUrl(cacheKey, url);
  return url;
}

export async function getNewsAttachmentSignedUrl(_db: DrizzleDB, _recordId: string, filename: string, expiresIn = 3600): Promise<string | null> {
  const cacheKey = `news:${filename}`;
  const cached = getCachedUrl(cacheKey);
  if (cached) return cached;

  const adapter = await getAdapter();
  const url = await adapter.getSignedUrl('news', filename, expiresIn);
  if (url) setCachedUrl(cacheKey, url);
  return url;
}
