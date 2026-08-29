/**
 * 会話詳細ページ（T-28・AC-007・AC-013）
 */
import { redirect } from 'next/navigation';
import { countWaitingConversations } from '@/lib/operatorData';
import { getCurrentOperator } from '@/lib/currentOperator';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { ConversationDetailClient } from '@/components/operator/ConversationDetailClient';

export const dynamic = 'force-dynamic';

export default async function ConversationDetailPage({
  params,
}: {
  // Next.js 15 から params は Promise になった
  params: Promise<{ id: string }>;
}) {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/login');

  const { id } = await params;

  let waitingCount = 0;
  try {
    waitingCount = await countWaitingConversations();
  } catch (error) {
    console.error('[ConversationDetailPage] 未対応件数の取得に失敗:', error);
  }

  return (
    <OperatorShell
      operatorName={operator.name}
      initialWaitingCount={waitingCount}
      title="会話詳細"
    >
      <ConversationDetailClient conversationId={id} />
    </OperatorShell>
  );
}
