// MUI Imports
import Grid from '@mui/material/GridLegacy';

// Component Imports
import AccountDetails from './AccountDetails';
import AccountDelete from './AccountDelete';
import AccountSecurity from './AccountSecurity';

const Account = () => {
  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <AccountDetails />
      </Grid>
      <Grid item xs={12}>
        <AccountSecurity />
      </Grid>
      <Grid item xs={12}>
        <AccountDelete />
      </Grid>
    </Grid>
  );
};

export default Account;
