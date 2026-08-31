/**
 * Hero 右側のプロダクト・プレビュー
 *
 * 実装した2画面を「単に2枚並べる」のではなく、主役と背景に分けて重ねる。
 *   前面：CUSTOMER CHAT（大きく・手前）
 *   背面：OPERATOR CONSOLE（小さく・奥）
 *
 * 【重要】中身のモックUIの配色には一切触れない。
 * 実際のプロダクトはアイボリー×ボタニカルグリーンのままで、
 * LP側のネイビー枠・細いミントのライン・弱いGlow・影で「馴染ませる」だけにする。
 * ここで中身の色をネイビーに寄せると、実物と違う画面を見せることになり
 * ポートフォリオとして意味が薄れる。
 *
 * 演出は控えめに保つこと（強いネオン・派手な3D表現は使わない）。
 */
import { MockChatUI } from '@/components/landing/MockChatUI';
import { MockOperatorUI } from '@/components/landing/MockOperatorUI';

/**
 * プレビュー用の外枠。
 *
 * ブラウザ風のバーを薄く付けて「動くWebアプリの画面」に見せる。
 * バーはダミーなので操作要素にはせず、スクリーンリーダーからも隠す。
 */
function PreviewFrame({
  label,
  path,
  emphasis,
  labelSide,
  children,
}: {
  /** 画面の役割。前面・背面の関係を一目で分かるようにする */
  label: string;
  /** ブラウザ風バーに出す擬似パス */
  path: string;
  /** 主役かどうか。Glowと影の強さだけを変える */
  emphasis: boolean;
  /**
   * 役割ラベルを枠の上下どちらに置くか。
   * 背面の画面は下に置くと前面の画面に隠れて読めなくなるため上に出す。
   */
  labelSide: 'top' | 'bottom';
  children: React.ReactNode;
}) {
  const roleLabel = (
    <span
      className={`inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] ${
        emphasis ? 'text-brand-night-accent' : 'text-brand-night-muted'
      }`}
    >
      <span
        aria-hidden
        className={`h-px w-5 ${emphasis ? 'bg-brand-night-accent/70' : 'bg-brand-night-line'}`}
      />
      {label}
    </span>
  );

  return (
    <div className="relative">
      {labelSide === 'top' && <div className="mb-3">{roleLabel}</div>}

      <div className="relative">
        {/* 弱いGlow。色を乗せるのではなく背後をほのかに光らせるだけに留める */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -inset-4 rounded-[26px] bg-brand-night-accent blur-2xl ${
            emphasis ? 'opacity-[0.10]' : 'opacity-[0.05]'
          }`}
        />

        <div
          className={`relative rounded-2xl border border-brand-night-line bg-brand-night-card p-2 ${
            emphasis ? 'shadow-2xl ring-1 ring-brand-night-accent/25' : 'shadow-xl'
          }`}
        >
          {/* 細いミントのアクセントライン。枠の上辺だけに薄く入れる */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-night-accent/60 to-transparent"
          />

          {/* ブラウザ風バー（ダミー） */}
          <div aria-hidden className="flex items-center gap-1.5 px-2 pb-2 pt-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-night-line" />
            <span className="h-2 w-2 rounded-full bg-brand-night-line" />
            <span className="h-2 w-2 rounded-full bg-brand-night-line" />
            <span className="ml-2 truncate rounded-full bg-brand-night px-2.5 py-0.5 text-[9px] tracking-wide text-brand-night-muted">
              {path}
            </span>
          </div>

          {/* 中身は実装どおりの配色のまま。角丸だけ合わせる */}
          <div className="overflow-hidden rounded-xl">{children}</div>
        </div>
      </div>

      {labelSide === 'bottom' && <div className="mt-3">{roleLabel}</div>}
    </div>
  );
}

export function UiShowcase() {
  return (
    <div className="relative">
      {/*
        前面：顧客チャットが主役。
        lg 以上でだけ重ねる。狭い画面で重ねると読めなくなるため、
        タブレット以下は縦に積んで順番（主役が先）で優先度を示す。
      */}
      <div className="relative z-10 lg:mt-28 lg:w-[74%]">
        <PreviewFrame label="CUSTOMER CHAT" path="/chat" emphasis labelSide="bottom">
          <MockChatUI />
        </PreviewFrame>
      </div>

      {/* 背面：オペレーター管理画面。小さく・奥に置く */}
      <div className="mt-8 lg:absolute lg:right-0 lg:top-0 lg:z-0 lg:mt-0 lg:w-[56%]">
        <PreviewFrame
          label="OPERATOR CONSOLE"
          path="/dashboard"
          emphasis={false}
          labelSide="top"
        >
          <MockOperatorUI />
        </PreviewFrame>
      </div>
    </div>
  );
}
