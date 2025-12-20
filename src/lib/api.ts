/**
 * API client for BurnLink backend
 * All secrets operations go through edge functions for security
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Base URL for the secrets edge function
const SECRETS_API_URL = `${SUPABASE_URL}/functions/v1/secrets`;

export interface CreateSecretRequest {
  type: 'message' | 'files' | 'voice' | 'chat';
  encrypted_payload: string;
  expiration: string;
  view_limit?: number;
  has_password?: boolean;
  require_click?: boolean;
  destroy_after_seconds?: number | null;
}

export interface SecretResponse {
  id: string;
  type: 'message' | 'files' | 'voice' | 'chat';
  encrypted_payload: string;
  expiration: string;
  view_limit: number;
  view_count: number;
  participants: string[];
  has_password: boolean;
  require_click: boolean;
  destroy_after_seconds: number | null;
  created_at: number;
}

export interface ViewResponse {
  success: boolean;
  view_count: number;
  destroyed?: boolean;
  views_remaining?: number;
  participants?: string[];
}

export interface ChatMessagesResponse {
  messages: {
    id: string;
    visible_id: string;
    text: string;
    sender: string;
    sender_name: string;
    timestamp: number;
  }[];
  destroy_votes: string[];
  participants: string[];
}

export interface DestroyResponse {
  success: boolean;
  destroyed: boolean;
  votes?: number;
  required?: number;
}

export interface APIError {
  error: 'not-found' | 'destroyed' | 'expired' | 'chat-full' | string;
  message?: string;
}

/**
 * Create a new secret
 */
export async function createSecret(data: CreateSecretRequest): Promise<{ id: string; created_at: number }> {
  const response = await fetch(SECRETS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create secret');
  }

  return response.json();
}

/**
 * Fetch a secret without destroying it
 * GET requests do not increment view count - safe for link previews
 */
export async function getSecret(secretId: string): Promise<SecretResponse> {
  const response = await fetch(`${SECRETS_API_URL}/${secretId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw { ...error, status: response.status } as APIError & { status: number };
  }

  return response.json();
}

/**
 * Confirm viewing a secret - this increments view count and may destroy it
 */
export async function confirmView(secretId: string, participantId?: string): Promise<ViewResponse> {
  const response = await fetch(`${SECRETS_API_URL}/${secretId}/view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ participant_id: participantId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw { ...error, status: response.status } as APIError & { status: number };
  }

  return response.json();
}

/**
 * Manually destroy a secret (or vote to destroy for chat)
 */
export async function destroySecret(secretId: string, participantId?: string): Promise<DestroyResponse> {
  const response = await fetch(`${SECRETS_API_URL}/${secretId}/destroy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ participant_id: participantId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw { ...error, status: response.status } as APIError & { status: number };
  }

  return response.json();
}

/**
 * Get chat messages
 */
export async function getChatMessages(secretId: string): Promise<ChatMessagesResponse> {
  const response = await fetch(`${SECRETS_API_URL}/${secretId}/chat`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw { ...error, status: response.status } as APIError & { status: number };
  }

  return response.json();
}

/**
 * Send a chat message
 */
export async function sendChatMessage(
  secretId: string,
  message: {
    id: string;
    visible_id: string;
    text: string;
    sender: string;
    sender_name: string;
  }
): Promise<{ success: boolean }> {
  const response = await fetch(`${SECRETS_API_URL}/${secretId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.json();
    throw { ...error, status: response.status } as APIError & { status: number };
  }

  return response.json();
}
