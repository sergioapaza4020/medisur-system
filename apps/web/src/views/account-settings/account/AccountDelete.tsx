'use client';

// MUI Imports
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';

const AccountDelete = () => {
  return (
    <Card
      sx={{
        border: 1,
        borderColor: (theme) => alpha(theme.palette.error.main, 0.2),
        bgcolor: (theme) => alpha(theme.palette.error.main, 0.04),
        borderRadius: 3,
        boxShadow: 'none',
      }}
    >
      <CardHeader
        avatar={<i className='ri-delete-bin-line' aria-hidden='true' />}
        title='Desactivar cuenta'
        titleTypographyProps={{ component: 'h2', variant: 'h6', fontWeight: 600 }}
        sx={{ px: { xs: 5, sm: 7 }, pt: 6, pb: 2, '& .MuiCardHeader-avatar': { color: 'error.main' } }}
      />
      <CardContent className='flex flex-col items-start gap-6' sx={{ px: { xs: 5, sm: 7 }, pb: 6 }}>
        <Typography color='text.secondary' variant='body2'>
          Confirma que deseas desactivar tu cuenta antes de continuar.
        </Typography>
        <FormControlLabel control={<Checkbox />} label='Confirmo que deseo desactivar mi cuenta' />
        <Button
          variant='contained'
          color='error'
          type='submit'
          sx={{ borderRadius: 2, minHeight: 40, boxShadow: 'none' }}
        >
          Desactivar cuenta
        </Button>
      </CardContent>
    </Card>
  );
};

export default AccountDelete;
