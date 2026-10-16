'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import AccountAvatar from '@/components/AccountAvatar';
import { useAuth } from '@/components/auth/AuthGuard';
import { myAccountService } from '@/services/users/myAccountService';
import type { MyAccount } from '@/types/users';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function AccountPhoto({
  account,
  onChange,
}: {
  account: MyAccount;
  onChange: (avatarUrl: string | null) => void;
}) {
  const { updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cleanupPending, setCleanupPending] = useState(false);
  const inFlight = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const { maxSize, mimeTypes } = account.avatarUpload;
  const sizeLabel = `${Number((maxSize / 1024 / 1024).toFixed(2))} MiB (${maxSize.toLocaleString('es')} bytes)`;

  async function save(file?: File) {
    if (inFlight.current) return;
    setError(null);
    setMessage(null);
    if (file && (!mimeTypes.includes(file.type) || file.size > maxSize)) {
      setError(`Selecciona una imagen JPEG, PNG o WebP de hasta ${sizeLabel}.`);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const result = file ? await myAccountService.uploadAvatar(file) : await myAccountService.deleteAvatar();
      onChange(result.avatarUrl);
      updateProfile({ avatarUrl: result.avatarUrl });
      setCleanupPending(result.cleanupPending);
      setMessage(file ? 'Foto de perfil actualizada' : 'Foto de perfil eliminada');
      setOpen(false);
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void save(file);
  }

  return (
    <Box sx={{ mb: 5 }} aria-busy={busy}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 4,
        }}
      >
        <AccountAvatar user={account} sx={{ width: 80, height: 80 }} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
            <Button ref={changeButton} onClick={() => fileInput.current?.click()} variant='contained' disabled={busy}>
              {busy ? 'Procesando foto…' : 'Cambiar foto'}
            </Button>
            <input
              ref={fileInput}
              hidden
              type='file'
              aria-label='Seleccionar foto de perfil'
              accept={mimeTypes.join(',')}
              disabled={busy}
              onChange={selectFile}
            />
            <Button
              color='error'
              disabled={busy || !account.avatarUrl}
              onClick={() => {
                setError(null);
                setOpen(true);
              }}
            >
              Eliminar foto
            </Button>
          </Box>
          <Typography variant='body2' color='text.secondary'>
            JPEG, PNG o WebP. Tamaño máximo: {sizeLabel}. Se sube al seleccionar.
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            La foto será pública. Evita imágenes con información clínica o documentos.
          </Typography>
        </Box>
      </Box>
      {error && !open && (
        <Alert severity='error' sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity={cleanupPending ? 'warning' : 'success'} sx={{ mt: 3 }}>
          {message}
          {cleanupPending ? '. La limpieza del archivo anterior quedó pendiente.' : ''}
        </Alert>
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth='xs'
        aria-labelledby='remove-avatar-title'
        aria-describedby='remove-avatar-description'
        slotProps={{
          transition: {
            onEntered: () => cancelButton.current?.focus(),
            onExited: () => {
              if (!account.avatarUrl) changeButton.current?.focus();
            },
          },
        }}
      >
        <DialogTitle id='remove-avatar-title'>¿Eliminar tu foto de perfil?</DialogTitle>
        <DialogContent>
          <DialogContentText id='remove-avatar-description'>
            Tu cuenta volverá a mostrar tus iniciales.
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
          <Button color='error' variant='contained' disabled={busy} onClick={() => void save()}>
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
