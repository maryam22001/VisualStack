const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const BASE_URL = `${API_ORIGIN}/api`;

/** Fired when a protected request returns 401, so the app can drop to the sign-in screen. */
export const UNAUTHORIZED_EVENT = 'visualstack:unauthorized';

// ---------- Types ----------
export type Role = 'owner' | 'editor' | 'viewer';

export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
  currentWorkspaceId?: string;
  currentWorkspaceName?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  role: Role;
}

export interface WorkspaceMember {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface ApiDesign {
  id: string;
  workspaceId: string;
  createdById?: string | null;
  title: string;
  viewMode: string;
  theme: string;
  /** The whole VisualStackProject is stored here. */
  graphData: unknown;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Turns anything thrown into a user-facing message. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------- Transport ----------
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

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // A 401 on a protected route means the session expired. (/auth/* 401s are just "wrong password" etc.)
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const message = typeof data.error === 'string' ? data.error : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
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

/** Revokes every session of this account, on every device. */
export const apiLogoutAll = () => post<{ success: boolean }>('/auth/logout-all', {});

/** Asks the server who the session cookie belongs to. 401 = not signed in. */
export const apiMe = () => request<{ user: UserSession }>('/auth/me');

export const apiForgotPassword = (email: string) => post<{ message: string }>('/auth/forgot-password', { email });

export const apiResetPassword = (email: string, code: string, newPassword: string) =>
  post<{ message: string }>('/auth/reset-password', { email, code, newPassword });

// Kept so existing imports keep working.
export const forgotPasswordApi = apiForgotPassword;
export const resetPasswordApi = apiResetPassword;

// ---------- Workspaces & team ----------
export const apiGetWorkspaces = () => request<WorkspaceSummary[]>('/workspaces');

export const apiGetMembers = (workspaceId: string) => request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);

export const apiAddMember = (workspaceId: string, email: string, role: 'editor' | 'viewer') =>
  post<WorkspaceMember>(`/workspaces/${workspaceId}/members`, { email, role });

export const apiUpdateMemberRole = (workspaceId: string, userId: string, role: 'editor' | 'viewer') =>
  request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

export const apiRemoveMember = (workspaceId: string, userId: string) =>
  request<{ success: boolean }>(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });

// ---------- Architecture designs ----------
export const apiGetDesigns = (workspaceId: string) => request<ApiDesign[]>(`/workspaces/${workspaceId}/designs`);

export const apiSaveDesign = (payload: {
  id?: string;
  workspaceId: string;
  title?: string;
  viewMode?: string;
  theme?: string;
  graphData?: unknown;
}) => post<ApiDesign>('/designs', payload);

export const apiDeleteDesign = (designId: string) =>
  request<{ success: boolean }>(`/designs/${designId}`, { method: 'DELETE' });
