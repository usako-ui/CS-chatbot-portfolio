/**
 * 会話の所有権チェック（T-12）
 *
 * Server Action は service_role で動くため RLS が効かない。
 * conversation_id を引数に取る処理は、必ずここを通して
 * 「その会話が本当にその顧客のものか」をアプリ側で突合する。
 * これを省くと、他人のIDを推測して投げるだけで会話を覗ける（AC-012 崩壊）。
 */
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ConversationStatus, Message, SenderType } from '@/types';

/** DBの status は TEXT 型のため、型定義側の4種と一致するか実際に確認する */
const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'ai_handling',
  'waiting_operator',
  'operator_handling',
  'closed',
];

function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

/** 所有権チェックの結果として返す最小限の会話情報 */
export interface OwnedConversation {
  id: string;
  status: ConversationStatus;
}

/**
 * 会話が指定顧客のものであることを確認する。
 *
 * @param conversationId 会話ID（クライアントから渡されるため信用しない）
 * @param customerUserId requireCustomerId() で確定させた顧客のUID
 * @throws 会話が存在しない、または他人の会話だった場合
 */
export async function requireOwnedConversation(
  conversationId: string,
  customerUserId: string
): Promise<OwnedConversation> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id, status, customer_user_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`会話の取得に失敗しました: ${error.message}`);
  }

  // 「存在しない」と「他人のもの」でメッセージを分けない。
  // 分けると会話IDの存在有無を外部から探れてしまうため。
  if (!data || data.customer_user_id !== customerUserId) {
    throw new Error('この会話にアクセスする権限がありません。');
  }

  if (!isConversationStatus(data.status)) {
    throw new Error(`会話のステータスが不正です: ${data.status}`);
  }

  return { id: data.id, status: data.status };
}

/**
 * メッセージを1件保存する。
 *
 * @param senderId オペレーターのみ指定する。顧客・AIは NULL（DBスキーマの取り決め）
 * @throws 保存に失敗した場合。呼び出し側は顧客に再送信を促すこと
 */
export async function insertMessage(
  conversationId: string,
  senderType: SenderType,
  content: string,
  senderId: string | null = null
): Promise<void> {
  const { error } = await getSupabaseAdmin().from('messages').insert({
    conversation_id: conversationId,
    sender_type: senderType,
    sender_id: senderId,
    content,
  });

  if (error) {
    throw new Error(`メッセージの保存に失敗しました: ${error.message}`);
  }
}

/**
 * 会話のステータスを更新する。
 *
 * updated_at は BEFORE UPDATE トリガー（trg_conversations_updated_at）が
 * NOW() で自動設定するため、ここでの明示的な指定は冗長。
 * 害は無いので保険として残している（トリガーが後から外れても並び順が壊れない）。
 *
 * @param assignedOperatorId 指定すると担当者も同時にセットする（Q-001の自動割り当て）
 */
export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  assignedOperatorId?: string
): Promise<void> {
  const patch: {
    status: ConversationStatus;
    updated_at: string;
    assigned_operator_id?: string;
  } = { status, updated_at: new Date().toISOString() };

  if (assignedOperatorId) {
    patch.assigned_operator_id = assignedOperatorId;
  }

  const { error } = await getSupabaseAdmin()
    .from('conversations')
    .update(patch)
    .eq('id', conversationId);

  if (error) {
    throw new Error(`会話ステータスの更新に失敗しました: ${error.message}`);
  }
}

/**
 * AIに渡す直近のやり取りを取得する（T-12・フォローアップ質問対応）。
 *
 * 全件ではなく直近だけを取るのは、会話が長くなってもトークンと
 * クエリ量を一定に保つため。表示用の全件取得とは目的が違う。
 *
 * DB側で customer / ai に絞っているのは、
 * オペレーターの発言が多い会話でも顧客とAIのやり取りを必要数確保するため。
 * （limit をかけたあとにアプリ側で除外すると、件数が足りなくなる）
 *
 * @param limit 取得する最大件数（顧客+AI の合計）
 * @returns 古い順。取得に失敗した場合は空配列（履歴が無くてもAIは動く）
 */
export async function listRecentAiMessages(
  conversationId: string,
  limit: number
): Promise<Pick<Message, 'sender_type' | 'content'>[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .in('sender_type', ['customer', 'ai'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // 履歴が取れなくてもAIは単発で回答できる。
    // ここで例外を投げると、文脈が無いだけの状況で会話全体が止まってしまう
    console.error('[listRecentAiMessages] 履歴の取得に失敗:', error);
    return [];
  }

  // 新しい順で取っているので、AIに渡す前に古い順へ戻す
  return (data ?? []).reverse() as Pick<Message, 'sender_type' | 'content'>[];
}

/**
 * 会話内のメッセージを時系列で取得する（T-18・会話履歴の復元用）。
 *
 * 呼び出し側は事前に requireOwnedConversation() で所有権を確認すること。
 * この関数自体は所有権を見ないため、単体で使うと他人の会話を読めてしまう。
 */
export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('messages')
    .select('id, conversation_id, sender_type, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`メッセージの取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as Message[];
}

/**
 * 未完了の会話を探し、無ければ新規作成する（Q-011 確定仕様）。
 *
 * 「closed 以外の会話があれば継続」とすることで、
 * 顧客がウィジェットを閉じて開き直しても会話が途切れない。
 * オペレーターから見ても1つの問い合わせが分断されずに済む。
 *
 * @param customerUserId requireCustomerId() で確定させた顧客のUID
 */
export async function findOrCreateOpenConversation(
  customerUserId: string
): Promise<OwnedConversation> {
  const admin = getSupabaseAdmin();

  // 継続対象を探す。複数残っていた場合は最新のものを使う
  const { data: existing, error: selectError } = await admin
    .from('conversations')
    .select('id, status')
    .eq('customer_user_id', customerUserId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(`会話の検索に失敗しました: ${selectError.message}`);
  }

  if (existing && isConversationStatus(existing.status)) {
    return { id: existing.id, status: existing.status };
  }

  const { data: created, error: insertError } = await admin
    .from('conversations')
    .insert({ customer_user_id: customerUserId })
    .select('id, status')
    .single();

  if (insertError || !created) {
    throw new Error(
      `会話の作成に失敗しました: ${insertError?.message ?? '不明なエラー'}`
    );
  }

  if (!isConversationStatus(created.status)) {
    throw new Error(`会話のステータスが不正です: ${created.status}`);
  }

  return { id: created.id, status: created.status };
}
