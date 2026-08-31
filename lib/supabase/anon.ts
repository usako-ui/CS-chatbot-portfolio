/**
 * サーバー側で使う anon クライアント（デモモード専用）
 *
 * 用途はデモの公開データ読み取り（FAQ）だけ。
 *
 * 【なぜ admin ではなく anon なのか】
 * デモは認証を通さない誰でも触れる導線であり、service_role で読むと
 * RLS を迂回した経路がひとつ増える。anon なら万一クエリを書き間違えても
 * RLS が最後の砦として効くため、事故の上限が「公開情報の読み取り」で止まる。
 *
 * 【なぜ lib/supabase/client.ts を使わないのか】
 * あちらは @supabase/ssr の createBrowserClient で Cookie にセッションを持つ。
 * デモはセッションを一切作らないので、Cookie を触らない素の
 * @supabase/supabase-js を使い、副作用を残さない。
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export function getSupabaseAnon() {
  // admin クライアントと同じ <Database> を渡す。
  // 型を揃えておくと lib/faq.ts が両方を1つの関数で受けられる
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    // デモはログイン状態を持たない。トークンの保存・更新を一切させない
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
