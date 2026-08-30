/**
 * FAQ管理ページ（T-31・Q-004）
 */
import { redirect } from 'next/navigation';
import { countWaitingConversations } from '@/lib/operatorData';
import { getCurrentOperator } from '@/lib/currentOperator';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { FaqClient } from '@/components/operator/FaqClient';

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/login');

  let waitingCount = 0;
  try {
    waitingCount = await countWaitingConversations();
  } catch (error) {
    console.error('[FaqPage] 未対応件数の取得に失敗:', error);
  }

  return (
    <OperatorShell
      operatorName={operator.name}
      waitingCount={waitingCount}
      title="FAQ管理"
    >
      <FaqClient />
    </OperatorShell>
  );
}
