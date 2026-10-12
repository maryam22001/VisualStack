import { prisma } from './db.service';

/**
 * Workspace roles
 *   owner  - everything, including managing members
 *   editor - create / edit / delete designs
 *   viewer - read-only
 * Rows created before roles existed hold the legacy value "member"; it is treated as editor.
 */
export type Role = 'owner' | 'editor' | 'viewer';

export function normalizeRole(raw: string | null | undefined): Role {
    if (raw === 'owner') return 'owner';
    if (raw === 'viewer') return 'viewer';
    return 'editor';
}

export async function getRole(userId: string, workspaceId: string): Promise<Role | null> {
    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } }
    });
    return membership ? normalizeRole(membership.role) : null;
}

export const canWrite = (role: Role | null): boolean => role === 'owner' || role === 'editor';
