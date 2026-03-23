import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter } from './types';

interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketAvatars: string;
  bucketNews: string;
}

export class S3Adapter implements StorageAdapter {
  private client: S3Client;
  private buckets: Record<'avatars' | 'news', string>;

  constructor(config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    this.buckets = {
      avatars: config.bucketAvatars,
      news: config.bucketNews,
    };
  }

  async upload(bucket: 'avatars' | 'news', key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.buckets[bucket],
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  }

  async delete(bucket: 'avatars' | 'news', key: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(bucket: 'avatars' | 'news', key: string): string {
    const endpoint = this.client.config.endpoint;
    const bucketName = this.buckets[bucket];
    // Scaleway Object Storage public URL format
    if (typeof endpoint === 'function') {
      return `https://${bucketName}.s3.${this.client.config.region}.scw.cloud/${key}`;
    }
    return `https://${bucketName}.s3.${this.client.config.region}.scw.cloud/${key}`;
  }

  async getSignedUrl(bucket: 'news', key: string, expiresIn = 3600): Promise<string | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch {
      return null;
    }
  }
}
