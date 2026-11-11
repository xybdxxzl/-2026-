import { Temporal } from '@js-temporal/polyfill';
import {
  Body, Observer, Equator, Horizon, HourAngle, SearchHourAngle, SearchSunLongitude, SunPosition,
} from 'astronomy-engine';
import { TERMS } from '../../data/terms.js';
import { termReference } from '../../data/hkoSolarTerms.js';
import { dialNeedle, projectShadow, sunDirection, radians } from './geometry.js';

export const MIN_DATE = '2025-01-01';
export const MAX_DATE = '2029-02-10';
export const MIN_CYCLE = 2025;
export const MAX_CYCLE = 2028;
export const OBSERVERS = Object.freeze([
  { id: 'beijing', name: '北京', latitude: 39.90, longitude: 116.41, zone: 'Asia/Shanghai' },
  { id: 'zhengzhou', name: '郑州', latitude: 34.75, longitude: 113.63, zone: 'Asia/Shanghai' },
  { id: 'hangzhou', name: '杭州', latitude: 30.27, longitude: 120.16, zone: 'Asia/Shanghai' },
  { id: 'guangzhou', name: '广州', latitude: 23.13, longitude: 113.26, zone: 'Asia/Shanghai' },
  { id: 'urumqi', name: '乌鲁木齐', latitude: 43.83, longitude: 87.62, zone: 'Asia/Shanghai' },
  { id: 'sydney', name: '悉尼', latitude: -33.87, longitude: 151.21, zone: 'Australia/Sydney' },
  { id: 'tromso', name: '特罗姆瑟', latitude: 69.65, longitude: 18.96, zone: 'Europe/Oslo' },
].map(place => Object.freeze({ ...place, elevation: 0 })));

const formatters = new Map();
export function localStamp(ms, zone) {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone);
}
export function localDate(ms, zone) {
  return localStamp(ms, zone).toPlainDate().toString();
}
export function formatLocal(ms, zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', hourCycle: 'h23',
  }));
  return formatters.get(zone).format(ms);
}
export function assertDate(date) {
  if (date < MIN_DATE || date > MAX_DATE) throw new RangeError(`日期范围为 ${MIN_DATE} 至 ${MAX_DATE}`);
  return Temporal.PlainDate.from(date);
}
export function dayBounds(date, zone) {
  const day = Temporal.PlainDate.from(date);
  return [day.toZonedDateTime(zone).epochMilliseconds,
    day.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds];
}
export function parseClock(date, time, zone, disambiguation = 'reject') {
  const plain = assertDate(date).toPlainDateTime(Temporal.PlainTime.from(time));
  try {
    const zoned = plain.toZonedDateTime(zone, { disambiguation });
    if (!zoned.toPlainDateTime().equals(plain)) throw new RangeError();
    return zoned.epochMilliseconds;
  } catch {
    throw new RangeError('该当地时间不存在或出现两次，请调整时间或选择重复钟点的先后次序。');
  }
}
export function validateObserver(input) {
  if (!input || [input.latitude, input.longitude, input.elevation].some(value =>
    value === '' || value == null || !Number.isFinite(Number(value)))) throw new RangeError('请填写有效的经纬度和海拔。');
  const latitude = Number(input.latitude), longitude = Number(input.longitude);
  const elevation = Number(input.elevation);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || elevation < -500 || elevation > 9000) {
    throw new RangeError('纬度须为 −90° 至 90°，经度 −180° 至 180°，海拔 −500 至 9000 米。');
  }
  let zone;
  try {
    if (typeof input.zone !== 'string' || !input.zone.trim()) throw new RangeError();
    zone = new Intl.DateTimeFormat('zh-CN', { timeZone: input.zone.trim() }).resolvedOptions().timeZone;
  } catch { throw new RangeError('请输入有效的 IANA 时区，例如 Asia/Shanghai。'); }
  return { id: input.id ?? 'custom', name: String(input.name || '自定义地点').slice(0, 30),
    latitude, longitude, elevation, zone };
}

const engineObserver = place => new Observer(place.latitude, place.longitude, place.elevation);
const mod24 = hours => (hours % 24 + 24) % 24;
export function solarAt(ms, place) {
  const time = new Date(ms), observer = engineObserver(place);
  const eq = Equator(Body.Sun, time, observer, true, true);
  const { altitude, azimuth } = Horizon(time, observer, eq.ra, eq.dec);
  const solarTime = mod24(HourAngle(Body.Sun, time, observer) + 12);
  const direction = sunDirection(altitude, azimuth);
  const needle = dialNeedle(place.latitude);
  return { altitude, azimuth, solarTime, direction, needle, shadow: projectShadow(needle, direction) };
}
export const longitudeAt = ms => SunPosition(new Date(ms)).elon;

