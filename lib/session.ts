/**
 * 顧客セッション管理（T-17）
 *
 * 顧客はログイン操作をしないが、裏側では Supabase の匿名サインインで
 * JWT を発行しておく。これがないと以下が成立しない。
 *
 *   - Realtime：postgres_changes は RLS を尊重するため、JWTが無いと
 *     購読しても1件も配信されない（購読自体は成功するので気づきにくい）
 *   - Server Action の本人確認：auth.getUser() で検証する対象が無くなる
 *
 * セッションは @supabase/ssr が Cookie に保存する。
 * localStorage ではないため Server Action 側から読める。
 */
'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * 進行中のサインイン処理。同時呼び出しをここで1本にまとめる。
 *
 * これが無いと、2回同時に呼ばれたときに signInAnonymously() が2本走り、
 * 匿名ユーザーが2人作られてしまう。後から書かれたCookieが勝つため、
 * 先に作った会話は別人のものになり、以降の送信が
 * 「この会話にアクセスする権限がありません」で全て失敗する。
 *
 * Reactの開発モードは useEffect を2回実行するので確実に踏む。
 * 本番でも、再マウントやウィジェットの開閉が重なれば同じことが起きる。
 */
let inFlight: Promise<string> | null = null;

/**
 * 匿名セッションを用意する。
 *
 * 既存セッションがあれば再利用する。再利用することで、
 * ウィジェットを閉じて開き直しても同じ顧客として扱われ、
 * 会話の継続（Q-011）が成立する。
 *
 * 同時に複数回呼ばれても、実際のサインインは1回だけ行われる。
 *
 * @returns 顧客の auth.uid()
 * @throws  匿名サインインが無効化されている場合など
 */
export function ensureAnonymousSession(): Promise<string> {
  // すでに進行中なら、その結果を共有する
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const supabase = createClient();

    // getSession() は Cookie を読むだけでネットワークアクセスしない。
    // 起動時の待ち時間を増やさないため、まずこちらで既存セッションを確認する。
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return session.user.id;
    }

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error || !data.user) {
      // 422 anonymous_provider_disabled が出る場合は
      // Supabase ダッシュボード → Authentication → Providers → Anonymous が未有効
      throw new Error(
        `チャットの準備に失敗しました: ${error?.message ?? '不明なエラー'}`
      );
    }

    return data.user.id;
  })();

  // 失敗した場合は次回やり直せるように解放する。
  // 成功時は保持したままでよい（以降は getSession() で即返る）。
  inFlight.catch(() => {
    inFlight = null;
  });

  return inFlight;
}
