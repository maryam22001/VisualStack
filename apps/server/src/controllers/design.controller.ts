import { Request, Response } from 'express';
import { prisma } from '../services/db.service';

export async function getWorkspaceDesigns(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
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
    const { id, workspaceId, title, viewMode, theme, graphData } = req.body;

    const design = await prisma.design.upsert({
      where: { id: id || 'non-existent' },
      update: { title, viewMode, theme, graphData, updatedAt: new Date() },
      create: {
        workspaceId,
        title: title || 'Untitled Architecture',
        viewMode: viewMode || 'clean',
        theme: theme || 'light',
        graphData
      }
    });

    return res.json(design);
  } catch (error) {
    return res.status(500).json({ error: 'Could not save design.' });
  }
}

export async function deleteDesign(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.design.delete({ where: { id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete design.' });
  }
}