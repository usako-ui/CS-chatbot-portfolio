/**
 * 営業設定ページ（T-32・AC-015〜017）
 */
import { redirect } from 'next/navigation';
import { getBusinessSettings } from '@/lib/businessHours';
import { countWaitingConversations } from '@/lib/operatorData';
import { getCurrentOperator } from '@/lib/currentOperator';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { SettingsClient } from '@/components/operator/SettingsClient';
import { OpenTodayToggle } from '@/components/operator/OpenTodayToggle';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/login');

  const settings = await getBusinessSettings();

  let waitingCount = 0;
  try {
    waitingCount = await countWaitingConversations();
  } catch (error) {
    console.error('[SettingsPage] 未対応件数の取得に失敗:', error);
  }

  return (
    <OperatorShell
      operatorName={operator.name}
      initialWaitingCount={waitingCount}
      title="営業設定"
      actions={<OpenTodayToggle initialOpen={settings.is_open_today} />}
    >
      <SettingsClient initial={settings} />
    </OperatorShell>
  );
}
