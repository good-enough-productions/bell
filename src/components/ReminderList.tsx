import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useReminders } from '../hooks/useReminders';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorDisplay } from './ErrorDisplay';

export function ReminderList() {
  const { reminders, loading, error } = useReminders();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <Paper elevation={2} className="p-4">
      <Typography variant="h6" className="mb-4">
        Upcoming Reminders
      </Typography>
      {reminders.length === 0 ? (
        <Typography color="textSecondary" className="text-center py-4">
          No upcoming reminders
        </Typography>
      ) : (
        <List>
          {reminders.map((reminder) => (
            <ListItem key={reminder.id}>
              <ListItemText
                primary={reminder.item}
                secondary={`${reminder.date} at ${reminder.time}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}