/**
 * FAQ データ取得（T-11）
 *
 * MVP はセマンティック検索を使わず、有効なFAQを全件プロンプトに載せる方式を採る。
 * 18件・約2,000文字程度でありトークン的に問題がなく、
 * 検索精度のチューニングという不確実な工程を丸ごと省けるため（requirements.md 確定仕様）。
 *
 * 件数が増えて全件投入が現実的でなくなったら、ここに検索を差し込む。
 * 呼び出し側（lib/aiReply.ts）のインターフェースは変えずに済む設計にしてある。
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { DEMO_FAQS } from '@/lib/demoFaq';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';
import type { FAQ, FAQCategory } from '@/types';

/**
 * DBの category は TEXT 型で制約が無いため、型定義側の5種と一致する保証がない。
 * 管理画面から想定外の値が入っても型を偽らないよう、ここで実際に突き合わせる。
 */
const FAQ_CATEGORIES: readonly FAQCategory[] = [
  '在庫',
  '配送',
  '返品',
  '商品',
  'その他',
];

function isFAQCategory(value: string): value is FAQCategory {
  return (FAQ_CATEGORIES as readonly string[]).includes(value);
}

/** DBの1行を FAQ 型へ変換する。想定外の行は null にして落とす */
function toFAQ(row: {
  id: string;
  category: string;
  question: string;
  answer: string;
  is_active: boolean;
}): FAQ | null {
  if (!isFAQCategory(row.category)) return null;
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
    is_active: row.is_active,
  };
}

/**
 * 有効なFAQを全件取得する。
 *
 * 顧客セッションに依存しないよう admin クライアントで読む。
 * FAQ自体は公開情報であり、ここで顧客の権限を見る必要がないため。
 * （顧客ごとの出し分けが必要になった場合はこの前提を見直すこと）
 *
 * @throws DB接続・クエリに失敗した場合。呼び出し側はエスカレーションへ倒す
 */
export async function getActiveFaqs(): Promise<FAQ[]> {
  return fetchActiveFaqs(getSupabaseAdmin());
}

/**
 * デモ用のFAQを返す（体験デモ専用）。
 *
 * **DBを見ない。** lib/demoFaq.ts の組み込みデータをそのまま返す。
 *
 * デモは体験者自身のAPIキーで動く公開導線で、DBには一切書き込まない。
 * 読み取りだけDBに依存させると、Supabaseプロジェクトの停止・削除で
 * デモまで動かなくなる。常に触れる状態を保つため依存を切ってある。
 *
 * 本番の顧客チャット（getActiveFaqs）はDBから読む。
 * 管理画面でのFAQ追加・無効化が即座に反映される必要があるため。
 *
 * async のままにしているのは呼び出し側（actions/demo.ts）の
 * インターフェースを変えないため。将来DBに戻す余地も残る。
 */
export async function getActiveFaqsForDemo(): Promise<FAQ[]> {
  return [...DEMO_FAQS];
}

/**
 * FAQ取得の実体。権限だけが違う2経路で同じクエリ・同じ検証を通すために共有する。
 * 片方だけ条件が変わると「本番では出るのにデモでは出ない」ズレが生まれるため。
 */
async function fetchActiveFaqs(client: SupabaseClient<Database>): Promise<FAQ[]> {
  const { data, error } = await client
    .from('faqs')
    .select('id, category, question, answer, is_active')
    .eq('is_active', true)
    .order('category', { ascending: true });

  if (error) {
    throw new Error(`FAQの取得に失敗しました: ${error.message}`);
  }

  const faqs = (data ?? []).map(toFAQ).filter((faq): faq is FAQ => faq !== null);

  // 0件のままAIを呼ぶと「根拠が何も無い状態」になり、
  // モデルが一般知識で答え始めるリスクがある（AI-005）。ここで止める。
  if (faqs.length === 0) {
    throw new Error('有効なFAQが1件も取得できませんでした');
  }
  return faqs;
}

/**
 * FAQ配列をプロンプト埋め込み用のテキストに変換する。
 *
 * 番号を振っているのは、回答がどのFAQを根拠にしたかを
 * ログや検証シナリオの確認時に追えるようにするため。
 */
export function buildFaqPromptText(faqs: FAQ[]): string {
  return faqs
    .map(
      (faq, index) =>
        `[FAQ ${index + 1}]（${faq.category}）\nQ: ${faq.question}\nA: ${faq.answer}`
    )
    .join('\n\n');
}
