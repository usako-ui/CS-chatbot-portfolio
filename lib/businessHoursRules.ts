/**
 * 営業時間の判定ルール（T-14・純粋ロジック）
 *
 * DBアクセスも 'server-only' も含めないのは、
 * scripts/verify-business-hours.mjs から直接読み込んで検証できるようにするため。
 * DBからの取得と失敗時のフォールバックは lib/businessHours.ts が担当する。
 */
import type { BusinessSettings } from '@/types';

/** 営業時間の判定結果 */
export interface BusinessHoursStatus {
  /** true なら営業時間内 */
  isOpen: boolean;
  /** 営業開始時刻（時）。時間外メッセージの「翌営業日（10:00以降）」に使う */
  hoursStart: number;
}

/**
 * 指定タイムゾーンでの「年月日・曜日・時」を取り出す。
 *
 * 【なぜ toLocaleString + new Date を使わないか】
 * `new Date(d.toLocaleString('ja-JP', { timeZone }))` は
 * ロケール文字列を再パースする実装依存の書き方で、環境によって壊れる。
 * さらに、そこから `toISOString()` で日付を取ると UTC に戻されるため、
 * JSTの朝9時が前日の日付になり、休日判定が1日ずれる。
 * formatToParts なら指定タイムゾーンの値をそのまま取り出せる。
 */
function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = new Map(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  // hour は深夜0時が '24' になる環境があるため 0 に寄せる
  const hour = Number(parts.get('hour')) % 24;
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    /** YYYY-MM-DD 形式。holiday_dates と直接比較できる */
    dateString: `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`,
    /** 0=日〜6=土。closed_weekdays と直接比較できる */
    weekday: weekdayLabels.indexOf(parts.get('weekday') ?? ''),
    hour,
  };
}

/**
 * 営業設定から営業時間内かどうかを判定する（純関数・テストしやすいよう分離）。
 *
 * 以下のいずれか1つでも該当すれば営業時間外とする（requirements.md 確定仕様）：
 *   1. is_open_today が false（オペレーターの手動フラグ・臨時休業）
 *   2. 現在の曜日が closed_weekdays に含まれる
 *   3. 現在の日付が holiday_dates に含まれる
 *   4. 現在時刻が hours_start 未満、または hours_end 以上
 */
export function evaluateBusinessHours(
  settings: BusinessSettings,
  now: Date = new Date()
): BusinessHoursStatus {
  const hoursStart = settings.hours_start;

  if (!settings.is_open_today) {
    return { isOpen: false, hoursStart };
  }

  const { dateString, weekday, hour } = getZonedParts(now, settings.timezone);

  if (settings.closed_weekdays.includes(weekday)) {
    return { isOpen: false, hoursStart };
  }
  // holiday_dates は DATE[] のため 'YYYY-MM-DD' で返る。
  // 将来タイムスタンプ混じりの値が入っても比較できるよう先頭10文字で揃える。
  if (settings.holiday_dates.some((day) => day.slice(0, 10) === dateString)) {
    return { isOpen: false, hoursStart };
  }
  // hours_end ちょうどは営業時間外（18:00 は終了済み）
  const isOpen = hour >= settings.hours_start && hour < settings.hours_end;

  return { isOpen, hoursStart };
}

/**
 * 営業時間外にエスカレーションしたときの追記文言（FR-TIME-004・FR-CUS-006）。
 * 開始時刻は設定値から組み立てる。管理画面で9時に変更したら案内も9時になる。
 */
export function buildAfterHoursNotice(hoursStart: number): string {
  return `現在は営業時間外です。翌営業日（${hoursStart}:00以降）に担当者が対応します。`;
}
