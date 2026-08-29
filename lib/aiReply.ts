/**
 * AI応答の中核ロジック（T-12・T-15）
 *
 * 本人確認・所有権チェックを含まない「AIに聞いて表示文言を決める」部分だけを担う。
 * これを Server Action の外に置いているのは、
 * actions/chat.ts が本人確認を済ませたあとに、もう一度認証を通さず呼べるようにするため。
 *
 * 【重要】この関数は例外を投げない。
 * FAQが取れなくても Gemini が落ちても、エスカレーション結果を返して人間へ回す（AI-009）。
 * AIが黙るくらいなら担当者につなぐほうが常に正しいため。
 */
import 'server-only';

import { generateAIResponse, GeminiError } from '@/lib/gemini';
import { getActiveFaqs, buildFaqPromptText } from '@/lib/faq';
import {
  buildSystemInstruction,
  getEscalationMessage,
  ESCALATION_REASON,
} from '@/lib/prompt';
import type { AIResponse } from '@/types';

/**
 * 顧客メッセージからAIの返答を決める。
 *
 * 【戻り値の約束】`answer` は「顧客に表示する本文」。
 * lib/gemini.ts の AIResponse.answer（escalate時は空文字）とは意味が違い、
 * escalate: true のときは確定文言の引き継ぎ案内が入る。
 */
export async function resolveAiReply(customerMessage: string): Promise<AIResponse> {
  // FAQ取得に失敗しても顧客にDBの事情は見せず人間へ回す
  // （requirements.md エラー処理表「FAQ検索失敗 → 顧客には非表示・ESCへフォールバック」）
  let systemInstruction: string;
  try {
    const faqs = await getActiveFaqs();
    systemInstruction = buildSystemInstruction(buildFaqPromptText(faqs));
  } catch (error) {
    console.error('[resolveAiReply] FAQ取得失敗:', error);
    return escalation(ESCALATION_REASON.AI_ERROR);
  }

  let aiResponse: AIResponse;
  try {
    aiResponse = await generateAIResponse(systemInstruction, customerMessage);
  } catch (error) {
    // GeminiError の kind（timeout / api / parse / blocked）はログにだけ残す。
    // 顧客への表示はどの失敗でも同じ「担当者に接続しています」に統一する。
    const kind = error instanceof GeminiError ? error.kind : 'unknown';
    console.error(`[resolveAiReply] Gemini呼び出し失敗（${kind}）:`, error);
    return escalation(ESCALATION_REASON.AI_ERROR);
  }

  if (aiResponse.escalate) {
    // モデルが指示外の理由文字列を返すことがあるため、既知のコードに丸めてから使う
    const reason = isKnownReason(aiResponse.reason)
      ? aiResponse.reason
      : ESCALATION_REASON.NEEDS_HUMAN;
    return escalation(reason);
  }

  // escalate:false なのに本文が空だと顧客に無言が届く。起きたら人間へ回す
  if (aiResponse.answer.trim() === '') {
    console.error('[resolveAiReply] escalate:false だが回答本文が空でした');
    return escalation(ESCALATION_REASON.AI_ERROR);
  }

  return { answer: aiResponse.answer, escalate: false, reason: '' };
}

/** 既知のエスカレーション理由コードかどうか */
function isKnownReason(reason: string): boolean {
  return (Object.values(ESCALATION_REASON) as string[]).includes(reason);
}

/** エスカレーション時の戻り値を組み立てる（顧客表示文言は確定文言に固定する） */
function escalation(reason: string): AIResponse {
  return { answer: getEscalationMessage(reason), escalate: true, reason };
}
