import { allIcons } from './stackData';

export interface IconResult {
  id: string;
  name: string;
  url: string;
}

// 1. Instant local search across AWS, GCP, Azure, Kubernetes, and Isoflow packs
export function searchLocalIcons(query: string, limit = 30): IconResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return allIcons
    .filter((icon) => icon.name.toLowerCase().includes(q) || icon.id.toLowerCase().includes(q))
    .slice(0, limit)
    .map((icon) => ({
      id: icon.id,
      name: icon.name,
      url: icon.url
    }));
}

// 2. Wide-net search via Iconify API (200k+ brand and developer tool icons)
export async function searchRemoteIcons(query: string, limit = 30): Promise<IconResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=${limit}`);
    const data = await res.json();
    const icons: string[] = data.icons || [];
    return icons.map((iconName) => {
      const [prefix, name] = iconName.split(':');
      return {
        id: iconName,
        name: iconName,
        url: `https://api.iconify.design/${prefix}/${name}.svg`
      };
    });
  } catch (err) {
    console.error('Remote icon search failed:', err);
    return [];
  }
}

// 3. Prefer bundled local isopacks; fall back to Iconify if local returns 0 matches
export async function findIcon(query: string): Promise<IconResult[]> {
  const local = searchLocalIcons(query);
  if (local.length > 0) return local;
  return searchRemoteIcons(query);
}