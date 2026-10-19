'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import type { BookingPatient, BookingPatientsPage, PatientSelectionQuery } from '@/types/booking-patient';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import MedicalAvailability from '@/views/schedules/MedicalAvailability';
import tableStyles from '@core/styles/table.module.css';

export default function ReceptionBooking() {
  const { user, hasPermission } = useAuth();
  if (
    !user ||
    !['appointment.create-for-patient', 'schedule.get-availability', 'doctor.get-by-specialty'].every(hasPermission)
  )
    return <Alert severity='warning'>No tienes los permisos necesarios para reservar desde recepción.</Alert>;
  return <ReceptionBookingFlow key={user.idUser} />;
}

function ReceptionBookingFlow() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<PatientSelectionQuery | null>(null);
  const [page, setPage] = useState<BookingPatientsPage | null>(null);
  const [completed, setCompleted] = useState<{ query: PatientSelectionQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<BookingPatient | null>(null);
  const loading = Boolean(query && (completed?.query !== query || completed?.refresh !== refresh));
  useEffect(() => {
    if (!query) return;
    let active = true;
    appointmentsService
      .patients(query)
      .then((result) => {
        if (!active) return;
        setError('');
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, result.meta.totalPages) });
        else setPage(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setPage(null);
          setError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setCompleted({ query, refresh });
      });
    return () => {
      active = false;
    };
  }, [query, refresh]);

  return (
    <Stack spacing={3}>
      <Typography variant='h5'>Reserva de cita desde recepción</Typography>
      <Typography>
        Estás registrando una cita en nombre de otro paciente. Verifica su identidad antes de confirmar.
      </Typography>
      {selected ? (
        <>
          <Alert severity='info'>
            Paciente seleccionado: {selected.name} {selected.lastname} · Documento: {selected.ci}
          </Alert>
          <Button
            onClick={() => {
              setSelected(null);
              setRefresh((value) => value + 1);
            }}
          >
            Cambiar paciente
          </Button>
          <MedicalAvailability key={selected.idUser} bookingFor={selected} />
        </>
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Box
                component='form'
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  if (search.trim().length < 3) return;
                  setQuery({ page: 1, limit: query?.limit ?? 10, search: search.trim() });
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    label='Nombre o documento del paciente'
                    value={search}
                    inputProps={{ maxLength: 200 }}
                    helperText='Ingresa al menos 3 caracteres'
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Button type='submit' variant='outlined' disabled={search.trim().length < 3}>
                    Buscar paciente
                  </Button>
                </Stack>
              </Box>
              {loading ? (
                <CircularProgress aria-label='Buscando pacientes' />
              ) : error ? (
                <Alert
                  severity='error'
                  action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar búsqueda</Button>}
                >
                  {error}
                </Alert>
              ) : (
                page &&
                query && (
                  <>
                    {page.data.length === 0 ? (
                      <Typography>
                        No se encontraron pacientes activos. Revisa los datos o registra al paciente si no existe.
                      </Typography>
                    ) : (
                      <div className='overflow-x-auto'>
                        <table className={tableStyles.table}>
                          <thead>
                            <tr>
                              <th>Paciente</th>
                              <th>Documento</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {page.data.map((patient) => (
                              <tr key={patient.idUser}>
                                <td>
                                  {patient.name} {patient.lastname}
                                </td>
                                <td>{patient.ci}</td>
                                <td>
                                  <Button onClick={() => setSelected(patient)}>
                                    Seleccionar paciente {patient.ci}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <ListPagination
                      query={query}
                      meta={page.meta}
                      onChange={(pagination) => setQuery({ ...query, ...pagination })}
                    />
                  </>
                )
              )}
              {hasPermission('user.create-patient') && (
                <Button href='/dashboard/patients/register'>Registrar paciente nuevo</Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
