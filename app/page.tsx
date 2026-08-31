/**
 * ランディングページ（ポートフォリオ用）
 *
 * このアプリの入口。デモ体験と管理画面への導線を兼ねる。
 * 顧客チャットの動作確認用モックEC（/chat）と管理画面（/login）は
 * 直接URLで従来どおりアクセスできる。
 *
 * 【ブランド表記のルール・変更時は必ず守ること】
 * このページに架空クライアント名（BOTANICA）を出さない。
 * 開発者自身のスキルを見せるページであり、架空の企業名が前面に出ると
 * 何を作った人なのかが伝わりにくくなるため。
 * 開発背景としてのみ Profile セクションの小テキストで触れる。
 *
 * 【表現の制約】
 * 実運用実績のない模擬案件のため、数値や効果を断定してはいけない
 * （「70%削減を実現」など）。想定値と分かる書き方に統一している。
 *
 * 【配色】
 * このページだけ night トークン（ネイビー×シアンのダーク面）を使う。
 * /chat と管理画面は従来どおり明るいブランド面のままなので、
 * globals.css の既存トークンは変更していない。
 * Hero の右に置くモック2枚だけは実装どおりの明るい配色にしてあり、
 * 「実際の画面のスクリーンショット」として読めるようにしている。
 */
import Link from 'next/link';
import { DemoChat } from '@/components/demo/DemoChat';
import { LandingNav } from '@/components/landing/LandingNav';
import { UiShowcase } from '@/components/landing/UiShowcase';
import {
  ArrowRightIcon,
  BotIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  InboxIcon,
  LayersIcon,
  MoonIcon,
  OperatorIcon,
  ShieldIcon,
} from '@/components/icons';

export const metadata = {
  title: 'AI CS Bot｜ECサイト向けCSチャットボット',
  description:
    'AIが一次対応し、複雑な案件だけ人間へ引き継ぐECサイト向けCSチャットボット。ポートフォリオ用デモ実装。',
};

/** アイコンコンポーネントの型。size と className だけ渡せれば足りる */
type IconComponent = (props: {
  size?: number;
  className?: string;
}) => React.ReactElement;

/**
 * Hero 下部のステータスバー。
 * 独立したカード3枚だと視線が散り、主役であるプレビューより目立ってしまうため、
 * 区切り線でつないだ横長の1本にまとめている。
 * 文言はいずれも「想定値」と分かる書き方にすること（実績と誤解されないため）。
 */
const HERO_STATS: { Icon: IconComponent; value: string; label: string }[] = [
  { Icon: InboxIcon, value: '月500件規模', label: 'を想定した設計' },
  { Icon: BotIcon, value: '最大70%', label: 'のAI自動対応を想定' },
  { Icon: OperatorIcon, value: 'オペレーター', label: '負担を軽減' },
];

/** 課題セクションの3項目 */
const PROBLEMS: { Icon: IconComponent; title: string; body: string }[] = [
  {
    Icon: ClockIcon,
    title: '返信に1〜2日かかっている',
    body: '問い合わせが担当者のメール確認待ちになり、回答までに営業日をまたぐ。',
  },
  {
    Icon: ChatIcon,
    title: '定型質問にオペレーターが追われている',
    body: '送料・返品条件など、FAQに答えがある質問が問い合わせの多くを占める。',
  },
  {
    Icon: MoonIcon,
    title: '夜間・休日の問い合わせが放置される',
    body: '営業時間外に届いた問い合わせは、翌営業日まで誰も反応できない。',
  },
];

/** 特徴セクションの3項目 */
const FEATURES: { Icon: IconComponent; title: string; body: string }[] = [
  {
    Icon: ShieldIcon,
    title: 'セキュリティ対策',
    body: 'アクセス権限の厳密な管理で情報漏えいを防止。お客様は自分の問い合わせだけを見られる仕組みにしており、他のお客様の会話は開けません。',
  },
  {
    Icon: CheckIcon,
    title: '安定した稼働',
    body: 'AIが応答できない場合も自動で人間へ引き継ぐ設計。回答が止まったまま放置されることがなく、お客様を待たせ続けません。',
  },
  {
    Icon: LayersIcon,
    title: 'スケーラブルな設計',
    body: '問い合わせやよくある質問が増えても、作り直さずに拡張できる構成。事業の成長に合わせて無理なく育てられます。',
  },
];

