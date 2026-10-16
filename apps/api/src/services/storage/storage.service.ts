import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { STORAGE_CONFIG } from './storage.config';
import type { StorageConfig } from './storage.config';
import { StorageProvider } from './storage.provider';
import type { ReplacedImage, StoredImage, UploadImage } from './storage.provider';

const formats: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const managedKey =
  /^images\/(?:[a-z][a-z0-9-]{0,39}\/)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp)$/;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  constructor(
    private readonly provider: StorageProvider,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {}

  async uploadImage(input: UploadImage): Promise<StoredImage> {
    if (!input || !Buffer.isBuffer(input.buffer) || !input.buffer.length)
      throw new BadRequestException('La imagen es obligatoria');
    if (input.buffer.length > this.config.maxImageSize)
      throw new PayloadTooLargeException('La imagen supera el tamaño máximo permitido');
    if (typeof input.mimeType !== 'string' || !Object.hasOwn(formats, input.mimeType))
      throw new BadRequestException('Formato de imagen no permitido. Usa JPEG, PNG o WebP');
    const context = input.context;
    if (
      context !== undefined &&
      (typeof context !== 'string' ||
        context.trim() !== context ||
        !/^[a-z][a-z0-9-]{0,39}$/.test(context))
    )
      throw new BadRequestException('Contexto de imagen no permitido');
    const buffer = Buffer.from(input.buffer);
    if (!this.hasExpectedSignature(buffer, input.mimeType))
      throw new BadRequestException('El contenido no corresponde al formato de imagen indicado');
    const key = `images/${context ? `${context}/` : ''}${randomUUID()}.${formats[input.mimeType]}`;
    const url = this.provider.getPublicUrl(key);
    try {
      await this.provider.upload(key, buffer, input.mimeType);
    } catch (error) {
      // A timeout can leave a remotely accepted object. Compensate only our new UUID key.
      try {
        await this.provider.delete(key);
      } catch {
        this.logger.warn({ operation: 'upload-cleanup', provider: 'neon', key });
      }
      throw error;
    }
    return { key, url };
  }

  getPublicUrl(key: string): string {
    this.assertKey(key);
    return this.provider.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);
    await this.provider.delete(key);
  }

  async replace(previousKey: string, input: UploadImage): Promise<ReplacedImage> {
    this.assertKey(previousKey);
    const image = await this.uploadImage(input);
    try {
      await this.delete(previousKey);
      return { ...image, cleanupPending: false };
    } catch {
      // Never lose the new reference or report a failed upload after it succeeded.
      this.logger.warn({ operation: 'replace-cleanup', provider: 'neon', key: previousKey });
      return { ...image, cleanupPending: true, previousKey };
    }
  }

  private assertKey(key: string): void {
    if (typeof key !== 'string' || key.trim() !== key || !managedKey.test(key))
      throw new BadRequestException('Referencia de imagen no permitida');
  }

  private hasExpectedSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/jpeg')
      return (
        buffer.length >= 4 &&
        buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) &&
        buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
      );
    if (mimeType === 'image/png')
      return (
        buffer.length >= 45 &&
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        buffer.readUInt32BE(8) === 13 &&
        buffer.toString('ascii', 12, 16) === 'IHDR' &&
        buffer.readUInt32BE(16) > 0 &&
        buffer.readUInt32BE(20) > 0 &&
        buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND'
      );
    return (
      buffer.length >= 20 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.readUInt32LE(4) === buffer.length - 8 &&
      buffer.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))
    );
  }
}
