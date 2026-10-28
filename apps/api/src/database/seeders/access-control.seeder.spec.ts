import { EntityManager } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { seedAccessControl } from './access-control.seeder';
import {
  MEDISUR_PERMISSION_NAMES,
  MEDISUR_ROLES,
  MEDISUR_STAFF_PERMISSION_NAMES,
  MEDISUR_PATIENT_PERMISSION_NAMES,
  MEDISUR_CLINICAL_PERMISSION_NAMES,
} from './access-control.catalog';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { UsersController } from 'src/controllers/users/users.controller';

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
    expect(admin.permissions.map((p) => p.name)).toEqual(
      MEDISUR_PERMISSION_NAMES.filter((name) => !MEDISUR_CLINICAL_PERMISSION_NAMES.includes(name)),
    );
    expect(admin.permissions.some(({ name }) => name === 'encounter.create')).toBe(false);
    expect(admin.permissions.some((permission) => permission.name === 'user.create-patient')).toBe(
      true,
    );
    expect(admin.permissions).not.toContain(custom);
    const context = new ExecutionContextHost(
      [{ user: { roles: [admin.name], permissions: admin.permissions.map((p) => p.name) } }],
      UsersController,
      Object.getOwnPropertyDescriptor(UsersController.prototype, 'getAll')!.value as () => void,
    );
    expect(new PermissionsGuard(new Reflector()).canActivate(context)).toBe(true);
    for (const role of roles.records.filter((r) => r.name !== 'SUPERADMIN')) {
      expect(role.permissions.map(({ name }) => name)).toEqual(
        role.name === 'STAFF'
          ? MEDISUR_PERMISSION_NAMES.filter((name) => MEDISUR_STAFF_PERMISSION_NAMES.includes(name))
          : role.name === 'PATIENT'
            ? MEDISUR_PATIENT_PERMISSION_NAMES
            : role.name === 'DOCTOR'
              ? [
                  'encounter.create',
                  'appointment.get-agenda',
                  'appointment.cancel-as-doctor',
                  'appointment.propose-rescheduling',
                  'schedule.create',
                  'schedule.update',
                ]
              : [],
      );
    }

    // Re-running repairs missing grants without reactivating disabled permissions.
    admin.permissions = [];
    const staff = roles.records.find((r) => r.name === 'STAFF')!;
    staff.permissions = [custom];
    permissions.records.find((p) => p.name === 'role.update')!.isActive = false;
    await seedAccessControl(manager);
    expect(roles.records).toHaveLength(4);
    expect(permissions.records).toHaveLength(MEDISUR_PERMISSION_NAMES.length + 2);
    expect(admin.permissions.map((p) => p.name)).toEqual(
      MEDISUR_PERMISSION_NAMES.filter(
        (name) => name !== 'role.update' && !MEDISUR_CLINICAL_PERMISSION_NAMES.includes(name),
      ),
    );
    expect(staff.permissions.map(({ name }) => name)).toEqual([
      'custom.read',
      ...MEDISUR_PERMISSION_NAMES.filter((name) => MEDISUR_STAFF_PERMISSION_NAMES.includes(name)),
    ]);
    expect(permissions.records.find((p) => p.name === 'role.update')!.isActive).toBe(false);
    const saves = roles.save.mock.calls.length;
    await seedAccessControl(manager);
    expect(roles.save).toHaveBeenCalledTimes(saves);
    expect(new Set(admin.permissions.map((p) => p.name)).size).toBe(admin.permissions.length);
  });

  it('repairs an existing SUPERADMIN and preserves explicit custom grants and role status', async () => {
    const permissions = repository<Permission>();
    const roles = repository<Role>();
    const custom = { name: 'custom.read', isActive: true } as Permission;
    permissions.records.push(custom);
    const admin = {
      name: 'SUPERADMIN',
      isActive: false,
      permissions: [custom],
    } as Role;
    roles.records.push(admin);
    const manager = {
      getRepository: (entity: unknown) => (entity === Permission ? permissions : roles),
    } as unknown as EntityManager;

    await seedAccessControl(manager);
    await seedAccessControl(manager);

    expect(admin.permissions.map((p) => p.name)).toEqual([
      'custom.read',
      ...MEDISUR_PERMISSION_NAMES.filter(
        (name) => !MEDISUR_CLINICAL_PERMISSION_NAMES.includes(name),
      ),
    ]);
    expect(admin.isActive).toBe(false);
    expect(roles.records.filter((role) => role.name === 'SUPERADMIN')).toHaveLength(1);
    expect(roles.findOne).toHaveBeenCalledWith({
      where: { name: 'SUPERADMIN' },
      relations: { permissions: true },
    });
  });

  it('repairs patient consultation grants and preserves custom or disabled permissions', async () => {
    const permissions = repository<Permission>();
    const roles = repository<Role>();
    const custom = { name: 'custom.read', isActive: true } as Permission;
    const consultation = { name: 'doctor.get-by-specialty', isActive: true } as Permission;
    permissions.records.push(custom, consultation);
    const patient = { name: 'PATIENT', isActive: true, permissions: [custom] } as Role;
    roles.records.push(patient);
    const manager = {
      getRepository: (entity: unknown) => (entity === Permission ? permissions : roles),
    } as unknown as EntityManager;
    await seedAccessControl(manager);
    await seedAccessControl(manager);
    expect(patient.permissions.map(({ name }) => name)).toEqual([
      'custom.read',
      'appointment.create',
      'appointment.get-mine',
      'appointment.cancel-mine',
      'appointment.respond-rescheduling',
      'schedule.get-availability',
      'doctor.get-by-specialty',
    ]);
    expect(
      patient.permissions.some(({ name }) =>
        ['doctor.get-all', 'specialty.get-all'].includes(name),
      ),
    ).toBe(false);
    patient.permissions = [custom];
    consultation.isActive = false;
    permissions.records.find(({ name }) => name === 'appointment.cancel-mine')!.isActive = false;
    permissions.records.find(({ name }) => name === 'appointment.respond-rescheduling')!.isActive =
      false;
    permissions.records.find(({ name }) => name === 'appointment.get-mine')!.isActive = false;
    permissions.records.find(({ name }) => name === 'appointment.create')!.isActive = false;
    permissions.records.find(({ name }) => name === 'schedule.get-availability')!.isActive = false;
    await seedAccessControl(manager);
    expect(patient.permissions).toEqual([custom]);
    expect(consultation.isActive).toBe(false);
  });
});
