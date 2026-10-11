import { EntityManager } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import {
  LEGACY_ACADEMIC_NAMESPACES,
  MEDISUR_PERMISSION_NAMES,
  MEDISUR_ROLES,
} from './access-control.catalog';

// Called inside a transaction. Repeated runs repair administrative grants only.
export async function seedAccessControl(manager: EntityManager) {
  const permissionRepository = manager.getRepository(Permission);
  const roleRepository = manager.getRepository(Role);

  for (const permission of await permissionRepository.find()) {
    if (LEGACY_ACADEMIC_NAMESPACES.includes(permission.name.split('.')[0])) {
      permission.isActive = false;
      await permissionRepository.save(permission);
    }
  }

  const permissions: Permission[] = [];
  for (const name of MEDISUR_PERMISSION_NAMES) {
    let permission = await permissionRepository.findOne({ where: { name } });
    if (!permission) {
      permission = await permissionRepository.save(
        permissionRepository.create({
          name,
          description: `MEDISUR: ${name}`,
          isActive: true,
        }),
      );
    }
    // The current catalog contains administrative resources only. Do not grant
    // custom permissions from the database or reactivate disabled capabilities.
    if (permission.isActive) permissions.push(permission);
  }

  for (const definition of MEDISUR_ROLES) {
    const existing = await roleRepository.findOne({
      where: { name: definition.name },
      relations: { permissions: true },
    });
    if (existing) {
      if (definition.name === 'SUPERADMIN') {
        const assigned = new Set(existing.permissions.map((permission) => permission.name));
        const missing = permissions.filter((permission) => !assigned.has(permission.name));
        if (missing.length) {
          existing.permissions = [...existing.permissions, ...missing];
          await roleRepository.save(existing);
        }
      }
      continue;
    }
    await roleRepository.save(
      roleRepository.create({
        ...definition,
        isActive: true,
        permissions: definition.name === 'SUPERADMIN' ? permissions : [],
      }),
    );
  }
}
