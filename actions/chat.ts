/**
 * 顧客向け Server Action（T-13・T-15）
 *
 * 顧客チャットの1往復（顧客メッセージ保存 → AI応答 → 必要ならエスカレーション）を担当する。
 *
 * 【実装規約・必読】
 * この中の処理は service_role で動くため RLS が効かない。
 * 顧客IDは必ず requireCustomerId()（Cookie上の匿名JWTをAuthサーバーで検証）で確定し、
 * conversationId は必ず requireOwnedConversation() で本人のものか突合する。
 * 引数で渡された userId を信用した時点で、他人の会話を読み書きできる（AC-012 崩壊）。
 */
'use server';

import { buildAiHistory, resolveAiReply } from '@/lib/aiReply';
import {
  buildAfterHoursNotice,
  getBusinessHoursStatus,
} from '@/lib/businessHours';
import {
  findOrCreateOpenConversation,
  insertMessage,
  listMessages,
  listRecentAiMessages,
  requireOwnedConversation,
  setConversationStatus,
  setPendingHandoff,
} from '@/lib/conversations';
import {
  HANDOFF_ACCEPTED_LEAD,
  HANDOFF_ACCEPTED_TEXT,
} from '@/lib/messages';
import { requireCustomerId } from '@/lib/supabase/server';
import { validateMessageText } from '@/lib/validation';
import type {
  ActionResult,
  ConversationStatus,
  Message,
} from '@/types';

/**
 * 認証・所有権チェックに失敗したときの顧客向け文言。
 *
 * 例外の message をそのまま返さないこと。
 * requireOwnedConversation は失敗時に Postgres のエラー文
 * （テーブル名・制約名を含む）をそのまま throw するため、
 * 顧客へ返すとDBスキーマをブラウザから読み取れてしまう。
 * 原因の特定に必要な詳細は console.error にだけ残す。
 */
const ACCESS_DENIED_MESSAGE =
  'アクセスできませんでした。画面を再読み込みしてお試しください。';

/** 選択待ちの解除に失敗したときの顧客向け文言（同上の理由で固定文にする） */
const DISMISS_FAILED_MESSAGE = '操作に失敗しました。画面を再読み込みしてください。';

/** 顧客メッセージ送信の結果。UIはこれを見てローディング解除と表示を行う */
export interface SendMessageResult {
  /** AIが返した本文。AIが動かなかった場合（担当者対応中）は null */
  aiMessage: string | null;
  /** true ならこの往復でオペレーターへ引き継いだ */
  escalated: boolean;
  /**
   * true なら「FAQを案内したうえで担当者を提案した」状態。
   * ステータスはまだ ai_handling のままで、顧客の選択を待っている。
   */
  pendingHandoff: boolean;
  /** 営業時間外だったか。UIの案内表示に使う */
  afterHours: boolean;
}

/**
 * 顧客のメッセージを保存し、必要ならAI応答とエスカレーションまで行う。
 *
 * @param conversationId 会話ID（クライアントから渡されるため信用しない）
 * @param customerMessage 顧客が入力した本文
 */
