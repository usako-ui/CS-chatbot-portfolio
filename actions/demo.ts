/**
 * デモモード用 Server Action（ポートフォリオのランディングページ専用）
 *
 * 【本番の顧客チャット（actions/chat.ts）との違い】
 * - 認証しない・DBに書かない・会話を作らない。履歴はブラウザのstateだけ。
 * - Gemini は環境変数のキーではなく、体験者が持ち込んだキーで呼ぶ。
 *   運営側の無料枠（1日20リクエスト・1分5リクエスト）をデモで食い潰さないため。
 *
 * 【APIキーの扱い】
 * 受け取ったキーは Gemini の呼び出しにだけ使い、保存もログ出力もしない。
 * エラーメッセージにも含めない（例外の cause 経由で漏れないよう、
 * 顧客表示用の文言は固定文にしている）。
 */
'use server';

import { cookies } from 'next/headers';
import { getActiveFaqsForDemo, buildFaqPromptText } from '@/lib/faq';
import { generateAIResponse, GeminiError } from '@/lib/gemini';
import { buildSystemInstruction } from '@/lib/prompt';
import { validateMessageText } from '@/lib/validation';
import type { ActionResult, DemoTurn } from '@/types';

/** デモの1往復の結果。UIはこれを見て吹き出しと引き継ぎ表示を出し分ける */
export interface DemoReplyResult {
  /** AIの回答本文。escalated が true のときは空文字 */
  answer: string;
  /** true ならFAQ外・人間対応が必要と判定された */
  escalated: boolean;
}

/** 連続送信を禁じる間隔。本番チャットのクールダウン（3秒）と揃える */
const RATE_LIMIT_MS = 3000;

/** デモのセッションを識別するCookie名。認証には一切使わない */
const DEMO_COOKIE = 'demo_session';

/** AIに渡す履歴の上限ターン数。長くしてもデモの体験は向上せずコストだけ増える */
const MAX_HISTORY_TURNS = 10;

/**
 * 直近の送信時刻（デモセッションID → エポックミリ秒）。
 *
 * これ「だけ」に頼らないこと。開発サーバーはモジュールを再評価することがあり、
 * その瞬間に記録が消えて制限がすり抜ける（実際に検証で再現した）。
 * 本番でも複数インスタンスに分散すればインスタンスをまたいだ制限はかからない。
 * そのため下の Cookie 側の記録と併用し、厳しいほうを採用する。
 */
const lastCallAt = new Map<string, number>();

/** 増え続けるのを防ぐため、古いエントリを間引く上限 */
const MAX_TRACKED_SESSIONS = 1000;

/**
 * APIキーの最低限の検証。
 *
 * 目的は「体験者の打ち間違い（空欄・コピー漏れ）を即座に伝えること」だけ。
 * プレフィックスの形式チェックはしない。Google が発行形式を変えたときに
 * 正しいキーを弾いてしまい、原因の分からない不具合になるため。
 * 無効なキーは Gemini 側が401を返すので、呼び出し後のエラー処理で拾う。
 */
const MIN_API_KEY_LENGTH = 39;

function validateApiKey(apiKey: string): { ok: true } | { ok: false; error: string } {
  const key = apiKey.trim();
  if (key === '') {
    return { ok: false, error: 'APIキーを入力してください。' };
  }
  if (key.length < MIN_API_KEY_LENGTH) {
    return {
      ok: false,
      error: `APIキーが短すぎます（${MIN_API_KEY_LENGTH}文字以上）。全体をコピーできているか確認してください。`,
    };
  }
  return { ok: true };
}

/**
 * デモセッションの状態。Cookieの値は「セッションID:直近送信時刻」の形で持つ。
 *
 * 時刻をCookieにも書くのは、サーバー側のメモリが消えても制限を維持するため。
 * httpOnly にしてあるのでブラウザのスクリプトからは書き換えられない。
 * （curl等で偽装は可能だが、目的は連打の抑止であり不正利用対策ではない）
 */
interface DemoSession {
  id: string;
  /** Cookieに記録された直近送信時刻。無ければ 0 */
  lastAt: number;
}

