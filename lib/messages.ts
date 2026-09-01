/**
 * 顧客に表示する固定文言とエスカレーション理由コード
 *
 * 【このファイルを lib/prompt.ts から分けている理由】
 * 固定文言はクライアントコンポーネント（ChatPanel・DemoChatWidget）も参照する。
 * lib/prompt.ts に置いたままだと、文言を1つ import しただけで
 * システムプロンプト本体を持つモジュールがクライアント側の依存に入る。
 * 本番ビルドでは tree-shaking で消えるが、prompt.ts に副作用が1つ入るだけで
 * エスカレーション判定ルールごと公開JSに載る。
 * そのため「サーバー専用（prompt.ts）」と「両側で使う文言（このファイル）」を分離し、
 * 依存の向きを messages.ts <- prompt.ts の一方向に固定している。
 *
 * このファイルには文言と定数だけを置くこと。
 * サーバー専用の処理（FAQ取得・プロンプト組み立て）を持ち込むと分離の意味が消える。
 */

/**
 * エスカレーション理由コード。
 *
 * Gemini には自由記述ではなくこのいずれかを返させる。
 * 理由が自由記述だと顧客への表示文言を機械的に選べず、
 * requirements.md のエスカレーション表（理由ごとに文言が違う）を実装できないため。
 */
export const ESCALATION_REASON = {
  /** FAQに根拠が無い質問だった */
  NO_FAQ: 'FAQ外',
  /** FAQを案内したうえで、個別手続きのために担当者を提案する（顧客が選ぶ） */
  HANDOFF_OFFER: '個別手続き',
  /** クレーム・お怒り・不満のトーン（顧客の感情が動いている） */
  COMPLAINT: 'クレーム',
  /**
   * 人間の判断・個別対応が必要（個別データ照会・個人情報変更・個別交渉）。
   * 顧客は怒っていないが、AIでは事実を確認できない類の依頼。
   */
  NEEDS_HUMAN: '人間対応必須',
  /** Gemini API のエラー・タイムアウト（モデルではなくアプリが付ける） */
  AI_ERROR: 'AIエラー',
} as const;

export type EscalationReason =
  (typeof ESCALATION_REASON)[keyof typeof ESCALATION_REASON];

/**
 * 引き継ぎを提案するときに、AIの回答の下へ添える案内文。
 * ここは固定文にする。AIに毎回書かせると言い回しが揺れ、
 * 「担当者につながるのか、つながらないのか」が読み取りにくくなる。
 */
export const HANDOFF_OFFER_TEXT =
  '個別のお手続きは担当者が承ります。ご希望の対応をお選びください。';

/**
 * 「担当者が確認してから対応する」タイプの引き継ぎ文言。
 *
 * FAQ外・個別手続き・個別データ照会は、顧客から見ると
 * 「AIでは分からないので人が調べる」という同じ状況なので文言を共有する。
 * 別々の文字列にすると、片方だけ直して表現がずれる。
 */
const NEEDS_CHECK_TEXT = '担当者に確認してご対応いたします。少々お待ちください。';

/**
 * 顧客が「担当者へつなぐ」を選んだ直後に、会話履歴へ残す文言のリード部分。
 *
 * actions/chat.ts に直接書かずここに置くのは、
 * 顧客に見える固定文言をこのファイルへ集約するため（冒頭のコメント参照）。
 * 営業時間外は後ろに翌営業日の案内を足すので、リード文だけを定数にしている。
 */
export const HANDOFF_ACCEPTED_LEAD = '承りました。担当者からご返信いたします。';

/** 営業時間内に「担当者へつなぐ」を選んだときの文言 */
export const HANDOFF_ACCEPTED_TEXT = `${HANDOFF_ACCEPTED_LEAD}少々お待ちください。`;

/**
 * 顧客に表示するエスカレーション文言（requirements.md エスカレーション表の確定文言）。
 *
 * Gemini が生成した文章をそのまま出さないのは、
 * 引き継ぎ時の案内を毎回同じ表現に固定して顧客の混乱を防ぐため。
 *
 * HANDOFF_OFFER を含めているのは、モデルが action: "escalate" と
 * reason: "個別手続き" を組み合わせて返す経路があるため。
 * 既定値へのフォールバックでも結果は同じ文言になるが、
 * 暗黙の依存になるので明示的に定義しておく。
 *
 * 【なぜクレームだけ文言を分けるか】
 * 「担当者に確認してご対応いたします」は、怒っている顧客には冷たく響く。
 * かといって「ご不満をおかけして申し訳ございません」を住所変更の依頼に返すと、
 * 怒っていない顧客に謝ることになり、これはこれで的外れになる。
 * どちらか一方に寄せると必ず片方で事故るため、理由コードで出し分ける。
 * この出し分けが成立するかは、Gemini が COMPLAINT と NEEDS_HUMAN を
 * 区別して返せるかに依存する（判定ルールは lib/prompt.ts）。
 * 区別できなかった場合は NEEDS_HUMAN 側（謝らない文言）に倒れる。
 */
const ESCALATION_MESSAGE: Record<string, string> = {
  [ESCALATION_REASON.NO_FAQ]: NEEDS_CHECK_TEXT,
  [ESCALATION_REASON.HANDOFF_OFFER]: NEEDS_CHECK_TEXT,
  [ESCALATION_REASON.COMPLAINT]:
    'ご不満をおかけして大変申し訳ございません。担当者が直接ご対応いたします。少々お待ちください。',
  [ESCALATION_REASON.NEEDS_HUMAN]: NEEDS_CHECK_TEXT,
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
