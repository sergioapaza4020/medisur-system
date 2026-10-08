export type PrimaryColorConfig = {
  name?: string;

  light: {
    main: string;
    light: string;
    dark: string;
  };

  dark: {
    main: string;
    light: string;
    dark: string;
  };
};

const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',

    light: {
      main: '#0372D0',
      light: '#2D8BE0',
      dark: '#0238AE',
    },

    dark: {
      main: '#4D9CFF',
      light: '#80B8FF',
      dark: '#2878D8',
    },
  },
];

export default primaryColorConfig;
