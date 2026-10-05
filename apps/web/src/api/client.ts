const BASE_URL = '/api';

export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
  currentWorkspaceId?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

// Auth API Calls
export const apiRegister = (fullName: string, email: string, password: string) =>
  request<{ user: UserSession }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });

export const apiVerifyOtp = (userId: string, code: string) =>
  request<{ success: boolean; isVerified: boolean }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ userId, code }),
  });

export const apiLogin = (email: string, password: string) =>
  request<{ user: UserSession }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

// Architecture Design API Calls
export const apiGetDesigns = (workspaceId: string) =>
  request<any[]>(`/workspaces/${workspaceId}/designs`);

export const apiSaveDesign = (payload: {
  id?: string;
  workspaceId: string;
  title: string;
  viewMode: string;
  theme: string;
  graphData: any;
}) =>
  request<any>('/designs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const apiDeleteDesign = (designId: string) =>
  request<{ success: boolean }>(`/designs/${designId}`, {
    method: 'DELETE',
  });