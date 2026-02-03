// Use relative URLs so requests go through Next.js proxy (configured in next.config.js)
// This avoids CORS issues and works with Docker networking
const API_URL = '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data as T;
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    return this.request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.request<User>('/api/auth/me');
  }

  // Connections
  async getConnections() {
    return this.request<Connection[]>('/api/connections');
  }

  async getAuthUrl(platform: string) {
    return this.request<{ authUrl: string; state: string }>(
      `/api/connections/${platform}/authorize`
    );
  }

  async connectPlatform(platform: string, code: string, state?: string) {
    return this.request<Connection>(`/api/connections/${platform}/connect`, {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  }

  async disconnectPlatform(connectionId: string) {
    return this.request<void>(`/api/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  async getConnectionSchema(connectionId: string) {
    return this.request<SourceSchema>(`/api/connections/${connectionId}/schema`);
  }

  // Jobs
  async createJob(input: CreateJobInput) {
    return this.request<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getJobs(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ items: Job[]; total: number; hasMore: boolean }>(
      `/api/jobs${query ? `?${query}` : ''}`
    );
  }

  async getJob(jobId: string) {
    return this.request<Job>(`/api/jobs/${jobId}`);
  }

  async cancelJob(jobId: string) {
    return this.request<void>(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  async getJobDownload(jobId: string) {
    return this.request<{ downloadUrl: string; filename: string }>(
      `/api/jobs/${jobId}/download`
    );
  }

  // Exports
  async getExportEntities(
    jobId: string,
    params?: { type?: string; search?: string; limit?: number; offset?: number }
  ) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ items: Entity[]; total: number; hasMore: boolean }>(
      `/api/exports/${jobId}/entities${query ? `?${query}` : ''}`
    );
  }

  async getExportEntity(jobId: string, entityId: string) {
    return this.request<EntityDetail>(`/api/exports/${jobId}/entities/${entityId}`);
  }
}

export const api = new ApiClient(API_URL);

// Types
export interface User {
  id: string;
  email: string;
  tier: 'community' | 'pro' | 'enterprise';
}

export interface Connection {
  id: string;
  platform: string;
  platformAccountId: string;
  platformAccountName: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  status: string;
}

export interface SourceSchema {
  databases: DatabaseSchema[];
  pages?: number;
  totalRecords?: number;
  estimatedSize?: number;
}

export interface DatabaseSchema {
  id: string;
  title: string;
  properties: PropertySchema[];
  estimatedRecords?: number;
}

export interface PropertySchema {
  id: string;
  name: string;
  type: string;
}

export interface Job {
  id: string;
  sourcePlatform: string;
  destinationType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  recordsTotal: number | null;
  recordsProcessed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface CreateJobInput {
  connectionId: string;
  selectedEntities: string[];
  destinationType: 'sqlite' | 'json' | 'csv' | 'markdown';
  includeAttachments?: boolean;
  options?: Record<string, unknown>;
}

export interface Entity {
  id: string;
  entity_type: string;
  title: string;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  source_platform: string;
  source_url: string | null;
}

export interface EntityDetail {
  entity: Entity;
  properties: Property[];
  relations: Relation[];
  contentBlocks: ContentBlock[];
  attachments: Attachment[];
}

export interface Property {
  id: string;
  entity_id: string;
  property_name: string;
  property_type: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown;
}

export interface Relation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
}

export interface ContentBlock {
  id: string;
  entity_id: string;
  block_type: string;
  content: string | null;
  position: number;
}

export interface Attachment {
  id: string;
  entity_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  source_url: string | null;
}
