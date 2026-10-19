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
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { schedulesService } from '@/services/schedules/schedulesService';
import type { Schedule, ScheduleSpecialties } from '@/services/schedules/schedulesService';
import type { PaginationQuery } from '@/types/pagination';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function ScheduleRegistration({
  schedule,
  onSaved,
  onCancel,
}: {
  schedule?: Schedule;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { hasPermission } = useAuth();
  const authorized = hasPermission(schedule ? 'schedule.update' : 'schedule.create');
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [specialties, setSpecialties] = useState<ScheduleSpecialties | null>(null);
  const [idSpecialty, setIdSpecialty] = useState(schedule ? String(schedule.idSpecialty) : '');
  const [date, setDate] = useState(schedule?.date ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(schedule?.endTime.slice(0, 5) ?? '');
  const [completed, setCompleted] = useState<{ query: PaginationQuery; refresh: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);
  const saving = useRef(false);
  const loading = completed?.query !== query || completed?.refresh !== refresh;

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    schedulesService
      .specialties(query, !!schedule)
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
  }, [authorized, query, refresh, schedule]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!authorized || saving.current || loading || !specialties) return;
    setError('');
    setSuccess('');
    const retainingSpecialty = schedule && Number(idSpecialty) === schedule.idSpecialty;
    if (
      (!retainingSpecialty && !specialties.data.some((item) => item.idSpecialty === Number(idSpecialty))) ||
      !date ||
      !startTime ||
      !endTime
    ) {
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
      const dto = { idSpecialty: Number(idSpecialty), date, startTime, endTime };
      if (schedule) {
        await schedulesService.update(schedule.idSchedule, { ...dto, isActive, expectedVersion: schedule.version });
        setSuccess('Horario modificado correctamente');
        onSaved?.();
      } else {
        await schedulesService.create(dto);
        setSuccess('Horario registrado correctamente');
        setStartTime('');
        setEndTime('');
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!authorized) return <Alert severity='warning'>No tienes permiso para gestionar este horario.</Alert>;
  return (
    <Card>
      <CardContent>
        <Box component='form' onSubmit={save}>
          <Stack spacing={3}>
            <Typography variant='h5'>
              {schedule ? 'Modificar mi horario de atención' : 'Registrar mi horario de atención'}
            </Typography>
            {schedule && (
              <Alert severity='info'>
                Valores actuales: {schedule.date}, {schedule.startTime.slice(0, 5)}–{schedule.endTime.slice(0, 5)},{' '}
                {schedule.specialtyName ?? schedule.idSpecialty}, {schedule.isActive ? 'Activo' : 'Inactivo'}. Los
                cambios conservarán el historial.
              </Alert>
            )}
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
                  {schedule && !specialties.data.some((item) => item.idSpecialty === schedule.idSpecialty) && (
                    <MenuItem value={schedule.idSpecialty}>
                      {schedule.specialtyName ?? `Especialidad ${schedule.idSpecialty}`} (actual)
                    </MenuItem>
                  )}
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
            {schedule && (
              <FormControlLabel
                label='Horario activo'
                control={
                  <Checkbox checked={isActive} disabled={busy} onChange={(_, checked) => setIsActive(checked)} />
                }
              />
            )}
            <Button type='submit' variant='contained' disabled={busy || loading || !idSpecialty || !specialties}>
              {busy ? 'Guardando…' : schedule ? 'Guardar cambios' : 'Registrar horario'}
            </Button>
            {schedule && onCancel && (
              <Button disabled={busy} onClick={onCancel}>
                Cancelar edición
              </Button>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
