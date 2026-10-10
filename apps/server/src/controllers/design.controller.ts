import type { Request, Response } from 'express';
import { prisma } from '../services/db.service';

// All routes using these handlers sit behind requireAuth, so req.userId is always set.
// Being signed in is not enough: the user must also belong to the design's workspace.
async function isMember(userId: string, workspaceId: string): Promise<boolean> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  });
  return !!membership;
}

export async function getWorkspaceDesigns(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    if (!(await isMember(req.userId!, workspaceId))) {
      return res.status(403).json({ error: 'You do not have access to this workspace.' });
    }

    const designs = await prisma.design.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(designs);
  } catch {
    return res.status(500).json({ error: 'Could not fetch designs.' });
  }
}

export async function saveDesign(req: Request, res: Response) {
  try {
    const { id, workspaceId, title, viewMode, theme, graphData } = req.body ?? {};
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 120) : undefined;

    // Update an existing design.
    if (id) {
      const existing = await prisma.design.findUnique({ where: { id: String(id) } });
      if (existing) {
        if (!(await isMember(req.userId!, existing.workspaceId))) {
          return res.status(403).json({ error: 'You do not have access to this design.' });
        }
        const updated = await prisma.design.update({
          where: { id: existing.id },
          data: {
            ...(cleanTitle ? { title: cleanTitle } : {}),
            ...(viewMode ? { viewMode } : {}),
            ...(theme ? { theme } : {}),
            ...(graphData !== undefined ? { graphData } : {})
          }
        });
        return res.json(updated);
      }
      // Unknown id (e.g. a client-generated one): fall through and create a new design.
    }

    // Create a new design.
    if (!workspaceId || !(await isMember(req.userId!, String(workspaceId)))) {
      return res.status(403).json({ error: 'You do not have access to this workspace.' });
    }
    const created = await prisma.design.create({
      data: {
        workspaceId: String(workspaceId),
        createdById: req.userId!,
        title: cleanTitle || 'Untitled Architecture',
        viewMode: viewMode || 'clean',
        theme: theme || 'light',
        graphData: graphData ?? { nodes: [], clusters: [], connectors: [] }
      }
    });
    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ error: 'Could not save design.' });
  }
}

export async function deleteDesign(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.design.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Design not found.' });
    if (!(await isMember(req.userId!, existing.workspaceId))) {
      return res.status(403).json({ error: 'You do not have access to this design.' });
    }

    await prisma.design.delete({ where: { id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete design.' });
  }
}
