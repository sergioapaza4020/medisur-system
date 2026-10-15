import { BadRequestException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { SpecialtiesService } from './specialties.service';
import { SpecialtiesQueryDto } from 'src/dtos/specialties/specialties.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';

describe('SpecialtiesService', () => {
  const qb = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value: Partial<Specialty>) => value),
    save: jest.fn(),
  };
  const service = new SpecialtiesService(repository as unknown as Repository<Specialty>);
  let specialty: Specialty;

  beforeEach(() => {
    jest.clearAllMocks();
    specialty = { idSpecialty: 1, name: 'Cardiología', isActive: true, createdBy: 7 } as Specialty;
    repository.findOne.mockResolvedValue(specialty);
    repository.save.mockImplementation((value: Specialty) => Promise.resolve(value));
    repository.find.mockResolvedValue([]);
    qb.getManyAndCount.mockResolvedValue([[specialty], 1]);
  });

  it('normalizes names, starts active and records the author', async () => {
    expect(await service.create({ name: '  Medicina   interna  ' }, 7)).toMatchObject({
      name: 'Medicina Interna',
      isActive: true,
      createdBy: 7,
    });
    expect(repository.find).toHaveBeenCalledWith({
      select: { idSpecialty: true, name: true },
      withDeleted: true,
    });
  });

  it('publishes only active specialty names with bounded pagination, ignoring state overrides', async () => {
    const result = await service.getPublicPage({
      page: 1,
      limit: 8,
      status: 'all',
    } as SpecialtiesQueryDto);
    expect(result.data).toEqual([{ idSpecialty: 1, name: 'Cardiología' }]);
    expect(qb.andWhere).toHaveBeenCalledWith('specialty.isActive = :isActive', { isActive: true });
    expect(qb.take).toHaveBeenCalledWith(8);
    expect(JSON.stringify(result)).not.toMatch(/createdBy|isActive/);
  });

  it('rejects duplicate active, inactive and soft deleted names', async () => {
    for (const isActive of [true, false]) {
      repository.find.mockResolvedValue([{ ...specialty, isActive }]);
      await expect(service.create({ name: 'CARDIOLOGÍA' }, 7)).rejects.toThrow(
        'La especialidad ya existe',
      );
    }
    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each(['cardiologia', 'CARDIOLOGÍA', ' CARDIOLOGIA ', 'cardiología'])(
    'rejects accent and case equivalent name %s on create and update',
    async (name) => {
      repository.find.mockResolvedValue([specialty]);
      await expect(service.create({ name }, 7)).rejects.toThrow('La especialidad ya existe');
      await expect(service.update(2, { name }, 7)).rejects.toThrow('La especialidad ya existe');
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('compares spaces in existing names and excludes only the edited record', async () => {
    repository.find.mockResolvedValue([{ ...specialty, name: ' Medicina   Interna ' }]);
    await expect(service.create({ name: 'Medicina Interna' }, 7)).rejects.toThrow(
      'La especialidad ya existe',
    );
    repository.find.mockResolvedValue([
      specialty,
      { ...specialty, idSpecialty: 2, name: 'Cardiologia' },
    ]);
    await expect(service.update(1, { name: ' CARDIOLOGÍA ' }, 7)).rejects.toThrow(
      'La especialidad ya existe',
    );
  });

  it.each([
    ['  enFERmedad Del corazon', 'Enfermedad Del Corazon'],
    ['MEDICINA INTERNA', 'Medicina Interna'],
    ['cardiología', 'Cardiología'],
    ['  cirugía   cardiovascular  ', 'Cirugía Cardiovascular'],
  ])('stores formatted name %s', async (name, expected) => {
    expect(await service.create({ name }, 7)).toMatchObject({ name: expected });
  });
  it('rejects an empty or oversized name', async () => {
    for (const name of ['   ', 'a'.repeat(101)])
      await expect(service.create({ name }, 7)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows renaming itself and rejects another specialty name', async () => {
    repository.find.mockResolvedValue([specialty]);
    expect(await service.update(1, { name: 'CARDIOLOGÍA' }, 8)).toMatchObject({
      name: 'Cardiología',
      updatedBy: 8,
    });
    repository.find.mockResolvedValue([{ ...specialty, name: 'Neurología', idSpecialty: 2 }]);
    await expect(service.update(1, { name: 'Neurología' }, 8)).rejects.toThrow(
      'La especialidad ya existe',
    );
  });

  it('maps database concurrent uniqueness failures and propagates other errors', async () => {
    repository.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], {
        code: '23505',
        constraint: 'UQ_specialties_name',
      } as unknown as Error),
    );
    await expect(service.create({ name: 'Neurología' }, 7)).rejects.toThrow(
      'La especialidad ya existe',
    );
    const failure = new Error('database unavailable');
    repository.save.mockRejectedValueOnce(failure);
    await expect(service.create({ name: 'Neurología' }, 7)).rejects.toBe(failure);
  });

  it('paginates active specialties by default and escapes literal search characters', async () => {
    const query = Object.assign(new SpecialtiesQueryDto(), {
      page: 2,
      limit: 25,
      search: '50%_\\',
    });
    const result = await service.getAll(query);
    expect(qb.andWhere).toHaveBeenCalledWith('specialty.isActive = :isActive', { isActive: true });
    expect(qb.andWhere).toHaveBeenCalledWith('specialty.name ILIKE :search', {
      search: '%50\\%\\_\\\\%',
    });
    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(result.meta).toEqual({ page: 2, limit: 25, total: 1, totalPages: 1 });
  });

  it('supports administrative inactive/all filters and empty results', async () => {
    await service.getAll(
      Object.assign(new SpecialtiesQueryDto(), { status: RecordStatus.INACTIVE }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith('specialty.isActive = :isActive', { isActive: false });
    qb.andWhere.mockClear();
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    expect(
      await service.getAll(Object.assign(new SpecialtiesQueryDto(), { status: RecordStatus.ALL })),
    ).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('deactivates without deleting, preserves identity and creation audit, and reactivates', async () => {
    expect(await service.deactivate(1, 8)).toMatchObject({
      idSpecialty: 1,
      name: 'Cardiología',
      isActive: false,
      createdBy: 7,
      updatedBy: 8,
      deletedBy: 8,
    });
    expect(await service.reactivate(1, 9)).toMatchObject({
      idSpecialty: 1,
      isActive: true,
      createdBy: 7,
      updatedBy: 9,
    });
  });

  it('excludes inactive specialties when resolving operational selections', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.getActiveById(1)).rejects.toThrow('Especialidad activa no encontrada');
    expect(repository.findOne).toHaveBeenCalledWith({ where: { idSpecialty: 1, isActive: true } });
    expect(await service.getActiveById(1)).toBe(specialty);
  });

  it('rejects updates and state changes for unknown IDs', async () => {
    repository.findOne.mockResolvedValue(null);
    for (const operation of [
      service.update(99, { name: 'Otra' }, 7),
      service.deactivate(99, 7),
      service.reactivate(99, 7),
    ])
      await expect(operation).rejects.toThrow('Especialidad no encontrada');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
