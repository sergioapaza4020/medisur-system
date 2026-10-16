import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from 'src/services/storage/storage.service';

@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  private readonly upload: NestInterceptor;

  constructor(storage: StorageService) {
    const Interceptor = FileInterceptor('avatar', {
      limits: { fileSize: storage.getImagePolicy().maxSize, files: 1, fields: 0 },
    });
    this.upload = new Interceptor();
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    return this.upload.intercept(context, next);
  }
}
