'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import useVerticalNav from '@menu/hooks/useVerticalNav';

const NavSearch = () => {
  const { isBreakpointReached } = useVerticalNav();

  return isBreakpointReached ? (
    <IconButton aria-label='Buscar'>
      <i aria-hidden='true' className='ri-search-line' />
    </IconButton>
  ) : (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        width: '100%',
        maxWidth: 680,
        minWidth: 0,
        minHeight: 48,
        px: 3,
        border: '1px solid var(--mui-palette-primary-lightOpacity)',
        borderRadius: 2.5,
        bgcolor: 'background.paper',
      }}
    >
      <Box aria-hidden='true' sx={{ display: 'flex', color: 'text.secondary' }}>
        <i className='ri-search-line' />
      </Box>
      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: '0.875rem',
        }}
      >
        Buscar pacientes, citas o historiales...
      </Typography>
      <Box
        component='span'
        sx={{
          display: { xs: 'none', lg: 'inline' },
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: '0.75rem',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          px: 1.5,
          py: 0.5,
        }}
      >
        Ctrl+K
      </Box>
    </Box>
  );
};

export default NavSearch;
