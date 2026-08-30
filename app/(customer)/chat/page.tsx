/**
 * 顧客チャットページ（T-16・FR-CUS-001・AC-005・AC-010）
 *
 * 本番ではウィジェットをECサイト側に埋め込むが、MVPでは動作確認のために
 * ECサイトを模したページを用意し、その右下にウィジェットを置いている。
 * 「ECサイト上にウィジェットが表示され、クリックで起動する」（AC-005）を
 * 実際の見え方で確認できるようにするため。
 *
 * このページ自体はサーバーコンポーネント。
 * ChatWidget だけがクライアントコンポーネントなので、
 * 商品一覧などの静的部分はサーバー側でレンダリングされる。
 */
import { ChatWidget } from '@/components/chat/ChatWidget';
import { LeafIcon } from '@/components/icons';

/** ECサイトの見た目を再現するためのダミー商品 */
const SAMPLE_PRODUCTS = [
  { name: 'ボタニカローション', size: '150mL', price: 3_960 },
  { name: 'ボタニカセラム', size: '30mL', price: 5_500 },
  { name: 'ハーバルクレンジング', size: '120mL', price: 3_300 },
  { name: 'モイストクリーム', size: '50g', price: 4_620 },
  { name: 'クリアソープ', size: '100g', price: 2_420 },
  { name: 'リペアオイル', size: '20mL', price: 4_180 },
] as const;

const YEN = new Intl.NumberFormat('ja-JP');

export default function CustomerChatPage() {
  return (
    <div className="min-h-screen bg-brand-sand">
      {/* ECサイトのヘッダー（ブランドカラー・テキストロゴ：Q-010） */}
      <header className="border-b border-brand-accent bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-4">
          <LeafIcon size={24} className="text-brand-primary" />
          <div>
            <p className="text-lg font-bold tracking-[0.18em] text-brand-primary">
              BOTANICA
            </p>
            <p className="text-[11px] tracking-wide text-brand-secondary">
              自然派スキンケア
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 pb-28">
        <h1 className="text-xl font-bold text-brand-text">商品一覧</h1>
        <p className="mt-1 text-sm text-brand-secondary">
          ご不明な点は右下のチャットからお気軽にお問い合わせください。
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_PRODUCTS.map((p) => (
            <li
              key={p.name}
              className="overflow-hidden rounded-xl border border-brand-accent bg-white"
            >
              {/* 商品画像のプレースホルダー。画像アセットは本案件のスコープ外 */}
              <div className="flex h-36 items-center justify-center bg-brand-accent/25">
                <LeafIcon size={36} className="text-brand-secondary/50" />
              </div>
              <div className="p-4">
                <p className="text-[15px] font-medium text-brand-text">{p.name}</p>
                <p className="mt-0.5 text-xs text-brand-secondary">{p.size}</p>
                <p className="mt-2 text-[15px] font-bold text-brand-primary">
                  {YEN.format(p.price)}円
                  <span className="ml-1 text-[11px] font-normal">税込</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {/* 右下固定のチャットウィジェット */}
      <ChatWidget />
    </div>
  );
}
