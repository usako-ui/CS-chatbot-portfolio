/**
 * 問い合わせ一覧ページ（T-26・AC-007）
 *
 * サーバー側でログイン中のオペレーターと未対応件数を取得してから描画する。
 * クライアントで取りに行くと、一瞬「0件」が見えてから数字が入れ替わり、
 * 未対応があるのに無いように見える瞬間が生まれるため。
 */
import { redirect } from 'next/navigation';
import { getBusinessSettings } from '@/lib/businessHours';
import { countWaitingConversations } from '@/lib/operatorData';
import { getCurrentOperator } from '@/lib/currentOperator';
import { DashboardClient } from '@/components/operator/DashboardClient';

// 未対応件数は常に最新を出す必要があるためキャッシュしない
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const operator = await getCurrentOperator();
  // middleware で弾かれる想定だが、直接遷移された場合の保険として二重に確認する
  if (!operator) redirect('/login');

  let waitingCount = 0;
  try {
    waitingCount = await countWaitingConversations();
  } catch (error) {
    // 件数が取れなくても一覧自体は開けたほうがよいので落とさない
    console.error('[DashboardPage] 未対応件数の取得に失敗:', error);
  }

  // 当日フラグは一覧のヘッダーからも切り替えられるようにする（FR-OPS-013）。
  // 急な早退や臨時休業のとき、設定画面まで辿らずに止められる必要があるため
  const settings = await getBusinessSettings();

  return (
    <DashboardClient
      operatorName={operator.name}
      initialWaitingCount={waitingCount}
      isOpenToday={settings.is_open_today}
    />
  );
}
