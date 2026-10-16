import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { StorageModule } from './modules/storage/storage.module';
import { StorageService } from './services/storage/storage.service';
import { StorageConfigurationError } from './services/storage/storage.config';
import { storageTestImage } from './common/test-mocks/storage-image.mock';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '..', '.env') }),
    StorageModule,
  ],
})
class StorageTestModule {}

async function checkUnavailable(url: string): Promise<void> {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  await response.body?.cancel();
  if (![403, 404, 410].includes(response.status))
    throw new Error('Deleted image still available or provider unavailable');
}

export async function runStorageTest() {
  const app = await NestFactory.createApplicationContext(StorageTestModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  const storage = app.get(StorageService);
  const created = new Set<string>();
  let cleanupFailed = false;
  let failure: unknown;
  let result:
    | {
        connection: string;
        upload: string;
        publicRead: string;
        exactBytes: boolean;
        replace: string;
        delete: string;
        unavailableAfterDelete: boolean;
        previewPath: string;
      }
    | undefined;
  try {
    const buffer = storageTestImage();
    const image = await storage.uploadImage({
      buffer,
      mimeType: 'image/png',
      context: 'storage-test',
    });
    created.add(image.key);
    const response = await fetch(image.url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png')
      throw new Error('Public image read failed');
    const downloaded = Buffer.from(await response.arrayBuffer());
    if (!downloaded.equals(buffer)) throw new Error('Image bytes changed');
    const previewPath = join(tmpdir(), `medisur-storage-${randomUUID()}.png`);
    await writeFile(previewPath, downloaded);
    const replacement = await storage.replace(image.key, {
      buffer,
      mimeType: 'image/png',
      context: 'storage-test',
    });
    created.add(replacement.key);
    if (replacement.cleanupPending) throw new Error('Previous image cleanup failed');
    created.delete(image.key);
    await checkUnavailable(image.url);
    const replacementResponse = await fetch(replacement.url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!replacementResponse.ok) throw new Error('Replacement image read failed');
    await replacementResponse.body?.cancel();
    await storage.delete(replacement.key);
    await storage.delete(replacement.key); // Idempotency, without touching pre-existing objects.
    created.delete(replacement.key);
    await checkUnavailable(replacement.url);
    result = {
      connection: 'ok',
      upload: 'ok',
      publicRead: 'ok',
      exactBytes: true,
      replace: 'ok',
      delete: 'ok',
      unavailableAfterDelete: true,
      previewPath,
    };
  } catch (error: unknown) {
    failure = error;
  } finally {
    for (const key of created) {
      try {
        await storage.delete(key);
      } catch {
        cleanupFailed = true;
        console.error(`No se pudo limpiar el objeto de prueba: ${key}`);
      }
    }
    await app.close();
  }
  if (failure instanceof Error) throw failure;
  if (failure !== undefined) throw new Error('Storage test failed');
  if (cleanupFailed) throw new Error('Test cleanup failed');
  if (!result) throw new Error('Test did not complete');
  return result;
}

if (require.main === module) {
  void runStorageTest()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(
        error instanceof StorageConfigurationError
          ? error.message
          : 'Falló la prueba de almacenamiento. Revisa configuración, permisos y disponibilidad del proveedor.',
      );
      process.exitCode = 1;
    });
}
