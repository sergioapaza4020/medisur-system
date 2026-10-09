'use client';

// React Imports
import { useRef } from 'react';

// Next Imports
import Link from 'next/link';

// MUI Imports
import { styled, useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';

// Component Imports
import VerticalNav, { NavHeader } from '@menu/vertical-menu';
import VerticalMenu from './VerticalMenu';
import Logo from '@components/layout/shared/Logo';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';

// Style Imports
import navigationCustomStyles from '@core/styles/vertical/navigationCustomStyles';

const StyledBoxForShadow = styled('div')(({ theme }) => ({
  top: 60,
  left: -8,
  zIndex: 2,
  opacity: 0,
  position: 'absolute',
  pointerEvents: 'none',
  width: 'calc(100% + 15px)',
  height: theme.mixins.toolbar.minHeight,
  transition: 'opacity .15s ease-in-out',
  background: `linear-gradient(var(--mui-palette-background-paper) 5%, rgb(var(--mui-palette-background-paperChannel) / 0.85) 30%, rgb(var(--mui-palette-background-paperChannel) / 0.5) 65%, rgb(var(--mui-palette-background-paperChannel) / 0.3) 75%, transparent)`,
  '&.scrolled': {
    opacity: 1,
  },
}));

const Navigation = () => {
  // Hooks
  const theme = useTheme();
  const { isBreakpointReached, toggleVerticalNav } = useVerticalNav();

  // Refs
  const shadowRef = useRef(null);

  const scrollMenu = (container: any, isPerfectScrollbar: boolean) => {
    container = isBreakpointReached || !isPerfectScrollbar ? container.target : container;

    if (shadowRef && container.scrollTop > 0) {
      // @ts-ignore
      if (!shadowRef.current.classList.contains('scrolled')) {
        // @ts-ignore
        shadowRef.current.classList.add('scrolled');
      }
    } else {
      // @ts-ignore
      shadowRef.current.classList.remove('scrolled');
    }
  };

  return (
    // Sidebar Vertical Menu
    <VerticalNav customStyles={navigationCustomStyles(theme)}>
      {/* Nav Header including Logo & nav toggle icons  */}
      <NavHeader>
        <Link href='/dashboard' aria-label='MEDISUR, inicio'>
          <Logo />
        </Link>
        <IconButton
          aria-label={isBreakpointReached ? 'Cerrar navegación' : 'Ocultar navegación'}
          onClick={() => toggleVerticalNav(isBreakpointReached ? false : undefined)}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'primary.lighterOpacity', color: 'primary.main' },
          }}
        >
          <i aria-hidden='true' className={isBreakpointReached ? 'ri-close-line' : 'ri-arrow-left-double-line'} />
        </IconButton>
      </NavHeader>
      <StyledBoxForShadow ref={shadowRef} />
      <VerticalMenu scrollMenu={scrollMenu} />
    </VerticalNav>
  );
};

export default Navigation;
