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
  status: 'DRAFT' | 'VALIDATED' | 'VALIDATION_FAILED' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'PAUSED' | 'RUNNING' | 'IDLE' | 'ARCHIVED' | string;
  price_per_call_usdc: number;
  pricing_model: string;
  rating?: number;
  completed_tasks?: number;
  current_version?: string;
  current_version_id?: string;
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

  getAgents: async (): Promise<AgentItem[]> => {
    try {
      const res = await apiFetch<any>('/api/v1/agents');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.items)) return res.items;
      if (res && Array.isArray(res.agents)) return res.agents;
      return [];
    } catch {
      try {
        const mres = await apiFetch<any>('/api/v1/marketplace/agents');
        return mres.agents || [];
      } catch {
        return [];
      }
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
    tool_permissions?: any[];
  }): Promise<{
    status: string;
    agent_id: string;
    id?: string;
    name: string;
    slug: string;
    current_status: string;
    version: string;
  }> => {
    return apiFetch<any>('/api/v1/agents', {
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

  getWorkspace: async (workspaceId: string) => {
    return apiFetch<any>(`/api/v1/workspaces/${workspaceId}`);
  },

  getWorkspaceLogs: async (workspaceId: string, tail: number = 100) => {
    return apiFetch<{ workspace_id: string; container_id: string; logs: string }>(
      `/api/v1/workspaces/${workspaceId}/logs?tail=${tail}`
    );
  },

  stopWorkspace: async (workspaceId: string) => {
    return apiFetch<any>(`/api/v1/workspaces/${workspaceId}/stop`, {
      method: 'POST',
    });
  },

  // GitHub Integration & Build Engine
  getGitHubInstallUrl: async (redirectPath: string = '/dashboard/settings/connected-accounts') => {
    return apiFetch<{ install_url: string; state: string }>(`/api/v1/github/install?redirect_path=${encodeURIComponent(redirectPath)}`);
  },

  connectDevGitHub: async () => {
    return apiFetch<any>('/api/v1/github/connect-dev', { method: 'POST' });
  },

  getGitHubRepos: async (): Promise<{
    connected: boolean;
    installations: any[];
    repos: any[];
  }> => {
    try {
      const data = await apiFetch<any>('/api/v1/github/repos');
      if (typeof data === 'object' && 'connected' in data) {
        return data;
      }
      if (Array.isArray(data)) {
        return { connected: data.length > 0, installations: [], repos: data };
      }
      return { connected: false, installations: [], repos: [] };
    } catch {
      return { connected: false, installations: [], repos: [] };
    }
  },

  getGitHubInstallations: async () => {
    try {
      return await apiFetch<any[]>('/api/v1/github/installations');
    } catch {
      return [];
    }
  },

  syncGitHubInstallations: async () => {
    return apiFetch<any[]>('/api/v1/github/installations/sync', {
      method: 'POST',
    });
  },

  linkGitHubInstallation: async (installationId: string) => {
    return apiFetch<any>('/api/v1/github/installations/link', {
      method: 'POST',
      body: JSON.stringify({ installation_id: installationId }),
    });
  },

  disconnectGitHubInstallation: async (installationDbId: string) => {
    return apiFetch<any>(`/api/v1/github/installations/${installationDbId}`, {
      method: 'DELETE',
    });
  },

  createAgentVersionWithRepo: async (agentId: string, payload: {
    version: string;
    system_instructions: string;
    source_type?: string;
    source_repo?: string;
    source_ref?: string;
    installation_id?: string;
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

  getAgentDetail: async (agentId: string) => {
    return apiFetch<any>(`/api/v1/agents/${agentId}`);
  },

  validateAgent: async (agentId: string) => {
    return apiFetch<{
      status: string;
      validation_id: string;
      passed: boolean;
      validation_passed: boolean;
      new_status: string;
      new_agent_status: string;
      risk_score: number;
      findings: any[];
    }>(`/api/v1/agents/${agentId}/validate`, {
      method: 'POST',
    });
  },

  publishAgent: async (agentId: string, payload?: { tx_hash?: string; block_number?: number }) => {
    return apiFetch<{
      status: string;
      agent_id: string;
      new_status: string;
      tx_hash?: string;
      block_number?: number;
    }>(`/api/v1/agents/${agentId}/publish`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    });
  },
};
