/**
 * 管理画面向け Server Action（T-26・T-28・T-31・T-32）
 *
 * 全関数の先頭で requireOperatorId() を呼ぶこと。
 * 匿名顧客も Postgres ロールは 'authenticated' になるため、
 * 「サインイン済みか」だけの判定では顧客が管理画面のデータを取得できてしまう。
 * この中は service_role で動きRLSが効かないので、ここが唯一の防衛線になる。
 */
'use server';

import { revalidatePath } from 'next/cache';
import {
  countWaitingConversations,
  getConversationDetail,
  listConversations,
  listOperators,
  type ConversationDetail,
  type ConversationListItem,
} from '@/lib/operatorData';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireOperatorId } from '@/lib/supabase/server';
import type {
  ActionResult,
  BusinessSettings,
  ConversationStatus,
  FAQ,
  FAQCategory,
  OperatorProfile,
} from '@/types';

/** 認証失敗を共通の戻り値に変換する。各アクションの定型処理をまとめる */
async function guard(): Promise<{ operatorId: string } | { error: string }> {
  try {
    return { operatorId: await requireOperatorId() };
  } catch (error) {
    console.error('[dashboard] オペレーター認証失敗:', error);
    return {
      error: error instanceof Error ? error.message : 'ログインが必要です。',
    };
  }
}

// ============================================================
// 問い合わせ一覧・詳細
// ============================================================

/** 問い合わせ一覧を取得する（T-26） */
export async function fetchConversations(
  statuses?: ConversationStatus[]
): Promise<ActionResult<ConversationListItem[]>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    return { success: true, data: await listConversations(statuses) };
  } catch (error) {
    console.error('[fetchConversations] 取得失敗:', error);
    return { success: false, error: '問い合わせ一覧を取得できませんでした。' };
  }
}

/** 未対応件数を取得する（Q-006） */
export async function fetchWaitingCount(): Promise<ActionResult<number>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    return { success: true, data: await countWaitingConversations() };
  } catch (error) {
    console.error('[fetchWaitingCount] 取得失敗:', error);
    return { success: false, error: '未対応件数を取得できませんでした。' };
  }
}

/** 会話詳細を取得する（T-28・AC-013） */
export async function fetchConversationDetail(
  conversationId: string
): Promise<ActionResult<ConversationDetail>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    const detail = await getConversationDetail(conversationId);
    if (!detail) {
      return { success: false, error: '対象の会話が見つかりませんでした。' };
    }
    return { success: true, data: detail };
  } catch (error) {
    console.error('[fetchConversationDetail] 取得失敗:', error);
    return { success: false, error: '会話を取得できませんでした。' };
  }
}

/** オペレーター一覧を取得する（担当者変更のプルダウン用） */
export async function fetchOperators(): Promise<ActionResult<OperatorProfile[]>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    return { success: true, data: await listOperators() };
  } catch (error) {
    console.error('[fetchOperators] 取得失敗:', error);
    return { success: false, error: 'オペレーター情報を取得できませんでした。' };
  }
}

/**
 * 担当者を変更する（Q-002）。
 *
 * 会話をロックしない代わりに、明示的な付け替えができるようにしておく。
 * 担当者が離席・退勤したときに他のオペレーターが引き取れる必要があるため。
 *
 * @param operatorId null を渡すと未割当に戻す
 */
