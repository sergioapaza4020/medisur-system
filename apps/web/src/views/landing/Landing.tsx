import { Suspense } from 'react';

import { Box, Link } from '@mui/material';

import LandingNavbar from './LandingNavbar';
import HeroSection from './HeroSection';
import LandingFooter from './LandingFooter';
import { SpecialtiesDataSection, SpecialistsDataSection } from './LandingDataSections';
import { SpecialtiesSection, SpecialistsSection } from './CatalogSections';
import { HowItWorksSection, BenefitsSection } from './InformationalSections';
import FaqSection from './FaqSection';
import FinalCtaSection from './FinalCtaSection';
import ContactSection from './ContactSection';
import { interactionSx } from './landingStyles';

export default function Landing() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        ...interactionSx,
        '& section': { minWidth: 0, overflowWrap: 'break-word' },
      }}
    >
      <Link
        href='#contenido-principal'
        sx={{
          position: 'absolute',
          left: 16,
          top: -100,
          zIndex: 'tooltip',
          p: 3,
          bgcolor: 'background.paper',
          '&:focus': { top: 16 },
        }}
      >
        Saltar al contenido principal
      </Link>
      <LandingNavbar />
      <Box component='main' id='contenido-principal' tabIndex={-1} sx={{ flex: 1 }}>
        <HeroSection />
        <Suspense fallback={<SpecialtiesSection state={{ status: 'loading' }} />}>
          <SpecialtiesDataSection />
        </Suspense>
        <HowItWorksSection />
        <Suspense fallback={<SpecialistsSection state={{ status: 'loading' }} />}>
          <SpecialistsDataSection />
        </Suspense>
        <BenefitsSection />
        <FaqSection />
        <FinalCtaSection />
        <ContactSection />
      </Box>
      <LandingFooter />
    </Box>
  );
}
