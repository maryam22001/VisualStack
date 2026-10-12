import type { Request, Response } from 'express';
import { prisma } from '../services/db.service';
import { canWrite, getRole } from '../services/access.service';

// All routes using these handlers sit behind requireAuth, so req.userId is always set.
// Being signed in is not enough: the user needs the right ROLE in the design's workspace
// (any role may read; only owner/editor may create, change or delete).

const NO_ACCESS = { error: 'You do not have access to this workspace.' };
const VIEW_ONLY = { error: 'You have view-only access to this workspace.' };

export async function getWorkspaceDesigns(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    if (!(await getRole(req.userId!, workspaceId))) return res.status(403).json(NO_ACCESS);

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
        const role = await getRole(req.userId!, existing.workspaceId);
        if (!role) return res.status(403).json({ error: 'You do not have access to this design.' });
        if (!canWrite(role)) return res.status(403).json(VIEW_ONLY);

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
    const role = workspaceId ? await getRole(req.userId!, String(workspaceId)) : null;
    if (!role) return res.status(403).json(NO_ACCESS);
    if (!canWrite(role)) return res.status(403).json(VIEW_ONLY);

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

    const role = await getRole(req.userId!, existing.workspaceId);
    if (!role) return res.status(403).json({ error: 'You do not have access to this design.' });
    if (!canWrite(role)) return res.status(403).json(VIEW_ONLY);

    await prisma.design.delete({ where: { id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete design.' });
  }
}
