'use client';

import { useEffect, useState } from 'react';

import { Alert, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { schedulesService } from '@/services/schedules/schedulesService';
import type { Schedule, SchedulesPage } from '@/services/schedules/schedulesService';
import type { PaginationQuery } from '@/types/pagination';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import ScheduleRegistration from './ScheduleRegistration';
import tableStyles from '@core/styles/table.module.css';

export default function SchedulesManagement() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('schedule.update');
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [result, setResult] = useState<SchedulesPage | null>(null);
  const [completed, setCompleted] = useState<{ query: PaginationQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [success, setSuccess] = useState('');
  const loading = completed?.query !== query || completed?.refresh !== refresh;

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    schedulesService
      .mine(query)
      .then((page) => {
        if (!active) return;
        setError('');
        if (query.page > Math.max(1, page.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, page.meta.totalPages) });
        else setResult(page);
      })
      .catch((failure: unknown) => {
        if (active) {
          setResult(null);
          setError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setCompleted({ query, refresh });
      });
    return () => {
      active = false;
    };
  }, [allowed, query, refresh]);

  if (!allowed) return <Alert severity='warning'>No tienes permiso para modificar horarios.</Alert>;
  if (selected)
    return (
      <ScheduleRegistration
        key={selected.idSchedule}
        schedule={selected}
        onCancel={() => {
          setSelected(null);
          setRefresh((value) => value + 1);
        }}
        onSaved={() => {
          setSelected(null);
          setSuccess('Horario modificado correctamente');
          setRefresh((value) => value + 1);
        }}
      />
    );
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Mis horarios de atención</Typography>
          <Typography>
            Selecciona un bloque para revisar sus valores y modificarlo, desactivarlo o reactivarlo. Los horarios
            inactivos se conservan.
          </Typography>
          {success && <Alert severity='success'>{success}</Alert>}
          {loading ? (
            <CircularProgress aria-label='Cargando mis horarios' />
          ) : error ? (
            <Alert
              severity='error'
              action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
            >
              {error}
            </Alert>
          ) : (
            result && (
              <>
                {result.data.length === 0 ? (
                  <Typography>No tienes horarios registrados.</Typography>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Especialidad</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((schedule) => (
                          <tr key={schedule.idSchedule}>
                            <td>{schedule.date}</td>
                            <td>{schedule.specialtyName}</td>
                            <td>{schedule.startTime.slice(0, 5)}</td>
                            <td>{schedule.endTime.slice(0, 5)}</td>
                            <td>{schedule.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <Button
                                onClick={() => {
                                  if (hasPermission('schedule.update')) {
                                    setSuccess('');
                                    setSelected(schedule);
                                  }
                                }}
                              >
                                {`Modificar horario ${schedule.idSchedule}`}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ListPagination query={query} meta={result.meta} onChange={setQuery} />
              </>
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
