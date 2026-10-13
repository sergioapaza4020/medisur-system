'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { doctorsService } from '@/services/doctors/doctorsService';
import { specialtiesService } from '@/services/specialties/specialtiesService';
import type { Doctor } from '@/types/doctors';
import type { SpecialtiesPage, SpecialtiesQuery, Specialty } from '@/types/specialties';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function DoctorSpecialtiesDialog({
  idDoctor,
  onClose,
  onSaved,
}: {
  idDoctor: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('doctor.assign-specialties') && hasPermission('specialty.get-all');
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selected, setSelected] = useState<Specialty[]>([]);
  const [query, setQuery] = useState<SpecialtiesQuery>({ page: 1, limit: 10, status: 'active' });
  const [page, setPage] = useState<SpecialtiesPage | null>(null);
  const [completed, setCompleted] = useState<SpecialtiesQuery | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    doctorsService
      .getSpecialties(idDoctor)
      .then((result) => {
        if (active) {
          setLoadError(null);
          setDoctor(result);
          setSelected(result.specialties);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getApiErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [allowed, idDoctor, refresh]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    specialtiesService
      .listPage(query)
      .then((result) => {
        if (!active) return;
        setCatalogError(null);
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, result.meta.totalPages) });
        else setPage(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setPage(null);
          setCatalogError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setCompleted(query);
      });
    return () => {
      active = false;
    };
  }, [allowed, query, refresh]);

  const canAdd = doctor?.isActive && doctor.user.isActive;
  function toggle(specialty: Specialty) {
    if (!allowed || !doctor || busy) return;
    setSelected((current) =>
      current.some(({ idSpecialty }) => idSpecialty === specialty.idSpecialty)
        ? current.filter(({ idSpecialty }) => idSpecialty !== specialty.idSpecialty)
        : canAdd && specialty.isActive
          ? [...current, specialty]
          : current,
    );
  }

  async function save() {
    if (
      !hasPermission('doctor.assign-specialties') ||
      !hasPermission('specialty.get-all') ||
      !doctor ||
      loadError ||
      saving.current
    )
      return;
    if (
      selected.length > 100 ||
      selected.some(({ idSpecialty }) => !Number.isInteger(idSpecialty) || idSpecialty < 1) ||
      new Set(selected.map(({ idSpecialty }) => idSpecialty)).size !== selected.length
    ) {
      setSaveError('Selecciona hasta 100 especialidades válidas sin duplicados.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await doctorsService.assignSpecialties(
        idDoctor,
        selected.map(({ idSpecialty }) => idSpecialty),
      );
      onSaved();
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle>Asignar especialidades</DialogTitle>
      <DialogContent>
        {!allowed ? (
          <Alert severity='warning'>No tienes permiso para asignar y consultar especialidades.</Alert>
        ) : (
          <Stack spacing={2}>
            {loadError ? (
              <Alert
                severity='error'
                action={
                  <Button
                    onClick={() => {
                      setDoctor(null);
                      setLoadError(null);
                      setCompleted(null);
                      setRefresh((value) => value + 1);
                    }}
                  >
                    Reintentar asignaciones
                  </Button>
                }
              >
                {loadError}
              </Alert>
            ) : !doctor ? (
              <CircularProgress aria-label='Cargando asignaciones' />
            ) : (
              <>
                <Typography>
                  {doctor.user.name} {doctor.user.lastname}
                </Typography>
                {!canAdd && (
                  <Alert severity='info'>
                    El médico o su cuenta están inactivos. Puedes conservar o retirar las asignaciones actuales.
                  </Alert>
                )}
                <Typography>Especialidades seleccionadas ({selected.length})</Typography>
                {selected.length === 0 && <Typography>Sin especialidades asignadas.</Typography>}
                {selected.map((specialty) => (
                  <Stack key={specialty.idSpecialty} direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography>
                      {specialty.name}
                      {!specialty.isActive && ' (inactiva)'}
                    </Typography>
                    <Button disabled={busy} onClick={() => toggle(specialty)} aria-label={`Retirar ${specialty.name}`}>
                      Retirar
                    </Button>
                  </Stack>
                ))}
                <Typography>Catálogo de especialidades activas</Typography>
                {catalogError ? (
                  <Alert
                    severity='error'
                    action={
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setCatalogError(null);
                          setQuery((current) => ({ ...current }));
                        }}
                      >
                        Reintentar catálogo
                      </Button>
                    }
                  >
                    {catalogError}
                  </Alert>
                ) : completed !== query ? (
                  <CircularProgress aria-label='Cargando especialidades' />
                ) : (
                  page && (
                    <>
                      {page.data.length === 0 && <Typography>No hay especialidades activas disponibles.</Typography>}
                      {page.data
                        .filter(({ isActive }) => isActive)
                        .map((specialty) => {
                          const checked = selected.some(({ idSpecialty }) => idSpecialty === specialty.idSpecialty);
                          return (
                            <FormControlLabel
                              key={specialty.idSpecialty}
                              label={specialty.name}
                              control={
                                <Checkbox
                                  checked={checked}
                                  disabled={busy || (!checked && (!canAdd || selected.length >= 100))}
                                  onChange={() => toggle(specialty)}
                                />
                              }
                            />
                          );
                        })}
                      <ListPagination
                        query={query}
                        meta={page.meta}
                        disabled={busy}
                        onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                        labelRowsPerPage='Especialidades por página'
                      />
                    </>
                  )
                )}
                <Typography variant='body2'>
                  Retirar una especialidad conserva el historial de la asociación.
                </Typography>
              </>
            )}
            {saveError && <Alert severity='error'>{saveError}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        {allowed && (
          <Button variant='contained' disabled={busy || !doctor || !!loadError} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar especialidades'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
