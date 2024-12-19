/**
 * Utility functions for date and time operations
 */

export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isTimeMatch(time1: string, time2: string): boolean {
  return time1 === time2;
}