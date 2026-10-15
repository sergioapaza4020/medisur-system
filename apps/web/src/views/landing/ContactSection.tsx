import { Box, Button, Container, Link, Paper, Stack, Typography } from '@mui/material';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import MailOutline from '@mui/icons-material/MailOutline';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import MapOutlined from '@mui/icons-material/MapOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';

import { institutionalContact } from '@configs/institutionalContact';
import type { InstitutionalContact } from '@configs/institutionalContact';

import { sectionSx } from './landingStyles';

export default function ContactSection({ contact = institutionalContact }: { contact?: InstitutionalContact }) {
  const details = [
    { label: 'Dirección', value: contact.address, Icon: LocationOnOutlined },
    {
      label: 'Teléfono',
      value: contact.phone,
      href: contact.phone ? `tel:${contact.phone.replace(/[^+\d]/g, '')}` : undefined,
      Icon: PhoneOutlined,
    },
    {
      label: 'Correo institucional',
      value: contact.email,
      href: contact.email ? `mailto:${contact.email}` : undefined,
      Icon: MailOutline,
    },
    { label: 'Horarios de atención', value: contact.hours, Icon: AccessTimeOutlined },
  ].filter(({ value }) => value);

  return (
    <Container component='section' id='contacto' aria-labelledby='contacto-title' maxWidth='lg' sx={sectionSx}>
      <Typography component='h2' variant='h3' id='contacto-title' align='center' sx={{ mb: 8 }}>
        ¿Dónde encontrarnos?
      </Typography>
      <Box
        sx={{
          position: 'relative',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          alignItems='center'
          justifyContent='center'
          gap={4}
          sx={{
            minHeight: { xs: 260, sm: 340, md: 460 },
            p: contact.mapsEmbedUrl ? 0 : 6,
            textAlign: 'center',
            bgcolor: 'action.hover',
            overflow: 'hidden',
          }}
        >
          {contact.mapsEmbedUrl ? (
            <Box
              component='iframe'
              title='Ubicación del Centro Médico de Especialidades MEDISUR'
              src={contact.mapsEmbedUrl}
              loading='lazy'
              referrerPolicy='strict-origin-when-cross-origin'
              allowFullScreen
              width='1200'
              height='460'
              sx={{
                width: '100%',
                height: { xs: 260, sm: 340, md: 460 },
                border: 0,
                display: 'block',
                colorScheme: 'light',
              }}
            />
          ) : (
            <>
              <MapOutlined aria-hidden='true' color='secondary' sx={{ fontSize: 48 }} />
              <Typography color='text.secondary'>
                {contact.mapsUrl
                  ? 'Consulta la ubicación oficial de MEDISUR.'
                  : 'La ubicación oficial se publicará próximamente.'}
              </Typography>
            </>
          )}
        </Stack>
        <Paper
          elevation={0}
          sx={{
            position: { xs: 'relative', md: 'absolute' },
            top: { md: 24 },
            right: { md: 24 },
            width: { md: 300, lg: 320 },
            maxWidth: '100%',
            p: { xs: 5, sm: 6 },
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: { xs: 0, md: 2 },
            border: 1,
            borderColor: 'divider',
            boxShadow: { xs: 0, md: 3 },
          }}
        >
          <Typography component='h3' variant='h5' sx={{ mb: 5 }}>
            Centro Médico de Especialidades MEDISUR
          </Typography>
          {details.length ? (
            <Stack component='address' gap={4} sx={{ fontStyle: 'normal' }}>
              {details.map(({ label, value, href, Icon }) => (
                <Stack key={label} direction='row' alignItems='flex-start' gap={3}>
                  <Icon aria-hidden='true' color='secondary' sx={{ mt: 1, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Typography component='span' fontWeight={600}>
                      {label}
                    </Typography>
                    {href ? (
                      <Link
                        href={href}
                        underline='always'
                        sx={{ display: 'flex', alignItems: 'center', minHeight: 44 }}
                      >
                        {value}
                      </Link>
                    ) : (
                      <Typography color='text.secondary'>{value}</Typography>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography color='text.secondary'>
              Estamos preparando la información oficial de dirección, canales de contacto y horarios de atención.
            </Typography>
          )}
          {contact.mapsUrl && (
            <Button
              href={contact.mapsUrl}
              target='_blank'
              rel='noopener noreferrer'
              aria-label='Cómo llegar a MEDISUR (abre otra pestaña)'
              variant='contained'
              endIcon={<OpenInNew aria-hidden='true' />}
              fullWidth
              sx={{ mt: 6, minHeight: 44 }}
            >
              Cómo llegar
            </Button>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
