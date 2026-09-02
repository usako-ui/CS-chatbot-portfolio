/**
 * Gemini API 接続層（T-10）
 *
 * このファイルは「Geminiを安全に呼んで、必ず AIResponse 型で返す」ことだけを担当する。
 * プロンプトの組み立て・FAQの埋め込み・エスカレーション後のDB更新は
 * lib/aiReply.ts・actions/chat.ts（T-12・T-13）側の責務。
 * ここに業務ロジックを持ち込まないこと。
 *
 * 【設計の前提】
 * AIが答えられない・落ちた場合は「オペレーターに引き継ぐ」が常に正解になる。
 * そのため、この層は例外を握りつぶさず GeminiError として投げ、
 * 呼び出し側が escalate: true へ倒せるように種別（kind）を付けて返す。
 *
 * 先頭の 'server-only' は APIキー保護の保険。
 * クライアントコンポーネントから誤って import した瞬間にビルドエラーになる。
 */
import 'server-only';

import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiApiKey } from '@/lib/env';
import type { AIResponse } from '@/types';

/**
 * 使用モデル。
 * requirements.md で「Gemini 2.5 Flash（無料枠）」と確定している。
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * タイムアウト（ミリ秒）。
 * NFR-001 で平均10秒以内と定めているため、30秒を上限として打ち切る。
 * これを超えたら待たせ続けるより即オペレーターへ回したほうが顧客体験がよい（AI-009）。
 *
 * 【15秒から延ばした理由】2026-09-02
 * 本番で Gemini の応答が 1.2秒 / 39秒 / 143秒 と大きく振れており、
 * 15秒だと正常なリクエストまで打ち切られて「担当者に接続しています。」に落ちていた。
 * AIが答えられる質問まで人へ回るのは自動対応率（KPI）に直接効くため上限を延ばす。
 * 短くしすぎると誤エスカレーション、長くしすぎると顧客を待たせるトレードオフ。
 */
export const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Gemini に渡す会話の1ターン。
 *
 * Gemini のロールは 'user' と 'model' の2種類のみ。
 * オペレーターの発言に対応するロールが無いため、
 * 履歴を組み立てる側（lib/aiReply.ts）で除外している。
 */
export interface AiTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * 出力トークン上限。
 * チャット1往復の回答としては十分で、暴走時のコストと待ち時間を抑える。
 */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Gemini に強制するJSONスキーマ。
 *
 * responseMimeType だけではJSON以外が混ざることがあるため、
 * responseSchema と併用して構造そのものを縛る（requirements.md 確定仕様）。
 * propertyOrdering を明示しているのは、キー順が揺れると
 * モデルが answer より先に escalate を決めてしまい判定が不安定になるため。
 */
const AI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: {
      type: Type.STRING,
      description: 'FAQを根拠とした回答本文。action が escalate のときは空文字',
    },
    action: {
      type: Type.STRING,
      enum: ['answer', 'handoff_offer', 'escalate'],
      description:
        'answer=AIだけで完結 / handoff_offer=FAQを案内したうえで担当者を提案 / escalate=AIは答えず担当者へ',
    },
    reason: {
      type: Type.STRING,
      description: 'エスカレーション理由。action が answer のときは空文字',
    },
  },
  required: ['answer', 'action', 'reason'],
  // answer を先に決めさせる。action を先にすると本文を書く前に方針だけ決めてしまい、
  // 「handoff_offer なのに本文が空」という不整合が出やすくなる
  propertyOrdering: ['answer', 'action', 'reason'],
} as const;

/** GeminiError の種別。呼び出し側がログ・表示を出し分けるために使う */
export type GeminiErrorKind =
  /** 制限時間内に応答が返らなかった */
  | 'timeout'
  /** APIがエラーを返した（キー不正・レート制限・障害など） */
  | 'api'
  /** 応答がJSONとして壊れていた、または期待した型ではなかった */
  | 'parse'
  /** セーフティフィルタ等でモデルが回答を拒否した */
  | 'blocked';

/**
 * Gemini 呼び出しの失敗。
 *
 * 呼び出し側は kind に関わらず「即エスカレーション」に倒すのが基本方針だが、
 * ログにどの失敗だったかを残せるよう種別を保持する。
 */
export class GeminiError extends Error {
  readonly kind: GeminiErrorKind;

  constructor(kind: GeminiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GeminiError';
    this.kind = kind;
  }
}

let cached: GoogleGenAI | null = null;

/**
 * Gemini クライアントを取得する（プロセス内で使い回す）。
 *
 * モジュール読み込み時ではなく呼び出し時に生成しているのは、
 * GEMINI_API_KEY 未設定でアプリ全体が起動不能になるのを避けるため。
 * AI機能を使った瞬間にだけ、原因が分かるエラーで落ちる。
 */
function getClient(apiKey?: string): GoogleGenAI {
  // デモモードは利用者が自分のキーを持ち込むため、キャッシュしてはいけない。
  // キャッシュすると次の利用者の呼び出しに前の人のキーを使ってしまう。
  if (apiKey) return new GoogleGenAI({ apiKey });
  if (cached) return cached;
  cached = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  return cached;
}

