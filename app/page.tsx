/**
 * ルート。顧客チャットページへ転送する。
 *
 * 本番ではウィジェットをECサイト側に埋め込むため、このアプリ単体の
 * トップページは持たない。動作確認用の /chat に寄せている。
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/chat');
}
