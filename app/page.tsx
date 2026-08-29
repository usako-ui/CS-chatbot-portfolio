/**
 * ルート。管理画面の一覧へ転送する。
 *
 * 未ログインの場合は middleware が /login へ回す。
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
