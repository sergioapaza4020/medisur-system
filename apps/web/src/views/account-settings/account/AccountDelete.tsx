'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import { myAccountService } from '@/services/users/myAccountService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function AccountDelete() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  async function deactivate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await myAccountService.deactivate();
      router.replace('/login');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card sx={{ border: 1, borderColor: 'error.main' }}>
      <CardHeader title='Desactivar cuenta' titleTypographyProps={{ component: 'h2' }} />
      <CardContent>
        <Typography sx={{ mb: 4 }}>
          Puedes desactivar tu cuenta. Para recuperar el acceso necesitarás solicitar su reactivación a administración.
        </Typography>
        <Button color='error' variant='contained' onClick={() => setOpen(true)}>
          Desactivar cuenta
        </Button>
        <Dialog
          open={open}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          fullWidth
          maxWidth='xs'
          aria-labelledby='deactivate-title'
          aria-describedby='deactivate-description'
          slotProps={{ transition: { onEntered: () => cancelButton.current?.focus() } }}
        >
          <DialogTitle id='deactivate-title'>¿Desactivar tu cuenta?</DialogTitle>
          <DialogContent>
            <DialogContentText id='deactivate-description'>
              Perderás acceso a MEDISUR y se cerrarán todas tus sesiones hasta que administración reactive tu cuenta.
              Tus datos se conservarán.
            </DialogContentText>
            {error && (
              <Alert severity='error' sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Button ref={cancelButton} autoFocus disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button color='error' variant='contained' disabled={busy} onClick={deactivate}>
              {busy ? 'Desactivando…' : 'Confirmar desactivación'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
