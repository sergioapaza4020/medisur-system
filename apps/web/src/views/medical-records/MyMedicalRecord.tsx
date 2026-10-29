'use client';

import { useEffect, useState } from 'react';

import { isAxiosError } from 'axios';
import { Alert, Button, Card, CardContent, CircularProgress, Divider, Stack, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { medicalRecordsService } from '@/services/medical-records/medicalRecordsService';
import type { PaginationQuery } from '@/types/pagination';
import type { PatientMedicalRecordPage } from '@/types/medical-records';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function MyMedicalRecord() {
  const { user, hasPermission } = useAuth();
  if (!user || !hasPermission('medical-record.get-mine'))
    return <Alert severity='warning'>No tienes permiso para consultar tu historial clínico.</Alert>;
  return <PatientHistory key={user.idUser} idUser={user.idUser} />;
}

function PatientHistory({ idUser }: { idUser: number }) {
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    page?: PatientMedicalRecordPage;
    error?: string;
    denied?: boolean;
  } | null>(null);
  const key = `${idUser}/${query.page}/${query.limit}/${refresh}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    let active = true;
    medicalRecordsService.mine(query).then(
      (page) => {
        if (!active) return;
        if (query.page > Math.max(1, page.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, page.meta.totalPages) });
        else setResponse({ key, page });
      },
      (failure: unknown) => {
        if (active)
          setResponse({
            key,
            error: getApiErrorMessage(failure),
            denied: isAxiosError(failure) && [401, 403].includes(failure.response?.status ?? 0),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [query, key]);

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5' component='h1'>
            Mi historial clínico
          </Typography>
          <Typography>Atenciones más recientes primero. Fechas y horas de Bolivia.</Typography>
          {!current ? (
            <CircularProgress aria-label='Cargando mi historial clínico' />
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
                ? 'No tienes autorización para consultar tu historial clínico. Verifica tu sesión y tus permisos.'
                : current.error}
            </Alert>
          ) : (
            current.page && (
              <>
                <Button onClick={() => setRefresh((value) => value + 1)}>Actualizar historial</Button>
                {!current.page.data.length && (
                  <Typography>Aún no tienes atenciones disponibles en tu historial clínico.</Typography>
                )}
                {current.page.data.map((encounter, index) => (
                  <Stack spacing={1} key={`${encounter.occurredAt}/${index}`}>
                    <Typography variant='subtitle1'>
                      {new Intl.DateTimeFormat('es-BO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'America/La_Paz',
                      }).format(new Date(encounter.occurredAt))}
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
      </CardContent>
    </Card>
  );
}
