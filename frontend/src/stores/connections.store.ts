import { create } from 'zustand';
import { api, Connection, SourceSchema } from '@/lib/api';

interface ConnectionsState {
  connections: Connection[];
  isLoading: boolean;
  connectingPlatform: string | null;
  error: string | null;

  fetchConnections: () => Promise<void>;
  initiateOAuth: (platform: string) => Promise<void>;
  connectPlatform: (platform: string, code: string, state?: string) => Promise<boolean>;
  disconnectPlatform: (connectionId: string) => Promise<boolean>;
  getSchema: (connectionId: string, refresh?: boolean) => Promise<SourceSchema | null>;
  clearError: () => void;
  clearConnecting: () => void;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  isLoading: false,
  connectingPlatform: null,
  error: null,

  fetchConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await api.getConnections();
      set({ connections, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  initiateOAuth: async (platform: string) => {
    set({ connectingPlatform: platform, error: null });
    try {
      const { authUrl } = await api.getAuthUrl(platform);
      window.location.href = authUrl;
    } catch (err) {
      set({ error: (err as Error).message, connectingPlatform: null });
    }
  },

  connectPlatform: async (platform: string, code: string, state?: string) => {
    set({ isLoading: true, error: null });
    try {
      const connection = await api.connectPlatform(platform, code, state);
      set((state) => ({
        connections: [...state.connections, connection],
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  disconnectPlatform: async (connectionId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.disconnectPlatform(connectionId);
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== connectionId),
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  getSchema: async (connectionId: string, refresh = true) => {
    try {
      return await api.getConnectionSchema(connectionId, refresh);
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  clearError: () => set({ error: null }),
  clearConnecting: () => set({ connectingPlatform: null }),
}));
