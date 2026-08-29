/**
 * ブラウザ用 Supabase クライアント（anon key）
 *
 * 用途：
 *   - 顧客の匿名サインイン
 *   - 顧客・オペレーターの Realtime 購読
 *   - オペレーターのログイン
 *
 * 【重要】@supabase/supabase-js の createClient ではなく
 * @supabase/ssr の createBrowserClient を使う。
 * 前者はセッションを localStorage に保存するため Server Action から読めない。
 * 後者は Cookie に保存するので、Server Action 側で auth.getUser() による
 * 署名検証ができる（決定①の設計が成立する前提条件）。
 *
 * 書き込みには使わないこと。顧客のDB書き込みはすべて Server Action 経由。
 */
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