export async function assignOperator(
  conversationId: string,
  operatorId: string | null
): Promise<ActionResult<void>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await getSupabaseAdmin()
    .from('conversations')
    .update({ assigned_operator_id: operatorId })
    .eq('id', conversationId);

  if (error) {
    console.error('[assignOperator] 更新失敗:', error);
    return { success: false, error: '担当者を変更できませんでした。' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/${conversationId}`);
  return { success: true };
}

// ============================================================
// FAQ管理（T-31・Q-004：追加と有効/無効切替のみ。編集・削除はPhase 2）
// ============================================================

/** FAQを全件取得する。管理画面では無効なものも見せる必要がある */
export async function fetchAllFaqs(): Promise<ActionResult<FAQ[]>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  const { data, error } = await getSupabaseAdmin()
    .from('faqs')
    .select('id, category, question, answer, is_active')
    .order('category', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchAllFaqs] 取得失敗:', error);
    return { success: false, error: 'FAQを取得できませんでした。' };
  }
  return { success: true, data: (data ?? []) as FAQ[] };
}

/**
 * FAQを追加する（T-31）。
 *
 * ここで追加した内容はそのままAIの回答根拠になる。
 * 曖昧な書き方をするとAIも曖昧に答えるため、
 * 画面側で「断定できない情報は書かない」ことを案内している。
 */
export async function createFaq(
  category: FAQCategory,
  question: string,
  answer: string
): Promise<ActionResult<void>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) {
    return { success: false, error: '質問と回答の両方を入力してください。' };
  }
  if (q.length > 200 || a.length > 2000) {
    return {
      success: false,
      error: '質問は200文字以内、回答は2000文字以内で入力してください。',
    };
  }

  const { error } = await getSupabaseAdmin()
    .from('faqs')
    .insert({ category, question: q, answer: a });

  if (error) {
    console.error('[createFaq] 追加失敗:', error);
    return { success: false, error: 'FAQを追加できませんでした。' };
  }

  revalidatePath('/faq');
  return { success: true };
}

/**
 * FAQの有効・無効を切り替える（Q-004）。
 *
 * 削除は用意しない。無効にすればAIは参照しなくなり、
 * 誤って消した場合も戻せる。過去の回答の根拠も追える。
 */
export async function toggleFaq(
  faqId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await getSupabaseAdmin()
    .from('faqs')
    .update({ is_active: isActive })
    .eq('id', faqId);

  if (error) {
    console.error('[toggleFaq] 更新失敗:', error);
    return { success: false, error: 'FAQの状態を変更できませんでした。' };
  }

  revalidatePath('/faq');
  return { success: true };
}

// ============================================================
// 営業設定（T-32・AC-015〜017）
// ============================================================

/** 営業設定を取得する */
export async function fetchBusinessSettings(): Promise<
  ActionResult<BusinessSettings>
> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  const { data, error } = await getSupabaseAdmin()
    .from('business_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('[fetchBusinessSettings] 取得失敗:', error);
    return { success: false, error: '営業設定を取得できませんでした。' };
  }
  return { success: true, data: data as BusinessSettings };
}

/** 営業設定の更新内容。渡した項目だけ変更する */
export interface BusinessSettingsPatch {
  hours_start?: number;
  hours_end?: number;
  closed_weekdays?: number[];
  holiday_dates?: string[];
  is_open_today?: boolean;
}

/**
 * 営業設定を更新する（AC-015〜017）。
 *
 * 顧客側は毎回DBを読んで判定するため、保存した瞬間から反映される。
 * 再デプロイは不要。
 */
export async function updateBusinessSettings(
  patch: BusinessSettingsPatch
): Promise<ActionResult<void>> {
  const auth = await guard();
  if ('error' in auth) return { success: false, error: auth.error };

  // DB側にもCHECK制約があるが、画面に理由を出すためここでも確認する。
  // 制約違反のエラーメッセージをそのまま顧客担当者に見せても意味が伝わらない。
  if (patch.hours_start !== undefined && patch.hours_end !== undefined) {
    if (patch.hours_start >= patch.hours_end) {
      return {
        success: false,
        error: '営業開始時刻は終了時刻より前にしてください。',
      };
    }
  }
  if (patch.closed_weekdays?.some((d) => d < 0 || d > 6)) {
    return { success: false, error: '定休曜日の指定が不正です。' };
  }

  const admin = getSupabaseAdmin();
  const { data: current } = await admin
    .from('business_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!current) {
    return { success: false, error: '営業設定のレコードが見つかりませんでした。' };
  }

  const { error } = await admin
    .from('business_settings')
    .update({ ...patch, updated_by: auth.operatorId })
    .eq('id', current.id);

  if (error) {
    console.error('[updateBusinessSettings] 更新失敗:', error);
    return { success: false, error: '営業設定を保存できませんでした。' };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}