async function readDemoSession(): Promise<DemoSession> {
  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return { id: crypto.randomUUID(), lastAt: 0 };

  const separator = raw.lastIndexOf(':');
  if (separator === -1) return { id: raw, lastAt: 0 };

  const id = raw.slice(0, separator);
  const parsed = Number(raw.slice(separator + 1));
  // 壊れた値が入っていても制限を素通りさせない。読めなければ 0 として扱う
  return { id: id || crypto.randomUUID(), lastAt: Number.isFinite(parsed) ? parsed : 0 };
}

async function writeDemoSession(session: DemoSession, at: number): Promise<void> {
  const store = await cookies();
  store.set(DEMO_COOKIE, `${session.id}:${at}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

/** 履歴が想定の形か検証し、渡してよい範囲に切り詰める */
function sanitizeHistory(history: DemoTurn[]): DemoTurn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (turn) =>
        turn !== null &&
        typeof turn === 'object' &&
        (turn.role === 'user' || turn.role === 'model') &&
        typeof turn.text === 'string' &&
        turn.text.trim() !== ''
    )
    .slice(-MAX_HISTORY_TURNS);
}

/**
 * デモのメッセージを1件処理する。
 *
 * @param input.message 体験者が入力した本文
 * @param input.apiKey  体験者自身の Gemini APIキー
 * @param input.history これまでのやり取り（古い順・今回の発言は含めない）
 */
export async function sendDemoMessage(input: {
  message: string;
  apiKey: string;
  history: DemoTurn[];
}): Promise<ActionResult<DemoReplyResult>> {
  const validation = validateMessageText(input.message);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const keyCheck = validateApiKey(input.apiKey ?? '');
  if (!keyCheck.ok) {
    return { success: false, error: keyCheck.error };
  }
  const apiKey = input.apiKey.trim();

  // ---- レート制限（1リクエスト/3秒）----
  // Cookie の記録とサーバーメモリの記録の「新しいほう」で判定する。
  // 片方が消えても、もう片方が残っていれば制限が効く
  const session = await readDemoSession();
  const now = Date.now();
  const lastAt = Math.max(session.lastAt, lastCallAt.get(session.id) ?? 0);

  if (lastAt > 0 && now - lastAt < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (now - lastAt)) / 1000);
    return {
      success: false,
      error: `送信の間隔が短すぎます。${wait}秒ほどお待ちください。`,
    };
  }

  // Map が無制限に増えないよう、上限を超えたら最も古いキーから捨てる
  if (lastCallAt.size >= MAX_TRACKED_SESSIONS) {
    const oldest = lastCallAt.keys().next().value;
    if (oldest !== undefined) lastCallAt.delete(oldest);
  }
  lastCallAt.set(session.id, now);
  await writeDemoSession(session, now);

  // ---- FAQ取得（anon・読み取りのみ）----
  let systemInstruction: string;
  try {
    const faqs = await getActiveFaqsForDemo();
    systemInstruction = buildSystemInstruction(buildFaqPromptText(faqs));
  } catch (error) {
    console.error('[sendDemoMessage] FAQ取得失敗:', error);
    return {
      success: false,
      error: 'FAQデータを取得できませんでした。時間をおいてお試しください。',
    };
  }

  // ---- Gemini 呼び出し（体験者のキーを使う）----
  try {
    const response = await generateAIResponse(
      systemInstruction,
      validation.message,
      sanitizeHistory(input.history),
      apiKey
    );
    return {
      success: true,
      data: { answer: response.answer, escalated: response.escalate },
    };
  } catch (error) {
    // APIキーが応答に混ざらないよう、種別だけを見て固定文言を返す。
    // error.message には呼び出しURLなどが入りうるため顧客表示に使わない
    const kind = error instanceof GeminiError ? error.kind : 'unknown';
    console.error(`[sendDemoMessage] Gemini呼び出し失敗（${kind}）`);
    if (kind === 'timeout') {
      return { success: false, error: 'AIの応答が時間内に返りませんでした。もう一度お試しください。' };
    }
    if (kind === 'api') {
      return {
        success: false,
        error: 'Gemini APIの呼び出しに失敗しました。APIキーが有効か、無料枠の上限に達していないか確認してください。',
      };
    }
    return { success: false, error: 'AIの応答を処理できませんでした。もう一度お試しください。' };
  }
}
