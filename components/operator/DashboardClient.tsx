/**
 * 問い合わせ一覧のクライアント側（T-26）
 *
 * 一覧が拾った未対応件数をシェル（サイドバーのバッジ・モーダル）へ伝える。
 */
'use client';

import { Suspense, useState } from 'react';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { ConversationList } from '@/components/operator/ConversationList';
import { OpenTodayToggle } from '@/components/operator/OpenTodayToggle';

export function DashboardClient({
  operatorName,
  initialWaitingCount,
  isOpenToday,
}: {
  operatorName: string;
  initialWaitingCount: number;
  isOpenToday: boolean;
}) {
  const [waitingCount, setWaitingCount] = useState(initialWaitingCount);

  return (
    <OperatorShell
      operatorName={operatorName}
      initialWaitingCount={waitingCount}
      title="問い合わせ一覧"
      actions={<OpenTodayToggle initialOpen={isOpenToday} />}
    >
      {/* ConversationList は useSearchParams を使うため Suspense で包む */}
      <Suspense
        fallback={
          <p className="px-6 py-8 text-sm text-brand-secondary">
            読み込んでいます...
          </p>
        }
      >
        <ConversationList onWaitingCountChange={setWaitingCount} />
      </Suspense>
    </OperatorShell>
  );
}
