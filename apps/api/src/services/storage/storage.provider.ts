export interface UploadImage {
  buffer: Buffer;
  mimeType: string;
  /** Controlled by the calling backend module, never copied from a client path. */
  context?: string;
}

export interface StoredImage {
  key: string;
  /** Public, unsigned URL, scoped to the configured Neon branch and bucket. */
  url: string;
}

export interface ReplacedImage extends StoredImage {
  cleanupPending: boolean;
  previousKey?: string;
}

export abstract class StorageProvider {
  abstract upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
}
