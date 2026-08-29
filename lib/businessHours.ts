/**
 * 営業時間判定（T-14）
 *
 * 判定はすべてサーバー側で行う。
 * ブラウザの時計を信用すると、端末のタイムゾーンや時刻をずらすだけで
 * 「営業時間内」を偽装できてしまうため（FR-TIME-001）。
 *
 * 設定は business_settings テーブル（1レコードのみ）で管理する。
 * 環境変数にしないのは、オペレーターが管理画面から変更できる必要があるため（FR-TIME-006）。
 */
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateBusinessHours } from '@/lib/businessHoursRules';
import type { BusinessHoursStatus } from '@/lib/businessHoursRules';
import type { BusinessSettings } from '@/types';

// 判定ルール本体と時間外文言は純粋ロジック側にある。
// 呼び出し側が import 先を意識せずに済むよう、ここから再エクスポートする。
export { evaluateBusinessHours, buildAfterHoursNotice } from '@/lib/businessHoursRules';
export type { BusinessHoursStatus } from '@/lib/businessHoursRules';

/** 判定に失敗したときの既定値。安全側に倒して「営業時間外」として扱う */
const FALLBACK_STATUS: BusinessHoursStatus = { isOpen: false, hoursStart: 10 };

/**
 * 営業設定を取得する。
 *
 * @throws レコードが無い・取得に失敗した場合
 */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from('business_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`営業設定の取得に失敗しました: ${error.message}`);
  }
  if (!data) {
    throw new Error('営業設定のレコードが存在しません');
  }
  return data as BusinessSettings;
}

/**
 * 現在が営業時間内かどうかを判定する。
 *
 * 判定に失敗した場合は例外を投げず「営業時間外」を返す。
 * 時間外だと誤判定しても顧客には翌営業日案内が出るだけだが、
 * 逆に営業時間内と誤判定すると、誰もいない時間に「すぐ対応します」と
 * 案内してしまい放置される（requirements.md エラー処理表・安全側に倒す）。
 */
export async function getBusinessHoursStatus(): Promise<BusinessHoursStatus> {
  try {
    return evaluateBusinessHours(await getBusinessSettings());
  } catch (error) {
    console.error('[getBusinessHoursStatus] 営業時間判定に失敗・時間外として扱います:', error);
    return FALLBACK_STATUS;
  }
}
