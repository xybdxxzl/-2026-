// Hong Kong Observatory, 24SolarTerms_YYYY.xml. Calendar order starts at 小寒.
// Original clock values, HKT (UTC+08:00), with minute resolution.
export const HKO_TERM_TIMES = Object.freeze({
  2025: [
    '01-05T10:33', '01-20T04:00', '02-03T22:10', '02-18T18:07', '03-05T16:07', '03-20T17:01', '04-04T20:49', '04-20T03:56',
    '05-05T13:57', '05-21T02:55', '06-05T17:57', '06-21T10:42', '07-07T04:05', '07-22T21:29', '08-07T13:52', '08-23T04:34',
    '09-07T16:52', '09-23T02:19', '10-08T08:41', '10-23T11:51', '11-07T12:04', '11-22T09:36', '12-07T05:05', '12-21T23:03',
  ],
  2026: [
    '01-05T16:23', '01-20T09:45', '02-04T04:02', '02-18T23:52', '03-05T21:59', '03-20T22:46', '04-05T02:40', '04-20T09:39',
    '05-05T19:49', '05-21T08:37', '06-05T23:48', '06-21T16:25', '07-07T09:57', '07-23T03:13', '08-07T19:43', '08-23T10:19',
    '09-07T22:41', '09-23T08:05', '10-08T14:29', '10-23T17:38', '11-07T17:52', '11-22T15:23', '12-07T10:53', '12-22T04:50',
  ],
  2027: [
    '01-05T22:10', '01-20T15:30', '02-04T09:46', '02-19T05:33', '03-06T03:40', '03-21T04:25', '04-05T08:17', '04-20T15:18',
    '05-06T01:25', '05-21T14:18', '06-06T05:26', '06-21T22:11', '07-07T15:37', '07-23T09:05', '08-08T01:27', '08-23T16:14',
    '09-08T04:28', '09-23T14:02', '10-08T20:17', '10-23T23:33', '11-07T23:39', '11-22T21:16', '12-07T16:38', '12-22T10:42',
  ],
  2028: [
    '01-06T03:55', '01-20T21:22', '02-04T15:31', '02-19T11:26', '03-05T09:25', '03-20T10:17', '04-04T14:03', '04-19T21:09',
    '05-05T07:12', '05-20T20:10', '06-05T11:16', '06-21T04:02', '07-06T21:30', '07-22T14:54', '08-07T07:21', '08-22T22:01',
    '09-07T10:22', '09-22T19:45', '10-08T02:09', '10-23T05:13', '11-07T05:27', '11-22T02:54', '12-06T22:25', '12-21T16:20',
  ],
});

export function hkoTermSource(year) {
  return `https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_${year}.xml`;
}

// 臺北市立天文科學教育館《2021–2030 簡易曆象表》，东经120°平太阳时。
const taipeiSource = 'https://www-ws.gov.taipei/Download.ashx?icon=..pdf&n=MjAyMS0yMDMw57Ch5piT5puG6LGh6KGoLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvNDM5L3JlbGZpbGUvNDc1NTcvNzk3MDY5OS8xMTUxOTk4MC1kMGExLTQ1NDctYTJlYS1iODZkNmFkMDZmZWEucGRm';
const boundaryTimes = {
  2024: { 23:'12-21T17:21' },
  2029: ['01-05T09:42','01-20T03:01','02-03T21:21','02-18T17:08'],
};

export function termReference(year,index) {
  const hko = HKO_TERM_TIMES[year]?.[index];
  const taipei = boundaryTimes[year]?.[index];
  if (!hko && !taipei) return null;
  return { ms:Date.parse(`${year}-${hko ?? taipei}:00+08:00`),
    source:hko ? hkoTermSource(year) : taipeiSource,
    label:hko ? '香港天文台' : '台北市立天文科学教育馆' };
}
