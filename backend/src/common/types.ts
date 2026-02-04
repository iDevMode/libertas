// Common types used across the application

export type Platform = 'notion' | 'airtable' | 'google_sheets';
export type SubscriptionTier = 'community' | 'pro' | 'enterprise';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DestinationType = 'sqlite' | 'postgresql' | 'json' | 'csv' | 'markdown' | 'relational_sqlite';
export type EntityType = 'page' | 'database' | 'record' | 'task' | 'document' | 'row';
export type PropertyType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'relation' | 'file' | 'url' | 'email' | 'phone' | 'formula' | 'rollup';
export type RelationType = 'parent_of' | 'child_of' | 'related_to' | 'assigned_to' | 'mentions' | 'linked_to';
export type BlockType = 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list' | 'numbered_list' | 'toggle' | 'code' | 'quote' | 'callout' | 'image' | 'video' | 'file' | 'divider' | 'table' | 'table_row';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// User types
export interface UserPayload {
  id: string;
  email: string;
  tier: SubscriptionTier;
}
