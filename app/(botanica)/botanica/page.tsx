/**
 * 本番の顧客チャットページ（/botanica）
 *
 * 実装したチャットボットを実際の仕様どおりに動かすページ。
 * 匿名サインイン・DB保存・RLS・Realtime がすべて有効で、
 * 受入条件（AC-005 など）の検証はこのページで行う。
 *
 * 旧 /chat の後継。/chat は next.config.mjs のリダイレクトでここへ来る。
 *
 * 【ランディングに導線を置かないこと】
 * 誰でも触れる場所に出すと、見ただけの人にも会話レコードが作られ、
 * Gemini の無料枠も消費される。URLを知っている人だけが使う運用にしている。
 * 公開のデモ導線は /demo-ec（体験者自身のAPIキーで動く・DB保存なし）。
 */
import { ChatWidget } from '@/components/chat/ChatWidget';
import { ClosedNotice } from '@/components/chat/ClosedNotice';
import { StoreFront } from '@/components/store/StoreFront';

/**
 * 受付を終了しているか。
 *
 * 講座提出後は Gemini のAPIキーを外して無料枠を守る運用にしている。
 * キーが無いままチャットを開かせると「担当者に接続しています。」しか返らず、
 * 誰も見ていない管理画面に会話だけが溜まる。
 * この環境変数を立てておけば、チャットを起動せずに案内で止められる。
 *
 * Vercel の環境変数に LIVE_CHAT_CLOSED=1 を足して再デプロイすると有効になる。
 * 外して再デプロイすれば元に戻せる。
 * NEXT_PUBLIC_ を付けないのは、ブラウザに配る必要がないため
 * （このページはサーバーコンポーネント）。
 */
const isClosed = process.env.LIVE_CHAT_CLOSED === '1';

export const metadata = {
  title: 'BOTANICA カスタマーサポート',
  description:
    'BOTANICAのカスタマーサポートです。在庫・配送・返品などのご質問にAIがお答えします。',
  // 検証用のページなので検索エンジンには載せない
  robots: { index: false, follow: false },
};

export default function BotanicaPage() {
  if (isClosed) return <ClosedNotice />;

  return (
    <StoreFront
      notice={
        <p>
          ※ これはウィジェット埋め込みのイメージ画面です。
          <br />
          実際のECサイトへの埋め込みはPhase 2で対応予定。
        </p>
      }
    >
      <ChatWidget />
    </StoreFront>
  );
}
