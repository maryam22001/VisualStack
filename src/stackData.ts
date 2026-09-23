import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import awsIsopack from '@isoflow/isopacks/dist/aws';
import gcpIsopack from '@isoflow/isopacks/dist/gcp';
import azureIsopack from '@isoflow/isopacks/dist/azure';
import kubernetesIsopack from '@isoflow/isopacks/dist/kubernetes';

export interface ArchitectureItem {
  id: string;
  name: string;
  icon: string;
}

// Flatten all bundled collections into a single icon registry
export const allIcons = flattenCollections([
  isoflowIsopack,
  awsIsopack,
  gcpIsopack,
  azureIsopack,
  kubernetesIsopack
]);

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