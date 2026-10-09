'use client';

import IconButton from '@mui/material/IconButton';

import useVerticalNav from '@menu/hooks/useVerticalNav';

const NavToggle = () => {
  const { toggleVerticalNav, isToggled } = useVerticalNav();

  return (
    <IconButton
      aria-label={isToggled ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
      aria-expanded={Boolean(isToggled)}
      onClick={() => toggleVerticalNav()}
    >
      <i aria-hidden='true' className='ri-menu-line' />
    </IconButton>
  );
};

export default NavToggle;
