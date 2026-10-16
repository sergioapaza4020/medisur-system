import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import * as files from 'fs/promises';
import { runStorageTest } from './storage-test';
import { storageTestImage } from './common/test-mocks/storage-image.mock';

jest.mock('fs/promises', () => ({ writeFile: jest.fn() }));

describe('Internal storage smoke test', () => {
  const first = { key: 'images/storage-test/first.png', url: 'https://public.example/first.png' };
  const second = {
    key: 'images/storage-test/second.png',
    url: 'https://public.example/second.png',
    cleanupPending: false,
  };
  const storage = { uploadImage: jest.fn(), replace: jest.fn(), delete: jest.fn() };
  const close = jest.fn();
  let request: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    storage.uploadImage.mockResolvedValue(first);
    storage.replace.mockResolvedValue(second);
    storage.delete.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);
    jest.mocked(files.writeFile).mockResolvedValue(undefined);
    jest
      .spyOn(NestFactory, 'createApplicationContext')
      .mockResolvedValue({ get: () => storage, close } as unknown as INestApplicationContext);
    request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(storageTestImage(), { headers: { 'Content-Type': 'image/png' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(storageTestImage()))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
  });
  afterEach(() => jest.restoreAllMocks());
  it('checks public bytes, replacement and idempotent deletion, then closes the SDK context', async () => {
    const result = await runStorageTest();
    expect(result).toMatchObject({
      connection: 'ok',
      upload: 'ok',
      publicRead: 'ok',
      exactBytes: true,
      replace: 'ok',
      delete: 'ok',
      unavailableAfterDelete: true,
    });
    expect(storage.delete.mock.calls).toEqual([[second.key], [second.key]]);
    expect(files.writeFile).toHaveBeenCalledWith(result.previewPath, storageTestImage());
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('cleans up only its own object if public reading fails', async () => {
    request.mockReset().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(runStorageTest()).rejects.toThrow('Public image read failed');
    expect(storage.delete).toHaveBeenCalledWith(first.key);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('cleans up both new and previous test images when replacement reports incomplete cleanup', async () => {
    storage.replace.mockResolvedValue({ ...second, cleanupPending: true });
    await expect(runStorageTest()).rejects.toThrow('Previous image cleanup failed');
    expect(storage.delete.mock.calls).toEqual([[first.key], [second.key]]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
