'use client';

import { useState } from 'react';

import Link from 'next/link';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';

import MissionCarousel from './MissionCarousel';
import ModeDropdown from '@/components/layout/shared/ModeDropdown';

const Register = ({ mode }: { mode: Mode }) => {
  const [isPasswordShown, setIsPasswordShown] = useState(false);

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
                Crear cuenta
              </Typography>
              <Typography sx={{ mt: 2, color: 'text.secondary', lineHeight: 1.6 }}>
                Regístrate para poder agendar tus citas y acceder a nuestros servicios médicos.
              </Typography>
            </Box>
            <Box
              component='form'
              noValidate
              onSubmit={(e) => e.preventDefault()}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                '& .MuiOutlinedInput-root': { minHeight: 54, borderRadius: 2.5 },
                '& .MuiInputLabel-root:not(.Mui-focused):not(.Mui-error)': { color: 'text.secondary' },
              }}
            >
              <TextField
                autoFocus
                fullWidth
                id='register-username'
                name='username'
                autoComplete='username'
                label='Nombre de usuario'
                placeholder='Nombre de usuario'
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    startAdornment: (
                      <InputAdornment position='start'>
                        <i aria-hidden='true' className='ri-user-line' />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                fullWidth
                id='register-email'
                name='email'
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
              <FormControlLabel
                control={<Checkbox name='terms' />}
                sx={{ mr: 0, '& .MuiTypography-root': { fontSize: '0.875rem' } }}
                label={
                  <>
                    <span>Acepto los </span>
                    <Link className='text-primary' href='/' onClick={(e) => e.preventDefault()}>
                      términos y condiciones
                    </Link>
                  </>
                }
              />
              <Button
                fullWidth
                variant='contained'
                type='submit'
                disableElevation
                endIcon={<i aria-hidden='true' className='ri-arrow-right-line' />}
                sx={{ minHeight: 52, borderRadius: 2.5, fontSize: '1rem' }}
              >
                Registrarse
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
              <Divider sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>o regístrate con</Divider>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                {[
                  { name: 'Google', icon: 'ri-google-fill', color: 'text-secondary' },
                  { name: 'Facebook', icon: 'ri-facebook-fill', color: 'text-facebook' },
                ].map((provider) => (
                  <IconButton
                    key={provider.name}
                    type='button'
                    aria-label={`Registrarse con ${provider.name}`}
                    className={provider.color}
                    sx={{
                      width: 48,
                      height: 48,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2.5,
                      '&:hover': { bgcolor: 'primary.lighterOpacity' },
                    }}
                  >
                    <i aria-hidden='true' className={provider.icon} />
                  </IconButton>
                ))}
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
