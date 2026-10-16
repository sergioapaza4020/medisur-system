import { ConfigService } from '@nestjs/config';

export const STORAGE_CONFIG = Symbol('STORAGE_CONFIG');
export class StorageConfigurationError extends Error {}

export function storageConfig(config: ConfigService) {
  const invalid = (name: string): never => {
    throw new StorageConfigurationError(`Configuración de almacenamiento inválida: ${name}`);
  };
  const required = (name: string) => {
    const value = config.get<string>(name)?.trim();
    if (!value || /\s/.test(value)) return invalid(name);
    return value;
  };
  if (required('STORAGE_PROVIDER') !== 'neon') invalid('STORAGE_PROVIDER');
  const bucket = required('STORAGE_BUCKET');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes('..'))
    invalid('STORAGE_BUCKET');
  const endpoint = required('AWS_ENDPOINT_URL_S3');
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.neon.tech') ||
      !url.hostname.includes('.storage.') ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      invalid('AWS_ENDPOINT_URL_S3');
  } catch {
    invalid('AWS_ENDPOINT_URL_S3');
  }
  const region = required('AWS_REGION');
  if (
    !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region) ||
    !new URL(endpoint).hostname.includes(`.${region}.`)
  )
    invalid('AWS_REGION');
  const accessKeyId = required('AWS_ACCESS_KEY_ID');
  const secretAccessKey = required('AWS_SECRET_ACCESS_KEY');
  const maxImageSize = Number(config.get<string>('STORAGE_MAX_IMAGE_SIZE') || '5242880');
  if (!Number.isSafeInteger(maxImageSize) || maxImageSize < 1 || maxImageSize > 50 * 1024 * 1024)
    invalid('STORAGE_MAX_IMAGE_SIZE');
  return { bucket, endpoint, region, accessKeyId, secretAccessKey, maxImageSize };
}

export type StorageConfig = ReturnType<typeof storageConfig>;
