'use client';

import { useEffect, useState } from 'react';

import { Alert, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { doctorsService } from '@/services/doctors/doctorsService';
import type { DoctorSelectionPage, SpecialtySelection, SpecialtySelectionPage } from '@/types/doctors';
import type { PaginationQuery } from '@/types/pagination';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import tableStyles from '@core/styles/table.module.css';

export default function DoctorsBySpecialty() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('doctor.get-by-specialty');
  const [specialtyQuery, setSpecialtyQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [specialties, setSpecialties] = useState<SpecialtySelectionPage | null>(null);
  const [specialtiesCompleted, setSpecialtiesCompleted] = useState<{ query: PaginationQuery; refresh: number } | null>(
    null,
  );
  const [specialtiesRefresh, setSpecialtiesRefresh] = useState(0);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SpecialtySelection | null>(null);
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [doctors, setDoctors] = useState<DoctorSelectionPage | null>(null);
  const [completed, setCompleted] = useState<{
    query: PaginationQuery;
    specialty: SpecialtySelection;
    refresh: number;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const specialtiesLoading =
    specialtiesCompleted?.query !== specialtyQuery || specialtiesCompleted?.refresh !== specialtiesRefresh;
  const loading = completed?.query !== query || completed?.specialty !== selected || completed?.refresh !== refresh;

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    doctorsService
      .selectionSpecialties(specialtyQuery)
      .then((result) => {
        if (!active) return;
        setSpecialtiesError(null);
        if (specialtyQuery.page > Math.max(1, result.meta.totalPages))
          setSpecialtyQuery({ ...specialtyQuery, page: Math.max(1, result.meta.totalPages) });
        else setSpecialties(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setSpecialties(null);
          setSpecialtiesError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setSpecialtiesCompleted({ query: specialtyQuery, refresh: specialtiesRefresh });
      });
    return () => {
      active = false;
    };
  }, [allowed, specialtyQuery, specialtiesRefresh]);

  useEffect(() => {
    if (!allowed || !selected) return;
    let active = true;
    doctorsService
      .bySpecialty(selected.idSpecialty, query)
      .then((result) => {
        if (!active) return;
        setError(null);
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, result.meta.totalPages) });
        else setDoctors(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setDoctors(null);
          setError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setCompleted({ query, specialty: selected, refresh });
      });
    return () => {
      active = false;
    };
  }, [allowed, selected, query, refresh]);

  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar médicos por especialidad.</Alert>;
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Médicos por especialidad</Typography>
          <Typography>
            Selecciona una especialidad para consultar sus profesionales activos. La consulta no indica horarios ni
            turnos disponibles.
          </Typography>
          <Typography variant='h6'>Especialidades activas</Typography>
          {specialtiesLoading ? (
            <CircularProgress aria-label='Cargando especialidades' />
          ) : specialtiesError ? (
            <Alert
              severity='error'
              action={
                <Button onClick={() => setSpecialtiesRefresh((value) => value + 1)}>Reintentar especialidades</Button>
              }
            >
              {specialtiesError}
            </Alert>
          ) : (
            specialties && (
              <>
                <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                  {specialties.data.map((specialty) => (
                    <Button
                      key={specialty.idSpecialty}
                      variant={selected?.idSpecialty === specialty.idSpecialty ? 'contained' : 'outlined'}
                      onClick={() => {
                        if (!hasPermission('doctor.get-by-specialty')) return;
                        setSelected(specialty);
                        setQuery((current) => ({ ...current, page: 1 }));
                        setError(null);
                      }}
                    >
                      {specialty.name}
                    </Button>
                  ))}
                </Stack>
                {specialties.data.length === 0 && <Typography>No hay especialidades activas disponibles.</Typography>}
                <ListPagination
                  query={specialtyQuery}
                  meta={specialties.meta}
                  onChange={setSpecialtyQuery}
                  labelRowsPerPage='Especialidades por página'
                />
              </>
            )
          )}
          {!selected ? (
            <Typography>Selecciona una especialidad.</Typography>
          ) : (
            <>
              <Typography variant='h6'>Médicos de {selected.name}</Typography>
              {loading ? (
                <CircularProgress aria-label='Cargando médicos' />
              ) : error ? (
                <Alert
                  severity='error'
                  action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar médicos</Button>}
                >
                  {error}
                </Alert>
              ) : (
                doctors && (
                  <>
                    <div className='overflow-x-auto'>
                      <table className={tableStyles.table}>
                        <thead>
                          <tr>
                            <th>Profesional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doctors.data.map((doctor) => (
                            <tr key={doctor.idDoctor}>
                              <td>
                                {doctor.name} {doctor.lastname}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {doctors.data.length === 0 && (
                      <Typography>No hay médicos activos asociados a esta especialidad.</Typography>
                    )}
                    <ListPagination
                      query={query}
                      meta={doctors.meta}
                      onChange={setQuery}
                      labelRowsPerPage='Médicos por página'
                    />
                  </>
                )
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
