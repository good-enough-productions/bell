import React from 'react';
import { CircularProgress, Box } from '@mui/material';

export function LoadingSpinner() {
  return (
    <Box className="flex justify-center p-4">
      <CircularProgress />
    </Box>
  );
}