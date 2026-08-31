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
import { StoreFront } from '@/components/store/StoreFront';

export const metadata = {
  title: 'BOTANICA カスタマーサポート',
  description:
    'BOTANICAのカスタマーサポートです。在庫・配送・返品などのご質問にAIがお答えします。',
  // 検証用のページなので検索エンジンには載せない
  robots: { index: false, follow: false },
};

export default function BotanicaPage() {
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
