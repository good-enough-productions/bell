import React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';

interface ErrorDisplayProps {
  message: string;
}

export function ErrorDisplay({ message }: ErrorDisplayProps) {
  const messageLines = message.split('\n');
  
  return (
    <Alert 
      severity="error" 
      className="mb-4"
      variant="outlined"
    >
      <AlertTitle>Configuration Error</AlertTitle>
      <Box component="div" className="whitespace-pre-line">
        {messageLines.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < messageLines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </Box>
    </Alert>
  );
}