export function atSolarTime(date, hour, place) {
  const [start, end] = dayBounds(date, place.zone);
  const observer = engineObserver(place);
  const event = SearchHourAngle(Body.Sun, observer, mod24(hour - 12), new Date(start - 1000));
  const ms = event.time.date.getTime();
  return ms >= start && ms < end ? ms : null;
}

const januaryOrder = [...TERMS.slice(-2), ...TERMS.slice(0, -2)];
const typicalDays = [5, 20, 4, 19, 5, 20, 4, 20, 5, 21, 5, 21, 7, 22, 7, 23, 7, 23, 8, 23, 7, 22, 7, 22];
const termCache = new Map();
export function calendarTerms(year) {
  if (!termCache.has(year)) {
    termCache.set(year, januaryOrder.map((term, index) => {
      const start = new Date(Date.UTC(year, Math.floor(index / 2), typicalDays[index] - 4));
      const result = SearchSunLongitude(term.longitude, start, 8);
      if (!result) throw new Error(`未找到 ${year} 年${term.name}的交节时刻`);
      const calculatedMs = result.date.getTime();
      const reference = termReference(year,index);
      const referenceMs = reference?.ms ?? null;
      const differenceSeconds = referenceMs == null ? null : Math.abs(calculatedMs - referenceMs) / 1000;
      const usesReference = differenceSeconds != null && differenceSeconds > 60;
      return { ...term, ms:usesReference ? referenceMs : calculatedMs, calculatedMs, referenceMs,
        differenceSeconds, usesReference, source:reference?.source, sourceLabel:reference?.label };
    }));
  }
  return termCache.get(year);
}
export function termAt(ms) {
  const year = new Date(ms).getUTCFullYear();
  const events = [calendarTerms(year - 1).at(-1), ...calendarTerms(year), calendarTerms(year + 1)[0]];
  const nextIndex = events.findIndex(event => event.ms > ms);
  const active = events[nextIndex - 1];
  const cycle = ms < events[3].ms ? year - 1 : year;
  return { active, next: events[nextIndex], cycle };
}
export function cycleTerm(cycle, id) {
  return calendarTerms(['xiaohan', 'dahan'].includes(id) ? cycle + 1 : cycle).find(term => term.id === id);
}

export function dayTrack(date, place) {
  const [start, end] = dayBounds(date, place.zone);
  const points = [];
  for (let ms = start; ms < end; ms += 300_000) points.push(solarAt(ms, place));
  points.push(solarAt(end, place));
  return points;
}
export function verticalShadow(altitude, height = 8) {
  if (altitude <= 0) return null;
  return altitude >= 89.999999 ? 0 : height / Math.tan(radians(altitude));
}

export function noonPreview(observation, termId) {
  if (!observation) return null;
  const { place, ms, cycle, selected } = observation;
  const sample = selected === termId ? ms : cycleTerm(cycle,termId).ms;
  const noon = atSolarTime(localDate(sample,place.zone),12,place);
  return noon == null ? null : solarAt(noon,place);
}

export function annualVerticalCurve(cycle, place) {
  const start = cycleTerm(cycle,'lichun').ms, end = cycleTerm(cycle+1,'lichun').ms;
  let day = Temporal.PlainDate.from(localDate(start,place.zone));
  const last = localDate(end,place.zone);
  const values = [];
  const at = ms => 360*(ms-start)/(end-start);
  const atNoon = date => {
    const noon = atSolarTime(date,12,place);
    return noon == null ? null : verticalShadow(solarAt(noon,place).altitude);
  };
  while (day.toString() <= last) {
    const noon = atSolarTime(day.toString(),12,place);
    if (noon != null && noon >= start && noon < end) {
      values.push({ x:at(noon), shadowChi:verticalShadow(solarAt(noon,place).altitude) });
    }
    day = day.add({ days:1 });
  }
  const terms = TERMS.map(term => {
    const ms = cycleTerm(cycle,term.id).ms;
    return { ...term, x:at(ms), shadowChi:atNoon(localDate(ms,place.zone)) };
  });
  return { values, terms };
}
