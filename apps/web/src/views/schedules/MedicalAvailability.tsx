'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { schedulesService } from '@/services/schedules/schedulesService';
import type { AvailabilityPage, AvailabilityQuery } from '@/types/availability';
import type { DoctorSelection, SpecialtySelection } from '@/types/doctors';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import DoctorsBySpecialty from '@/views/doctors/DoctorsBySpecialty';
import tableStyles from '@core/styles/table.module.css';

export default function MedicalAvailability() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('schedule.get-availability') && hasPermission('doctor.get-by-specialty');
  const [selected, setSelected] = useState<{ doctor: DoctorSelection; specialty: SpecialtySelection } | null>(null);
  const [date, setDate] = useState('');
  const [query, setQuery] = useState<AvailabilityQuery | null>(null);
  const [result, setResult] = useState<AvailabilityPage | null>(null);
  const [completed, setCompleted] = useState<{ query: AvailabilityQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const loading = query !== null && (completed?.query !== query || completed?.refresh !== refresh);

  useEffect(() => {
    if (!allowed || !query) return;
    let active = true;
    schedulesService
      .availability(query)
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

  function consult(event: FormEvent) {
    event.preventDefault();
    if (!allowed || !selected || loading) return;
    if (
      !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date
    ) {
      setError('Selecciona una fecha válida');
      return;
    }
    setError('');
    setQuery({
      idDoctor: selected.doctor.idDoctor,
      idSpecialty: selected.specialty.idSpecialty,
      date,
      page: 1,
      limit: query?.limit ?? 10,
    });
  }

  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar disponibilidad médica.</Alert>;
  return (
    <Stack spacing={3}>
      <DoctorsBySpecialty
        onSelectDoctor={(doctor, specialty) => {
          if (!hasPermission('schedule.get-availability')) return;
          setSelected(doctor ? { doctor, specialty } : null);
          setQuery(null);
          setResult(null);
          setError('');
        }}
      />
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant='h5'>Disponibilidad médica</Typography>
            <Typography>
              {selected
                ? `${selected.doctor.name} ${selected.doctor.lastname} — ${selected.specialty.name}`
                : 'Selecciona un médico para consultar sus horarios disponibles.'}
            </Typography>
            <Typography>
              Horarios de Bolivia (America/La_Paz). La consulta muestra bloques de atención; no reserva una cita.
            </Typography>
            <Box component='form' onSubmit={consult}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  required
                  label='Fecha de atención'
                  type='date'
                  value={date}
                  disabled={!selected || loading}
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setQuery(null);
                    setResult(null);
                    setError('');
                  }}
                />
                <Button type='submit' variant='contained' disabled={!selected || !date || loading}>
                  Consultar disponibilidad
                </Button>
              </Stack>
            </Box>
            {loading ? (
              <CircularProgress aria-label='Consultando disponibilidad' />
            ) : error ? (
              <Alert
                severity='error'
                action={
                  query ? <Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button> : undefined
                }
              >
                {error}
              </Alert>
            ) : (
              query &&
              result && (
                <>
                  <Typography>Disponibilidad para {query.date}</Typography>
                  {result.data.length === 0 ? (
                    <Alert severity='info'>
                      No hay disponibilidad para el médico, especialidad y fecha seleccionados.
                    </Alert>
                  ) : (
                    <div className='overflow-x-auto'>
                      <table className={tableStyles.table}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.map((block) => (
                            <tr key={`${block.idSchedule}-${block.startTime}`}>
                              <td>{block.date}</td>
                              <td>{block.startTime.slice(0, 5)}</td>
                              <td>{block.endTime.slice(0, 5)}</td>
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
                    labelRowsPerPage='Bloques por página'
                  />
                </>
              )
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
