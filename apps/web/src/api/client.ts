
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const BASE_URL = `${API_ORIGIN}/api`;

/** Fired when a protected request returns 401, so the app can drop to the sign-in screen. */
export const UNAUTHORIZED_EVENT = 'visualstack:unauthorized';

export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
  currentWorkspaceId?: string;
  currentWorkspaceName?: string;
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
    // Sends/receives the HTTP-only session cookie.
    credentials: 'include',
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 on a protected route means the session expired. (/auth/* 401s are just "wrong password" etc.)
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data);
  }
  return data as T;
}

const post = <T>(endpoint: string, body: unknown) =>
  request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });

// ---------- Auth ----------
export const apiRegister = (fullName: string, email: string, password: string) =>
  post<{ user: UserSession; emailSent: boolean }>('/auth/register', { fullName, email, password });

export const apiVerifyOtp = (userId: string, code: string) =>
  post<{ success: boolean; isVerified: boolean }>('/auth/verify', { userId, code });

export const apiResendCode = (email: string) =>
  post<{ success: boolean; emailSent: boolean }>('/auth/resend-code', { email });

export const apiLogin = (email: string, password: string) =>
  post<{ user: UserSession }>('/auth/login', { email, password });

export const apiLogout = () => post<{ success: boolean }>('/auth/logout', {});

/** Asks the server who the session cookie belongs to. 401 = not signed in. */
export const apiMe = () => request<{ user: UserSession }>('/auth/me');

export const apiForgotPassword = (email: string) => post<{ message: string }>('/auth/forgot-password', { email });

export const apiResetPassword = (email: string, code: string, newPassword: string) =>
  post<{ message: string }>('/auth/reset-password', { email, code, newPassword });

// Kept so existing imports keep working.
export const forgotPasswordApi = apiForgotPassword;
export const resetPasswordApi = apiResetPassword;

// ---------- Architecture designs ----------
export const apiGetDesigns = (workspaceId: string) => request<any[]>(`/workspaces/${workspaceId}/designs`);

export const apiSaveDesign = (payload: {
  id?: string;
  workspaceId: string;
  title: string;
  viewMode: string;
  theme: string;
  graphData: any;
}) => post<any>('/designs', payload);

export const apiDeleteDesign = (designId: string) =>
  request<{ success: boolean }>(`/designs/${designId}`, { method: 'DELETE' });
