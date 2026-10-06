import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { instanceToPlain } from 'class-transformer';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        const statusCode = response.statusCode;

        return {
          status: true,
          statusCode,
          message: this.extractMessage(data),
          data: this.sanitize(this.extractData(data)),
          ...(typeof data === 'object' && data !== null && 'meta' in data
            ? { meta: this.sanitize(data.meta) }
            : {}),
        };
      }),
    );
  }

  private sanitize(value: unknown): unknown {
    // Honor entity exclusions, including entities returned directly by save().
    const plain: unknown = instanceToPlain(value);
    return this.omitPasswords(plain);
  }

  private omitPasswords(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item: unknown) => this.omitPasswords(item));
    if (value instanceof Date) return value;
    if (typeof value !== 'object' || value === null) return value;
    // Projections and nested plain objects do not carry entity decorators.
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'password')
        .map(([key, item]: [string, unknown]) => [key, this.omitPasswords(item)]),
    );
  }

  private extractMessage(data: unknown): string | undefined {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = data.message;

      if (typeof message === 'string') return message;
    }

    return undefined;
  }

  private extractData(data: unknown): unknown {
    if (typeof data === 'object' && data !== null && 'data' in data) {
      return data.data;
    }

    return data;
  }
}
