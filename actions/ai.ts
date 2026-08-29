/**
 * AI回答生成 Server Action（T-12）
 *
 * 責務は「顧客のメッセージから、顧客に表示する1件の返答を決める」ことまで。
 * メッセージのDB保存とステータス遷移（ai_handling → waiting_operator）は T-13 が行う。
 *
 * 【戻り値の約束】
 * この関数は AI が失敗しても success: false を返さない。
 * Gemini が落ちてもタイムアウトしても「担当者に接続しています」＋ escalate: true を
 * 正常な結果として返す（AI-009・requirements.md エラー処理表）。
 * 顧客を無言で待たせるより、人間へ回すほうが常に正しいため。
 * success: false になるのは、本人確認・所有権・入力検証に失敗したときだけ。
 */
'use server';

import { generateAIResponse, GeminiError } from '@/lib/gemini';
import { getActiveFaqs, buildFaqPromptText } from '@/lib/faq';
import {
  buildSystemInstruction,
  getEscalationMessage,
  ESCALATION_REASON,
} from '@/lib/prompt';
import { requireOwnedConversation } from '@/lib/conversations';
import { requireCustomerId } from '@/lib/supabase/server';
import type { ActionResult, AIResponse } from '@/types';

/** 1メッセージの最大文字数。これを超える入力はプロンプト汚染とコスト増の温床になる */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * AI応答を生成する。
 *
 * 【注意】戻り値の `answer` は「顧客に表示する本文」であり、
 * lib/gemini.ts の AIResponse.answer（escalate 時は空文字）とは意味が異なる。
 * escalate: true のときは確定文言の引き継ぎ案内が入る。
 *
 * @param conversationId 会話ID。所有権をサーバー側で必ず突合する
 * @param customerMessage 顧客が送信した本文
 */
export async function generateAiReply(
  conversationId: string,
  customerMessage: string
): Promise<ActionResult<AIResponse>> {
  // ---- 入力検証 ----
  const message = customerMessage.trim();
  if (message === '') {
    return { success: false, error: 'メッセージが空です。' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `メッセージが長すぎます（${MAX_MESSAGE_LENGTH}文字以内で入力してください）。`,
    };
  }

  // ---- 本人確認と所有権の突合 ----
  // 引数の conversationId はクライアントが自由に書き換えられるため、
  // Cookie の匿名JWTから確定した顧客IDと必ず突合する（AC-012）。
  let conversationStatus: string;
  try {
    const customerUserId = await requireCustomerId();
    const conversation = await requireOwnedConversation(conversationId, customerUserId);
    conversationStatus = conversation.status;
  } catch (error) {
    console.error('[generateAiReply] 認証・所有権チェック失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アクセスが拒否されました。',
    };
  }

  // エスカレーション後はAIを黙らせる（requirements.md「エスカレーション後の状態管理」）。
  // 呼び出し側で弾くのが本筋だが、二重で防いでおく。
  if (conversationStatus !== 'ai_handling') {
    return {
      success: false,
      error: 'この会話はすでに担当者が対応しています。',
    };
  }

  // ---- FAQ取得 ----
  // 取得に失敗しても顧客にはDBの事情を見せず、人間へ回す
  // （requirements.md エラー処理表「FAQ検索失敗 → 顧客には非表示・ESCへフォールバック」）。
  let systemInstruction: string;
  try {
    const faqs = await getActiveFaqs();
    systemInstruction = buildSystemInstruction(buildFaqPromptText(faqs));
  } catch (error) {
    console.error('[generateAiReply] FAQ取得失敗:', error);
    return escalationResult(ESCALATION_REASON.AI_ERROR);
  }

  // ---- AI呼び出し ----
  let aiResponse: AIResponse;
  try {
    aiResponse = await generateAIResponse(systemInstruction, message);
  } catch (error) {
    // GeminiError の kind（timeout / api / parse / blocked）はログにだけ残す。
    // 顧客への表示はどの失敗でも同じ「担当者に接続しています」に統一する。
    const kind = error instanceof GeminiError ? error.kind : 'unknown';
    console.error(`[generateAiReply] Gemini呼び出し失敗（${kind}）:`, error);
    return escalationResult(ESCALATION_REASON.AI_ERROR);
  }

  // ---- 結果の正規化 ----
  if (aiResponse.escalate) {
    // モデルが指示外の理由文字列を返すことがあるため、既知のコードに丸めてから使う。
    const reason = isKnownReason(aiResponse.reason)
      ? aiResponse.reason
      : ESCALATION_REASON.NEEDS_HUMAN;
    return escalationResult(reason);
  }

  // FAQ根拠ありなのに本文が空という応答は、そのまま出すと顧客に無言が届く。
  // 起きたら人間へ回す（AI-009と同じ扱い）。
  if (aiResponse.answer.trim() === '') {
    console.error('[generateAiReply] escalate:false だが回答本文が空でした');
    return escalationResult(ESCALATION_REASON.AI_ERROR);
  }

  return {
    success: true,
    data: { answer: aiResponse.answer, escalate: false, reason: '' },
  };
}

/** 既知のエスカレーション理由コードかどうか */
function isKnownReason(reason: string): boolean {
  return (Object.values(ESCALATION_REASON) as string[]).includes(reason);
}

/** エスカレーション時の戻り値を組み立てる（顧客表示文言は確定文言に固定する） */
function escalationResult(reason: string): ActionResult<AIResponse> {
  return {
    success: true,
    data: {
      answer: getEscalationMessage(reason),
      escalate: true,
      reason,
    },
  };
}
