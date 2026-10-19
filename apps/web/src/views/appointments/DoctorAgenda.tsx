'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import { appointmentStatusLabels, type AppointmentStatus } from '@/types/appointments';
import type { DoctorAppointment } from '@/types/doctor-agenda';
import { boliviaToday, displayDate, monthDates } from '@/views/schedules/availabilityDates';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import CancelAppointment from './CancelAppointment';
import {
  agendaPeriod,
  boliviaClock,
  navigateAgenda,
  periodDays,
  periodLabel,
  positionEvents,
  timeMinutes,
  viewLabels,
  type AgendaView,
} from './agendaDates';

const statusColor = (status: AppointmentStatus) =>
  status === 'CANCELLED' ? 'error' : status === 'RESCHEDULED' ? 'warning' : 'primary';
const patientName = (event: DoctorAppointment) => `${event.patient.name} ${event.patient.lastname}`.trim();
const eventTime = (event: DoctorAppointment) => `${event.startTime.slice(0, 5)}–${event.endTime.slice(0, 5)}`;
function EventButton({
  event,
  onSelect,
  compact = false,
  fill = false,
}: {
  event: DoctorAppointment;
  onSelect: (event: DoctorAppointment) => void;
  compact?: boolean;
  fill?: boolean;
}) {
  return (
    <Button
      variant='outlined'
      color={statusColor(event.status)}
      onClick={() => onSelect(event)}
      aria-label={`${event.date}, ${eventTime(event)}, ${patientName(event)}, ${event.specialty.name}, ${appointmentStatusLabels[event.status]}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        width: '100%',
        minWidth: 0,
        textAlign: 'left',
        textTransform: 'none',
        height: fill ? '100%' : 'auto',
        overflow: 'hidden',
        p: compact ? 0.5 : 1,
        bgcolor: 'background.paper',
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
      }}
    >
      <Typography
        variant='caption'
        component='span'
        display='block'
        sx={
          compact
            ? { fontSize: 10, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : undefined
        }
      >
        {eventTime(event)}
      </Typography>
      <Typography
        variant='body2'
        component='span'
        display='block'
        sx={
          compact
            ? { fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : { overflowWrap: 'anywhere' }
        }
      >
        {patientName(event)}
      </Typography>
      {!compact && (
        <Typography variant='caption' component='span' display='block'>
          {event.specialty.name}
        </Typography>
      )}
      <Typography
        variant='caption'
        component='span'
        display='block'
        sx={
          compact
            ? { fontSize: 10, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            : undefined
        }
      >
        {appointmentStatusLabels[event.status]}
      </Typography>
    </Button>
  );
}

export default function DoctorAgenda() {
  const { user, hasPermission } = useAuth();
  const idUser = user?.idUser;
  const allowed = Boolean(idUser && hasPermission('appointment.get-agenda'));
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [chosenView, setView] = useState<AgendaView | null>(null);
  const view = chosenView ?? (wide ? 'week' : 'day');
  const [date, setDate] = useState(boliviaToday);
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<DoctorAppointment | null>(null);
  const [clock, setClock] = useState(boliviaClock);
  const { from, to } = agendaPeriod(date, view);
  const key = `${idUser}/${from}/${to}/${status}/${refresh}`;
  const [response, setResponse] = useState<{ key: string; events: DoctorAppointment[]; error: string } | null>(null);
  const [feedback, setFeedback] = useState<{ idUser: number; success: boolean; message: string } | null>(null);
  const loading = response?.key !== key;
  const events = !loading && !response?.error ? (response?.events ?? []) : [];
  const selectedEvent = events.find((event) => event.idAppointment === selected?.idAppointment);
  const days = periodDays(from, to);
  const grouped = new Map(days.map((day) => [day, events.filter((event) => event.date === day)]));
  useEffect(() => {
    const timer = setInterval(() => setClock(boliviaClock()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    appointmentsService
      .agenda({ from, to, status: status || undefined, mode: 'calendar', page: 1, limit: 100 })
      .then((page) => {
        if (active) setResponse({ key, events: page.data, error: '' });
      })
      .catch((error: unknown) => {
        if (active) setResponse({ key, events: [], error: getApiErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [allowed, from, to, status, key]);
  // Derive visible hours from actual appointments, never from free availability slots.
  const start = events.length ? Math.floor(Math.min(...events.map((event) => timeMinutes(event.startTime))) / 60) : 8;
  const end = events.length ? Math.ceil(Math.max(...events.map((event) => timeMinutes(event.endTime))) / 60) : 9;
  const hours = { start, end: Math.max(start + 1, end) };
  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar tu agenda médica.</Alert>;
  const today = boliviaToday();
  const selectDay = (day: string) => {
    setDate(day);
    setView('day');
    setSelected(null);
  };
  const emptyText =
    view === 'day'
      ? 'No tienes citas programadas para este día.'
      : view === 'week'
        ? 'No tienes citas programadas esta semana.'
        : 'No tienes citas programadas este mes.';
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Mi agenda médica</Typography>
          <Typography variant='body2'>Citas programadas · Hora de Bolivia (America/La_Paz)</Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: { sm: 'center' } }}
          >
            <ToggleButtonGroup
              exclusive
              value={view}
              aria-label='Vista de agenda'
              onChange={(_, value: AgendaView | null) => {
                if (value) {
                  setView(value);
                  setSelected(null);
                }
              }}
            >
              {Object.entries(viewLabels).map(([value, label]) => (
                <ToggleButton key={value} value={value}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Stack direction='row' spacing={1}>
              <Button
                aria-label='Periodo anterior'
                onClick={() => {
                  setDate(navigateAgenda(date, view, -1));
                  setSelected(null);
                }}
              >
                ‹
              </Button>
              <Button
                onClick={() => {
                  setDate(boliviaToday());
                  setSelected(null);
                }}
              >
                Hoy
              </Button>
              <Button
                aria-label='Periodo siguiente'
                onClick={() => {
                  setDate(navigateAgenda(date, view, 1));
                  setSelected(null);
                }}
              >
                ›
              </Button>
            </Stack>
            <TextField
              label='Fecha'
              type='date'
              value={date}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                  setDate(event.target.value);
                  setSelected(null);
                }
              }}
            />
            <TextField
              select
              label='Estado'
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as AppointmentStatus | '');
                setSelected(null);
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value=''>Todos los estados</MenuItem>
              {Object.entries(appointmentStatusLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Typography variant='h6' aria-live='polite' sx={{ textTransform: 'capitalize' }}>
            {periodLabel(date, view)}
          </Typography>
          {loading ? (
            <CircularProgress aria-label='Cargando agenda médica' />
          ) : response?.error ? (
            <Alert
              severity='error'
              action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
            >
              {response.error}
            </Alert>
          ) : (
            <>
              {events.length === 0 && <Alert severity='info'>{emptyText}</Alert>}
              {view === 'month' ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                    <Typography key={day} align='center' variant='caption'>
                      {day}
                    </Typography>
                  ))}
                  {Array.from({ length: monthDates(date.slice(0, 7)).offset }, (_, i) => (
                    <Box key={`blank-${i}`} />
                  ))}
                  {days.map((day) => {
                    const daily = grouped.get(day) ?? [];
                    return (
                      <Box
                        key={day}
                        sx={{
                          border: '1px solid',
                          borderColor: day === today ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          minWidth: 0,
                          p: { xs: 0.25, md: 1 },
                        }}
                      >
                        <Button
                          aria-label={`Ver día ${day}, ${daily.length} citas`}
                          onClick={() => selectDay(day)}
                          sx={{ minWidth: 0, width: '100%', display: 'block', p: 0.5 }}
                        >
                          {Number(day.slice(8))}
                          <Typography component='span' variant='caption' display='block'>
                            {daily.length} citas
                          </Typography>
                        </Button>
                        {wide &&
                          daily.slice(0, 2).map((event) => (
                            <Box key={event.idAppointment} sx={{ mb: 0.5 }}>
                              <EventButton event={event} onSelect={setSelected} compact />
                            </Box>
                          ))}
                        {wide && daily.length > 2 && (
                          <Button size='small' onClick={() => selectDay(day)}>
                            +{daily.length - 2} más
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                events.length > 0 &&
                (view === 'week' && wide ? (
                  <Box
                    role='region'
                    aria-label='Calendario semanal por horas'
                    sx={{ maxHeight: 720, overflowY: 'auto' }}
                  >
                    <Box sx={{ display: 'grid', gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}>
                      <Box />
                      {days.map((day) => (
                        <Button key={day} onClick={() => selectDay(day)} sx={{ minWidth: 0, p: 1 }}>
                          {displayDate(day, { weekday: 'short', day: 'numeric' })}
                        </Button>
                      ))}
                      <Box sx={{ position: 'relative', height: (hours.end - hours.start) * 180 }}>
                        {Array.from({ length: hours.end - hours.start }, (_, i) => (
                          <Typography key={i} variant='caption' sx={{ position: 'absolute', top: i * 180 }}>
                            {String(hours.start + i).padStart(2, '0')}:00
                          </Typography>
                        ))}
                      </Box>
                      {days.map((day) => {
                        const daily = grouped.get(day) ?? [];
                        const positioned = positionEvents(daily);
                        const now = timeMinutes(clock);
                        return (
                          <Box
                            key={day}
                            sx={{
                              position: 'relative',
                              borderLeft: '1px solid',
                              borderColor: 'divider',
                              height: (hours.end - hours.start) * 180,
                              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 89px, ${theme.palette.divider} 89px, ${theme.palette.divider} 90px)`,
                            }}
                          >
                            {positioned.map(({ event, lane, columns }) => (
                              <Box
                                key={event.idAppointment}
                                sx={{
                                  position: 'absolute',
                                  top: (timeMinutes(event.startTime) - hours.start * 60) * 3,
                                  height: Math.max(30, (timeMinutes(event.endTime) - timeMinutes(event.startTime)) * 3),
                                  left: `${(lane * 100) / columns}%`,
                                  width: `${100 / columns}%`,
                                  p: 0.25,
                                }}
                              >
                                <EventButton event={event} onSelect={setSelected} compact fill />
                              </Box>
                            ))}
                            {day === today && now >= hours.start * 60 && now <= hours.end * 60 && (
                              <Box
                                aria-label={`Hora actual ${clock}`}
                                sx={{
                                  pointerEvents: 'none',
                                  position: 'absolute',
                                  top: (now - hours.start * 60) * 3,
                                  width: '100%',
                                  borderTop: '2px solid',
                                  borderColor: 'error.main',
                                  zIndex: 1,
                                }}
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ) : (
                  <Stack spacing={3}>
                    {days.map((day) => (
                      <Stack key={day} spacing={1}>
                        <Typography component='h3' variant='subtitle1'>
                          {displayDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Typography>
                        {day === today && (
                          <Typography variant='caption' color='error.main' aria-label={`Hora actual ${clock}`}>
                            Hora actual {clock} ─────
                          </Typography>
                        )}
                        {(grouped.get(day) ?? []).length === 0 ? (
                          <Typography variant='body2'>Sin citas</Typography>
                        ) : (
                          grouped
                            .get(day)
                            ?.map((event) => (
                              <EventButton key={event.idAppointment} event={event} onSelect={setSelected} />
                            ))
                        )}
                      </Stack>
                    ))}
                  </Stack>
                ))
              )}
            </>
          )}
          {feedback && feedback.idUser === idUser && (
            <Alert severity={feedback.success ? 'success' : 'error'}>{feedback.message}</Alert>
          )}
          <Dialog
            open={Boolean(selectedEvent)}
            onClose={() => setSelected(null)}
            fullWidth
            maxWidth='xs'
            aria-labelledby='agenda-summary-title'
          >
            <DialogTitle id='agenda-summary-title'>Resumen de cita</DialogTitle>
            {selectedEvent && (
              <DialogContent>
                <Stack spacing={2}>
                  <Typography>{patientName(selectedEvent)}</Typography>
                  <Typography>{selectedEvent.specialty.name}</Typography>
                  <Typography>
                    {displayDate(selectedEvent.date, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Typography>
                  <Typography>{eventTime(selectedEvent)} · Bolivia</Typography>
                  <Chip
                    label={appointmentStatusLabels[selectedEvent.status]}
                    color={statusColor(selectedEvent.status)}
                    variant='outlined'
                  />
                </Stack>
              </DialogContent>
            )}
            <DialogActions>
              {selectedEvent && hasPermission('appointment.cancel-as-doctor') && (
                <CancelAppointment
                  key={`${idUser}/${selectedEvent.idAppointment}`}
                  appointment={selectedEvent}
                  mode='doctor'
                  onResult={(success, message) => {
                    if (idUser) setFeedback({ idUser, success, message });
                    setSelected(null);
                    setRefresh((value) => value + 1);
                  }}
                />
              )}
              <Button onClick={() => setSelected(null)}>Cerrar</Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </CardContent>
    </Card>
  );
}
