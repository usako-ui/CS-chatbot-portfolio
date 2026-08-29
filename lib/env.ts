/**
 * 環境変数の読み取りと検証
 *
 * 未設定のまま起動すると「なぜか401が返る」「Realtimeが繋がらない」といった
 * 遠回りな症状で気づくことになるため、参照時点で明示的に落として原因を即わかるようにする。
 */

/** 必須の環境変数を取得する。未設定なら分かりやすいメッセージで落とす */
function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env.local を確認してください（テンプレート: .env.example）`
    );
  }
  return value;
}

/**
 * ブラウザにも露出してよい公開設定。
 *
 * NEXT_PUBLIC_ 変数はビルド時に静的置換されるため、
 * process.env[name] のような動的アクセスでは値が入らない。必ず直接参照する。
 */
export const publicEnv = {
  supabaseUrl: required(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
} as const;

/**
 * サーバー専用の秘匿設定。
 *
 * この関数はサーバー側でのみ呼ぶこと。クライアントから呼ぶと
 * process.env が空のため必ず例外になる（露出はしないが動作しない）。
 * 実際の流出防止は lib/supabase/admin.ts の 'server-only' が担う。
 */
export function getServerEnv() {
  return {
    supabaseUrl: required(
      'SUPABASE_URL',
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    supabaseServiceRoleKey: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  } as const;
}

/**
 * Gemini APIキー。AI処理（T-10以降）で使用する。
 * 未設定でもアプリ全体は起動できるよう、AI呼び出し時にのみ検証する。
 */
export function getGeminiApiKey(): string {
  return required('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
}
