export interface StorageAdapter {
  upload(bucket: 'avatars' | 'news', key: string, buffer: Buffer, contentType: string): Promise<void>;
  delete(bucket: 'avatars' | 'news', key: string): Promise<boolean>;
  getPublicUrl(bucket: 'avatars' | 'news', key: string): string;
  getSignedUrl(bucket: 'news', key: string, expiresIn: number): Promise<string | null>;
}
