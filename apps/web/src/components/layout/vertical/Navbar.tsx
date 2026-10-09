// Component Imports
import LayoutNavbar from '@layouts/components/vertical/Navbar';
import NavbarContent from './NavbarContent';

const Navbar = () => {
  return (
    <LayoutNavbar
      overrideStyles={{
        backgroundColor: 'var(--mui-palette-background-paper)',
        borderBottom: '1px solid var(--mui-palette-primary-lighterOpacity)',
        boxShadow: 'none',
      }}
    >
      <NavbarContent />
    </LayoutNavbar>
  );
};

export default Navbar;
