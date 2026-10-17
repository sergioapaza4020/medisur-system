'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Alert,
  Box,
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
import { schedulesService } from '@/services/schedules/schedulesService';
import type { ScheduleSpecialties } from '@/services/schedules/schedulesService';
import type { PaginationQuery } from '@/types/pagination';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function ScheduleRegistration() {
  const { hasPermission } = useAuth();
  const authorized = hasPermission('schedule.create');
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [specialties, setSpecialties] = useState<ScheduleSpecialties | null>(null);
  const [idSpecialty, setIdSpecialty] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [completed, setCompleted] = useState<{ query: PaginationQuery; refresh: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  const loading = completed?.query !== query || completed?.refresh !== refresh;

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    schedulesService
      .specialties(query)
      .then((result) => {
        if (active) {
          setSpecialties(result);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) {
          setSpecialties(null);
          setError(getApiErrorMessage(cause));
        }
      })
      .finally(() => {
        if (active) setCompleted({ query, refresh });
      });
    return () => {
      active = false;
    };
  }, [authorized, query, refresh]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!authorized || saving.current || loading || !specialties) return;
    setError('');
    setSuccess('');
    if (!specialties.data.some((item) => item.idSpecialty === Number(idSpecialty)) || !date || !startTime || !endTime) {
      setError('Completa la fecha, especialidad y horas del horario');
      return;
    }
    if (startTime >= endTime) {
      setError('La hora de inicio debe ser anterior a la hora de fin');
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await schedulesService.create({ idSpecialty: Number(idSpecialty), date, startTime, endTime });
      setSuccess('Horario registrado correctamente');
      setStartTime('');
      setEndTime('');
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!authorized) return <Alert severity='warning'>No tienes permiso para registrar horarios.</Alert>;
  return (
    <Card>
      <CardContent>
        <Box component='form' onSubmit={save}>
          <Stack spacing={3}>
            <Typography variant='h5'>Registrar mi horario de atención</Typography>
            <Typography>
              Las horas corresponden a Bolivia (America/La_Paz). Cada bloque pertenece a una fecha; el día se determina
              por esa fecha.
            </Typography>
            {error && <Alert severity='error'>{error}</Alert>}
            {success && <Alert severity='success'>{success}</Alert>}
            {loading ? (
              <CircularProgress aria-label='Cargando especialidades' />
            ) : specialties ? (
              <>
                <TextField
                  select
                  required
                  label='Especialidad'
                  value={idSpecialty}
                  disabled={busy}
                  onChange={(event) => setIdSpecialty(event.target.value)}
                >
                  {specialties.data.map((item) => (
                    <MenuItem key={item.idSpecialty} value={item.idSpecialty}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
                {specialties.meta.total === 0 && <Typography>No tienes especialidades activas asignadas.</Typography>}
                <ListPagination
                  query={query}
                  meta={specialties.meta}
                  disabled={busy}
                  onChange={(pagination) => {
                    setIdSpecialty('');
                    setQuery(pagination);
                  }}
                  labelRowsPerPage='Especialidades por página'
                />
              </>
            ) : (
              <Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>
            )}
            <TextField
              required
              label='Fecha de atención'
              type='date'
              value={date}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => setDate(event.target.value)}
            />
            <TextField
              required
              label='Hora de inicio'
              type='time'
              value={startTime}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <TextField
              required
              label='Hora de fin'
              type='time'
              value={endTime}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
              onChange={(event) => setEndTime(event.target.value)}
            />
            <Button type='submit' variant='contained' disabled={busy || loading || !idSpecialty || !specialties}>
              {busy ? 'Registrando…' : 'Registrar horario'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
