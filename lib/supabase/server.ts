/**
 * サーバー用 Supabase クライアント（anon key + Cookie）
 *
 * 用途：Server Action / Server Component で「誰がアクセスしてきたか」を検証する。
 *
 * このクライアントは RLS の効いた匿名ロール相当で動く。
 * DB操作の権限は持たせず、あくまで JWT の検証（本人確認）に使う。
 * 実際のDB読み書きは、本人確認が済んだうえで admin クライアントが行う。
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

/**
 * Cookie 上の JWT を読めるサーバークライアントを作る。
 *
 * Next.js 15 から cookies() が非同期になったため、この関数も async。
 * 呼び出し側は必ず await すること。
 *
 * @param writable Server Action / Route Handler では true（トークン更新をCookieへ書き戻す）。
 *                 Server Component では false（Cookie書き込みが禁止されているため）。
 */
export async function createClient(writable = false) {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Component からは Cookie を書き換えられない（Next.jsの制約）。
        // ミドルウェアがセッション更新を担うため、ここでの失敗は無視してよい。
        if (!writable) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component から呼ばれた場合はここに来る。意図的に握りつぶす。
        }
      },
    },
  });
}

/**
 * 顧客の本人確認。全ての顧客向け Server Action の先頭で呼ぶこと。
 *
 * 【重要】クライアントから渡された userId を引数で受け取ってはいけない。
 * Server Action の引数はクライアントが自由に改ざんできるため、
 * 他人のUIDを渡されると service_role が RLS をバイパスして
 * 他人の会話を読み書きできてしまう（AC-012 が崩壊する）。
 *
 * getSession() ではなく getUser() を使う理由：
 * getSession() は Cookie の中身をそのまま信用するだけだが、
 * getUser() は Auth サーバーに問い合わせて JWT の署名を検証するため、
 * 偽造トークンを弾ける。
 *
 * @returns 匿名サインイン済み顧客の auth.uid()
 * @throws  セッションが無い・無効な場合
 */
export async function requireCustomerId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('セッションが無効です。ページを再読み込みしてください。');
  }
  return user.id;
}

/**
 * オペレーターの本人確認。管理画面向け Server Action の先頭で呼ぶこと。
 *
 * 匿名顧客も role は 'authenticated' になるため、
 * 「サインイン済みかどうか」だけでは判定できない。
 * is_anonymous が false であることまで確認する。
 *
 * @returns オペレーターの auth.uid()
 * @throws  未ログイン、または匿名顧客だった場合
 */
export async function requireOperatorId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('ログインが必要です。');
  }
  // 匿名顧客が管理画面のServer Actionを直接叩いてくるケースを弾く
  if (user.is_anonymous === true) {
    throw new Error('この操作にはオペレーター権限が必要です。');
  }
  return user.id;
}
