/**
 * ログイン中のオペレーター情報の取得
 *
 * 表示名は auth.users の user_metadata に入っているため、
 * Server Component から都度読み出す。
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface CurrentOperator {
  id: string;
  name: string;
}

/**
 * @returns ログイン中のオペレーター。未ログイン・匿名顧客なら null
 */
export async function getCurrentOperator(): Promise<CurrentOperator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 匿名顧客も role は authenticated になるため必ず除外する
  if (!user || user.is_anonymous === true) return null;

  return {
    id: user.id,
    name:
      (user.user_metadata?.display_name as string) ?? user.email ?? '担当者',
  };
}
