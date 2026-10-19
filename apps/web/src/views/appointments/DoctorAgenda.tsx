'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import type { AppointmentStatus } from '@/types/appointments';
import type { DoctorAgendaPage, DoctorAgendaQuery } from '@/types/doctor-agenda';
import { boliviaToday } from '@/views/schedules/availabilityDates';
import { appointmentStatusLabels } from '@/types/appointments';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import tableStyles from '@core/styles/table.module.css';

export default function DoctorAgenda() {
  const { user, hasPermission } = useAuth();
  const idUser = user?.idUser;
  const allowed = Boolean(idUser && hasPermission('appointment.get-agenda'));
  const [query, setQuery] = useState<DoctorAgendaQuery>({ page: 1, limit: 10, date: boliviaToday() });
  const [result, setResult] = useState<DoctorAgendaPage | null>(null);
  const [completed, setCompleted] = useState<{
    query: DoctorAgendaQuery;
    refresh: number;
    idUser: number | undefined;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const loading = completed?.query !== query || completed?.refresh !== refresh || completed?.idUser !== idUser;
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    appointmentsService
      .agenda(query)
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
        if (active) setCompleted({ query, refresh, idUser });
      });
    return () => {
      active = false;
    };
  }, [allowed, idUser, query, refresh]);
  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar tu agenda médica.</Alert>;
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Mi agenda médica</Typography>
          <Typography>
            Fechas y horas de Bolivia. Consulta un día o un rango de hasta 31 días; los estados se muestran sin
            modificar las citas.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label='Consulta'
              value={query.date !== undefined ? 'date' : 'range'}
              onChange={(event) => {
                setQuery(
                  event.target.value === 'date'
                    ? { page: 1, limit: query.limit, status: query.status, date: query.from ?? boliviaToday() }
                    : {
                        page: 1,
                        limit: query.limit,
                        status: query.status,
                        from: query.date ?? boliviaToday(),
                        to: query.date ?? boliviaToday(),
                      },
                );
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value='date'>Por fecha</MenuItem>
              <MenuItem value='range'>Por rango</MenuItem>
            </TextField>
            <TextField
              select
              label='Estado'
              value={query.status ?? ''}
              onChange={(event) =>
                setQuery({
                  ...query,
                  status: (event.target.value || undefined) as AppointmentStatus | undefined,
                  page: 1,
                })
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value=''>Todos los estados</MenuItem>
              {Object.entries(appointmentStatusLabels).map(([status, label]) => (
                <MenuItem key={status} value={status}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            {query.date !== undefined ? (
              <TextField
                label='Fecha'
                type='date'
                value={query.date}
                required
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) => setQuery({ ...query, date: event.target.value, page: 1 })}
              />
            ) : (
              <>
                <TextField
                  label='Desde'
                  type='date'
                  value={query.from ?? ''}
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(event) => setQuery({ ...query, from: event.target.value, page: 1 })}
                />
                <TextField
                  label='Hasta'
                  type='date'
                  value={query.to ?? ''}
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(event) => setQuery({ ...query, to: event.target.value, page: 1 })}
                />
              </>
            )}
          </Stack>
          {loading ? (
            <CircularProgress aria-label='Cargando agenda médica' />
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
                  <Typography>No hay citas en tu agenda para los filtros seleccionados.</Typography>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Paciente</th>
                          <th>Documento</th>
                          <th>Especialidad</th>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((appointment) => (
                          <tr key={appointment.idAppointment}>
                            <td>
                              {appointment.patient.name} {appointment.patient.lastname}
                            </td>
                            <td>{appointment.patient.ci}</td>
                            <td>{appointment.specialty.name}</td>
                            <td>{appointment.date}</td>
                            <td>
                              {appointment.startTime.slice(0, 5)}–{appointment.endTime.slice(0, 5)}
                            </td>
                            <td>
                              <Chip
                                size='small'
                                variant='outlined'
                                label={appointmentStatusLabels[appointment.status] ?? appointment.status}
                                color={
                                  appointment.status === 'CANCELLED'
                                    ? 'error'
                                    : appointment.status === 'RESCHEDULED'
                                      ? 'warning'
                                      : 'primary'
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ListPagination
                  query={query}
                  meta={result.meta}
                  onChange={(pagination) => setQuery({ ...query, ...pagination })}
                />
              </>
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
