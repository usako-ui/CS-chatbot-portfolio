/**
 * 顧客入力の検証（T-15）
 *
 * 'use server' のファイルは非同期関数しかエクスポートできないため、
 * 複数の Server Action で共有する同期的な検証はここに置く。
 */

/** 1メッセージの最大文字数。これを超える入力はプロンプト汚染とコスト増の温床になる */
export const MAX_MESSAGE_LENGTH = 2000;

/** 検証結果。ok が true のときだけ整形済みの message を使う */
export type ValidationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** 顧客・オペレーター双方のメッセージを検証し、前後の空白を落とした本文を返す */
export function validateMessageText(input: string): ValidationResult {
  const message = input.trim();
  if (message === '') {
    return { ok: false, error: 'メッセージが空です。' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `メッセージが長すぎます（${MAX_MESSAGE_LENGTH}文字以内で入力してください）。`,
    };
  }
  return { ok: true, message };
}
