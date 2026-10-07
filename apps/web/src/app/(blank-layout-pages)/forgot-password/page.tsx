// Component Imports
import ForgotPassword from '@views/ForgotPassword';

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers';

const ForgotPasswordPage = async () => {
  // Vars
  const mode = await getServerMode();

  return <ForgotPassword mode={mode} />;
};

export default ForgotPasswordPage;
