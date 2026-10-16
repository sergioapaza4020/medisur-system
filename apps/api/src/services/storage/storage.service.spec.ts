import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { StorageService } from './storage.service';
import type { StorageConfig } from './storage.config';
import { storageTestImage } from 'src/common/test-mocks/storage-image.mock';

describe('Reusable image storage', () => {
  const provider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn((key: string) => `https://public.example/${key}`),
  };
  const buffer = storageTestImage();
  const input = () => ({ buffer, mimeType: 'image/png', context: 'test-images' });
  const previousKey = 'images/test-images/12345678-abcd-4abc-8abc-123456789abc.png';
  let service: StorageService;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    provider.upload.mockResolvedValue(undefined);
    provider.delete.mockResolvedValue(undefined);
    service = new StorageService(provider, { maxImageSize: buffer.length } as StorageConfig);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it('returns a key and public URL using UUIDs and the validated MIME, ignoring original filenames', async () => {
    const upload = { ...input(), originalname: '../../patient-name.exe' };
    const first = await service.uploadImage(upload);
    const second = await service.uploadImage(upload);
    expect(first.key).toMatch(/^images\/test-images\/[a-f0-9-]{36}\.png$/);
    expect(first.key).not.toBe(second.key);
    expect(first.url).toBe(`https://public.example/${first.key}`);
    expect(first.key).not.toContain('patient');
    expect(provider.upload).toHaveBeenCalledWith(first.key, buffer, 'image/png');
  });
  it('supports a generic key without domain-specific folders', async () => {
    expect((await service.uploadImage({ buffer, mimeType: 'image/png' })).key).toMatch(
      /^images\/[a-f0-9-]{36}\.png$/,
    );
  });
  it.each([
    'image/svg+xml',
    'application/pdf',
    'application/octet-stream',
    'text/html',
    'image/gif',
    'IMAGE/PNG',
  ])('rejects MIME %s before uploading', async (mimeType) => {
    await expect(service.uploadImage({ ...input(), mimeType })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(provider.upload).not.toHaveBeenCalled();
  });
  it('rejects missing, empty and oversized buffers', async () => {
    await expect(service.uploadImage(undefined as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.uploadImage({ buffer: Buffer.alloc(0), mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadImage({ ...input(), buffer: Buffer.alloc(buffer.length + 1) }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(provider.upload).not.toHaveBeenCalled();
  });
  it('inspects content signatures rather than trusting the supplied MIME', async () => {
    for (const mimeType of ['image/png', 'image/jpeg', 'image/webp']) {
      await expect(
        service.uploadImage({ buffer: Buffer.from('<svg>unsafe</svg>'), mimeType }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(provider.upload).not.toHaveBeenCalled();
  });
  it('derives jpg and webp extensions from matching signatures', async () => {
    const jpeg = Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]);
    const webp = Buffer.alloc(20);
    webp.write('RIFF');
    webp.writeUInt32LE(12, 4);
    webp.write('WEBPVP8 ', 8);
    expect((await service.uploadImage({ buffer: jpeg, mimeType: 'image/jpeg' })).key).toMatch(
      /\.jpg$/,
    );
    expect((await service.uploadImage({ buffer: webp, mimeType: 'image/webp' })).key).toMatch(
      /\.webp$/,
    );
  });
  it.each(['../../file', 'a/b', '', '.', 'a%2fb', 'https://example.com', 'with space', 'folder\n'])(
    'rejects arbitrary context %s',
    async (context) => {
      await expect(service.uploadImage({ ...input(), context })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(provider.upload).not.toHaveBeenCalled();
    },
  );
  it.each([
    '../logo.png',
    'logo.png',
    'images/../logo.png',
    '/images/file.png',
    'https://public.example/file.png',
    `${previousKey}\n`,
  ])('protects deletion, replacement and URLs against uncontrolled keys', async (key) => {
    await expect(service.delete(key)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.replace(key, input())).rejects.toBeInstanceOf(BadRequestException);
    expect(() => service.getPublicUrl(key)).toThrow(BadRequestException);
    expect(provider.delete).not.toHaveBeenCalled();
    expect(provider.upload).not.toHaveBeenCalled();
  });
  it('deletes a managed key and obtains its URL', async () => {
    await service.delete(previousKey);
    expect(provider.delete).toHaveBeenCalledWith(previousKey);
    expect(service.getPublicUrl(previousKey)).toContain(previousKey);
  });
  it('uploads before deleting during replacement', async () => {
    const result = await service.replace(previousKey, input());
    expect(result.cleanupPending).toBe(false);
    expect(result.key).not.toBe(previousKey);
    expect(provider.upload.mock.invocationCallOrder[0]).toBeLessThan(
      provider.delete.mock.invocationCallOrder[0],
    );
  });
  it('preserves the previous image when the new image is invalid or upload fails', async () => {
    await expect(
      service.replace(previousKey, { ...input(), mimeType: 'text/html' }),
    ).rejects.toThrow();
    provider.upload.mockRejectedValue(new Error('controlled upload failure'));
    await expect(service.replace(previousKey, input())).rejects.toThrow();
    expect(provider.delete).toHaveBeenCalledTimes(1);
    expect(provider.delete).not.toHaveBeenCalledWith(previousKey);
  });
  it('returns the new reference and a cleanup marker if deleting the previous image fails', async () => {
    provider.delete.mockRejectedValue(new Error('provider secret'));
    const result = await service.replace(previousKey, input());
    expect(result.cleanupPending).toBe(true);
    expect(result.previousKey).toBe(previousKey);
    expect(result.key).not.toBe(previousKey);
    expect(result.url).toContain(result.key);
    expect(warn.mock.calls).toEqual([
      [{ operation: 'replace-cleanup', provider: 'neon', key: previousKey }],
    ]);
  });
  it('preserves the original upload error if compensating cleanup also fails', async () => {
    provider.upload.mockRejectedValue(new Error('controlled upload failure'));
    provider.delete.mockRejectedValue(new Error('provider secret'));
    await expect(service.uploadImage(input())).rejects.toThrow('controlled upload failure');
    expect(warn.mock.calls).toEqual([
      [
        {
          operation: 'upload-cleanup',
          provider: 'neon',
          key: expect.stringMatching(/^images\//) as unknown,
        },
      ],
    ]);
  });
});
