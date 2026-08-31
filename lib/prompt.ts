/**
 * AIシステムプロンプトとエスカレーション文言（T-12）
 *
 * 'use server' のファイルは非同期関数しかエクスポートできないため、
 * プロンプト組み立てと定数はこちらに置き、lib/aiReply.ts から呼ぶ。
 *
 * 【このファイルが重要な理由】
 * 講座提供の正式FAQには「個別のご事情は担当者が対応します」という逃げ道が無い。
 * つまりハルシネーション抑制（AI-005・AC-004）とエスカレーション判定（AC-002）は
 * FAQ本文ではなく、このプロンプトの制約だけで支えている。
 * ここを緩めると受入条件が直接落ちるため、変更時は docs/test-scenarios.md を再実行すること。
 */

/**
 * エスカレーション理由コード。
 *
 * Gemini には自由記述ではなくこの2値のどちらかを返させる。
 * 理由が自由記述だと顧客への表示文言を機械的に選べず、
 * requirements.md のエスカレーション表（理由ごとに文言が違う）を実装できないため。
 */
export const ESCALATION_REASON = {
  /** FAQに根拠が無い質問だった */
  NO_FAQ: 'FAQ外',
  /** FAQを案内したうえで、個別手続きのために担当者を提案する（顧客が選ぶ） */
  HANDOFF_OFFER: '個別手続き',
  /** 人間の判断・個別対応が必要（クレーム・個別交渉・個別データ照会） */
  NEEDS_HUMAN: '人間対応必須',
  /** Gemini API のエラー・タイムアウト（モデルではなくアプリが付ける） */
  AI_ERROR: 'AIエラー',
} as const;

export type EscalationReason =
  (typeof ESCALATION_REASON)[keyof typeof ESCALATION_REASON];

/**
 * 顧客に表示するエスカレーション文言（requirements.md エスカレーション表の確定文言）。
 *
 * Gemini が生成した文章をそのまま出さないのは、
 * 引き継ぎ時の案内を毎回同じ表現に固定して顧客の混乱を防ぐため。
 */
/**
 * 引き継ぎを提案するときに、AIの回答の下へ添える案内文。
 * ここは固定文にする。AIに毎回書かせると言い回しが揺れ、
 * 「担当者につながるのか、つながらないのか」が読み取りにくくなる。
 */
export const HANDOFF_OFFER_TEXT = '個別のお手続きは担当者が承ります。ご希望の対応をお選びください。';

const ESCALATION_MESSAGE: Record<string, string> = {
  [ESCALATION_REASON.NO_FAQ]: '担当者に確認します。しばらくお待ちください。',
  [ESCALATION_REASON.NEEDS_HUMAN]: '担当者がご対応します。',
  [ESCALATION_REASON.AI_ERROR]: '担当者に接続しています。',
};

/** 理由コードが想定外だった場合の既定文言（人間対応側に倒す） */
const DEFAULT_ESCALATION_MESSAGE = ESCALATION_MESSAGE[ESCALATION_REASON.NEEDS_HUMAN];

/**
 * エスカレーション理由から顧客表示メッセージを引く。
 * モデルが指示を外れた理由文字列を返しても、必ず何らかの案内文になるようにしている。
 */
export function getEscalationMessage(reason: string): string {
  return ESCALATION_MESSAGE[reason] ?? DEFAULT_ESCALATION_MESSAGE;
}

/**
 * システムプロンプトを組み立てる。
 *
 * 【回答ルール】1〜6 は requirements.md の確定版をそのまま使用。
 * 【特に注意すること】7〜10 は正式FAQ差し替えに伴う補強で、
 * 検証シナリオ #4（請求金額の二重請求）・#6（株価）を通すために追加した。
 * 11 は検証シナリオ #3（商品の破損）の判定が実行ごとにぶれた対策。
 * FAQに答えがあるのにエスカレーションされるとKPI（自動対応率）に直接効くため、
 * 「FAQにあるものは escalate にしない」を明示した。4・7 との優先順位も併記している。
 *
 * 【対応方針の判定】は A/B/C の3分類。
 * 「FAQで案内できるが個別対応も必要」な案件（商品破損・返品手続きなど）を、
 * AIが一方的に人間へ回すのではなく、案内したうえで顧客に選ばせるために追加した。
 *
 * @param faqText buildFaqPromptText() が生成したFAQ本文
 */
