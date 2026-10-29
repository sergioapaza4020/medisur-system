'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import ListPagination from '@/components/pagination/ListPagination';
import { medicalRecordsService } from '@/services/medical-records/medicalRecordsService';
import type { BookingPatient, BookingPatientsPage, PatientSelectionQuery } from '@/types/booking-patient';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function ExtraordinaryPersonPicker({
  kind,
  selected,
  onSelect,
  disabled,
}: {
  kind: 'patients' | 'beneficiaries';
  selected: BookingPatient | null;
  onSelect: (person: BookingPatient) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<PatientSelectionQuery | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ key: string; page?: BookingPatientsPage; error?: string } | null>(null);
  const label = kind === 'patients' ? 'paciente' : 'médico beneficiario';
  const key = `${kind}/${JSON.stringify(query)}/${attempt}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    if (!open || !query) return;
    let active = true;
    medicalRecordsService.people(kind, query).then(
      (page) => {
        if (active) {
          if (query.page > Math.max(1, page.meta.totalPages))
            setQuery({ ...query, page: Math.max(1, page.meta.totalPages) });
          else setResponse({ key, page });
        }
      },
      (failure: unknown) => {
        if (active) setResponse({ key, error: getApiErrorMessage(failure) });
      },
    );
    return () => {
      active = false;
    };
  }, [open, kind, query, key]);
  function close() {
    setOpen(false);
    setResponse(null);
    setSearch('');
    setQuery(null);
  }
  return (
    <>
      {selected && (
        <Typography>
          {label}: {selected.name} {selected.lastname} · Documento: {selected.ci}
        </Typography>
      )}
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        {selected ? 'Cambiar' : 'Seleccionar'} {label}
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth='sm' aria-label={`Seleccionar ${label}`}>
        <DialogTitle>Seleccionar {label}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label='Nombre o documento'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
              helperText='Ingresa al menos 3 caracteres'
            />
            <Button
              disabled={search.trim().length < 3}
              onClick={() => {
                setQuery({ search: search.trim(), page: 1, limit: 10 });
                setAttempt((value) => value + 1);
              }}
            >
              Buscar
            </Button>
            {query &&
              (!current ? (
                <CircularProgress aria-label='Buscando personas' />
              ) : current.error ? (
                <Alert
                  severity='error'
                  action={<Button onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>}
                >
                  {current.error}
                </Alert>
              ) : (
                current.page && (
                  <>
                    {!current.page.data.length && <Typography>No se encontraron resultados.</Typography>}
                    {current.page.data.map((person) => (
                      <Button
                        key={person.idUser}
                        onClick={() => {
                          onSelect(person);
                          close();
                        }}
                      >
                        {person.name} {person.lastname} · {person.ci}
                      </Button>
                    ))}
                    {current.page.meta.total > 0 && (
                      <ListPagination
                        query={query}
                        meta={current.page.meta}
                        onChange={(page) => setQuery({ ...query, ...page })}
                      />
                    )}
                  </>
                )
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cerrar búsqueda</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