export async function sendCustomerMessage(
  conversationId: string,
  customerMessage: string
): Promise<ActionResult<SendMessageResult>> {
  const validation = validateMessageText(customerMessage);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }
  const message = validation.message;

  // ---- 本人確認と所有権の突合 ----
  // customerUserId は try の外で保持する。
  // AI応答のあとに status を取り直すため、そこで同じUIDを使い回す必要がある。
  let customerUserId: string;
  let status: string;
  try {
    customerUserId = await requireCustomerId();
    const conversation = await requireOwnedConversation(conversationId, customerUserId);
    status = conversation.status;
  } catch (error) {
    console.error('[sendCustomerMessage] 認証・所有権チェック失敗:', error);
    return { success: false, error: ACCESS_DENIED_MESSAGE };
  }

  if (status === 'closed') {
    return {
      success: false,
      error: 'この問い合わせは完了しています。新しくお問い合わせください。',
    };
  }

  // ---- AIに渡す履歴を先に取得する ----
  // 顧客メッセージを保存する「前」に取るのが重要。
  // 保存後だと今回の発言が履歴にも入り、同じ文がAIへ二重に渡る。
  // 直近5往復（顧客+AI で10件）だけ渡す。
  const history = buildAiHistory(await listRecentAiMessages(conversationId, 10));

  // ---- 顧客メッセージの保存 ----
  // ここで失敗したら以降は進めない。AIだけ動いて顧客の発言が残らない状態を避けるため、
  // 必ず保存を先に確定させる（AC-009：全メッセージがDBに残ること）。
  try {
    await insertMessage(conversationId, 'customer', message);
  } catch (error) {
    console.error('[sendCustomerMessage] 顧客メッセージの保存失敗:', error);
    return { success: false, error: '送信に失敗しました。もう一度お試しください。' };
  }

  // エスカレーション済みの会話ではAIを動かさない。
  // 担当者が対応している最中にAIが割り込むと会話が二重になるため
  // （requirements.md「エスカレーション後はAIの自動回答を停止する」）。
  if (status !== 'ai_handling') {
    // afterHours は「今が営業時間外か」という事実であり、
    // AIを動かすかどうかとは独立している。
    // ここを false 固定にすると、深夜に追加送信した顧客の画面から
    // 時間外バナーが消え「そのままお待ちください」と案内してしまう
    // （担当者は翌営業日まで来ないのに、その場で待たせることになる）。
    const { isOpen } = await getBusinessHoursStatus();
    return {
      success: true,
      data: {
        aiMessage: null,
        escalated: false,
        pendingHandoff: false,
        afterHours: !isOpen,
      },
    };
  }

  // ---- AI応答 ----
  // resolveAiReply は例外を投げない。失敗時もエスカレーション結果が返る。
  const aiResponse = await resolveAiReply(message, history);

  // ---- 書き込む前に status を取り直す ----
  // 冒頭で読んだ status は、AI応答を待つ最大30秒の間に古くなっている。
  // その間に顧客が「担当者へつなぐ」を押していると会話は waiting_operator になっており、
  // 確認せずに書くと「承りました。担当者からご返信いたします」の直後に
  // AIの回答が差し込まれる。
  // requirements.md の「エスカレーション後はAIの自動回答を停止する」に反するため、
  // ai_handling でなくなっていたらAIの結果は捨てる（顧客メッセージは保存済み）。
  try {
    const current = await requireOwnedConversation(conversationId, customerUserId);
    if (current.status !== 'ai_handling') {
      const { isOpen } = await getBusinessHoursStatus();
      return {
        success: true,
        data: {
          aiMessage: null,
          escalated: true,
          pendingHandoff: false,
          afterHours: !isOpen,
        },
      };
    }
  } catch (error) {
    // 取り直しに失敗しても本来の処理は続ける。
    // これは稀な競合に対する保険であり、DB障害でAIの回答ごと落とすほうが害が大きい
    console.error('[sendCustomerMessage] status の再確認に失敗:', error);
  }

  // 営業時間の判定はエスカレーション時のみ必要だが、
  // 判定自体がDBアクセス1回で軽く、UIが常に afterHours を参照できるほうが扱いやすい。
  const { isOpen, hoursStart } = await getBusinessHoursStatus();
  const afterHours = !isOpen;

  // 時間外は「翌営業日に対応する」ことまで伝える（FR-TIME-004・FR-CUS-006）。
  // 伝えないと、顧客が深夜に返信を待ち続けることになる。
  const isEscalated = aiResponse.action === 'escalate';
  const isHandoffOffer = aiResponse.action === 'handoff_offer';

  const aiMessage =
    isEscalated && afterHours
      ? `${aiResponse.answer}
${buildAfterHoursNotice(hoursStart)}`
      : aiResponse.answer;

  // ---- AIメッセージの保存 ----
  try {
    await insertMessage(conversationId, 'ai', aiMessage);
  } catch (error) {
    // 保存に失敗しても顧客メッセージは残っている。
    // 「送信失敗」と伝えて再送させると同じ質問が二重に届くため、ここでは失敗にしない。
    // オペレーターが履歴を見れば対応できる状態にはなっている。
    console.error('[sendCustomerMessage] AIメッセージの保存失敗:', error);
  }

  // ---- エスカレーション（T-13）----
  // 時間内でも時間外でも waiting_operator に変更する。
  // 時間外は「即時通知しないだけ」でステータスは保持する（FR-TIME-002・003）。
  if (isEscalated) {
    try {
      await setConversationStatus(conversationId, 'waiting_operator');
    } catch (error) {
      // ここが失敗すると管理画面に上がらず放置される。最も重い失敗なのでログを残す。
      // 顧客側は引き継ぎ案内を受け取っているため、表示上は成功として返す。
      console.error('[sendCustomerMessage] エスカレーションのステータス更新失敗:', error);
    }
  }

  // ---- 引き継ぎの提案（ソフトエスカレーション）----
  // ステータスは ai_handling のまま。担当者につなぐかは顧客が選ぶ。
  //
  // 選択待ちフラグは毎回上書きする。false へ戻す処理をここに集約することで、
  // 顧客が選択肢を押さずに次の質問を送った場合も古い提案が残らない。
  try {
    await setPendingHandoff(conversationId, isHandoffOffer);
  } catch (error) {
    // 失敗しても会話自体は成立する。選択肢が出ない／残るだけなのでログに留める
    console.error('[sendCustomerMessage] 引き継ぎ提案の状態更新失敗:', error);
  }

  return {
    success: true,
    data: {
      aiMessage,
      escalated: isEscalated,
      pendingHandoff: isHandoffOffer,
      afterHours,
    },
  };
}

