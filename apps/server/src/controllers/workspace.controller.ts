import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { getRole, normalizeRole } from '../services/access.service';

const inviteSchema = z.object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
    role: z.enum(['editor', 'viewer'], { message: 'Role must be "editor" or "viewer".' })
});
const roleSchema = z.object({
    role: z.enum(['editor', 'viewer'], { message: 'Role must be "editor" or "viewer".' })
});

const toMember = (m: any) => ({
    userId: m.userId as string,
    fullName: m.user.fullName as string,
    email: m.user.email as string,
    role: normalizeRole(m.role)
});

// GET /api/workspaces  - every workspace the signed-in user belongs to
export async function listMyWorkspaces(req: Request, res: Response) {
    try {
        const rows = await prisma.workspaceMember.findMany({
            where: { userId: req.userId! },
            include: { workspace: true }
        });
        const list = rows
            .map((m: any) => ({
                id: m.workspaceId as string,
                name: m.workspace.name as string,
                ownerId: m.workspace.ownerId as string,
                role: normalizeRole(m.role)
            }))
            // own workspaces first, then by name
            .sort((a: any, b: any) => (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) || a.name.localeCompare(b.name));
        return res.json(list);
    } catch (error) {
        console.error('[workspaces] list error:', error);
        return res.status(500).json({ error: 'Could not load your workspaces.' });
    }
}

// GET /api/workspaces/:workspaceId/members  - any member can see who else is in the workspace
export async function listMembers(req: Request, res: Response) {
    try {
        const { workspaceId } = req.params;
        if (!(await getRole(req.userId!, workspaceId))) {
            return res.status(403).json({ error: 'You do not have access to this workspace.' });
        }
        const rows = await prisma.workspaceMember.findMany({
            where: { workspaceId },
            include: { user: { select: { id: true, fullName: true, email: true } } }
        });
        return res.json(rows.map(toMember));
    } catch (error) {
        console.error('[workspaces] members error:', error);
        return res.status(500).json({ error: 'Could not load members.' });
    }
}

// POST /api/workspaces/:workspaceId/members  { email, role }   (owner only)
// The person must already have a verified VisualStack account.
export async function addMember(req: Request, res: Response) {
    try {
        const { workspaceId } = req.params;
        if ((await getRole(req.userId!, workspaceId)) !== 'owner') {
            return res.status(403).json({ error: 'Only the workspace owner can add members.' });
        }
        const parsed = inviteSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request.' });
        const { email, role } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isVerified) {
            return res.status(404).json({
                error: 'No VisualStack account uses that email yet. Ask them to sign up and verify first, then add them.'
            });
        }
        const existing = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: user.id } }
        });
        if (existing) return res.status(409).json({ error: 'That person is already a member of this workspace.' });

        await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id, role } });
        return res.status(201).json({ userId: user.id, fullName: user.fullName, email: user.email, role });
    } catch (error) {
        console.error('[workspaces] add member error:', error);
        return res.status(500).json({ error: 'Could not add the member.' });
    }
}

// PATCH /api/workspaces/:workspaceId/members/:userId  { role }   (owner only)
export async function updateMemberRole(req: Request, res: Response) {
    try {
        const { workspaceId, userId } = req.params;
        if ((await getRole(req.userId!, workspaceId)) !== 'owner') {
            return res.status(403).json({ error: 'Only the workspace owner can change roles.' });
        }
        const parsed = roleSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request.' });

        const target = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
            include: { user: { select: { id: true, fullName: true, email: true } } }
        });
        if (!target) return res.status(404).json({ error: 'Member not found.' });
        if (normalizeRole(target.role) === 'owner') return res.status(400).json({ error: "The owner's role can't be changed." });

        await prisma.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId, userId } },
            data: { role: parsed.data.role }
        });
        return res.json({ ...toMember(target), role: parsed.data.role });
    } catch (error) {
        console.error('[workspaces] role error:', error);
        return res.status(500).json({ error: 'Could not change the role.' });
    }
}

// DELETE /api/workspaces/:workspaceId/members/:userId
//   owner can remove anyone except themselves; any other member can remove themselves (leave).
export async function removeMember(req: Request, res: Response) {
    try {
        const { workspaceId, userId } = req.params;
        const myRole = await getRole(req.userId!, workspaceId);
        if (!myRole) return res.status(403).json({ error: 'You do not have access to this workspace.' });

        const leaving = userId === req.userId;
        if (!leaving && myRole !== 'owner') {
            return res.status(403).json({ error: 'Only the workspace owner can remove other members.' });
        }

        const target = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } }
        });
        if (!target) return res.status(404).json({ error: 'Member not found.' });
        if (normalizeRole(target.role) === 'owner') {
            return res.status(400).json({ error: "The workspace owner can't be removed." });
        }

        await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
        return res.json({ success: true });
    } catch (error) {
        console.error('[workspaces] remove error:', error);
        return res.status(500).json({ error: 'Could not remove the member.' });
    }
}
