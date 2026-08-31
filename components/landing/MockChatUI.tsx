/**
 * Hero に置く顧客チャット画面のモック
 *
 * 実際に人が入力しているように見せるため、
 * 「入力 → 送信 → AIが考える → 回答」を一定間隔で繰り返す。
 * 通信もDBもしない、見た目だけのループ。
 *
 * ここは実際に実装した顧客チャット（components/chat/ChatPanel.tsx）と
 * 同じ配色をそのまま使う。ランディングのネイビー面の上に
 * 実装どおりの明るい画面を置くことで、スクリーンショットのように見せる。
 *
 * 【注意】ここに架空ブランド名を書かないこと。
 * ランディングは開発者のポートフォリオであり、
 * 架空クライアント名が前面に出ると何を作った人なのかが伝わりにくくなる。
 */
'use client';

import { useEffect, useState } from 'react';
import { LeafIcon, SendIcon } from '@/components/icons';

/** 演出する会話。1往復だけにして、短いループで意味が伝わるようにする */
const GREETING = 'こんにちは。ご質問をどうぞ。';
const QUESTION = '配送状況を教えてください';
const ANSWER = 'ご注文番号を教えていただけますか。確認してご案内します。';

/** 1文字打つ間隔（ミリ秒）。速すぎると機械的、遅すぎると先に進まない */
const TYPE_INTERVAL_MS = 90;

/** 各フェーズの滞在時間 */
const AFTER_TYPING_MS = 500;
const AFTER_SEND_MS = 700;
const THINKING_MS = 1500;
const HOLD_MS = 3200;

type Phase = 'typing' | 'sent' | 'thinking' | 'answered';

export function MockChatUI() {
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  /**
   * 動きを減らす設定のときはループを止め、完了状態を出す。
   * 前庭障害などで動きに強い不快感を覚える利用者がいるため、
   * 装飾のアニメーションは必ず止められるようにする。
   */
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // 入力中：1文字ずつ増やす
  useEffect(() => {
    if (reduceMotion || phase !== 'typing') return;
    if (typed.length >= QUESTION.length) {
      const timer = setTimeout(() => setPhase('sent'), AFTER_TYPING_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => setTyped(QUESTION.slice(0, typed.length + 1)),
      TYPE_INTERVAL_MS
    );
    return () => clearTimeout(timer);
  }, [typed, phase, reduceMotion]);

  // 送信後の進行。フェーズごとに次を予約するだけの単純な流れにしておく
  useEffect(() => {
    if (reduceMotion) return;

    if (phase === 'sent') {
      const timer = setTimeout(() => setPhase('thinking'), AFTER_SEND_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'thinking') {
      const timer = setTimeout(() => setPhase('answered'), THINKING_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'answered') {
      const timer = setTimeout(() => {
        setTyped('');
        setPhase('typing');
      }, HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, reduceMotion]);

  // 動きを止める設定では、会話が終わった状態を静止画として見せる
  const showQuestion = reduceMotion || phase !== 'typing';
  const showThinking = !reduceMotion && phase === 'thinking';
  const showAnswer = reduceMotion || phase === 'answered';

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-brand-accent bg-brand-sand shadow-2xl"
    >
      {/* ヘッダー。実装と同じブランドグリーン。架空ブランド名ではなく機能名を出す */}
      <div className="flex items-center gap-2 bg-brand-primary px-4 py-3 text-white">
        <LeafIcon size={17} />
        <span className="text-[13px] font-bold tracking-wide">カスタマーサポート</span>
      </div>

      {/* 高さを固定して下詰めにする。
          可変にすると吹き出しが増えた瞬間にHero全体が縦に動いてしまう */}
      <div className="flex h-[186px] flex-col justify-end gap-2.5 px-4 py-4">
        <div className="flex justify-start">
          <p className="max-w-[85%] rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-3 py-2 text-[12px] leading-relaxed text-brand-text shadow-sm">
            {GREETING}
          </p>
        </div>

        {showQuestion && (
          <div className="flex animate-bubble-in justify-end motion-reduce:animate-none">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-primary px-3 py-2 text-[12px] leading-relaxed text-white shadow-sm">
              {QUESTION}
            </p>
          </div>
        )}

        {showThinking && (
          <div className="flex animate-bubble-in justify-start motion-reduce:animate-none">
            <span className="flex gap-1 rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-3.5 py-2.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary motion-reduce:animate-none" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary [animation-delay:150ms] motion-reduce:animate-none" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary [animation-delay:300ms] motion-reduce:animate-none" />
            </span>
          </div>
        )}

        {showAnswer && (
          <div className="flex animate-bubble-in justify-start motion-reduce:animate-none">
            <p className="max-w-[85%] rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-3 py-2 text-[12px] leading-relaxed text-brand-text shadow-sm">
              {ANSWER}
            </p>
          </div>
        )}
      </div>

      {/* 入力欄。押せない見た目だけの要素なので button ではなく div で組む */}
      <div className="border-t border-brand-accent bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-brand-accent bg-brand-sand px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[12px] text-brand-text">
            {phase === 'typing' && !reduceMotion ? (
              <>
                {typed || <span className="text-brand-secondary">メッセージを入力</span>}
                {/* キャレット。実際に打ち込んでいるように見せる */}
                <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 animate-caret-blink bg-brand-primary align-middle motion-reduce:animate-none" />
              </>
            ) : (
              <span className="text-brand-secondary">メッセージを入力</span>
            )}
          </span>
          <SendIcon
            size={15}
            className={
              phase === 'typing' && typed.length > 0
                ? 'text-brand-primary'
                : 'text-brand-secondary'
            }
          />
        </div>
      </div>
    </div>
  );
}
