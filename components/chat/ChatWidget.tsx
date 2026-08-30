/**
 * チャットウィジェット（T-16・FR-CUS-001・FR-CUS-012・AC-005）
 *
 * ECサイト右下に固定表示するFAB（Floating Action Button＝浮いている丸ボタン）と、
 * それを押して開くチャットパネルをまとめる。
 *
 * パネルは開くまでマウントしない。
 * マウントした時点で匿名サインインと会話作成が走るため、
 * 常時マウントするとサイトを見ただけの人にも会話レコードが作られてしまう。
 */
'use client';

import { useEffect, useState } from 'react';
import { ChatIcon, CloseIcon } from '@/components/icons';
import { ChatPanel } from '@/components/chat/ChatPanel';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // スマホでパネルを開いている間、背後のページがスクロールしてしまうのを防ぐ。
  // 全画面表示になるため、背後が動くと閉じたときに位置が変わって混乱する。
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    // md以上ではパネルが浮いているだけなので背面スクロールを止めない
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Escキーで閉じられるようにする（キーボード操作への配慮）
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* パネル本体。
          モバイル：画面いっぱい（inset-0）
          PC：右下に固定サイズで浮かせる */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="BOTANICA カスタマーサポート"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-brand-sand shadow-2xl md:inset-auto md:bottom-24 md:right-6 md:h-[min(620px,calc(100vh-8rem))] md:w-[400px] md:rounded-2xl md:border md:border-brand-accent"
        >
          <ChatPanel onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* FABボタン。
          モバイルでパネルを開いている間は全画面パネルに隠れるので非表示にする */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'チャットを閉じる' : 'チャットで質問する'}
        aria-expanded={isOpen}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-all hover:bg-brand-secondary focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent ${
          isOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {isOpen ? <CloseIcon size={24} /> : <ChatIcon size={24} />}
      </button>
    </>
  );
}
