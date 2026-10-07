import { EntityManager } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import {
  LEGACY_ACADEMIC_NAMESPACES,
  MEDISUR_PERMISSION_NAMES,
  MEDISUR_ROLES,
} from './access-control.catalog';

// Called inside a transaction. Repeated runs preserve existing role assignments.
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
    permissions.push(permission);
  }

  for (const definition of MEDISUR_ROLES) {
    const existing = await roleRepository.findOne({ where: { name: definition.name } });
    if (existing) continue;
    await roleRepository.save(
      roleRepository.create({
        ...definition,
        isActive: true,
        permissions: definition.name === 'SUPERADMIN' ? permissions : [],
      }),
    );
  }
}