/**
 * 顧客が「担当者へつなぐ」を選んだときの処理。
 *
 * AIがFAQを案内したうえで提案した引き継ぎを、顧客が受け入れた場合に呼ぶ。
 *
 * 【引数を信用しないこと】
 * この処理は service_role で動くため RLS が効かない。
 * 本人確認と所有権の突合を必ず通す。加えて「選択待ちの会話か」も確認する。
 * これが無いと、完了済みの会話や既に引き継いだ会話を
 * 外部から waiting_operator に戻せてしまう。
 */
export async function requestOperatorHandoff(
  conversationId: string
): Promise<ActionResult<{ afterHours: boolean }>> {
  let conversation;
  try {
    const customerUserId = await requireCustomerId();
    conversation = await requireOwnedConversation(conversationId, customerUserId);
  } catch (error) {
    console.error('[requestOperatorHandoff] 認証・所有権チェック失敗:', error);
    return { success: false, error: ACCESS_DENIED_MESSAGE };
  }

  // 選択待ちでない会話を引き継ぎ状態にしない（二重押し・改ざん対策）
  if (conversation.status !== 'ai_handling' || !conversation.pendingHandoff) {
    return {
      success: false,
      error: 'この操作は受け付けられません。画面を再読み込みしてください。',
    };
  }

  const { isOpen, hoursStart } = await getBusinessHoursStatus();
  const afterHours = !isOpen;

  // 顧客が自分で引き継ぎを選んだ事実を履歴に残す。
  // これが無いと、オペレーターは会話を見ても
  // 「AIが案内した後になぜ引き継がれたか」が分からない（AC-013）。
  const handoffMessage = afterHours
    ? `${HANDOFF_ACCEPTED_LEAD}
${buildAfterHoursNotice(hoursStart)}`
    : HANDOFF_ACCEPTED_TEXT;

  try {
    await insertMessage(conversationId, 'ai', handoffMessage);
  } catch (error) {
    // 記録に失敗しても引き継ぎ自体は成立させる。顧客を待たせないことを優先する
    console.error('[requestOperatorHandoff] 引き継ぎメッセージの保存失敗:', error);
  }

  try {
    await setConversationStatus(conversationId, 'waiting_operator');
    await setPendingHandoff(conversationId, false);
  } catch (error) {
    // ここが失敗すると管理画面に上がらず放置される。最も重い失敗
    console.error('[requestOperatorHandoff] ステータス更新失敗:', error);
    return {
      success: false,
      error: '担当者へのお繋ぎに失敗しました。もう一度お試しください。',
    };
  }

  return { success: true, data: { afterHours } };
}

