const BASE_URL = '/api';

export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
  currentWorkspaceId?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
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
    throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data);
  }
  return data as T;
}

// Auth API Calls
export const apiRegister = (fullName: string, email: string, password: string) =>
  request<{ user: UserSession; emailSent: boolean }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });

export const apiVerifyOtp = (userId: string, code: string) =>
  request<{ success: boolean; isVerified: boolean }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ userId, code }),
  });

export const apiResendCode = (userId: string) =>
  request<{ success: boolean; emailSent: boolean }>('/auth/resend', {
    method: 'POST',
    body: JSON.stringify({ userId }),
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
export const forgotPasswordApi = async (email: string) => {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to request reset');
  return res.json();
};

export const resetPasswordApi = async (email: string, code: string, newPassword: string) => {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to reset password');
  return res.json();
};