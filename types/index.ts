/**
 * 全エージェント共通の型定義
 *
 * このファイルは main ブランチの参照用ファイル。
 * 型を追加・変更する場合は勝手に編集せず Architect にエスカレーションすること
 * （3つの worktree が同時に参照しているため、変更が全ブランチに波及する）。
 */

// ============================================================
// 会話ステータス
//   ai_handling       AI自動応答中（初期状態）
//   waiting_operator  エスカレーション後・オペレーター待機中
//   operator_handling オペレーターが最初の返信を送った後
//   closed            対応完了
// ============================================================
export type ConversationStatus =
  | 'ai_handling'
  | 'waiting_operator'
  | 'operator_handling'
  | 'closed';

/** メッセージの送信者種別 */
export type SenderType = 'customer' | 'ai' | 'operator';

/** FAQ・会話のカテゴリ */
export type FAQCategory = '在庫' | '配送' | '返品' | '商品' | 'その他';

/**
 * 顧客1件分の問い合わせ会話
 */
export interface Conversation {
  id: string;
  /** 匿名サインインで発行された auth.uid()。RLSの識別キー */
  customer_user_id: string;
  status: ConversationStatus;
  /** 最初に返信したオペレーターが自動で担当になる。NULLは未割当 */
  assigned_operator_id: string | null;
  category: FAQCategory | null;
  created_at: string;
  updated_at: string;
}

/**
 * 会話内の1メッセージ
 */
export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  /** operator のときのみ発言者UID。customer・ai は null */
  sender_id: string | null;
  content: string;
  created_at: string;
}

/**
 * AI回答の根拠となるFAQ
 */
export interface FAQ {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
  is_active: boolean;
}

/**
 * Gemini からの構造化レスポンス
 * responseSchema でこの形を強制する。パース失敗時は即エスカレーションに倒す。
 */
/**
 * デモモードでAIに渡す会話1ターン。
 *
 * lib/gemini.ts の AiTurn と同じ形だが、あちらは 'server-only' のため
 * クライアントコンポーネントから参照できない。デモの入力は
 * クライアントが組み立ててServer Actionへ渡すので、型はここに置く。
 */
export interface DemoTurn {
  /** 'user' が体験者の発言、'model' がAIの発言 */
  role: 'user' | 'model';
  text: string;
}

/**
 * AIが選んだ対応方針。
 *
 * 'answer'        AIだけで完結する（FAQに回答があり個別手続きが不要）
 * 'handoff_offer' FAQを案内したうえで担当者への引き継ぎを提案する（顧客が選ぶ）
 * 'escalate'      AIは答えず即座に担当者へ引き継ぐ
 *
 * 迷った場合は安全な側（escalate）へ倒す。
 * B判定がC判定に倒れても顧客は担当者につながるだけで実害がないが、
 * 逆はクレームをAIが処理しようとすることになる。
 */
export type AIAction = 'answer' | 'handoff_offer' | 'escalate';

export interface AIResponse {
  /** AIが選んだ対応方針 */
  action: AIAction;
  /** 回答本文。action が 'escalate' のときは空文字 */
  answer: string;
  /** エスカレーション理由。action が 'answer' のときは空文字 */
  reason: string;
}

/**
 * 営業設定。DBには必ず1レコードのみ存在する。
 */
export interface BusinessSettings {
  id: string;
  /** 営業開始時刻（時）例：10 */
  hours_start: number;
  /** 営業終了時刻（時）例：18。この時刻ちょうどは営業時間外 */
  hours_end: number;
  /** 定休曜日 0=日〜6=土 例：[0] で日曜定休 */
  closed_weekdays: number[];
  /** 特定休日 YYYY-MM-DD 形式 例：["2026-01-01"] */
  holiday_dates: string[];
  /** 当日の手動フラグ。false = 本日休業 */
  is_open_today: boolean;
  /** タイムゾーン 例："Asia/Tokyo" */
  timezone: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Server Action の共通戻り値
 *
 * Server Action で例外を throw するとクライアントには
 * 本番ビルドで内容が伏せられた汎用エラーしか届かない。
 * 呼び出し側が理由に応じてUIを出し分けられるよう、この形で返す。
 */
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * オペレーター表示用の情報
 * auth.users の user_metadata から取り出す（Q-001の担当者名表示で使用）
 */
export interface OperatorProfile {
  id: string;
  email: string | null;
  /** user_metadata.display_name */
  display_name: string | null;
  /** user_metadata.role_label（フルタイム / パートタイム） */
  role_label: string | null;
}
