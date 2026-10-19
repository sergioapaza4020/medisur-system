'use client';

import { useEffect, useState } from 'react';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import { schedulesService } from '@/services/schedules/schedulesService';
import type { AvailabilityBlock } from '@/types/availability';
import type { DoctorSelection, SpecialtySelection } from '@/types/doctors';
import type { BookingPatient } from '@/types/booking-patient';
import DoctorsBySpecialty from '@/views/doctors/DoctorsBySpecialty';
import AvailabilityCalendar from './AvailabilityCalendar';
import AvailabilitySlots from './AvailabilitySlots';
import { boliviaToday, monthDates, moveMonth } from './availabilityDates';

export default function MedicalAvailability({ bookingFor }: { bookingFor?: BookingPatient } = {}) {
  const { hasPermission } = useAuth();
  const allowed =
    hasPermission('schedule.get-availability') &&
    hasPermission('doctor.get-by-specialty') &&
    (!bookingFor || hasPermission('appointment.create-for-patient'));
  const canReserve = hasPermission(bookingFor ? 'appointment.create-for-patient' : 'appointment.create');
  const [selected, setSelected] = useState<{ doctor: DoctorSelection; specialty: SpecialtySelection } | null>(null);
  const [month, setMonth] = useState(() => boliviaToday().slice(0, 7));
  const [date, setDate] = useState('');
  const [result, setResult] = useState<{ key: string; blocks: AvailabilityBlock[]; error: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const today = boliviaToday();
  const idDoctor = selected?.doctor.idDoctor;
  const idSpecialty = selected?.specialty.idSpecialty;
  const key = `${idDoctor}-${idSpecialty}-${month}-${refresh}`;
  const current = result?.key === key ? result : null;
  const loading = Boolean(selected && !current);

  useEffect(() => {
    if (!allowed || !idDoctor || !idSpecialty) return;
    let active = true;
    const { from, to } = monthDates(month);
    async function load() {
      try {
        const blocks: AvailabilityBlock[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const response = await schedulesService.availability({
            idDoctor: idDoctor!,
            idSpecialty,
            from,
            to,
            page,
            limit: 100,
          });
          if (!active) return;
          blocks.push(...response.data);
          totalPages = response.meta.totalPages;
          page++;
        } while (page <= totalPages);
        setResult({ key, blocks, error: false });
      } catch {
        if (active) setResult({ key, blocks: [], error: true });
      }
    }
    // React Strict Mode cleans up the first effect before this microtask runs.
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [allowed, idDoctor, idSpecialty, month, key]);

  if (!allowed) return <Alert severity='warning'>No tienes permiso para consultar disponibilidad médica.</Alert>;
  const blocks = current?.blocks ?? [];
  const dates = new Set(blocks.filter((block) => block.date >= today).map((block) => block.date));
  const visibleDate = dates.has(date) ? date : '';
  return (
    <Stack spacing={3}>
      <DoctorsBySpecialty
        onSelectDoctor={(doctor, specialty) => {
          if (!hasPermission('schedule.get-availability')) return;
          setSelected(doctor ? { doctor, specialty } : null);
          setDate('');
          setResult(null);
          setRefresh((value) => value + 1);
        }}
      />
      {feedback && <Alert severity={feedback.success ? 'success' : 'error'}>{feedback.message}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant='h5'>Disponibilidad médica</Typography>
            <Typography>
              {selected
                ? `${selected.doctor.name} ${selected.doctor.lastname} — ${selected.specialty.name}`
                : 'Selecciona un médico para consultar su disponibilidad.'}
            </Typography>
            {selected && (
              <>
                <Typography>
                  Horarios de Bolivia (America/La_Paz).{' '}
                  {canReserve
                    ? 'Selecciona un horario para reservar el bloque completo.'
                    : 'Los bloques de atención son informativos; esta consulta no reserva una cita.'}
                </Typography>
                {loading && <CircularProgress size={24} aria-label='Consultando disponibilidad' />}
                {current?.error && (
                  <Alert
                    severity='error'
                    action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
                  >
                    No fue posible consultar la disponibilidad.
                  </Alert>
                )}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                    gap: 4,
                  }}
                >
                  <AvailabilityCalendar
                    month={month}
                    today={today}
                    dates={dates}
                    selectedDate={visibleDate}
                    loading={loading}
                    onMonthChange={(delta) => {
                      setMonth(moveMonth(month, delta));
                      setDate('');
                    }}
                    onSelect={setDate}
                  />
                  {!loading && !current?.error && (
                    <AvailabilitySlots
                      bookingFor={bookingFor}
                      onReserve={
                        canReserve
                          ? (success, message) => {
                              setFeedback({ success, message });
                              setRefresh((value) => value + 1);
                            }
                          : undefined
                      }
                      date={visibleDate}
                      blocks={blocks.filter((block) => block.date === visibleDate)}
                    />
                  )}
                </Box>
                {!loading && !current?.error && dates.size === 0 && (
                  <Alert severity='info'>No hay horarios disponibles para este médico durante este mes.</Alert>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
