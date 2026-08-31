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

import { generateAIResponse, GeminiError, type AiTurn } from '@/lib/gemini';
import { getActiveFaqs, buildFaqPromptText } from '@/lib/faq';
import {
  buildSystemInstruction,
  getEscalationMessage,
  ESCALATION_REASON,
} from '@/lib/prompt';
import type { AIResponse, Message } from '@/types';

/**
 * AIに渡す直近のやり取りの往復数。
 *
 * 5往復にしているのは、これ以上遡っても解決率が上がらない一方で
 * 毎回のトークンが増え、古い話題に引きずられた誤答が出やすくなるため。
 * FAQ本文もプロンプトに載っているので、履歴を長くする余地は元々小さい。
 */
const HISTORY_TURNS = 5;

/**
 * DBのメッセージ列から、Geminiに渡す履歴を組み立てる。
 *
 * オペレーターの発言は**含めない**。
 * Gemini のロールは 'user' / 'model' の2種類しかなく、担当者の発言を
 * 'model'（＝AI自身の発言）として渡すと、AIが「自分が約束した」と誤認して
 * FAQ外の対応まで引き受けてしまう。
 * 顧客がAIと話している文脈だけを渡すのが正しい。
 *
 * @param messages 会話の全メッセージ（古い順）
 */
export function buildAiHistory(
  messages: Pick<Message, 'sender_type' | 'content'>[]
): AiTurn[] {
  return messages
    .filter((m) => m.sender_type === 'customer' || m.sender_type === 'ai')
    // 直近 HISTORY_TURNS 往復ぶん（1往復 = 顧客+AI の2件）
    .slice(-HISTORY_TURNS * 2)
    .map((m) => ({
      role: m.sender_type === 'customer' ? ('user' as const) : ('model' as const),
      text: m.content,
    }));
}

/**
 * 顧客メッセージからAIの返答を決める。
 *
 * 【戻り値の約束】`answer` は「顧客に表示する本文」。
 * lib/gemini.ts の AIResponse.answer（escalate時は空文字）とは意味が違い、
 * escalate: true のときは確定文言の引き継ぎ案内が入る。
 *
 * @param customerMessage 今回の顧客の発言
 * @param history buildAiHistory() が組み立てた直近のやり取り（今回の発言は含めない）
 *
 * 【検証メモ】フォローアップ質問（「返品できますか」→「いつまでですか」）が
 * 正しく回答されるかの実機検証は未実施。
 * Gemini 無料枠が1日20リクエストのため、枠が回復した日に
 * docs/test-scenarios.md と併せてまとめて確認すること。
 */
export async function resolveAiReply(
  customerMessage: string,
  history: AiTurn[] = []
): Promise<AIResponse> {
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
    aiResponse = await generateAIResponse(systemInstruction, customerMessage, history);
  } catch (error) {
    // GeminiError の kind（timeout / api / parse / blocked）はログにだけ残す。
    // 顧客への表示はどの失敗でも同じ「担当者に接続しています」に統一する。
    const kind = error instanceof GeminiError ? error.kind : 'unknown';
    console.error(`[resolveAiReply] Gemini呼び出し失敗（${kind}）:`, error);
    return escalation(ESCALATION_REASON.AI_ERROR);
  }

  if (aiResponse.action === 'escalate') {
    // モデルが指示外の理由文字列を返すことがあるため、既知のコードに丸めてから使う
    const reason = isKnownReason(aiResponse.reason)
      ? aiResponse.reason
      : ESCALATION_REASON.NEEDS_HUMAN;
    return escalation(reason);
  }

  // 本文が空だと顧客に無言が届く。起きたら人間へ回す
  if (aiResponse.answer.trim() === '') {
    console.error(`[resolveAiReply] action=${aiResponse.action} だが回答本文が空でした`);
    return escalation(ESCALATION_REASON.AI_ERROR);
  }

  if (aiResponse.action === 'handoff_offer') {
    // FAQの案内はそのまま顧客へ出す。担当者につなぐかどうかは顧客が選ぶので、
    // ここではステータスを変えない（呼び出し側が選択待ちフラグを立てる）
    return {
      action: 'handoff_offer',
      answer: aiResponse.answer,
      reason: ESCALATION_REASON.HANDOFF_OFFER,
    };
  }

  return { action: 'answer', answer: aiResponse.answer, reason: '' };
}

/** 既知のエスカレーション理由コードかどうか */
function isKnownReason(reason: string): boolean {
  return (Object.values(ESCALATION_REASON) as string[]).includes(reason);
}

/** エスカレーション時の戻り値を組み立てる（顧客表示文言は確定文言に固定する） */
function escalation(reason: string): AIResponse {
  return { action: 'escalate', answer: getEscalationMessage(reason), reason };
}
