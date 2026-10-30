export type TextLayer = {
  id: string; enabled: boolean; text: string;
  face: 'top'|'bottom'; mode: 'emboss'|'engrave'; layout: 'linear'|'arc';
  font: 'sans'|'serif'|'mono'|'custom'; weight: 'regular'|'bold'; italic: boolean;
  size: number; depth: number; tracking: number; lineHeight: number;
  align: 'left'|'center'|'right'; x: number; y: number; rotation: number;
  radius: number; angle: number; clockwise: boolean; kerning: boolean;
};
export type Project = {
  version: number; name: string; units: 'in'|'mm'; color: string; rollerCount: number;
  rollerDiameter: number; betweenMin: number; betweenMax: number; targetPosition: number;
  thickness: number; gapWidth: number; gapLength: number; cageDiameter: number;
  boreEnabled: boolean; boreDiameter: number; compensation: number; compensateBore: boolean;
  chamferTop: number; chamferBottom: number; chamferTopAngle: number; chamferBottomAngle: number;
  quality: 'draft'|'standard'|'fine'|'ultra';
  texts: TextLayer[]; customFont?: string; customFontName?: string;
};
export type Model = {
  positions: Float32Array; indices: Uint32Array; volume: number; surfaceArea: number;
  triangles: number; components: number; zOffset: number; milliseconds: number; signature: string;
};
export type ViewSettings = {
  rollers: boolean; dimensions: boolean; grid: boolean; wireframe: boolean;
  material: string; view: 'iso'|'top'|'bottom'|'front'; reset: number;
};
