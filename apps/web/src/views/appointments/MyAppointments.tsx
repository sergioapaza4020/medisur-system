'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import type { AppointmentsPage, AppointmentsQuery, AppointmentStatus } from '@/types/appointments';
import { appointmentStatusLabels } from '@/types/appointments';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import CancelAppointment from './CancelAppointment';
import PatientProposals from './PatientProposals';
import tableStyles from '@core/styles/table.module.css';

export default function MyAppointments() {
  const { user, hasPermission } = useAuth();
  const idUser = user?.idUser;
  const allowed = Boolean(idUser && hasPermission('appointment.get-mine'));
  const [query, setQuery] = useState<AppointmentsQuery>({ page: 1, limit: 10, period: 'upcoming' });
  const [result, setResult] = useState<AppointmentsPage | null>(null);
  const [completed, setCompleted] = useState<{
    query: AppointmentsQuery;
    refresh: number;
    idUser: number | undefined;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; idUser: number | undefined } | null>(
    null,
  );
  const loading = completed?.query !== query || completed?.refresh !== refresh || completed?.idUser !== idUser;
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    appointmentsService
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
        if (active) setCompleted({ query, refresh, idUser });
      });
    return () => {
      active = false;
    };
  }, [allowed, idUser, query, refresh]);
  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar tus citas.</Alert>;
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Mis citas médicas</Typography>
          {feedback && feedback.idUser === idUser && (
            <Alert severity={feedback.success ? 'success' : 'error'}>{feedback.message}</Alert>
          )}
          <Typography>
            Fechas y horas de Bolivia. Las citas anteriores son aquellas cuya hora de inicio ya pasó.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label='Periodo'
              value={query.period}
              onChange={(event) =>
                setQuery({ ...query, period: event.target.value as AppointmentsQuery['period'], page: 1 })
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value='upcoming'>Próximas</MenuItem>
              <MenuItem value='past'>Anteriores</MenuItem>
              <MenuItem value='all'>Todas</MenuItem>
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
            <TextField
              label='Fecha'
              type='date'
              value={query.date ?? ''}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => setQuery({ ...query, date: event.target.value || undefined, page: 1 })}
            />
          </Stack>
          {loading ? (
            <CircularProgress aria-label='Cargando mis citas' />
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
                  <Typography>No tienes citas para los filtros seleccionados.</Typography>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Médico</th>
                          <th>Especialidad</th>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Estado</th>
                          {hasPermission('appointment.cancel-mine') && <th>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((appointment) => (
                          <tr key={appointment.idAppointment}>
                            <td>
                              {appointment.doctor.name} {appointment.doctor.lastname}
                            </td>
                            <td>{appointment.specialty.name}</td>
                            <td>{appointment.date}</td>
                            <td>
                              {appointment.startTime.slice(0, 5)}–{appointment.endTime.slice(0, 5)}
                            </td>
                            <td>
                              {appointmentStatusLabels[appointment.status]}
                              {appointment.status === 'CANCELLED' && (
                                <Stack spacing={1} sx={{ mt: 1, maxWidth: 360, whiteSpace: 'normal' }}>
                                  <PatientProposals
                                    key={`${idUser}/${appointment.idAppointment}`}
                                    idAppointment={appointment.idAppointment}
                                  />
                                  <Typography variant='subtitle2'>Motivo de cancelación</Typography>
                                  <Typography variant='body2' sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                                    {appointment.cancellationReason?.trim() ||
                                      'No se registró un motivo de cancelación.'}
                                  </Typography>
                                </Stack>
                              )}
                            </td>
                            {hasPermission('appointment.cancel-mine') && (
                              <td>
                                <CancelAppointment
                                  key={`${idUser}-${appointment.idAppointment}`}
                                  appointment={appointment}
                                  onResult={(success, message) => {
                                    setFeedback({ success, message, idUser });
                                    setRefresh((value) => value + 1);
                                  }}
                                />
                              </td>
                            )}
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
