'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';

import MissionCarousel from './MissionCarousel';
import ModeDropdown from '@/components/layout/shared/ModeDropdown';
import { authService } from '@/services/auth/authService';
import type { PatientRegistration } from '@/types/auth';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import {
  emptyPatientRegistration,
  getRegistrationPasswordFeedback,
  validatePatientRegistration,
} from '@/utils/patientRegistration';
import { saveRegistrationNotice } from '@/utils/registrationNotice';

const Register = ({ mode }: { mode: Mode }) => {
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [form, setForm] = useState<PatientRegistration>(emptyPatientRegistration);
  const [errors, setErrors] = useState<Partial<Record<keyof PatientRegistration, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitInFlight = useRef(false);
  const router = useRouter();
  const passwordFeedback = getRegistrationPasswordFeedback(form.password);

  function change(field: keyof PatientRegistration, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlight.current || success) return;
    const validation = validatePatientRegistration(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    submitInFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await authService.register({
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim().toLowerCase(),
        ci: form.ci.trim(),
        password: form.password,
      });
      setForm(emptyPatientRegistration);
      setSuccess(true);
      saveRegistrationNotice(form.email);
      router.replace('/login');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setForm((current) => ({ ...current, password: '' }));
      submitInFlight.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleClickShowPassword = () => setIsPasswordShown((show) => !show);

  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 6, lg: 8 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(ellipse at 80% 15%, var(--mui-palette-primary-lighterOpacity), transparent 55%)',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          pointerEvents: 'none',
          borderRadius: '50%',
        },
        '&::before': {
          width: '85%',
          height: 260,
          bottom: -180,
          left: '-20%',
          bgcolor: 'primary.lightOpacity',
          transform: 'rotate(12deg)',
        },
        '&::after': {
          width: 420,
          height: 420,
          top: -300,
          right: '12%',
          border: '60px solid var(--mui-palette-primary-lighterOpacity)',
        },
        '& a:focus-visible': {
          outline: '2px solid var(--mui-palette-primary-main)',
          outlineOffset: 4,
          borderRadius: 1,
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1440,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 540px)',
            md: 'minmax(0, 1fr) minmax(0, 500px)',
            lg: '1fr minmax(0, 540px) 1fr',
          },
          justifyContent: 'center',
          alignItems: 'center',
          gap: { md: 6, lg: 8 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          component='section'
          aria-label='Nuestra misión'
          sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 360 }}
        >
          <MissionCarousel mode={mode} />
        </Box>

        <Card
          sx={{
            width: '100%',
            borderRadius: 5,
            border: '1px solid var(--mui-palette-primary-lighterOpacity)',
            boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
          }}
        >
          <CardContent sx={{ p: { xs: 5, sm: 9 }, '&:last-child': { pb: { xs: 5, sm: 9 } }, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 2, right: 2, zIndex: 1 }}>
              <ModeDropdown />
            </Box>
            <Box
              component={Link}
              href='/'
              aria-label='MEDISUR, inicio'
              sx={{ display: 'flex', justifyContent: 'center', mb: 7 }}
            >
              <Logo logoSize={54} />
            </Box>
            <Box sx={{ textAlign: 'center', mb: 7 }}>
              <Typography
                component='h1'
                variant='h4'
                sx={{
                  fontSize: { xs: '1.6rem', sm: '1.9rem' },
                  fontWeight: 700,
                  color: mode === 'dark' ? 'text.primary' : 'primary.dark',
                }}
              >
                Crear cuenta de paciente
              </Typography>
              <Typography sx={{ mt: 2, color: 'text.secondary', lineHeight: 1.6 }}>
                Regístrate para poder agendar tus citas y acceder a nuestros servicios médicos.
              </Typography>
            </Box>
            <Box
              component='form'
              noValidate
              onSubmit={handleSubmit}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                '& .MuiOutlinedInput-root': { minHeight: 54, borderRadius: 2.5 },
                '& .MuiInputLabel-root:not(.Mui-focused):not(.Mui-error)': { color: 'text.secondary' },
              }}
            >
              {error && (
                <Alert severity='error' sx={{ whiteSpace: 'pre-line' }}>
                  {error}
                </Alert>
              )}
              {success && <Alert severity='success'>Tu cuenta de paciente fue creada. Ya puedes iniciar sesión.</Alert>}
              {(['name', 'lastname', 'ci'] as const).map((field) => (
                <TextField
                  key={field}
                  fullWidth
                  required
                  name={field}
                  id={`register-${field}`}
                  label={{ name: 'Nombres', lastname: 'Apellidos', ci: 'Documento de identidad' }[field]}
                  autoComplete={{ name: 'given-name', lastname: 'family-name', ci: 'off' }[field]}
                  value={form[field]}
                  onChange={(event) => change(field, event.target.value)}
                  disabled={isSubmitting || success}
                  error={Boolean(errors[field])}
                  helperText={errors[field]}
                  inputProps={{ maxLength: field === 'ci' ? 30 : 100 }}
                />
              ))}
              <TextField
                fullWidth
                id='register-email'
                name='email'
                required
                value={form.email}
                onChange={(event) => change('email', event.target.value)}
                disabled={isSubmitting || success}
                error={Boolean(errors.email)}
                helperText={errors.email}
                inputProps={{ maxLength: 254 }}
                type='email'
                autoComplete='email'
                label='Correo electrónico'
                placeholder='tu@correo.com'
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i aria-hidden='true' className='ri-mail-line' />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label='Contraseña'
                id='register-password'
                name='password'
                required
                value={form.password}
                onChange={(event) => change('password', event.target.value)}
                disabled={isSubmitting || success}
                error={Boolean(errors.password)}
                helperText={errors.password}
                inputProps={{
                  'aria-describedby': `register-password-requirements${errors.password ? ' register-password-helper-text' : ''}`,
                }}
                autoComplete='new-password'
                placeholder='Ingresa tu contraseña'
                InputLabelProps={{ shrink: true }}
                type={isPasswordShown ? 'text' : 'password'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i aria-hidden='true' className='ri-lock-line' />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        type='button'
                        edge='end'
                        aria-label={isPasswordShown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={isPasswordShown}
                        onClick={handleClickShowPassword}
                        onMouseDown={(e) => e.preventDefault()}
                        sx={{ width: 44, height: 44 }}
                      >
                        <i aria-hidden='true' className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Box id='register-password-requirements' sx={{ mt: -3, minWidth: 0 }}>
                <Typography variant='body2' sx={{ mb: 1 }}>
                  La contraseña debe cumplir:
                </Typography>
                <Box
                  component='ul'
                  sx={{
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1,
                  }}
                >
                  {passwordFeedback.requirements.map((requirement) => {
                    const met = Boolean(form.password) && requirement.met;
                    const StatusIcon = met ? CheckCircleOutline : RadioButtonUnchecked;
                    return (
                      <Box
                        component='li'
                        key={requirement.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: met ? 'success.main' : 'text.secondary',
                          minWidth: 0,
                        }}
                      >
                        <StatusIcon fontSize='small' aria-hidden='true' />
                        <Typography variant='caption'>
                          <span>{met ? 'Cumplido' : 'Pendiente'}: </span>
                          {requirement.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                  La longitud máxima depende de los caracteres utilizados; los acentos y emojis pueden reducirla. Los
                  símbolos son opcionales.
                </Typography>
                <Typography id='register-password-strength' variant='body2' sx={{ mt: 2 }} aria-live='polite'>
                  Fortaleza: {passwordFeedback.strength}
                </Typography>
                <LinearProgress
                  variant='determinate'
                  value={passwordFeedback.progress}
                  aria-labelledby='register-password-strength'
                  color={
                    passwordFeedback.strength === 'Fuerte'
                      ? 'success'
                      : passwordFeedback.strength === 'Media'
                        ? 'primary'
                        : 'inherit'
                  }
                  sx={{ mt: 1, borderRadius: 1 }}
                />
              </Box>
              <Button
                fullWidth
                variant='contained'
                type='submit'
                disabled={isSubmitting || success}
                disableElevation
                endIcon={<i aria-hidden='true' className='ri-arrow-right-line' />}
                sx={{ minHeight: 52, borderRadius: 2.5, fontSize: '1rem' }}
              >
                {isSubmitting ? 'Registrando…' : 'Registrarse'}
              </Button>
              <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>¿Ya tienes una cuenta?</Typography>
                <Typography
                  component={Link}
                  href='/login'
                  color='primary'
                  sx={{ fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Iniciar sesión
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Box
          aria-hidden='true'
          sx={{
            display: { xs: 'none', lg: 'flex' },
            position: 'relative',
            minHeight: 520,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '48% 48% 40% 40%',
            overflow: 'hidden',
            background:
              'linear-gradient(160deg, var(--mui-palette-primary-lighterOpacity), var(--mui-palette-secondary-lighterOpacity))',
          }}
        >
          <Box sx={{ position: 'relative', width: '80%', minHeight: 320 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 280,
                border: '1px solid var(--mui-palette-primary-lightOpacity)',
                borderRadius: 6,
                bgcolor: 'primary.lighterOpacity',
                transform: 'rotate(-8deg)',
                color: 'primary.main',
              }}
            >
              <i className='ri-add-line' style={{ fontSize: 140 }} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                p: 5,
                borderRadius: 4,
                border: '1px solid var(--mui-palette-primary-lightOpacity)',
                bgcolor: 'background.paper',
                boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
                color: 'secondary.main',
              }}
            >
              <i className='ri-heart-pulse-line' style={{ fontSize: 48 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ width: 56, height: 5, borderRadius: 2, bgcolor: 'primary.lightOpacity' }} />
                <Box sx={{ width: 40, height: 5, borderRadius: 2, bgcolor: 'primary.lightOpacity' }} />
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(0deg, var(--mui-palette-background-default), transparent 35%)',
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Register;