/** 技術スタックと選定理由 */
const TECH_STACK = [
  { name: 'Next.js 15', reason: 'お客様の情報がブラウザの外に漏れない安全な設計のため' },
  { name: 'Supabase', reason: 'データの閲覧権限管理とリアルタイム通信を一括で管理できるため' },
  { name: 'Gemini API', reason: 'AIの回答形式を固定し、ブレのない安定した応答を実現できるため' },
  { name: 'Vercel', reason: '開発環境と本番環境の差異が少なく、安定して公開できるため' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-night text-brand-night-text">
      <LandingNav />

      <main className="pt-16">
        {/* ================= Hero ================= */}
        <section className="relative overflow-hidden px-5 py-16 sm:py-24">
          {/* 背景の発光。画像を使わずCSSグラデーションで描くので追加読み込みが無い */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-night-accent/10 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -left-32 top-40 h-[380px] w-[380px] rounded-full bg-brand-night-accent-soft/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            {/* 左：テキスト */}
            <div>
              <span className="inline-flex items-center rounded-full border border-brand-night-accent/40 px-3.5 py-1.5 text-[12px] font-bold tracking-[0.14em] text-brand-night-accent">
                AI × HUMAN × REALTIME
              </span>

              <h1 className="mt-7 text-4xl font-bold leading-[1.2] tracking-tight sm:text-5xl">
                AIが即答。
                <br />
                人がつなぐ。
              </h1>

              <p className="mt-6 text-[15px] leading-relaxed text-brand-night-muted sm:text-base">
                FAQ自動回答から人間へのスムーズな引き継ぎまで、
                <br className="hidden sm:block" />
                月500件規模の問い合わせをもっとスマートに。
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#demo"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-night-accent px-7 py-3 text-[15px] font-bold text-brand-night transition-opacity hover:opacity-90 sm:w-auto"
                >
                  デモを試す
                  <ArrowRightIcon size={17} />
                </a>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-brand-night-line px-7 py-3 text-[15px] font-bold text-brand-night-text transition-colors hover:border-brand-night-accent/60 sm:w-auto"
                >
                  管理画面を見る
                </Link>
              </div>

              <ul className="mt-10 flex flex-col divide-y divide-brand-night-line overflow-hidden rounded-xl border border-brand-night-line bg-brand-night-card/70 sm:flex-row sm:divide-x sm:divide-y-0">
                {HERO_STATS.map(({ Icon, value, label }) => (
                  <li
                    key={value}
                    className="flex flex-1 items-center gap-2.5 px-4 py-3"
                  >
                    <Icon size={16} className="shrink-0 text-brand-night-accent" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold leading-tight">
                        {value}
                      </span>
                      <span className="block text-[11px] leading-snug text-brand-night-muted">
                        {label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 右：実装した2画面を主役（顧客チャット）と背面（管理画面）に重ねて見せる */}
            <UiShowcase />
          </div>
        </section>

        {/* ================= Problem ================= */}
        <section className="scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              こんな課題を解決します
            </h2>

            <ul className="mt-12 grid gap-5 sm:grid-cols-3">
              {PROBLEMS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-brand-night-line bg-brand-night-card p-6"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-night-accent/30 text-brand-night-accent">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 text-[17px] font-bold leading-snug">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-brand-night-muted">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= Solution（導入の流れ） ================= */}
        <section id="flow" className="scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              AIと人の最適な連携フロー
            </h2>

            <div className="mt-14 flex flex-col items-center gap-6 lg:flex-row lg:justify-center lg:gap-4">
              <FlowNode Icon={ChatIcon} label="問い合わせ" />
              <FlowArrow />
              <FlowNode Icon={BotIcon} label="AIが理解" />
              <FlowArrow />

              {/* 分岐。回答できる／できないで行き先が変わる */}
              <div className="flex flex-col gap-4">
                <FlowBranch
                  condition="回答できる"
                  Icon={BotIcon}
                  label="AIが回答"
                  tone="accent"
                />
                <FlowBranch
                  condition="回答できない"
                  Icon={OperatorIcon}
                  label="オペレーターへ引き継ぎ"
                  tone="line"
                />
              </div>

              <FlowArrow />
              <FlowNode Icon={CheckIcon} label="解決・履歴保存" />
            </div>

            <p className="mt-12 text-center text-[13px] leading-relaxed text-brand-night-muted">
              営業時間外に引き継ぎが発生した場合は、翌営業日に担当者が対応する旨を顧客へ案内します。
              <br className="hidden sm:block" />
              引き継ぎ後もAIとのやり取りは管理画面にそのまま残ります。
            </p>
          </div>
        </section>

        {/* ================= Demo ================= */}
        <section id="demo" className="scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">デモを試す</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[14px] leading-relaxed text-brand-night-muted">
              ご自身のGemini APIキーを入力してチャットを体験できます。
              FAQにある質問はAIが即答し、FAQ外の質問は担当者への引き継ぎ判定になります。
            </p>

            <div className="mt-12">
              <DemoChat />
            </div>

            <p className="mt-6 text-center text-[12px] text-brand-night-muted">
              ダミーFAQ18件・テストシナリオ8件で動作確認済み。実運用時は実際のFAQデータでの検証を推奨します。
            </p>
          </div>
        </section>

        {/* ================= Features（機能紹介） ================= */}
        <section id="features" className="scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">設計上の特徴</h2>

            <ul className="mt-12 grid gap-5 sm:grid-cols-3">
              {FEATURES.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-brand-night-line bg-brand-night-card p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-night-accent/30 bg-brand-night-accent/10 text-brand-night-accent">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 text-[16px] font-bold">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-brand-night-muted">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= Tech Stack ================= */}
        <section id="tech" className="scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">技術スタック</h2>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TECH_STACK.map(({ name, reason }) => (
                <li
                  key={name}
                  className="rounded-2xl border border-brand-night-line bg-brand-night-card p-5"
                >
                  <span className="inline-flex rounded-full border border-brand-night-accent/40 px-3 py-1 text-[13px] font-bold text-brand-night-accent">
                    {name}
                  </span>
                  <p className="mt-3 text-[13px] leading-relaxed text-brand-night-muted">
                    {reason}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= Profile ================= */}
        <section className="border-t border-brand-night-line px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">開発者</h2>

            <p className="mt-7 text-[18px] font-bold">Misako</p>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-brand-night-muted">
              業務フローを一緒に整理しながら、小さく作って実運用で育てるシステム開発をしています。
              個人フリーランス・小規模事業者の方のご相談歓迎です。
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {/* 差し替え可能：開発者ご自身のポートフォリオURLに変更してください */}
              <a
                href="https://misako-profile-portfolio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-night-line px-6 py-2.5 text-[14px] font-bold text-brand-night-text transition-colors hover:border-brand-night-accent/60 sm:w-auto"
              >
                ポートフォリオを見る
                <ArrowRightIcon size={16} />
              </a>
              {/* 差し替え可能：ご自身のLINE公式アカウントのURLに変更してください */}
              <a
                href="https://line.me/R/ti/p/@745jejoa?oat__id=6328713"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-night-accent px-6 py-2.5 text-[14px] font-bold text-brand-night transition-opacity hover:opacity-90 sm:w-auto"
              >
                <ChatIcon size={16} />
                LINEで相談する
              </a>
            </div>

            {/* 開発背景の説明。架空ブランド名に触れてよいのはここだけ */}
            <p className="mx-auto mt-10 max-w-xl text-[12px] leading-relaxed text-brand-night-muted/80">
              本プロジェクトはポートフォリオ用の模擬案件です。
              架空のD2CブランドBOTANICAを想定して開発しました。
              実データでの導入検討時は別途ご相談ください。
              記載の数値はいずれも設計上の想定値であり、実運用の実績ではありません。
            </p>
          </div>
        </section>

        <footer className="border-t border-brand-night-line px-5 py-8 text-center text-[12px] text-brand-night-muted/80">
          AI CS Bot（ポートフォリオ用デモ実装）
        </footer>
      </main>
    </div>
  );
}

/** フロー図の丸ノード */
function FlowNode({ Icon, label }: { Icon: IconComponent; label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-brand-night-accent/35 bg-brand-night-card text-brand-night-accent">
        <Icon size={30} />
      </span>
      <span className="text-[13px] font-bold">{label}</span>
    </div>
  );
}

/** フロー図の分岐。条件ラベルと行き先をひとまとめにする */
function FlowBranch({
  condition,
  Icon,
  label,
  tone,
}: {
  condition: string;
  Icon: IconComponent;
  label: string;
  tone: 'accent' | 'line';
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`shrink-0 rounded-full border px-3 py-1 text-[12px] ${
          tone === 'accent'
            ? 'border-brand-night-accent/50 text-brand-night-accent'
            : 'border-brand-night-line text-brand-night-muted'
        }`}
      >
        {condition}
      </span>
      <span aria-hidden className="h-px w-5 shrink-0 bg-brand-night-line" />
      <span className="flex items-center gap-2 rounded-xl border border-brand-night-line bg-brand-night-card px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-night text-brand-night-accent">
          <Icon size={16} />
        </span>
        <span className="text-[13px] font-bold leading-snug">{label}</span>
      </span>
    </div>
  );
}

/**
 * ステップ間の矢印。
 * 絵文字や記号文字（→）は使わず、SVG線アイコンで描く。
 * 縦積み（スマホ）では向きが変わるので回転させる。
 */
function FlowArrow() {
  return (
    <ArrowRightIcon
      size={22}
      className="shrink-0 rotate-90 text-brand-night-muted/60 lg:rotate-0"
    />
  );
}
