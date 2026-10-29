'use client';

import { useEffect, useState } from 'react';

import { Alert, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { medicalRecordsService } from '@/services/medical-records/medicalRecordsService';
import type { PaginationQuery } from '@/types/pagination';
import type { ExtraordinaryGrantsPage } from '@/types/medical-records';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { ExtraordinaryMedicalRecord } from '@/views/appointments/DoctorMedicalRecord';
import { CreateGrant, RevokeGrant } from './ExtraordinaryGrantActions';

export default function ExtraordinaryAccesses({ mode }: { mode: 'manage' | 'mine' }) {
  const { user, hasPermission } = useAuth();
  const required = mode === 'manage' ? 'medical-record.manage-extraordinary' : 'medical-record.get-extraordinary';
  if (!user || !hasPermission(required))
    return <Alert severity='warning'>No tienes permiso para acceder a estas autorizaciones.</Alert>;
  return <AccessList key={`${user.idUser}/${mode}`} idUser={user.idUser} mode={mode} />;
}

function AccessList({ idUser, mode }: { idUser: number; mode: 'manage' | 'mine' }) {
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [response, setResponse] = useState<{ key: string; page?: ExtraordinaryGrantsPage; error?: string } | null>(
    null,
  );
  const key = `${idUser}/${mode}/${query.page}/${query.limit}/${refresh}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    let active = true;
    medicalRecordsService.grants(query, mode).then(
      (page) => {
        if (!active) return;
        if (query.page > Math.max(1, page.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, page.meta.totalPages) });
        else setResponse({ key, page });
      },
      (failure: unknown) => {
        if (active) setResponse({ key, error: getApiErrorMessage(failure) });
      },
    );
    return () => {
      active = false;
    };
  }, [query, mode, key]);
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5' component='h1'>
            {mode === 'manage' ? 'Gestión de accesos extraordinarios' : 'Accesos clínicos autorizados'}
          </Typography>
          {mode === 'manage' && (
            <CreateGrant
              idActor={idUser}
              onCreated={() => {
                setFeedback('Autorización concedida correctamente');
                setRefresh((value) => value + 1);
              }}
            />
          )}
          {feedback && <Alert severity='success'>{feedback}</Alert>}
          <Button onClick={() => setRefresh((value) => value + 1)}>Actualizar autorizaciones</Button>
          {!current ? (
            <CircularProgress aria-label='Cargando autorizaciones' />
          ) : current.error ? (
            <Alert
              severity='error'
              action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
            >
              {current.error}
            </Alert>
          ) : (
            current.page && (
              <>
                {!current.page.data.length && <Typography>No hay autorizaciones disponibles.</Typography>}
                {current.page.data.map((grant) => (
                  <Stack key={grant.idGrant} spacing={1}>
                    <Typography variant='subtitle1'>
                      {grant.patient.name} {grant.patient.lastname} · Documento: {grant.patient.ci}
                    </Typography>
                    <Typography>
                      Médico: {grant.beneficiary.name} {grant.beneficiary.lastname}
                    </Typography>
                    <Chip
                      label={`${grant.type === 'EMERGENCY' ? 'Emergencia' : 'Autorización'} · ${{ ACTIVE: 'Vigente', EXPIRED: 'Vencida', REVOKED: 'Revocada' }[grant.state]}`}
                    />
                    <Typography sx={{ overflowWrap: 'anywhere' }}>{grant.reason}</Typography>
                    <Typography>
                      Vence:{' '}
                      {new Intl.DateTimeFormat('es-BO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'America/La_Paz',
                      }).format(new Date(grant.expiresAt))}{' '}
                      (Bolivia)
                    </Typography>
                    {grant.revocationReason && <Typography>Revocación: {grant.revocationReason}</Typography>}
                    {mode === 'manage' && grant.state === 'ACTIVE' && (
                      <RevokeGrant
                        grant={grant}
                        onRevoked={() => {
                          setFeedback('Autorización revocada correctamente');
                          setRefresh((value) => value + 1);
                        }}
                      />
                    )}
                    {mode === 'mine' && <ExtraordinaryMedicalRecord grant={grant} />}
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
