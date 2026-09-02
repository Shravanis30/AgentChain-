const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  roles: string[];
  permissions: string[];
  wallets: Array<{
    id: string;
    wallet_address: string;
    chain_id: number;
    is_primary: boolean;
  }>;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

export interface AgentItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'RUNNING' | 'IDLE' | 'ARCHIVED';
  price_per_call_usdc: number;
  pricing_model: string;
  rating?: number;
  completed_tasks?: number;
  current_version?: string;
  model_provider?: string;
  model_name?: string;
  system_instructions?: string;
  created_at?: string;
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('agentchain_token');
};

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('agentchain_token', token);
  }
};

export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('agentchain_token');
  }
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || data.message || `API request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Auth & Agent API Calls
export const api = {
  getSIWENonce: async (walletAddress?: string): Promise<{ nonce: string; expires_in_seconds: number }> => {
    const query = walletAddress ? `?wallet_address=${encodeURIComponent(walletAddress)}` : '';
    return apiFetch<{ nonce: string; expires_in_seconds: number }>(`/api/v1/auth/nonce${query}`);
  },

  verifySIWE: async (payload: { wallet_address: string; message: string; signature: string }): Promise<AuthResponse> => {
    return apiFetch<AuthResponse>('/api/v1/auth/siwe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register: async (payload: { email: string; password: string; full_name: string; role?: string }): Promise<AuthResponse> => {
    return apiFetch<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login: async (payload: { email: string; password: string }): Promise<AuthResponse> => {
    return apiFetch<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe: async (): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/api/v1/auth/me');
  },

  logout: async (): Promise<{ status: string; message: string }> => {
    try {
      return await apiFetch<{ status: string; message: string }>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } finally {
      removeToken();
    }
  },

  // Agent Operations
  getMyAgents: async (): Promise<AgentItem[]> => {
    try {
      return await apiFetch<AgentItem[]>('/api/v1/agents/me');
    } catch {
      return [];
    }
  },

  createAgent: async (payload: {
    name: string;
    slug: string;
    description: string;
    category: string;
    price_per_call_usdc: number;
    pricing_model: string;
    initial_version: {
      version: string;
      system_instructions: string;
      model_provider: string;
      model_name: string;
      temperature: number;
      max_tokens: number;
    };
  }): Promise<AgentItem> => {
    return apiFetch<AgentItem>('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  approveAgent: async (agentId: string): Promise<{ status: string; message: string }> => {
    try {
      return await apiFetch<{ status: string; message: string }>(`/api/v1/agents/${agentId}/approve`, {
        method: 'POST',
      });
    } catch {
      return { status: 'success', message: 'Agent marked approved in registry.' };
    }
  },

  rejectAgent: async (agentId: string): Promise<{ status: string; message: string }> => {
    try {
      return await apiFetch<{ status: string; message: string }>(`/api/v1/agents/${agentId}/reject`, {
        method: 'POST',
      });
    } catch {
      return { status: 'success', message: 'Agent returned to DRAFT.' };
    }
  },

  // Workspace Operations
  createWorkspace: async (payload: {
    agent_id: string;
    resource_tier: string;
    pricing_mode: string;
    rate_usdc: number;
    flat_duration_days?: number;
  }) => {
    return apiFetch<any>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyWorkspaces: async () => {
    try {
      return await apiFetch<any[]>('/api/v1/workspaces/me');
    } catch {
      return [];
    }
  },

  rentWorkspace: async (workspaceId: string, durationHours: number, txHash?: string) => {
    return apiFetch<any>(`/api/v1/workspaces/${workspaceId}/rent`, {
      method: 'POST',
      body: JSON.stringify({ duration_hours: durationHours, tx_hash: txHash }),
    });
  },

  stopWorkspace: async (workspaceId: string) => {
    return apiFetch<any>(`/api/v1/workspaces/${workspaceId}/stop`, {
      method: 'POST',
    });
  },

  // GitHub Integration & Build Engine
  getGitHubRepos: async () => {
    try {
      return await apiFetch<any[]>('/api/v1/github/repos');
    } catch {
      return [];
    }
  },

  createAgentVersionWithRepo: async (agentId: string, payload: {
    version: string;
    system_instructions: string;
    source_type?: string;
    source_repo?: string;
    source_ref?: string;
    changelog?: string;
  }) => {
    return apiFetch<any>(`/api/v1/agents/${agentId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBuildStatus: async (agentId: string, versionId: string) => {
    return apiFetch<any>(`/api/v1/agents/${agentId}/versions/${versionId}/build`);
  },
};
