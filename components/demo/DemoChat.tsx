/**
 * デモセクション（ランディングページの #demo）
 *
 * 本番の ChatPanel をベースにしているが、次の点が異なる。
 * - Supabase 認証・DB保存・Realtime を一切使わない
 * - 会話は React の state のみ。リロードで消える
 * - Gemini は体験者自身のAPIキーで呼ぶ（actions/demo.ts 経由）
 *
 * APIキーはブラウザの localStorage にだけ置き、画面ではマスク表示する。
 * サーバーへは送信のたびに渡すが、保存もログ出力もしない。
 *
 * 【注意】ここに架空ブランド名を書かないこと。
 * チャットのヘッダーは機能名（カスタマーサポート）で表示する。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { sendDemoMessage } from '@/actions/demo';
import {
  AlertIcon,
  ArrowRightIcon,
  BookIcon,
  BotIcon,
  CheckIcon,
  InfoIcon,
  OperatorIcon,
  SendIcon,
} from '@/components/icons';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation';
import type { DemoTurn } from '@/types';

/** APIキーの保存先。体験者のブラウザから出ない */
const STORAGE_KEY = 'botanica-demo-gemini-key';

/** 送信後に次の送信を受け付けないミリ秒数。サーバー側の制限と揃える */
const COOLDOWN_MS = 3000;

const WELCOME_TEXT = `こんにちは。カスタマーサポートです。
在庫確認・配送・返品などのご質問をどうぞ。
AIがお答えし、人間のサポートが必要な場合は自動でつなぎます。`;

/** 右カラムの質問チップ。クリックで入力欄にそのまま入る */
const SAMPLE_QUESTIONS = [
  {
    label: '在庫について聞く',
    note: '在庫の有無や再入荷の予定を確認できます',
    text: '在庫切れの商品はいつ再入荷しますか？',
  },
  {
    label: '配送について聞く',
    note: '送料や配送の条件を確認できます',
    text: '送料はいくらですか？',
  },
  {
    label: '返品について聞く',
    note: '返品・交換の方法や条件を案内します',
    text: '届いた商品が壊れていました',
  },
  {
    label: 'FAQにない質問をする',
    note: 'AIが判断し、必要に応じて人へ引き継ぎます',
    text: '先週注文した商品の請求金額が二重になっているようなので調べてほしい',
  },
];

/** 画面に出す1件分。DBを使わないのでidは連番で足りる */
interface DemoMessage {
  id: number;
  from: 'customer' | 'ai';
  content: string;
}

