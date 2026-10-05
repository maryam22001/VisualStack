export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  isVerified: boolean;
  currentWorkspaceId?: string;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}