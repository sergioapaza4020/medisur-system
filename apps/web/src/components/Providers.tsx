// Type Imports
import type { ChildrenType, Direction } from '@core/types';

// Context Imports
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext';
import { SettingsProvider } from '@core/contexts/settingsContext';
import ThemeProvider from '@components/theme';

// Util Imports
import { getMode, getSettingsFromCookie } from '@core/utils/serverHelpers';

type Props = ChildrenType & {
  direction: Direction;
};

const Providers = async (props: Props) => {
  // Props
  const { children, direction } = props;

  // Vars
  const mode = await getMode();
  const settingsCookie = await getSettingsFromCookie();

  return (
    <VerticalNavProvider>
      <SettingsProvider settingsCookie={settingsCookie} mode={mode}>
        <ThemeProvider direction={direction}>{children}</ThemeProvider>
      </SettingsProvider>
    </VerticalNavProvider>
  );
};

export default Providers;
