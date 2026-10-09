// Component Imports
import LayoutFooter from '@layouts/components/vertical/Footer';
import FooterContent from './FooterContent';

const Footer = () => {
  return (
    <LayoutFooter
      overrideStyles={{
        backgroundColor: 'var(--mui-palette-background-paper)',
        borderTop: '1px solid var(--mui-palette-divider)',
        boxShadow: 'none',
      }}
    >
      <FooterContent />
    </LayoutFooter>
  );
};

export default Footer;
