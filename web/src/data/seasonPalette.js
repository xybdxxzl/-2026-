// 转盘弧线与季相背景共用的四季颜料色；背景只取淡染。
export const SEASON_PALETTE = Object.freeze([
  { id:'spring', name:'春', color:'#3f806d', pale:'#e7eee2' },
  { id:'summer', name:'夏', color:'#b96146', pale:'#f4e8dc' },
  { id:'autumn', name:'秋', color:'#b38b2f', pale:'#f2ecd8' },
  { id:'winter', name:'冬', color:'#607e89', pale:'#e6ecec' },
].map(Object.freeze));

function tint(base, ink, strength) {
  const rgb = hex => [1,3,5].map(index => parseInt(hex.slice(index,index+2),16));
  const start=rgb(base), end=rgb(ink);
  return '#'+start.map((value,index) => Math.round(value+(end[index]-value)*strength).toString(16).padStart(2,'0')).join('');
}

// 每季两个锚点，分别位于立季与分至；在年角上首尾衔接。
export const SEASON_ANCHORS = SEASON_PALETTE.flatMap(season => [
  [tint(season.pale,'#faf6eb',.22),tint(season.pale,season.color,.045)],
  [tint(season.pale,'#faf6eb',.08),tint(season.pale,season.color,.105)],
]);
