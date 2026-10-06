import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { firstValueFrom, of } from 'rxjs';
import { User } from 'src/entities/users/users.entity';

function responseFor(data: unknown) {
  return firstValueFrom(
    new ResponseInterceptor().intercept(new ExecutionContextHost([{}, { statusCode: 200 }]), {
      handle: () => of(data),
    }),
  );
}

describe('ResponseInterceptor', () => {
  it('should be defined', () => {
    expect(new ResponseInterceptor()).toBeDefined();
  });

  it.each([null, 'ok', [1, 2], { id: 1 }])('preserves unwrapped responses: %p', async (data) => {
    expect(await responseFor(data)).toEqual({
      status: true,
      statusCode: 200,
      message: undefined,
      data,
    });
  });

  it('preserves the existing envelope and pagination metadata without nesting data', async () => {
    const meta = { page: 2, limit: 20, total: 25, totalPages: 2 };
    expect(await responseFor({ message: 'Users', data: [{ idUser: 21 }], meta })).toEqual({
      status: true,
      statusCode: 200,
      message: 'Users',
      data: [{ idUser: 21 }],
      meta,
    });
  });

  it('preserves the domain preview summary, operationId, page and metadata inside its envelope', async () => {
    const preview = {
      operationId: 'b73a79d0-02ca-4a3a-8a47-5516cae13e47',
      total: 10000,
      valid: 9997,
      invalid: 3,
      data: [{ row: 2, name: 'Carlos', valid: false, errors: ['RU duplicado'] }],
      meta: { page: 1, limit: 25, total: 3, totalPages: 1 },
    };
    expect(await responseFor({ data: preview })).toEqual({
      status: true,
      statusCode: 200,
      message: undefined,
      data: preview,
    });
  });

  it('preserves the durable operation status inside the 202 envelope', async () => {
    const execution = {
      operationId: 'operation',
      status: 'IMPORTING',
      total: 10000,
      processed: 250,
      failed: 0,
      progress: 2.5,
      startedAt: new Date(),
      completedAt: null,
    };
    const result = await firstValueFrom(
      new ResponseInterceptor().intercept(new ExecutionContextHost([{}, { statusCode: 202 }]), {
        handle: () => of(execution),
      }),
    );
    expect(result).toEqual({ status: true, statusCode: 202, message: undefined, data: execution });
  });

  it('removes passwords from saved entities, projections and nested sessions without mutating them', async () => {
    const createdAt = new Date('2026-01-01');
    const entity = Object.assign(new User(), { idUser: 1, password: 'hash', createdAt });
    const result = await responseFor({
      data: { user: entity, sessions: [{ user: { password: 'hash', username: 'test' } }] },
    });
    expect(result).toEqual({
      status: true,
      statusCode: 200,
      message: undefined,
      data: { user: { idUser: 1, createdAt }, sessions: [{ user: { username: 'test' } }] },
    });
    expect(entity.password).toBe('hash');
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
