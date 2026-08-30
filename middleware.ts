/**
 * 管理画面の認証保護（T-25・FR-OPS-001・AC-011）
 *
 * 【重要】匿名顧客も Postgres ロールは 'authenticated' になる。
 * 「サインイン済みか」だけで通すと、顧客のウィジェットを開いた匿名セッションで
 * 管理画面に入れてしまう。is_anonymous が false であることまで必ず確認する。
 *
 * middleware は入口の第1関門にすぎない。
 * Server Action 側でも requireOperatorId() を通しているのは、
 * middleware を経由しない経路（Server Action の直接呼び出し）を塞ぐため。
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** 認証が必要なパス */
const PROTECTED = ['/dashboard', '/faq', '/settings'];

export async function middleware(request: NextRequest) {
  // Cookieの更新（トークン再発行）を返却レスポンスへ確実に載せるため、
  // レスポンスを先に作ってから supabase クライアントに渡す
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() ではなく getUser() を使う。
  // getSession() はCookieの中身をそのまま信じるだけだが、
  // getUser() はAuthサーバーで署名を検証するため偽造トークンを弾ける。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path.startsWith(p));
  // 匿名顧客はオペレーターではない
  const isOperator = Boolean(user) && user!.is_anonymous !== true;

  if (isProtected && !isOperator) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // ログイン後に元のページへ戻せるよう、行き先を持たせる
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // ログイン済みでログイン画面に来たらダッシュボードへ送る
  if (path === '/login' && isOperator) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * 静的アセットと顧客チャットを除外する。
   * 顧客側（/chat）まで middleware に通すと、
   * 匿名サインイン前のアクセスで無駄なAuth問い合わせが発生する。
   */
  matcher: ['/dashboard/:path*', '/faq/:path*', '/settings/:path*', '/login'],
};
