'use client';

// React Imports
import { useState } from 'react';
import type { SyntheticEvent, ReactElement } from 'react';

// MUI Imports
import Grid from '@mui/material/GridLegacy';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

const AccountSettings = ({ tabContentList }: { tabContentList: { [key: string]: ReactElement } }) => {
  // States
  const [activeTab, setActiveTab] = useState('account');

  const handleChange = (event: SyntheticEvent, value: string) => {
    setActiveTab(value);
  };

  return (
    <TabContext value={activeTab}>
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <TabList
            onChange={handleChange}
            variant='scrollable'
            aria-label='Configuración de cuenta'
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 52,
                px: { xs: 3, sm: 5 },
                textTransform: 'none',
                fontWeight: 500,
                color: 'text.secondary',
                '&.Mui-selected': { color: 'primary.main' },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
              },
              '& .MuiTabs-indicator': { borderRadius: 1 },
            }}
          >
            <Tab label='Cuenta' icon={<i className='ri-user-3-line' />} iconPosition='start' value='account' />
            <Tab
              label='Notificaciones'
              icon={<i className='ri-notification-3-line' />}
              iconPosition='start'
              value='notifications'
            />
          </TabList>
        </Grid>
        <Grid item xs={12}>
          <TabPanel value={activeTab} className='p-0'>
            {tabContentList[activeTab]}
          </TabPanel>
        </Grid>
      </Grid>
    </TabContext>
  );
};

export default AccountSettings;
