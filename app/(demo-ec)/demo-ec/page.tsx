/**
 * 公開デモページ（/demo-ec）
 *
 * ECサイトの見た目は本番チャットのページ（/botanica）と同じで、
 * 右下のウィジェットだけがデモ専用のものに差し替わっている。
 *
 * 【なぜデモ専用にするのか】
 * ランディングから誰でも来られるページなので、本番チャットを置くと
 * 見ただけの人にも会話レコードが作られ、運営側のGemini無料枠
 * （1日20・1分5リクエスト）も消費される。
 * デモは体験する方自身のAPIキーで動き、DBには一切書き込まない。
 *
 * 【コードの重複を作らないこと】
 * ECサイトのレイアウトは components/store/StoreFront.tsx を /botanica と共有する。
 */
import { DemoChatWidget } from '@/components/demo/DemoChatWidget';
import { StoreFront } from '@/components/store/StoreFront';

export const metadata = {
  title: 'BOTANICA｜チャットウィジェットのデモ',
  description:
    'ECサイトにCSチャットボットのウィジェットを埋め込んだ場合の見え方と動きを試せるデモ画面です。',
};

export default function DemoEcPage() {
  return (
    <StoreFront
      notice={
        <p>
          ※ これはポートフォリオ用のデモ画面です。
          <br />
          ご自身のGemini APIキーで動作し、会話は保存されません。
          <br />
          ダミーFAQ18件・テストシナリオ8件で動作確認済み。実運用時は実際のFAQデータでの検証を推奨します。
        </p>
      }
    >
      <DemoChatWidget />
    </StoreFront>
  );
}
