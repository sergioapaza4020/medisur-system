// MUI Imports
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { SystemMode } from '@core/types';

const customShadows = (mode: SystemMode): Theme['customShadows'] => {
  const shadowColor = `var(--mui-mainColorChannels-${mode}Shadow)`;

  return {
    xs: `0px 1px 3px rgb(${shadowColor} / ${mode === 'light' ? 0.08 : 0.16})`,
    sm: `0px 2px 6px rgb(${shadowColor} / ${mode === 'light' ? 0.1 : 0.18})`,
    md: `0px 4px 12px rgb(${shadowColor} / ${mode === 'light' ? 0.12 : 0.2})`,
    lg: `0px 8px 20px rgb(${shadowColor} / ${mode === 'light' ? 0.14 : 0.22})`,
    xl: `0px 12px 32px rgb(${shadowColor} / ${mode === 'light' ? 0.16 : 0.24})`,
  };
};

export default customShadows;
