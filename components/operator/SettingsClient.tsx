/**
 * 営業設定（T-32・FR-OPS-010〜013・AC-015〜017）
 *
 * ここでの変更は保存した瞬間から顧客側に反映される。
 * 顧客側は毎回DBを読んで営業時間を判定するため、再デプロイは不要。
 */
'use client';

import { useState } from 'react';
import { updateBusinessSettings } from '@/actions/dashboard';
import { AlertIcon, ClockIcon, InfoIcon } from '@/components/icons';
import type { BusinessSettings } from '@/types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** YYYY-MM-DD に揃える。DBのDATE型は時刻付きで返ることがある */
function toDateString(value: string): string {
  return value.slice(0, 10);
}

export function SettingsClient({ initial }: { initial: BusinessSettings }) {
  const [hoursStart, setHoursStart] = useState(initial.hours_start);
  const [hoursEnd, setHoursEnd] = useState(initial.hours_end);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(
    initial.closed_weekdays ?? []
  );
  const [holidays, setHolidays] = useState<string[]>(
    (initial.holiday_dates ?? []).map(toDateString)
  );
  const [newHoliday, setNewHoliday] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleWeekday(day: number) {
    setClosedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function addHoliday() {
    const d = newHoliday.trim();
    if (!d || holidays.includes(d)) return;
    setHolidays((prev) => [...prev, d].sort());
    setNewHoliday('');
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await updateBusinessSettings({
        hours_start: hoursStart,
        hours_end: hoursEnd,
        closed_weekdays: closedWeekdays,
        holiday_dates: holidays,
      });

      if (!result.success) {
        setError(result.error ?? '保存できませんでした。');
      } else {
        setNotice('保存しました。顧客側の表示にすぐ反映されます。');
      }
    } catch (err) {
      // 通信断では Server Action が reject する。
      // 捕まえないと「保存しています...」のまま押せなくなる
      console.error('[SettingsClient] 営業設定の保存に失敗:', err);
      setError('通信に失敗しました。接続を確認してもう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-2xl px-6 py-5">
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

      {/* 営業時間（FR-OPS-010） */}
      <section className="mb-5 rounded-xl border border-brand-accent bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-brand-text">
          <ClockIcon size={17} className="text-brand-primary" />
          営業時間
        </h2>
        <p className="mb-4 text-[12px] text-brand-secondary">
          終了時刻ちょうどは営業時間外として扱われます（18時終了なら18:00は時間外）。
        </p>
        <div className="flex items-center gap-3">
          <select
            value={hoursStart}
            onChange={(e) => setHoursStart(Number(e.target.value))}
            aria-label="営業開始時刻"
            className="rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
          <span className="text-brand-secondary">〜</span>
          <select
            value={hoursEnd}
            onChange={(e) => setHoursEnd(Number(e.target.value))}
            aria-label="営業終了時刻"
            className="rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 定休曜日（FR-OPS-011） */}
      <section className="mb-5 rounded-xl border border-brand-accent bg-white p-5">
        <h2 className="mb-1 text-[15px] font-bold text-brand-text">定休曜日</h2>
        <p className="mb-4 text-[12px] text-brand-secondary">
          選択した曜日は終日、営業時間外と同じ扱いになります。
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, day) => {
            const on = closedWeekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                aria-pressed={on}
                className={`h-10 w-10 rounded-full border text-[14px] transition-colors ${
                  on
                    ? 'border-brand-primary bg-brand-primary font-medium text-white'
                    : 'border-brand-accent bg-brand-sand text-brand-text hover:bg-brand-accent/30'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 休日登録（FR-OPS-012） */}
      <section className="mb-5 rounded-xl border border-brand-accent bg-white p-5">
        <h2 className="mb-1 text-[15px] font-bold text-brand-text">休日登録</h2>
        <p className="mb-4 text-[12px] text-brand-secondary">
          祝日・年末年始など、特定の日を休業日として登録します。
        </p>

        <div className="mb-3 flex gap-2">
          <input
            type="date"
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
            aria-label="休日の日付"
            className="rounded-lg border border-brand-accent bg-brand-sand px-3 py-2 text-[14px] outline-none focus:border-brand-secondary"
          />
          <button
            type="button"
            onClick={addHoliday}
            disabled={!newHoliday}
            className="rounded-lg border border-brand-primary px-3 py-2 text-[13px] font-medium text-brand-primary transition-colors hover:bg-brand-primary hover:text-white disabled:opacity-40"
          >
            追加
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="text-[13px] text-brand-secondary/70">
            登録された休日はありません。
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {holidays.map((d) => (
              <li
                key={d}
                className="flex items-center gap-1.5 rounded-full border border-brand-accent bg-brand-sand px-3 py-1 text-[13px]"
              >
                {d}
                <button
                  type="button"
                  onClick={() => setHolidays((prev) => prev.filter((x) => x !== d))}
                  aria-label={`${d} を削除`}
                  className="text-brand-secondary transition-colors hover:text-red-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="w-full rounded-lg bg-brand-primary py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSaving ? '保存しています...' : '保存する'}
      </button>

      {/* 当日フラグの運用上の注意（R-01） */}
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
        <InfoIcon size={15} className="mt-0.5 shrink-0" />
        <p>
          ヘッダーの「本日休業」は当日限りの臨時休業フラグです。
          日付が変わっても自動では戻らないため、翌営業日の朝に「本日対応中」へ戻してください。
          戻し忘れると、営業時間内でも顧客に時間外メッセージが表示され続けます。
        </p>
      </div>
    </div>
  );
}
