/**
 * FAQ管理（T-31・Q-004）
 *
 * MVPの機能は「追加」と「有効/無効の切り替え」のみ。
 * 編集とCSV一括インポートは Phase 2。
 * 削除は用意しない（無効にすればAIは参照しなくなり、誤操作も戻せる）。
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createFaq, fetchAllFaqs, toggleFaq } from '@/actions/dashboard';
import { AlertIcon, InfoIcon, PlusIcon } from '@/components/icons';
import type { FAQ, FAQCategory } from '@/types';

const CATEGORIES: FAQCategory[] = ['在庫', '配送', '返品', '商品', 'その他'];

export function FaqClient() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [category, setCategory] = useState<FAQCategory>('在庫');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    // 呼び出し元が void で呼び捨てる箇所があるため、
    // ここで例外を握りつぶさないと unhandled rejection になる
    try {
      const result = await fetchAllFaqs();
      if (!result.success || !result.data) {
        setError(result.error ?? 'FAQを取得できませんでした。');
      } else {
        setFaqs(result.data);
        setError(null);
      }
    } catch (err) {
      console.error('[FaqClient] FAQの取得に失敗:', err);
      setError('通信に失敗しました。接続を確認してページを再読み込みしてください。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await createFaq(category, question, answer);
      if (!result.success) {
        setError(result.error ?? 'FAQを追加できませんでした。');
      } else {
        setQuestion('');
        setAnswer('');
        setIsFormOpen(false);
        setNotice('FAQを追加しました。次回の問い合わせからAIが参照します。');
        await load();
      }
    } catch (err) {
      // 通信断では Server Action が reject する。
      // 捕まえないと「追加しています...」のまま押せなくなり、
      // 入力内容を残したまま操作不能になる
      console.error('[FaqClient] FAQの追加に失敗:', err);
      setError('通信に失敗しました。接続を確認してもう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(faq: FAQ) {
    setError(null);
    setNotice(null);
    // 先に画面を切り替えて操作感を保つ。失敗したら load() で戻る
    setFaqs((prev) =>
      prev.map((f) => (f.id === faq.id ? { ...f, is_active: !f.is_active } : f))
    );
    try {
      const result = await toggleFaq(faq.id, !faq.is_active);
      if (!result.success) setError(result.error ?? '状態を変更できませんでした。');
    } catch (err) {
      console.error('[FaqClient] FAQの状態変更に失敗:', err);
      setError('通信に失敗しました。接続を確認してもう一度お試しください。');
    } finally {
      // 失敗しても必ず取り直す。先に画面だけ切り替えているため、
      // ここで戻さないと実際のDBと表示がずれたままになる
      await load();
    }
  }

  const activeCount = faqs.filter((f) => f.is_active).length;

  if (isLoading) {
    return <p className="px-6 py-8 text-sm text-brand-secondary">読み込んでいます...</p>;
  }

  return (
    <div className="px-6 py-5">
      {/* AIの挙動に直結することを明示する。
          ここを理解せずに曖昧なFAQを足すと、AIも曖昧に答えるようになる */}
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-brand-accent bg-white px-4 py-3 text-[13px] leading-relaxed text-brand-secondary">
        <InfoIcon size={16} className="mt-0.5 shrink-0 text-brand-primary" />
        <div>
          <p className="text-brand-text">
            ここに登録した内容が、そのままAIの回答根拠になります（有効なもののみ）。
          </p>
          <p className="mt-1">
            断定できない情報は書かないでください。書いた内容はAIがそのまま事実として answer します。
            個別対応が必要なことは「担当者が確認します」と書くと、AIが勝手に判断しません。
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-brand-secondary">
          全{faqs.length}件（有効 {activeCount}件 / 無効 {faqs.length - activeCount}件）
        </p>
        <button
          type="button"
          onClick={() => setIsFormOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon size={16} />
          {isFormOpen ? '閉じる' : 'FAQを追加'}
        </button>
      </div>

      {notice && (
        <p className="mb-4 rounded-lg border border-brand-accent bg-brand-accent/25 px-3 py-2 text-[13px] text-brand-text">
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
        >
          <AlertIcon size={15} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-brand-accent bg-white p-5"
        >
          <div className="mb-3">
            <label htmlFor="cat" className="mb-1 block text-[13px] font-medium">
              カテゴリ
            </label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as FAQCategory)}
              className="rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="q" className="mb-1 block text-[13px] font-medium">
              質問
            </label>
            <input
              id="q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
              required
              placeholder="例：ギフトラッピングはできますか？"
              className="w-full rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="a" className="mb-1 block text-[13px] font-medium">
              回答
            </label>
            <textarea
              id="a"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={2000}
              required
              rows={4}
              placeholder="例：1点につき330円でギフトラッピングを承っています。"
              className="w-full resize-y rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
            />
            <p className="mt-1 text-right text-[11px] text-brand-secondary/70">
              {answer.length} / 2000
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-primary px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? '追加しています...' : '追加する'}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {faqs.map((faq) => (
          <li
            key={faq.id}
            className={`rounded-xl border bg-white p-4 transition-opacity ${
              faq.is_active
                ? 'border-brand-accent'
                : 'border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 rounded-full border border-brand-accent bg-brand-accent/25 px-2 py-0.5 text-[11px] text-brand-text">
                {faq.category}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-brand-text">
                  {faq.question}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-secondary">
                  {faq.answer}
                </p>
              </div>

              {/* 有効/無効トグル
                  文字ラベルを併記するのは、色と位置だけで状態を示すと
                  色覚特性のある方に伝わらないため。一覧を上から見たときに
                  どれが無効か一目で分かる効果もある。 */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`w-7 text-right text-[11px] font-bold ${
                    faq.is_active ? 'text-brand-primary' : 'text-slate-400'
                  }`}
                >
                  {faq.is_active ? '有効' : '無効'}
                </span>
                <button
                  type="button"
                  onClick={() => void handleToggle(faq)}
                  role="switch"
                  aria-checked={faq.is_active}
                  aria-label={`${faq.question} を${faq.is_active ? '無効' : '有効'}にする`}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 ${
                    faq.is_active ? 'bg-brand-primary' : 'bg-slate-300'
                  }`}
                >
                  {/* left-0.5 を必ず付けること。
                      absolute で left を省くと基準がボタンの静的位置になり、
                      button が持つ text-align: center の影響でつまみが中央に寄る。
                      その状態で translate すると ON のときトラックの外へ出て
                      見えなくなり、緑一色の塊にしか見えなくなる。 */}
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      faq.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
