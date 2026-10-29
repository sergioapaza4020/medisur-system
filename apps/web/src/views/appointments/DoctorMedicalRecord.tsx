'use client';

import { useEffect, useState } from 'react';

import { isAxiosError } from 'axios';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import type { DoctorAppointment } from '@/types/doctor-agenda';
import type { PaginationQuery } from '@/types/pagination';
import type { DoctorMedicalRecordPage } from '@/types/medical-records';
import { medicalRecordsService } from '@/services/medical-records/medicalRecordsService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function DoctorMedicalRecord({ appointment }: { appointment: DoctorAppointment }) {
  const { user, hasPermission } = useAuth();
  if (
    !user ||
    !hasPermission('medical-record.get-by-appointment') ||
    appointment.status !== 'RESERVED' ||
    appointment.canReadMedicalRecord !== true
  )
    return null;
  return (
    <MedicalRecordDialog
      key={`${user.idUser}/${appointment.idAppointment}`}
      appointment={appointment}
      idUser={user.idUser}
    />
  );
}

function MedicalRecordDialog({ appointment, idUser }: { appointment: DoctorAppointment; idUser: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    page?: DoctorMedicalRecordPage;
    error?: string;
    denied?: boolean;
  } | null>(null);
  const key = `${idUser}/${appointment.idAppointment}/${query.page}/${query.limit}/${refresh}`;
  const current = response?.key === key ? response : null;

  useEffect(() => {
    if (!open) return;
    let active = true;
    medicalRecordsService.byAppointment(appointment.idAppointment, query).then(
      (page) => {
        if (active) {
          if (!page.data.length && page.meta.total > 0 && query.page > page.meta.totalPages) {
            setQuery({ ...query, page: page.meta.totalPages });
          } else setResponse({ key, page });
        }
      },
      (failure: unknown) => {
        if (active)
          setResponse({
            key,
            error: getApiErrorMessage(failure),
            denied: isAxiosError(failure) && [401, 403, 404].includes(failure.response?.status ?? 0),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [open, appointment.idAppointment, query, key]);

  function close() {
    setOpen(false);
    setResponse(null);
  }

  return (
    <>
      <Button
        onClick={() => {
          setQuery({ page: 1, limit: 10 });
          setRefresh((value) => value + 1);
          setOpen(true);
        }}
      >
        Consultar historial
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth='md' aria-labelledby='doctor-medical-record-title'>
        <DialogTitle id='doctor-medical-record-title'>
          Historial clínico de {appointment.patient.name} {appointment.patient.lastname}
        </DialogTitle>
        <DialogContent>
          {open && (
            <Stack spacing={3}>
              {!current ? (
                <CircularProgress aria-label='Cargando historial clínico' />
              ) : current.error ? (
                <Alert
                  severity='error'
                  action={
                    !current.denied ? (
                      <Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>
                    ) : undefined
                  }
                >
                  {current.denied
                    ? 'Acceso al historial denegado. Verifica tus permisos y la vigencia de la cita.'
                    : current.error}
                </Alert>
              ) : (
                current.page && (
                  <>
                    {!current.page.data.length && (
                      <Typography>El paciente aún no tiene atenciones disponibles en su historial.</Typography>
                    )}
                    {current.page.data.map((encounter) => (
                      <Stack spacing={1} key={encounter.idEncounter}>
                        <Typography variant='subtitle1'>
                          {new Intl.DateTimeFormat('es-BO', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'America/La_Paz',
                          }).format(new Date(encounter.occurredAt))}{' '}
                          · Bolivia
                        </Typography>
                        <Typography>
                          {encounter.doctor.name} {encounter.doctor.lastname} · {encounter.specialty.name}
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {encounter.summary}
                        </Typography>
                        <Divider />
                      </Stack>
                    ))}
                    {current.page.meta.total > 0 && (
                      <ListPagination query={query} meta={current.page.meta} onChange={setQuery} />
                    )}
                  </>
                )
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cerrar historial</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
