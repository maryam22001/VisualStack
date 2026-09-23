import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import awsIsopack from '@isoflow/isopacks/dist/aws';
import gcpIsopack from '@isoflow/isopacks/dist/gcp';
import azureIsopack from '@isoflow/isopacks/dist/azure';
import kubernetesIsopack from '@isoflow/isopacks/dist/kubernetes';

// Helper to safely extract the pack whether Vite resolves it directly or under .default
const resolvePack = (pack: unknown) => {
  if (!pack || typeof pack !== 'object') return null;

  const candidate = pack as { icons?: unknown; default?: { icons?: unknown } };
  if (Array.isArray(candidate.icons)) return candidate;
  if (candidate.default && Array.isArray(candidate.default.icons)) return candidate.default;
  return null;
};

const rawPacks = [isoflowIsopack, awsIsopack, gcpIsopack, azureIsopack, kubernetesIsopack];
const validPacks = rawPacks.map(resolvePack).filter(
  (pack): pack is NonNullable<typeof pack> => Boolean(pack)
);

// Fallback icons if no external isopacks resolve properly
export const fallbackIcons = [
  {
    id: 'icon-server',
    name: 'Server',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15, 85 35, 50 55, 15 35" fill="%230284c7"/><polygon points="15 35, 50 55, 50 85, 15 65" fill="%230369a1"/><polygon points="85 35, 50 55, 50 85, 85 65" fill="%23075985"/></svg>',
    isIsometric: true
  },
  {
    id: 'icon-device',
    name: 'Device',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15, 85 35, 50 55, 15 35" fill="%2310b981"/><polygon points="15 35, 50 55, 50 85, 15 65" fill="%23059669"/><polygon points="85 35, 50 55, 50 85, 85 65" fill="%23047857"/></svg>',
    isIsometric: true
  }
];



export interface ArchitectureItem {
  id: string;
  name: string;
  icon: string;
}

// Flatten all bundled collections into a single icon registry
export const allIcons = validPacks.length > 0
  ? flattenCollections(validPacks as Parameters<typeof flattenCollections>[0])
  : fallbackIcons;

export const colors = [
  { id: 'c-cyan', value: '#00A8CC' },
  { id: 'c-teal', value: '#1A5164' },
  { id: 'c-amber', value: '#E67E22' },
  { id: 'c-gray', value: '#7F8C8D' }
];

export const items: ArchitectureItem[] = [
  { id: 'item-esp32', name: 'ESP32 & Sensors', icon: 'server' },
  { id: 'item-ztp', name: 'ZTP & GNS3', icon: 'server' },
  { id: 'item-mosquitto', name: 'Mosquitto MQTT', icon: 'server' },
  { id: 'item-laravel', name: 'Laravel API', icon: 'server' },
  { id: 'item-timescale', name: 'TimescaleDB', icon: 'server' },
  { id: 'item-ai', name: 'LangGraph Agents', icon: 'server' },
  { id: 'item-ui', name: 'Vue & Flutter UI', icon: 'server' }
];

export const initialData = {
  title: 'AegisOT 5-Layer Architecture',
  fitToScreen: true,
  icons: allIcons,
  colors,
  items,
  views: [
    {
      id: 'main-view',
      name: 'Architecture View',
      items: [
        { id: 'item-esp32', tile: { x: 0, y: 0 } },
        { id: 'item-ztp', tile: { x: 3, y: -2 } },
        { id: 'item-mosquitto', tile: { x: 5, y: 0 } },
        { id: 'item-laravel', tile: { x: 8, y: 0 } },
        { id: 'item-timescale', tile: { x: 8, y: 3 } },
        { id: 'item-ai', tile: { x: 11, y: 1 } },
        { id: 'item-ui', tile: { x: 14, y: 0 } }
      ],
      connectors: [
        {
          id: 'conn-1',
          style: 'SOLID' as const,
          color: 'c-cyan',
          anchors: [{ id: 'a1', ref: { item: 'item-esp32' } }, { id: 'a2', ref: { item: 'item-mosquitto' } }]
        },
        {
          id: 'conn-2',
          style: 'SOLID' as const,
          color: 'c-cyan',
          anchors: [{ id: 'a3', ref: { item: 'item-mosquitto' } }, { id: 'a4', ref: { item: 'item-laravel' } }]
        },
        {
          id: 'conn-3',
          style: 'SOLID' as const,
          color: 'c-teal',
          anchors: [{ id: 'a5', ref: { item: 'item-laravel' } }, { id: 'a6', ref: { item: 'item-timescale' } }]
        },
        {
          id: 'conn-4',
          style: 'SOLID' as const,
          color: 'c-amber',
          anchors: [{ id: 'a7', ref: { item: 'item-laravel' } }, { id: 'a8', ref: { item: 'item-ai' } }]
        },
        {
          id: 'conn-5',
          style: 'SOLID' as const,
          color: 'c-cyan',
          anchors: [{ id: 'a9', ref: { item: 'item-laravel' } }, { id: 'a10', ref: { item: 'item-ui' } }]
        }
      ]
    }
  ]
};