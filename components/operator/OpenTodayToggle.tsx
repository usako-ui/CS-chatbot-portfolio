/**
 * 当日対応フラグの切り替え（T-32・FR-OPS-013・AC-016）
 *
 * ヘッダーに常時置いてワンタップで切り替えられるようにする。
 * 急な早退や臨時休業のときに、設定画面まで辿らずに止められる必要があるため。
 *
 * OFF にすると営業時間内でも顧客側は時間外と同じ表示になる。
 * 影響が大きいので、押し間違い防止に確認を挟む。
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateBusinessSettings } from '@/actions/dashboard';
import { ClockIcon } from '@/components/icons';

export function OpenTodayToggle({ initialOpen }: { initialOpen: boolean }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle() {
    const next = !isOpen;

    // 休業にする側だけ確認する。対応再開は誤操作でも実害が小さい
    if (!next) {
      const ok = window.confirm(
        '本日を休業にします。\n営業時間内でもお客様には「営業時間外」と表示され、担当者への引き継ぎは翌営業日扱いになります。\n\nよろしいですか？'
      );
      if (!ok) return;
    }

    setIsSaving(true);
    try {
      const result = await updateBusinessSettings({ is_open_today: next });
      if (result.success) {
        setIsOpen(next);
        // 他の画面（設定ページの注意書き等）にも反映させる
        router.refresh();
      } else {
        window.alert(result.error ?? '切り替えに失敗しました。');
      }
    } catch (error) {
      // 通信断では Server Action が reject する（戻り値の error にはならない）。
      // ここで捕まえないとボタンが「切替中...」のまま固まり、
      // ページを再読み込みするまで臨時休業の切り替えができなくなる
      console.error('[OpenTodayToggle] 切り替えに失敗:', error);
      window.alert('通信に失敗しました。接続を確認してもう一度お試しください。');
    } finally {
      // 成否にかかわらずボタンを戻す。finally に置かないと
      // 例外のときだけ復帰しない状態が残る
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={isSaving}
      aria-pressed={!isOpen}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
        isOpen
          ? 'border-brand-primary bg-brand-accent/30 text-brand-primary'
          : 'border-amber-300 bg-amber-100 text-amber-900'
      }`}
    >
      <ClockIcon size={15} />
      {isSaving ? '切替中...' : isOpen ? '本日対応中' : '本日休業'}
    </button>
  );
}
