'use client';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/GridLegacy';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

// Presentation only: replace these proposed categories with the notification
// module's supported preferences when its API and shared data source exist.
const preferencePreview = [
  {
    label: 'Citas y recordatorios',
    description: 'Avisos sobre citas y recordatorios de atención.',
    icon: 'ri-calendar-line',
  },
  {
    label: 'Cambios en citas',
    description: 'Reprogramaciones, cancelaciones y modificaciones.',
    icon: 'ri-calendar-event-line',
  },
  {
    label: 'Historia clínica',
    description: 'Actualizaciones relacionadas con la historia clínica.',
    icon: 'ri-file-list-3-line',
  },
  {
    label: 'Resultados y documentos',
    description: 'Disponibilidad de resultados y documentos.',
    icon: 'ri-file-text-line',
  },
  { label: 'Pacientes', description: 'Avisos relacionados con pacientes.', icon: 'ri-user-line' },
  { label: 'Profesionales', description: 'Avisos relacionados con profesionales de salud.', icon: 'ri-team-line' },
  { label: 'Avisos del sistema', description: 'Mantenimiento y comunicados de MEDISUR.', icon: 'ri-settings-3-line' },
];

const summaries = [
  {
    label: 'Todas',
    description: 'Notificaciones totales',
    icon: 'ri-notification-3-line',
    color: 'primary.main',
    background: 'primary.lightOpacity',
  },
  {
    label: 'No leídas',
    description: 'Pendientes de lectura',
    icon: 'ri-mail-unread-line',
    color: 'warning.main',
    background: 'warning.lightOpacity',
  },
  {
    label: 'Importantes',
    description: 'Requieren tu atención',
    icon: 'ri-flag-line',
    color: 'error.main',
    background: 'error.lightOpacity',
  },
];

const Notifications = () => (
  <Box sx={{ display: 'grid', gap: 6, minWidth: 0 }}>
    <Box>
      <Typography component='h1' variant='h4' sx={{ fontWeight: 600, mb: 2 }}>
        Centro de notificaciones
      </Typography>
      <Typography color='text.secondary'>
        Consulta tus notificaciones recientes y configura cómo quieres recibir avisos dentro de MEDISUR.
      </Typography>
    </Box>
    <Grid container spacing={5} alignItems='flex-start'>
      <Grid item xs={12} md={7}>
        <Stack spacing={5}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
            {summaries.map((summary) => (
              <Box key={summary.label} sx={{ minWidth: 0 }}>
                <Card variant='outlined' sx={{ height: '100%', borderRadius: 3, boxShadow: 'none' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 4 }}>
                    <Avatar
                      variant='rounded'
                      sx={{ bgcolor: summary.background, color: summary.color, width: 44, height: 44, borderRadius: 2 }}
                    >
                      <i aria-hidden='true' className={summary.icon} />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='body2' color='text.primary'>
                        {summary.label}
                      </Typography>
                      <Typography
                        variant='h4'
                        component='p'
                        aria-label={`${summary.label}: datos no disponibles`}
                        sx={{ fontWeight: 600 }}
                      >
                        —
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {summary.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
          <Card sx={{ border: 1, borderColor: 'divider', borderRadius: 3, boxShadow: (theme) => theme.shadows[1] }}>
            <CardHeader
              title='Notificaciones recientes'
              subheader='Los avisos de tu actividad en MEDISUR aparecerán aquí.'
              titleTypographyProps={{ component: 'h2', variant: 'h6', fontWeight: 600 }}
              sx={{ p: { xs: 5, sm: 6 }, pb: 3 }}
            />
            <CardContent sx={{ px: { xs: 5, sm: 6 } }}>
              <Button disabled startIcon={<i aria-hidden='true' className='ri-check-double-line' />} sx={{ mb: 4 }}>
                Marcar todas como leídas
              </Button>
              <Stack
                alignItems='center'
                spacing={3}
                sx={{ borderTop: 1, borderColor: 'divider', py: 10, textAlign: 'center' }}
              >
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.lighterOpacity', color: 'primary.main' }}>
                  <i aria-hidden='true' className='ri-notification-3-line' />
                </Avatar>
                <Typography variant='h6' component='h3'>
                  Centro de notificaciones en preparación
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 380 }}>
                  Las notificaciones internas todavía no están disponibles. Cuando se habiliten, podrás consultar tus
                  avisos y gestionar su lectura desde aquí.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card sx={{ border: 1, borderColor: 'divider', borderRadius: 3, boxShadow: (theme) => theme.shadows[1] }}>
          <CardHeader
            title='Preferencias de notificaciones'
            subheader='Configura qué tipo de notificaciones quieres recibir dentro de MEDISUR.'
            titleTypographyProps={{ component: 'h2', variant: 'h6', fontWeight: 600 }}
            sx={{ p: { xs: 5, sm: 6 }, pb: 3 }}
          />
          <CardContent sx={{ px: { xs: 5, sm: 6 } }}>
            <Alert severity='info' sx={{ mb: 3, borderRadius: 2 }}>
              Vista previa de categorías. Las preferencias aún no están disponibles para guardar.
            </Alert>
            {preferencePreview.map((preference) => (
              <Box
                key={preference.label}
                sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 3, borderBottom: 1, borderColor: 'divider' }}
              >
                <Avatar
                  variant='rounded'
                  sx={{ flexShrink: 0, bgcolor: 'primary.lighterOpacity', color: 'primary.main', borderRadius: 2 }}
                >
                  <i aria-hidden='true' className={preference.icon} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <FormControlLabel
                    label={preference.label}
                    labelPlacement='start'
                    disabled
                    control={<Switch checked={false} />}
                    sx={{
                      m: 0,
                      width: '100%',
                      justifyContent: 'space-between',
                      gap: 1,
                      '& .MuiFormControlLabel-label.Mui-disabled': { color: 'text.primary', fontWeight: 500 },
                    }}
                  />
                  <Typography variant='body2' color='text.secondary'>
                    {preference.description}
                  </Typography>
                </Box>
              </Box>
            ))}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                mt: 5,
                '& .MuiButton-root': { flex: 1, minWidth: 140, borderRadius: 2, minHeight: 42 },
              }}
            >
              <Button variant='contained' disabled>
                Guardar cambios
              </Button>
              <Button variant='outlined' color='secondary' disabled>
                Restablecer
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

export default Notifications;
