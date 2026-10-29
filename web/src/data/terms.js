import { HOU_NAMES } from './hou.js';
const names = ['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];
const ids = ['lichun','yushui','jingzhe','chunfen','qingming','guyu','lixia','xiaoman','mangzhong','xiazhi','xiaoshu','dashu','liqiu','chushu','bailu','qiufen','hanlu','shuangjiang','lidong','xiaoxue','daxue','dongzhi','xiaohan','dahan'];

export const TERMS = names.map((name, index) => ({
  id: ids[index], name, index,
  season: ['春','夏','秋','冬'][Math.floor(index / 6)],
  longitude: (315 + index * 15) % 360,
  hou: HOU_NAMES[index].map((name, i) => ({ id: `${ids[index]}-${i + 1}`, name, order: i, isDraft: true })),
  description: null, north: [], south: [], proverb: null,
  sourceIds: [],
}));

export const getTerm = id => TERMS.find(term => term.id === id) || TERMS[0];
export const adjacentTerm = (id, step) => TERMS[(getTerm(id).index + step + 24) % 24];

// Historical material stays empty until it has been checked against a source.
export const SOURCES = [];
export const FARM_RECORDS = [];
export const ANCIENT_IMAGE = null;
export const SOLAR_TERM_TIMES = [];
