import { ConfigService } from '@nestjs/config';
import { storageConfig, StorageConfigurationError } from './storage.config';

describe('Storage configuration', () => {
  let environment: NodeJS.ProcessEnv;
  let config: ConfigService;
  beforeEach(() => {
    environment = { ...process.env };
    config = new ConfigService();
    for (const [key, value] of Object.entries({
      STORAGE_PROVIDER: 'neon',
      STORAGE_BUCKET: 'public-read',
      STORAGE_MAX_IMAGE_SIZE: '',
      AWS_ENDPOINT_URL_S3: 'https://br-test.storage.c-1.us-east-2.aws.neon.tech',
      AWS_REGION: 'us-east-2',
      AWS_ACCESS_KEY_ID: 'synthetic-access-id',
      AWS_SECRET_ACCESS_KEY: 'synthetic-test-secret',
    }))
      config.set(key, value);
  });
  afterEach(() => {
    process.env = environment;
  });
  it('uses backend configuration and a 5 MiB default without making network calls', () => {
    expect(storageConfig(config)).toMatchObject({
      bucket: 'public-read',
      region: 'us-east-2',
      maxImageSize: 5242880,
    });
    config.set('STORAGE_MAX_IMAGE_SIZE', '1024');
    expect(storageConfig(config).maxImageSize).toBe(1024);
  });
  it.each([
    'STORAGE_PROVIDER',
    'STORAGE_BUCKET',
    'AWS_ENDPOINT_URL_S3',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ])('rejects missing %s without disclosing other values', (name) => {
    config.set(name, '');
    expect(() => storageConfig(config)).toThrow(StorageConfigurationError);
    expect(() => storageConfig(config)).toThrow(name);
    expect(() => storageConfig(config)).not.toThrow('synthetic-test-secret');
  });
  it.each(['0', '-1', '1.5', 'text', '52428801', 'Infinity'])(
    'rejects invalid size %s',
    (value) => {
      config.set('STORAGE_MAX_IMAGE_SIZE', value);
      expect(() => storageConfig(config)).toThrow('STORAGE_MAX_IMAGE_SIZE');
    },
  );
  it.each([
    'http://br-test.storage.c-1.us-east-2.aws.neon.tech',
    'https://example.com',
    'https://neon.tech.evil.example',
    'https://user:secret@br-test.storage.c-1.us-east-2.aws.neon.tech',
    'https://br-test.storage.c-1.us-east-2.aws.neon.tech/bucket',
    'https://br-test.storage.c-1.us-east-2.aws.neon.tech?token=secret',
  ])('rejects unsafe or non-Neon endpoints', (endpoint) => {
    config.set('AWS_ENDPOINT_URL_S3', endpoint);
    expect(() => storageConfig(config)).toThrow('AWS_ENDPOINT_URL_S3');
  });
  it('rejects unsupported providers, invalid buckets, and mismatched regions', () => {
    config.set('STORAGE_PROVIDER', 's3');
    expect(() => storageConfig(config)).toThrow('STORAGE_PROVIDER');
    config.set('STORAGE_PROVIDER', 'neon');
    config.set('STORAGE_BUCKET', '../public-read');
    expect(() => storageConfig(config)).toThrow('STORAGE_BUCKET');
    config.set('STORAGE_BUCKET', 'public-read');
    config.set('AWS_REGION', 'eu-central-1');
    expect(() => storageConfig(config)).toThrow('AWS_REGION');
  });
});