/**
 * 顧客が「続けて質問する」を選んだときの処理。
 *
 * 選択待ちを解除するだけで、ステータスも会話履歴も変えない。
 * AIの案内文はそのまま残り、続けて質問できる。
 */
export async function dismissHandoffOffer(
  conversationId: string
): Promise<ActionResult<void>> {
  try {
    const customerUserId = await requireCustomerId();
    await requireOwnedConversation(conversationId, customerUserId);
    await setPendingHandoff(conversationId, false);
    return { success: true };
  } catch (error) {
    console.error('[dismissHandoffOffer] 選択待ちの解除に失敗:', error);
    return { success: false, error: DISMISS_FAILED_MESSAGE };
  }
}

/** ウィジェット起動時に返す初期状態（T-18） */
export interface ConversationBootstrap {
  conversationId: string;
  status: ConversationStatus;
  /** 継続会話の場合は過去のやり取り。新規なら空配列（AC-014：履歴の保持） */
  messages: Message[];
  /**
   * AIがFAQ案内後に担当者を提案し、顧客の選択を待っている状態。
   * React の state ではなくサーバーから返すのは、
   * リロードしても選択肢が復元されるようにするため（AC-014）。
   */
  pendingHandoff: boolean;
  /** 営業時間内か。時間外バナーの出し分けに使う（FR-CUS-006） */
  isBusinessHours: boolean;
  /** 翌営業日の開始時刻。時間外案内の文面に使う */
  hoursStart: number;
  /** 営業設定のタイムゾーン。メッセージの時刻表示に使う */
  timezone: string;
}

/**
 * ウィジェット起動時に会話を用意する（T-18）。
 *
 * 【重要】この関数は引数を一切取らない。
 * 顧客IDは requireCustomerId() が Cookie 上の匿名JWTを
 * Authサーバーで署名検証して確定させる。
 *
 * 仮に customerUserId を引数で受け取る設計にすると、
 * Server Action の引数はクライアントが自由に改ざんできるため、
 * 他人のUIDを渡すだけで他人の会話を継続・閲覧できてしまう。
 * この関数は service_role で動きRLSが効かないので、
 * 引数を信用した時点で AC-012 が崩壊する。
 *
 * closed 以外の会話があれば継続、なければ新規作成する（Q-011 確定）。
 */
export async function createOrGetConversation(): Promise<
  ActionResult<ConversationBootstrap>
> {
  let customerUserId: string;
  try {
    customerUserId = await requireCustomerId();
  } catch (error) {
    console.error('[createOrGetConversation] 顧客の本人確認に失敗:', error);
    return {
      success: false,
      error: 'セッションを開始できませんでした。ページを再読み込みしてください。',
    };
  }

  try {
    const conversation = await findOrCreateOpenConversation(customerUserId);
    const messages = await listMessages(conversation.id);
    const { isOpen, hoursStart, timezone } = await getBusinessHoursStatus();

    return {
      success: true,
      data: {
        conversationId: conversation.id,
        status: conversation.status,
        messages,
        pendingHandoff: conversation.pendingHandoff,
        isBusinessHours: isOpen,
        hoursStart,
        timezone,
      },
    };
  } catch (error) {
    console.error('[createOrGetConversation] 会話の準備に失敗:', error);
    return {
      success: false,
      error: 'チャットを開始できませんでした。時間をおいてお試しください。',
    };
  }
}

/**
 * 会話のメッセージを取り直す（購読の取りこぼし回収用）。
 *
 * Realtime の postgres_changes は「購読が確立した後」のイベントしか届かない。
 * ウィジェットを開いた直後に送信されると、購読完了前のINSERTを取りこぼし、
 * AIの回答が画面に出ないまま残る（DBには保存されている）。
 * 購読確立直後と再接続後にこれを呼んで差分を埋める。
 *
 * conversationId はクライアントから渡されるため、必ず所有権を突合する。
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ActionResult<Message[]>> {
  try {
    const customerUserId = await requireCustomerId();
    await requireOwnedConversation(conversationId, customerUserId);
    const messages = await listMessages(conversationId);
    return { success: true, data: messages };
  } catch (error) {
    console.error('[getConversationMessages] 取得に失敗:', error);
    return { success: false, error: '履歴の取得に失敗しました。' };
  }
}
