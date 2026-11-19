// The instrument studio, its analytical overlays and the printed plates share these sRGB pigments.
export const palette = Object.freeze({
  paper: '#F4EEDF', paperEdge: '#E4D9C2', marble: '#EEE7D6',
  stone: '#BDB3A1', stoneLine: '#8F8573',
  bronze: '#8C5A2B', gold: '#D6A24A', bronzeDark: '#3A2515', lacquer: '#43291A',
  ink: '#231D19', lightInk: '#6E6254', cinnabar: '#B5382B', winter: '#34506E',
  patina: '#6B8573', shadow: '#4A3826',
  sunlight: '#FFF0D2', sky: '#FFF7E8', ground: '#D9CBB1',
  studioPaper:'#ECE7DD', studioEdge:'#B9ACA0', reflection:'#B8ADA1',
  oxide:'#AB8866', burnished:'#CEB998', umber:'#927660', stoneShade:'#C1B6A7',
  springWash: '#EAE4BC', summerWash: '#EFCFBD', autumnWash: '#EBD8A8', winterWash: '#CFD8E2',
  nightWash: '#DAD5CA', twilightWash: '#DFD8CC', dawnWash: '#E6DCCC', duskWash: '#E4D8C9',
  morningWash: '#EBDFC4', daylightWash: '#F1E2B8',
  onCinnabar: '#FFFFFF',
});

export const paperGradient = `radial-gradient(ellipse farthest-corner at 50% 50%, ${palette.paper}, ${palette.paperEdge})`;
export const studioCss = Object.fromEntries(Object.entries(palette).map(([key,value])=>['--dial-'+key,value]));
studioCss['--dial-background'] = paperGradient;
studioCss['--ruler-font'] = '"Songti SC","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';

export const branches = '子丑寅卯辰巳午未申酉戌亥';
export const inscriptionFont = '"KaiTi","STKaiti","Songti SC","Noto Serif CJK SC","SimSun",serif';

// Compatibility names also used by the time controls and educational overlays.
export const SUNDIAL_COLORS = Object.freeze({
  paper:palette.paper, stage:palette.ink, stageLight:palette.lightInk, stageEdge:palette.paperEdge,
  ink:palette.ink, muted:palette.lightInk, cinnabar:palette.cinnabar, cinnabarTrack:palette.cinnabar,
  bronze:palette.bronze, bronzeDark:palette.bronzeDark, dial:palette.marble, dialHighlight:palette.paper,
  stone:palette.stone, stoneTop:palette.marble, sun:palette.gold, sunCore:palette.sunlight,
  ray:palette.bronze, halo:palette.paper, debug:palette.cinnabar,
});
export const SUNDIAL_VIEWS = Object.freeze({
  oblique:{azimuth:46,elevation:24}, back:{azimuth:148,elevation:16},
  south:{azimuth:164,elevation:10}, side:{azimuth:90,elevation:8}, bowl:{azimuth:133,elevation:41},
});
export const SUNDIAL_SOLSTICES = Object.freeze({
  xiazhi:{name:'夏至', color:palette.cinnabar, arcAhead:palette.bronze, glow:palette.gold, core:palette.sunlight, angleRadius:1.12},
  dongzhi:{name:'冬至', color:palette.winter, arc:palette.winter, arcAhead:palette.winter, glow:palette.lightInk, core:palette.paper, angleRadius:1.72},
});
export const CELESTIAL_COLORS = Object.freeze({
  night:palette.ink, grid:palette.stoneLine, horizon:palette.lightInk, equator:palette.bronzeDark,
  ecliptic:palette.bronze, pole:palette.gold, stars:palette.ink, dipper:palette.bronze,
});
export const REFERENCE_COLORS = Object.freeze({
  post:palette.stone, base:palette.lightInk, cap:palette.marble, rule:palette.stoneLine,
});
const rgb = color => color.slice(1).match(/../g).map(channel=>parseInt(channel,16));
const stops = colors => [-90,-12,-6,0,10,75].map((alt,i)=>[alt,rgb(colors[i])]);
export const TIMELINE_COLORS = Object.freeze({
  morning:stops([palette.nightWash,palette.nightWash,palette.twilightWash,palette.dawnWash,palette.morningWash,palette.daylightWash]),
  evening:stops([palette.nightWash,palette.nightWash,palette.twilightWash,palette.duskWash,palette.morningWash,palette.daylightWash]),
});
