/**
 * 本番チャット終了時の案内
 *
 * 講座提出後は Gemini の無料枠を守るためAPIキーを外す。
 * その状態でこのページに来た人には、チャットを開かせずここで止める。
 *
 * 案内を出さずにチャットを開かせると、
 * 「担当者に接続しています。」だけが返る画面になる。
 * 誰も見ていない管理画面へ引き継がれるだけで、
 * 訪問者には「壊れている」あるいは「返信を待てばよい」と映ってしまう。
 *
 * 体験できる導線（/demo-ec）を必ず併記すること。
 * ここで行き止まりにすると、ポートフォリオとして見に来た人が
 * 動くものを何も見ずに離脱する。
 */
import Link from 'next/link';
import { LeafIcon } from '@/components/icons';

export function ClosedNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-sand px-5 py-16">
      <div className="w-full max-w-md rounded-2xl border border-brand-accent bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent/40 text-brand-primary">
          <LeafIcon size={26} />
        </span>

        <h1 className="mt-5 text-[19px] font-bold text-brand-text">
          このデモは終了しました
        </h1>

        <p className="mt-3 text-[14px] leading-relaxed text-brand-secondary">
          BOTANICA は、CSチャットボットの制作事例として作成した
          <strong className="text-brand-text">架空のECサイト</strong>です。
          実在する企業・サービスではありません。
        </p>

        <p className="mt-3 text-[14px] leading-relaxed text-brand-secondary">
          このページの問い合わせ受付は終了しており、
          送信いただいてもご返信できません。
        </p>

        <div className="mt-6 rounded-xl bg-brand-sand p-4 text-left">
          <p className="text-[13px] font-medium text-brand-text">
            チャットボットの動作を試したい方へ
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-secondary">
            体験用のデモは引き続きご利用いただけます。
            ご自身の Gemini APIキーを入力する形式で、
            会話内容は保存されません。
          </p>
          <Link
            href="/demo-ec"
            className="mt-3 inline-block rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            体験デモを開く
          </Link>
        </div>

        <Link
          href="/"
          className="mt-6 inline-block text-[13px] text-brand-secondary underline transition-colors hover:text-brand-primary"
        >
          紹介ページに戻る
        </Link>
      </div>
    </main>
  );
}
