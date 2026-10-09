'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { verticalLayoutClasses } from '@layouts/utils/layoutClasses';

const FooterContent = () => (
  <Box
    className={verticalLayoutClasses.footerContent}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: { xs: 'center', sm: 'space-between' },
      flexWrap: 'wrap',
      gap: 2,
      minWidth: 0,
    }}
  >
    <Typography
      component='p'
      variant='body2'
      sx={{ color: 'text.secondary', fontSize: '0.8125rem', lineHeight: 1.6, textAlign: { xs: 'center', sm: 'start' } }}
    >
      © {new Date().getFullYear()}{' '}
      <Box component='span' sx={{ fontWeight: 600 }}>
        Medisur.
      </Box>{' '}
      Todos los derechos reservados.
    </Typography>
  </Box>
);

export default FooterContent;
