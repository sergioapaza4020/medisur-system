import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { STORAGE_CONFIG } from './storage.config';
import type { StorageConfig } from './storage.config';
import { StorageProvider } from './storage.provider';

export const NEON_S3_CLIENT = Symbol('NEON_S3_CLIENT');

@Injectable()
export class NeonStorageProvider extends StorageProvider implements OnModuleDestroy {
  private readonly logger = new Logger(NeonStorageProvider.name);

  constructor(
    @Inject(NEON_S3_CLIENT) private readonly client: S3Client,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {
    super();
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentDisposition: 'inline',
          CacheControl: 'public, max-age=300',
        }),
      );
    } catch (error: unknown) {
      this.reportError('upload', key, error);
      throw new ServiceUnavailableException('No se pudo subir la imagen');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (error: unknown) {
      // S3 DeleteObject is idempotent. Do not hide NoSuchBucket/configuration errors.
      if (error instanceof Error && error.name === 'NoSuchKey') return;
      this.reportError('delete', key, error);
      throw new ServiceUnavailableException('No se pudo eliminar la imagen');
    }
  }

  getPublicUrl(key: string): string {
    // AWS SDK has no public-URL helper. Use Neon's documented path-style addressing.
    // No signed URL is persisted and no branch/domain is inferred or hardcoded.
    const path = [this.config.bucket, ...key.split('/')].map(encodeURIComponent).join('/');
    return new URL(path, `${this.config.endpoint.replace(/\/$/, '')}/`).toString();
  }

  private reportError(operation: string, key: string, error: unknown): void {
    const allowed = [
      'AccessDenied',
      'InvalidAccessKeyId',
      'SignatureDoesNotMatch',
      'NoSuchBucket',
      'NoSuchKey',
      'RequestTimeout',
      'SlowDown',
      'TimeoutError',
      'AbortError',
    ];
    const code = error instanceof Error && allowed.includes(error.name) ? error.name : 'UNKNOWN';
    this.logger.error({ operation, provider: 'neon', key, code });
  }

  onModuleDestroy() {
    this.client.destroy();
  }
}
