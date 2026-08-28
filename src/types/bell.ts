export type UserRole = 'Danny' | 'Bri';

export interface Ring {
  id: string;
  timestamp: string;
  sender: UserRole | string;
  message: string;
  status: 'PENDING' | 'COMPLETED';
  completedAt?: string;
  durationSeconds?: number | null;
}

export interface BellStatusResponse {
  active: Ring | null;
  history: Ring[];
  error?: string;
}

export interface AppSettings {
  userRole: UserRole;
  soundEnabled: boolean;
  appsScriptUrl: string;
  ntfyTopic: string;
}