/** キーの中身が読めないよう先頭4文字と末尾4文字だけ見せる */
function maskKey(key: string): string {
  if (key.length <= 8) return '設定済み';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export function DemoChat() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 保存済みキーの復元。プライベートウィンドウなどでは例外になるため必ず包む
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setApiKey(saved);
    } catch {
      // 読めなくてもデモは動く。キーを入れ直してもらうだけ
    }
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleSaveKey() {
    const key = keyInput.trim();
    if (key === '') {
      setErrorText('APIキーを入力してください。');
      return;
    }
    setErrorText(null);
    setApiKey(key);
    setKeyInput('');
    setIsEditingKey(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // 保存できなくてもこのセッション中は state で動く
    }
  }

  function handleClearKey() {
    setApiKey(null);
    setKeyInput('');
    setIsEditingKey(false);
    setMessages([]);
    setEscalated(false);
    setErrorText(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 消せなくても state 側は破棄済み
    }
  }

  /** 質問チップ。入力欄に入れるだけで送信はしない（誤ってAPIを消費させないため） */
  function handlePickQuestion(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  function addMessage(from: 'customer' | 'ai', content: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, from, content }]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !apiKey || isSending || cooldown) return;

    setErrorText(null);
    setIsSending(true);
    setInput('');

    // 今回の発言を含めない履歴を先に作る。
    // 含めると同じ文がAIへ二重に渡る（本番の actions/chat.ts と同じ考え方）
    const history: DemoTurn[] = messages.map((m) => ({
      role: m.from === 'customer' ? ('user' as const) : ('model' as const),
      text: m.content,
    }));

    addMessage('customer', text);

    try {
      const result = await sendDemoMessage({ message: text, apiKey, history });

      if (!result.success || !result.data) {
        setInput(text);
        setErrorText(result.error ?? '送信に失敗しました。もう一度お試しください。');
        return;
      }

      if (result.data.escalated) {
        setEscalated(true);
      } else {
        addMessage('ai', result.data.answer);
      }
    } catch (error) {
      console.error('[DemoChat] 送信に失敗:', error);
      setInput(text);
      setErrorText('送信に失敗しました。通信状況を確認してもう一度お試しください。');
    } finally {
      setIsSending(false);
      setCooldown(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 日本語入力の変換確定Enterで誤送信しないよう isComposing を見る
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canSend = Boolean(input.trim() && apiKey && !isSending && !cooldown);
  const isReady = Boolean(apiKey) && !isEditingKey;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* ================= 左カラム ================= */}
      <div className="rounded-2xl border border-brand-night-line bg-brand-night-card p-6">
        {!isReady ? (
          <>
            <h3 className="text-[20px] font-bold text-brand-night-accent">
              デモを試してみましょう
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-brand-night-muted">
              ご自身のGemini APIキーを入力してチャットを体験できます。
              入力したキーはご自身のブラウザにのみ保存され、AIの呼び出しにだけ使用します。
              サーバーには保存しません。
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Gemini APIキーを入力"
                aria-label="Gemini APIキー"
                autoComplete="off"
                className="flex-1 rounded-xl border border-brand-night-line bg-brand-night px-3.5 py-2.5 text-[14px] text-brand-night-text outline-none transition-colors placeholder:text-brand-night-muted/70 focus:border-brand-night-accent"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="shrink-0 rounded-xl bg-brand-night-accent px-5 py-2.5 text-[14px] font-bold text-brand-night transition-opacity hover:opacity-90"
              >
                デモを開始する
              </button>
            </div>

            {errorText && (
              <p className="mt-3 flex items-start gap-1.5 text-[13px] text-red-300">
                <AlertIcon size={15} className="mt-0.5 shrink-0" />
                {errorText}
              </p>
            )}

            {isEditingKey && (
              <button
                type="button"
                onClick={() => setIsEditingKey(false)}
                className="mt-3 text-[13px] text-brand-night-muted underline"
              >
                入力をやめる
              </button>
            )}

            <p className="mt-5 flex items-start gap-1.5 text-[12px] leading-relaxed text-brand-night-muted">
              <InfoIcon size={14} className="mt-0.5 shrink-0" />
              ダミーFAQ18件を根拠に回答します。会話は保存されず、リロードで消えます。
              実際の個人情報は入力しないでください。
            </p>
          </>
        ) : (
          <>
            {/* キーの状態 */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] text-brand-night-text">
                <CheckIcon size={15} className="text-brand-night-accent" />
                APIキー設定済み
                <span className="font-mono text-brand-night-muted">
                  {apiKey ? maskKey(apiKey) : ''}
                </span>
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingKey(true)}
                  className="text-[13px] text-brand-night-muted underline"
                >
                  変更
                </button>
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="text-[13px] text-brand-night-muted underline"
                >
                  削除
                </button>
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-night-line">
              <div className="flex items-center gap-2 border-b border-brand-night-line bg-brand-night px-4 py-3">
                <BotIcon size={17} className="text-brand-night-accent" />
                <span className="text-[14px] font-bold text-brand-night-text">
                  カスタマーサポート
                </span>
                <span className="ml-auto rounded-full bg-brand-night-card px-2.5 py-0.5 text-[11px] text-brand-night-muted">
                  デモ
                </span>
              </div>

              {/* メッセージ一覧 */}
              <div className="flex h-[360px] flex-col gap-3 overflow-y-auto bg-brand-night px-4 py-4">
                <div className="flex justify-start">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-brand-night-line bg-brand-night-card px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-night-text">
                    {WELCOME_TEXT}
                  </p>
                </div>

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.from === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        m.from === 'customer'
                          ? 'rounded-br-sm bg-brand-night-accent text-brand-night'
                          : 'rounded-bl-sm border border-brand-night-line bg-brand-night-card text-brand-night-text'
                      }`}
                    >
                      {m.content}
                    </p>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <span
                      className="flex gap-1 rounded-2xl rounded-bl-sm border border-brand-night-line bg-brand-night-card px-4 py-3"
                      role="status"
                      aria-label="AIが入力しています"
                    >
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-night-accent" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-night-accent [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-night-accent [animation-delay:300ms]" />
                    </span>
                  </div>
                )}

                {/* 引き継ぎ表示。デモなので実際には誰にもつながらないことを明示する */}
                {escalated && (
                  <div className="flex items-start gap-2 rounded-xl border border-brand-night-accent/40 bg-brand-night-card px-3.5 py-2.5 text-[12px] leading-relaxed text-brand-night-text">
                    <OperatorIcon size={15} className="mt-0.5 shrink-0 text-brand-night-accent" />
                    <p>
                      担当者への引き継ぎ（デモ）
                      <br />
                      <span className="text-brand-night-muted">
                        FAQに根拠が無い、または人間の判断が必要と判定されました。
                        実運用ではここで管理画面に未対応として通知されます。
                      </span>
                    </p>
                  </div>
                )}

                {errorText && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-200"
                  >
                    <AlertIcon size={15} className="mt-0.5 shrink-0" />
                    <p>{errorText}</p>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* 入力欄 */}
              <div className="border-t border-brand-night-line bg-brand-night-card px-3 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    maxLength={MAX_MESSAGE_LENGTH}
                    placeholder="メッセージを入力"
                    aria-label="メッセージ入力"
                    className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-brand-night-line bg-brand-night px-3 py-2.5 text-[14px] text-brand-night-text outline-none transition-colors placeholder:text-brand-night-muted/70 focus:border-brand-night-accent"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    aria-label="送信"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-night-accent text-brand-night transition-opacity hover:opacity-90 disabled:opacity-35"
                  >
                    <SendIcon size={18} />
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-brand-night-muted/80">
                  {cooldown && !isSending
                    ? '送信しました。次の送信まで少しお待ちください'
                    : 'Enterで送信 / Shift+Enterで改行'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ================= 右カラム：試せる質問の例 ================= */}
      <div className="rounded-2xl border border-brand-night-line bg-brand-night-card p-6">
        <h3 className="flex items-center gap-2 text-[16px] font-bold text-brand-night-accent">
          <BookIcon size={17} />
          試せる質問の例
        </h3>
        <p className="mt-2 text-[12px] text-brand-night-muted">
          クリックすると入力欄に入ります。内容を確認してから送信してください。
        </p>

        <ul className="mt-4 space-y-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <li key={q.label}>
              <button
                type="button"
                onClick={() => handlePickQuestion(q.text)}
                disabled={!isReady}
                className="flex w-full items-center gap-3 rounded-xl border border-brand-night-line bg-brand-night px-4 py-3 text-left transition-colors hover:border-brand-night-accent/60 disabled:opacity-45"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-brand-night-text">
                    {q.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-brand-night-muted">
                    {q.note}
                  </span>
                </span>
                <ArrowRightIcon size={16} className="shrink-0 text-brand-night-muted" />
              </button>
            </li>
          ))}
        </ul>

        {!isReady && (
          <p className="mt-4 text-[12px] text-brand-night-muted">
            APIキーを入力すると選べるようになります。
          </p>
        )}
      </div>
    </div>
  );
}
