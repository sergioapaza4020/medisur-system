import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageModule } from 'src/modules/storage/storage.module';
import { NeonStorageProvider, NEON_S3_CLIENT } from './neon-storage.provider';
import { StorageService } from './storage.service';
import type { StorageConfig } from './storage.config';
import { storageTestImage } from 'src/common/test-mocks/storage-image.mock';

describe('Neon SDK adapter', () => {
  const config: StorageConfig = {
    bucket: 'public-read',
    endpoint: 'https://br-test.storage.c-1.us-east-2.aws.neon.tech',
    region: 'us-east-2',
    accessKeyId: 'synthetic-key',
    secretAccessKey: 'synthetic-secret',
    maxImageSize: 5242880,
  };
  const send = jest.fn<Promise<unknown>, [PutObjectCommand | DeleteObjectCommand]>();
  const destroy = jest.fn();
  let provider: NeonStorageProvider;
  let errorLog: jest.SpyInstance;
  const key = 'images/test/12345678-abcd-4abc-8abc-123456789abc.png';
  beforeEach(() => {
    jest.clearAllMocks();
    send.mockReset().mockResolvedValue({});
    provider = new NeonStorageProvider({ send, destroy } as unknown as S3Client, config);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it('uses official SDK PutObjectCommand with configured bucket, type and no unsupported ACL', async () => {
    const buffer = storageTestImage();
    await provider.upload(key, buffer, 'image/png');
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'public-read',
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      ContentDisposition: 'inline',
    });
    expect(command.input).not.toHaveProperty('ACL');
  });
  it('derives a public unsigned path-style URL from the configured endpoint, not a hardcoded domain', () => {
    const alternate = new NeonStorageProvider({ send, destroy } as unknown as S3Client, {
      ...config,
      bucket: 'another-public-bucket',
    });
    const url = alternate.getPublicUrl(key);
    expect(url).toBe(`${config.endpoint}/another-public-bucket/${key}`);
    expect(new URL(url).search).toBe('');
    expect(url).not.toContain(config.accessKeyId);
  });
  it('uses DeleteObjectCommand and treats a missing key consistently as an idempotent delete', async () => {
    await provider.delete(key);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: config.bucket,
      Key: key,
    });
    send.mockRejectedValue(Object.assign(new Error('provider details'), { name: 'NoSuchKey' }));
    await expect(provider.delete(key)).resolves.toBeUndefined();
  });
  it('sanitizes upload/delete errors and does not ignore a missing bucket', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('synthetic-secret buffer content'), { name: 'NoSuchBucket' }),
    );
    await expect(provider.upload(key, storageTestImage(), 'image/png')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(provider.delete(key)).rejects.toThrow('No se pudo eliminar la imagen');
    expect(errorLog.mock.calls).toEqual([
      [{ operation: 'upload', provider: 'neon', key, code: 'NoSuchBucket' }],
      [{ operation: 'delete', provider: 'neon', key, code: 'NoSuchBucket' }],
    ]);
  });
  it('releases the SDK client on module shutdown', () => {
    provider.onModuleDestroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  it('exports the service through Nest DI and can replace only the SDK client in tests', async () => {
    const variables: Record<string, string> = {
      STORAGE_PROVIDER: 'neon',
      STORAGE_BUCKET: config.bucket,
      STORAGE_MAX_IMAGE_SIZE: String(config.maxImageSize),
      AWS_REGION: config.region,
      AWS_ENDPOINT_URL_S3: config.endpoint,
      AWS_ACCESS_KEY_ID: config.accessKeyId,
      AWS_SECRET_ACCESS_KEY: config.secretAccessKey,
    };
    const module = await Test.createTestingModule({ imports: [StorageModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (name: string) => variables[name] })
      .overrideProvider(NEON_S3_CLIENT)
      .useValue({ send, destroy })
      .compile();
    const result = await module
      .get(StorageService)
      .uploadImage({ buffer: storageTestImage(), mimeType: 'image/png' });
    expect(result.url).toContain(`${config.endpoint}/${config.bucket}/images/`);
    expect(send).toHaveBeenCalledTimes(1);
    await module.close();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