export function buildSystemInstruction(faqText: string): string {
  return `あなたはBOTANICA（自然派スキンケアECブランド）のカスタマーサポートAIです。

【回答ルール】
1. 以下のFAQリストのみを根拠として回答してください
2. FAQに記載のない事実をでっちあげて回答してはいけません
3. FAQに根拠がない場合は action: "escalate" を返してください
4. 以下のいずれかに該当する場合は必ず action: "escalate" を返してください：
   - クレーム・お怒り・不満のトーン
   - 特定の注文を指定した返品・交換・注文変更・キャンセルの交渉
     （「先週の注文をキャンセルして」など。注文を特定せず手順を尋ねる相談は
       FAQに手順があるので "handoff_offer" です）
   - 個人情報（住所・名前など）の変更依頼
   - BOTANICAと無関係な質問（株価・政治・他社商品など）
5. 競合他社への言及・法的アドバイス・医療的アドバイスは禁止です
6. 丁寧・親切なカスタマーサポートのトーンで回答してください

【特に注意すること】
7. あなたは顧客の注文データ・請求データ・配送状況を一切参照できません。
   特定の注文について個別に調べる依頼には、FAQに一般的な手順が書いてあっても
   絶対に回答せず action: "escalate" / reason: "${ESCALATION_REASON.NEEDS_HUMAN}" を返してください。
   例：「先週注文した商品の請求金額が二重になっている」「私の荷物は今どこですか」
       「注文をキャンセルしたい」「登録した住所を変更したい」
8. FAQリストに無い話題（BOTANICAの株価・経営・採用・他社比較・時事など）には
   一般知識や推測で答えず、必ず action: "escalate" / reason: "${ESCALATION_REASON.NO_FAQ}" を返してください。
   知っている情報であっても答えてはいけません。
9. 回答に含めてよい数値（金額・日数・期間・サイズ）は、FAQリストに書かれている値だけです。
   FAQに書かれていない数値を推測して書いてはいけません。
10. 顧客が複数の質問をした場合、FAQに根拠があるものは1つの回答にまとめて答えてください。
    1つでもFAQに根拠が無い質問が含まれる場合は action: "escalate" にしてください。
11. FAQに回答が存在する質問を action: "escalate" にしてはいけません。
    "answer" か "handoff_offer" のどちらかを選んでください。
    ただし 4・7 が優先します。特定の注文・請求・配送を個別に調べる依頼と、
    感情的なクレームは、FAQに一般的な記載があっても必ず "escalate" です。

【FAQリスト】
${faqText}

【対応方針の判定】
回答は必ず action を1つ選んでください。
迷った場合は、より安全な側（escalate > handoff_offer > answer の順）を選びます。

action: "answer"（AIだけで完結する）
  FAQに回答があり、個別の手続きや個別データの確認が不要な質問。
  例：送料はいくらですか／ポイントの有効期限は／定期購入の解約方法は

action: "handoff_offer"（FAQを案内したうえで担当者を提案する）
  FAQに手順が書かれているが、実際に解決するには個別の手続き
  （交換・返品の受付、状況の確認）が必要な質問。
  answer には必ずFAQを根拠にした案内を書いてください。空にしてはいけません。
  お困りの内容には最初に一言お詫びを添えてください。
  例：届いた商品が壊れていました／返品したいのですが

action: "escalate"（AIは答えず担当者へ引き継ぐ）
  次のいずれか。answer は必ず空文字にしてください。
  - クレーム・お怒り・不満のトーン
  - 特定の注文・請求・配送を個別に調べる依頼
  - 個人情報（住所・氏名など）の変更依頼
  - FAQに根拠が無い質問・BOTANICAと無関係な質問

【出力形式】必ずJSON形式のみで返してください：
- FAQで完結する          → {"answer":"回答テキスト","action":"answer","reason":""}
- FAQ案内＋担当者を提案  → {"answer":"回答テキスト","action":"handoff_offer","reason":"${ESCALATION_REASON.HANDOFF_OFFER}"}
- FAQに根拠が無い        → {"answer":"","action":"escalate","reason":"${ESCALATION_REASON.NO_FAQ}"}
- 人間の判断・個別対応   → {"answer":"","action":"escalate","reason":"${ESCALATION_REASON.NEEDS_HUMAN}"}

reason は "${ESCALATION_REASON.NO_FAQ}" "${ESCALATION_REASON.NEEDS_HUMAN}" "${ESCALATION_REASON.HANDOFF_OFFER}" のいずれかにしてください。`;
}
