import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { STORAGE_CONFIG, storageConfig } from 'src/services/storage/storage.config';
import type { StorageConfig } from 'src/services/storage/storage.config';
import { StorageProvider } from 'src/services/storage/storage.provider';
import { NeonStorageProvider, NEON_S3_CLIENT } from 'src/services/storage/neon-storage.provider';
import { StorageService } from 'src/services/storage/storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: STORAGE_CONFIG, useFactory: storageConfig, inject: [ConfigService] },
    {
      provide: NEON_S3_CLIENT,
      inject: [STORAGE_CONFIG],
      useFactory: (config: StorageConfig) =>
        new S3Client({
          endpoint: config.endpoint,
          region: config.region,
          forcePathStyle: true,
          credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
          maxAttempts: 2,
          requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
        }),
    },
    { provide: StorageProvider, useClass: NeonStorageProvider },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
