import { EntityManager } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { seedAccessControl } from './access-control.seeder';
import { MEDISUR_PERMISSION_NAMES, MEDISUR_ROLES } from './access-control.catalog';

function repository<T extends { name: string }>() {
  const records: T[] = [];
  return {
    records,
    find: jest.fn(() => Promise.resolve([...records])),
    findOne: jest.fn(({ where }: { where: { name: string } }) =>
      Promise.resolve(records.find((r) => r.name === where.name) ?? null),
    ),
    create: jest.fn((item: T) => item),
    save: jest.fn((item: T) => {
      if (!records.includes(item)) records.push(item);
      return Promise.resolve(item);
    }),
  };
}

describe('MEDISUR access seed', () => {
  it('reproduces the minimum catalog, preserves assignments, and retires academic permissions', async () => {
    const permissions = repository<Permission>();
    const roles = repository<Role>();
    const academic = { name: 'course.create', isActive: true } as Permission;
    const custom = { name: 'custom.read', isActive: true } as Permission;
    permissions.records.push(academic, custom);
    const manager = {
      getRepository: (entity: unknown) => (entity === Permission ? permissions : roles),
    } as unknown as EntityManager;

    await seedAccessControl(manager);
    expect(roles.records.map((r) => r.name)).toEqual(MEDISUR_ROLES.map((r) => r.name));
    expect(permissions.records.filter((p) => p.isActive).map((p) => p.name)).toEqual([
      'custom.read',
      ...MEDISUR_PERMISSION_NAMES,
    ]);
    expect(academic.isActive).toBe(false);
    const admin = roles.records.find((r) => r.name === 'SUPERADMIN')!;
    expect(admin.permissions.map((p) => p.name)).toEqual(MEDISUR_PERMISSION_NAMES);
    for (const role of roles.records.filter((r) => r.name !== 'SUPERADMIN')) {
      expect(role.permissions).toEqual([]);
    }

    // Re-running cannot silently restore capabilities revoked by an administrator.
    admin.permissions = [];
    const staff = roles.records.find((r) => r.name === 'STAFF')!;
    staff.permissions = [custom];
    permissions.records.find((p) => p.name === 'role.update')!.isActive = false;
    await seedAccessControl(manager);
    expect(roles.records).toHaveLength(4);
    expect(permissions.records).toHaveLength(MEDISUR_PERMISSION_NAMES.length + 2);
    expect(admin.permissions).toEqual([]);
    expect(staff.permissions).toEqual([custom]);
    expect(permissions.records.find((p) => p.name === 'role.update')!.isActive).toBe(false);
  });
});
