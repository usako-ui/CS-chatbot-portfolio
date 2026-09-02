/**
 * チャット内の各種お知らせ表示（T-21・T-22・T-23）
 */
import { AlertIcon, ClockIcon, InfoIcon, LeafIcon } from '@/components/icons';

/**
 * AI応答待ちのタイピングインジケーター（T-21・FR-CUS-004）
 *
 * AIの応答は最大30秒かかる。何も出さないと固まったように見えて
 * 顧客が何度も送信してしまうため、処理中であることを必ず示す。
 */
export function TypingIndicator() {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1 px-1 text-xs text-brand-secondary">
        <LeafIcon size={13} />
        AIサポート
      </span>
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-4 py-3"
        role="status"
        aria-label="AIが回答を作成しています"
      >
        {/* 3点が順に沈む。animation-delay で位相をずらしている */}
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 営業時間外の案内（T-23・FR-CUS-006・FR-TIME-004・AC-006）
 *
 * 文面は buildAfterHoursNotice（lib/businessHoursRules.ts）と同一に保つ。
 * 起動時バナーとエスカレーション時のメッセージで言い回しが変わると、
 * 顧客は「状況が変わったのか」と受け取るため1文に統一する。
 */
export function AfterHoursNotice({ hoursStart }: { hoursStart: number }) {
  return (
    <div className="flex items-start gap-2 border-b border-brand-accent bg-brand-accent/30 px-4 py-2.5 text-[13px] leading-relaxed text-brand-text">
      <ClockIcon size={16} className="mt-0.5 shrink-0 text-brand-primary" />
      <p>
        現在は営業時間外です。翌営業日（{hoursStart}:00以降）に担当者が対応します。
      </p>
    </div>
  );
}

/**
 * 個人情報の注意書き（T-23・Q-007 確定文言）
 *
 * メッセージ本文はオペレーターが対応に使うためそのまま保存される。
 * 「何を書いてはいけないか」だけでなく「注文番号は書いてよい」まで
 * 示さないと、顧客が必要な情報まで伏せてしまい対応が進まなくなる。
 */
export function PrivacyNotice() {
  return (
    <div className="flex items-start gap-2 border-b border-brand-accent/60 bg-brand-sand px-4 py-2 text-[12px] leading-relaxed text-brand-secondary">
      <InfoIcon size={14} className="mt-0.5 shrink-0" />
      <p>
        クレジットカード番号・パスワード等の機密情報は入力しないでください。
        注文番号はお伝えいただけます。
      </p>
    </div>
  );
}

/**
 * エスカレーション通知（T-22・FR-CUS-005・AC-014）
 *
 * 会話の流れの中にシステムメッセージとして差し込む。
 * 引き継ぎが起きたことが履歴に残るので、後から見返しても経緯がわかる。
 */
export function EscalationNotice({ afterHours }: { afterHours: boolean }) {
  return (
    <div
      className="mx-auto flex max-w-[90%] items-start gap-2 rounded-lg border border-brand-secondary/30 bg-white/70 px-3 py-2 text-[12px] leading-relaxed text-brand-secondary"
      role="status"
    >
      <InfoIcon size={14} className="mt-0.5 shrink-0" />
      <p>
        {afterHours
          ? '担当者への引き継ぎが完了しました。次の営業日にご連絡いたします。'
          : '担当者に引き継ぎました。そのままお待ちください。'}
      </p>
    </div>
  );
}

/**
 * 送信エラー表示（FR-CUS-008）
 *
 * 再送は顧客の操作に委ねる。自動再送にすると、
 * 実際は保存できていたケースで同じ質問が二重に届くため。
 */
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="mx-auto flex max-w-[90%] items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-700"
      role="alert"
    >
      <AlertIcon size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 font-medium underline underline-offset-2"
          >
            再試行する
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 接続断の表示（requirements.md エラー処理表）
 *
 * Realtime が切れると「オペレーターが返信したのに画面に出ない」状態になる。
 * 黙って失敗すると顧客は待ち続けるので、必ず可視化する。
 */
export function ReconnectingNotice() {
  return (
    <div
      className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-1.5 text-[12px] text-amber-800"
      role="status"
    >
      <AlertIcon size={13} />
      接続が切れました。再接続しています...
    </div>
  );
}
