import React, { useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AppBar, Container, CssBaseline, Toolbar, Typography } from '@mui/material';
import { Bell } from 'lucide-react';
import { ReminderList } from './components/ReminderList';
import { requestNotificationPermission } from './services/notifications';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="min-h-screen bg-gray-100">
        <AppBar position="static">
          <Toolbar>
            <Bell className="mr-2" />
            <Typography variant="h6">Reminder PWA</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" className="py-8">
          <ReminderList />
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;