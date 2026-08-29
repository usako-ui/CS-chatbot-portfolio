/**
 * 管理用 Supabase クライアント（service_role key）
 *
 * 【最重要・取り扱い注意】
 * このクライアントは RLS（行レベルセキュリティ）を完全にバイパスし、
 * 全テーブルの全行を無条件に読み書きできる。
 * 漏洩すると全顧客の会話・個人情報が第三者に読み書きされる。
 *
 * 使用ルール：
 *   1. 必ず本人確認（requireCustomerId / requireOperatorId）を通した後に使う
 *   2. conversation_id を扱う処理では、その会話が本人のものか所有権を突合する
 *   3. クライアントコンポーネントから絶対に import しない
 *
 * 先頭の 'server-only' はそのための保険。
 * クライアントコンポーネントから誤って import した瞬間にビルドエラーになり、
 * 鍵の流出を「実行時の事故」ではなく「ビルド時の失敗」として検出できる。
 */
import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';

let cached: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * service_role クライアントを取得する（プロセス内で使い回す）。
 *
 * autoRefreshToken / persistSession を切っているのは、
 * service_role キーは失効しない固定キーであり、
 * サーバー上でセッションを保持する必要がないため。
 * 有効にしたままだとサーバー環境で不要なタイマーが走る。
 */
export function getSupabaseAdmin() {
  if (cached) return cached;

  const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();

  cached = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
