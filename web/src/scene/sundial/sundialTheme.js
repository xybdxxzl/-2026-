// Shared scene and legend palette. Existing paper/ink/cinnabar values mirror style.css.
export const SUNDIAL_COLORS = Object.freeze({
  paper: '#f6f3ea',          // Page and marker halo; matches --paper.
  stage: '#132922',          // Dark mineral-green gallery floor.
  stageLight: '#294439',
  stageEdge: '#101e1b',
  ink: '#243e36',            // Engraved grooves and current shadow; matches --ink.
  muted: '#626c60',          // Secondary annotations; matches --muted.
  cinnabar: '#9e4935',       // Analytical shadow endpoint; matches --accent.
  cinnabarTrack: '#a66f5c',  // Lower-saturation shadow-tip track.
  bronze: '#9a794c',         // Dial edge and support metal.
  bronzeDark: '#536b5c',     // Needle and dark bronze details.
  dial: '#c9b383',           // Matte, bright engraved face for high line contrast.
  dialHighlight: '#ead9b7',  // Engraved groove highlight.
  stone: '#b8b09e',          // Warm stepped stone base.
  stoneTop: '#c8c0ad',       // Base reading surface.
  sun: '#f3b963',            // Warm-gold solar arc and direction marker.
  sunCore: '#fff1c7',        // Sun marker centre.
  ray: '#fce0a2',            // Optional light incidence guide.
  halo: '#fff4d7',           // Light halo around the cinnabar endpoint.
  debug: '#167c80',          // ?debug=geom independent projection marker.
});

export const SUNDIAL_MODEL = Object.freeze({
  radius: 5,
  thicknessRatio: 0.07,
  needleDiameterRatio: 0.025,
  baseWidthRatio: 2.8,
  baseHeightRatio: 0.3,
  dialClearanceRatio: 0.15,
  skyRadiusRatio: 1.8,
  shadowWidthRatio: 0.018,
});

export const SUNDIAL_VIEWS = Object.freeze({
  oblique: { azimuth: 32, elevation: 29 },
  back: { azimuth: 157, elevation: 14 },
  side: { azimuth: 90, elevation: 8 },
});
