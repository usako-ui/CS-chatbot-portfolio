/**
 * 営業時間判定の検証（T-14）
 *
 * 実行：node scripts/verify-business-hours.mjs
 *
 * lib/businessHoursRules.ts の判定を、時刻を固定して確認する。
 * 本番（Vercel）のサーバーはUTCで動くため、サーバーのタイムゾーンが変わっても
 * 同じ結果になることを TZ=UTC と TZ=Asia/Tokyo の両方で確認する意図がある。
 * （どちらで実行しても全ケースが OK になれば、サーバーの時計設定に依存していない）
 */
import { evaluateBusinessHours, buildAfterHoursNotice } from '../lib/businessHoursRules.ts';

const base = {
  id: 'test',
  hours_start: 10,
  hours_end: 18,
  closed_weekdays: [0], // 日曜定休
  holiday_dates: [],
  is_open_today: true,
  timezone: 'Asia/Tokyo',
  updated_at: '',
  updated_by: null,
};

/** JSTの壁時計時刻からDateを作る（JST = UTC+9） */
const jst = (iso) => new Date(`${iso}+09:00`);

const cases = [
  // [説明, 設定の上書き, JST時刻, 期待するisOpen]
  ['平日14:00 営業時間内', {}, '2026-09-02T14:00', true],
  ['平日10:00 開始ちょうど', {}, '2026-09-02T10:00', true],
  ['平日09:59 開始前', {}, '2026-09-02T09:59', false],
  ['平日17:59 終了直前', {}, '2026-09-02T17:59', true],
  ['平日18:00 終了ちょうどは時間外', {}, '2026-09-02T18:00', false],
  ['平日22:00 シナリオ#7の時刻', {}, '2026-09-02T22:00', false],
  ['日曜14:00 定休曜日', {}, '2026-09-06T14:00', false],
  ['指定休日14:00', { holiday_dates: ['2026-09-02'] }, '2026-09-02T14:00', false],
  ['本日休業フラグON', { is_open_today: false }, '2026-09-02T14:00', false],
  [
    '早朝営業(8-18)の休日 日付ずれ回帰',
    { hours_start: 8, holiday_dates: ['2026-09-02'] },
    '2026-09-02T08:30',
    false,
  ],
  [
    '早朝営業(8-18)の平日 8:30',
    { hours_start: 8 },
    '2026-09-02T08:30',
    true,
  ],
  [
    '深夜0時台は時間外',
    {},
    '2026-09-02T00:30',
    false,
  ],
];

console.log(`TZ=${process.env.TZ ?? '(未設定・OS既定)'}\n`);
let ng = 0;
for (const [label, override, iso, expected] of cases) {
  const { isOpen } = evaluateBusinessHours({ ...base, ...override }, jst(iso));
  const ok = isOpen === expected;
  if (!ok) ng++;
  console.log(`${ok ? 'OK ' : 'NG '} ${label} → isOpen=${isOpen}（期待 ${expected}）`);
}

console.log(`\n時間外メッセージ: ${buildAfterHoursNotice(10)}`);
console.log(`設定変更時（9時開始）: ${buildAfterHoursNotice(9)}`);
console.log(ng === 0 ? '\n全ケース 期待通り' : `\n${ng}件が期待と不一致`);
process.exit(ng === 0 ? 0 : 1);