/** 受け取った値が AIResponse の形をしているか検証する（any を使わないための実行時チェック） */
function isAIResponse(value: unknown): value is AIResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.answer === 'string' &&
    typeof v.reason === 'string' &&
    (v.action === 'answer' || v.action === 'handoff_offer' || v.action === 'escalate')
  );
}

/**
 * システムプロンプトと顧客メッセージを渡して、構造化された回答を1件生成する。
 *
 * @param systemInstruction FAQを埋め込んだ確定版システムプロンプト
 * @param userMessage       顧客が送信したメッセージ本文
 * @param history           直近のやり取り（古い順）。省略時は単発の一問一答になる
 * @param apiKey            利用者が持ち込むAPIキー（デモモード用）。
 *                          省略時は環境変数の GEMINI_API_KEY を使う。
 *                          ログに出さないこと（この関数もエラーメッセージに含めない）
 * @throws {GeminiError} タイムアウト・API障害・パース失敗・回答拒否のいずれか
 */
export async function generateAIResponse(
  systemInstruction: string,
  userMessage: string,
  history: AiTurn[] = [],
  apiKey?: string
): Promise<AIResponse> {
  // AbortController でタイムアウトを制御する。
  // SDK 側の待機を打ち切るためのもので、API課金自体は止まらない点に注意。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let text: string | undefined;

  try {
    const response = await getClient(apiKey).models.generateContent({
      model: GEMINI_MODEL,
      // 履歴 + 今回の発言。履歴が空なら従来どおり単発の一問一答になる。
      // Gemini のロールは 'user'（顧客）と 'model'（AI）の2種類しかないため、
      // 呼び出し側で operator の発言を除外しておく必要がある
      contents: [
        ...history.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        { role: 'user' as const, parts: [{ text: userMessage }] },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: AI_RESPONSE_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // 事実の言い換えを最小限にするため低めに固定する。
        // 高いとFAQにない表現を足しやすくなり、AI-005（ハルシネーション抑制）に反する。
        // 0.2 では同じ質問でエスカレーション判定がぶれたため 0.1 まで下げた
        // （検証シナリオ #3「届いた商品が壊れていました」が実行ごとに割れた）。
        // 0 にしないのは、完全な貪欲法だと定型文が硬くなりやすいため。
        temperature: 0.1,
        // 2.5 Flash は既定で思考トークンを使い応答が遅くなる。
        // FAQ参照の一問一答に推論は不要なため無効化し、制限時間の枠内に収める。
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: controller.signal,
      },
    });

    text = response.text;

    // セーフティフィルタ等で本文が返らないケース。
    // 空文字のまま進めるとパースエラーとして扱われ原因が分かりにくくなるため、ここで切り分ける。
    if (!text) {
      const finishReason = response.candidates?.[0]?.finishReason ?? '不明';
      throw new GeminiError(
        'blocked',
        `Geminiが回答を返しませんでした（finishReason: ${finishReason}）`
      );
    }
  } catch (error) {
    if (error instanceof GeminiError) throw error;

    // abort は DOMException(name: 'AbortError') で飛んでくる
    if (controller.signal.aborted) {
      throw new GeminiError(
        'timeout',
        `Gemini APIが${GEMINI_TIMEOUT_MS / 1000}秒以内に応答しませんでした`,
        { cause: error }
      );
    }

    throw new GeminiError(
      'api',
      `Gemini APIの呼び出しに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  } finally {
    // 成功時もタイマーを必ず解除する。放置するとプロセスが最大30秒終了しない。
    clearTimeout(timer);
  }

  // responseSchema で縛っていても、モデル応答は最終的に文字列で返るため検証は省略しない。
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new GeminiError('parse', 'Geminiの応答をJSONとして解釈できませんでした', {
      cause: error,
    });
  }

  if (!isAIResponse(parsed)) {
    throw new GeminiError('parse', 'Geminiの応答が期待した形式ではありませんでした');
  }

  // action ごとに整える。
  //
  // 【重要】本文を空にするのは 'escalate' のときだけにすること。
  // 'handoff_offer' は「FAQの案内を出したうえで担当者を提案する」方針なので、
  // ここで本文を捨てると謝罪もFAQ案内も顧客に届かず、引き継ぎ文だけが表示される。
  // この設計を入れた目的そのものが失われる。
  if (parsed.action === 'escalate') {
    // 引き継ぎ案内と中途半端なAI回答が二重に表示されるのを防ぐ
    return { action: 'escalate', answer: '', reason: parsed.reason };
  }

  if (parsed.action === 'handoff_offer') {
    // 本文が空のまま選択肢だけ出すと、何の案内も無いまま
    // 「担当者へつなぐ？」と聞くことになる。安全側（即エスカレーション）へ倒す
    if (parsed.answer.trim() === '') {
      return { action: 'escalate', answer: '', reason: parsed.reason };
    }
    return { action: 'handoff_offer', answer: parsed.answer, reason: parsed.reason };
  }

  return { action: 'answer', answer: parsed.answer, reason: '' };
}
