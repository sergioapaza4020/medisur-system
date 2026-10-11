import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from './validation.pipe';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { StatusQueryDto } from 'src/dtos/common/status-query.dto';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { UsersAssignRolesDto } from 'src/dtos/users/users-assign-roles.dto';

describe('HTTP validation', () => {
  const pipe = createValidationPipe();

  it('requires at least one role in creation and assignment, preserving multiple roles', async () => {
    const user = {
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123',
      password: 'secret',
    };
    for (const metatype of [UserCreateDto, UsersAssignRolesDto]) {
      const fields = metatype === UserCreateDto ? user : {};
      await expect(
        pipe.transform({ ...fields, roleNames: [] }, { type: 'body', metatype }),
      ).rejects.toBeInstanceOf(BadRequestException);
      for (const roleNames of [['STAFF'], ['DOCTOR', 'STAFF']]) {
        expect(await pipe.transform({ ...fields, roleNames }, { type: 'body', metatype })).toEqual({
          ...fields,
          roleNames,
        });
      }
    }
    await expect(
      pipe.transform({ roleNames: [] }, { type: 'body', metatype: UserUpdateDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('strips credentials from administrative updates but requires an initial creation password', async () => {
    for (const password of ['new-secret', '', null]) {
      expect(
        await pipe.transform(
          {
            name: 'Ana',
            password,
            passwordHash: 'hash',
            refreshToken: 'token',
            resetToken: 'reset',
          },
          { type: 'body', metatype: UserUpdateDto },
        ),
      ).toEqual({ name: 'Ana' });
    }
    await expect(
      pipe.transform(
        {
          name: 'Ana',
          lastname: 'Pérez',
          email: 'ana@example.com',
          ci: '123',
          roleNames: [],
        },
        { type: 'body', metatype: UserCreateDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps login credentials and removes unknown properties', async () => {
    const result: unknown = await pipe.transform(
      { email: ' TEST@example.com ', password: 'secret', isAdmin: true, username: 'obsolete' },
      { type: 'body', metatype: LoginDto },
    );
    expect(result).toEqual({ email: 'test@example.com', password: 'secret' });
    await expect(
      pipe.transform({ email: 'test@example.com' }, { type: 'body', metatype: LoginDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { password: 'secret' },
    { username: 'obsolete', password: 'secret' },
    { email: 'invalid', password: 'secret' },
    { email: '', password: 'secret' },
  ])('rejects missing or invalid login email: %j', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: LoginDto })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('defaults administrative lists to active and accepts all states', async () => {
    expect(await pipe.transform({}, { type: 'query', metatype: StatusQueryDto })).toEqual({
      status: 'active',
    });
    for (const status of ['active', 'inactive', 'all']) {
      expect(await pipe.transform({ status }, { type: 'query', metatype: StatusQueryDto })).toEqual(
        { status },
      );
    }
  });
});
