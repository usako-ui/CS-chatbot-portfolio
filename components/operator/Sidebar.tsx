/**
 * 管理画面サイドバー（T-33・Q-010 確定構成）
 *
 * 構成：問い合わせ一覧 / 対応中 / 新規 / 完了 / すべての会話 /
 *       FAQ管理 / 設定 / ログアウト / オペレーターオンライン表示
 */
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BellIcon,
  BookIcon,
  CheckIcon,
  InboxIcon,
  LeafIcon,
  LogoutIcon,
  OperatorIcon,
  ProgressIcon,
  SettingsIcon,
} from '@/components/icons';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  label: string;
  href: string;
  icon: typeof InboxIcon;
  /** 未対応件数バッジを出すか（Q-006） */
  showBadge?: boolean;
}

const NAV: NavItem[] = [
  { label: '問い合わせ一覧', href: '/dashboard', icon: InboxIcon },
  { label: '新規', href: '/dashboard?status=waiting_operator', icon: BellIcon, showBadge: true },
  { label: '対応中', href: '/dashboard?status=operator_handling', icon: ProgressIcon },
  { label: '完了', href: '/dashboard?status=closed', icon: CheckIcon },
  { label: 'すべての会話', href: '/dashboard?status=all', icon: InboxIcon },
];

const TOOLS: NavItem[] = [
  { label: 'FAQ管理', href: '/faq', icon: BookIcon },
  { label: '設定', href: '/settings', icon: SettingsIcon },
];

export function Sidebar({
  operatorName,
  waitingCount,
}: {
  operatorName: string;
  waitingCount: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const currentStatus = params.get('status');

  /** 現在地の判定。/dashboard は status クエリまで見ないと区別できない */
  function isActive(href: string): boolean {
    const [path, query] = href.split('?');
    if (pathname !== path) return false;
    if (!query) return !currentStatus;
    return query === `status=${currentStatus}`;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    // Cookieの変更を middleware に読み直させる。
    // これが無いと、戻るボタンでキャッシュされた管理画面が見えてしまう
    router.refresh();
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-brand-sidebar text-white">
      <div className="flex items-center gap-2 px-4 py-4">
        <LeafIcon size={22} />
        <div>
          <p className="text-[15px] font-bold tracking-[0.14em]">BOTANICA</p>
          <p className="text-[10px] text-white/70">サポート管理</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  isActive(item.href)
                    ? 'bg-brand-primary font-medium'
                    : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {/* 未対応件数バッジ（Q-006）。0件のときは出さない */}
                {item.showBadge && waitingCount > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
                    {waitingCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-white/15" />

        <ul className="space-y-0.5">
          {TOOLS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  pathname.startsWith(item.href)
                    ? 'bg-brand-primary font-medium'
                    : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* オペレーターオンライン表示（Q-010） */}
      <div className="border-t border-white/15 px-3 py-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          <OperatorIcon size={15} className="text-white/70" />
          <span className="truncate text-[12px]">{operatorName}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-white/85 transition-colors hover:bg-white/10"
        >
          <LogoutIcon size={17} />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
