/**
 * デモ用チャットウィジェット（/demo-ec の右下に固定）
 *
 * 本番の ChatWidget + ChatPanel と同じ見た目・同じ操作感にしてあるが、
 * 中身は次の点が異なる。
 * - Supabase 認証・DB保存・Realtime を一切使わない
 * - 会話は React の state のみ。閉じてもリロードでも消える
 * - Gemini は体験者自身のAPIキーで呼ぶ（actions/demo.ts 経由）
 *
 * 誰でも触れる公開ページに置くため、運営側の無料枠
 * （1日20・1分5リクエスト）を消費しない作りにしている。
 *
 * APIキーはブラウザの localStorage にだけ置き、画面ではマスク表示する。
 * サーバーへは送信のたびに渡すが、保存もログ出力もしない。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { sendDemoMessage } from '@/actions/demo';
import { HandoffChoice } from '@/components/chat/HandoffChoice';
import { MessageBubble } from '@/components/chat/MessageBubble';
import {
  AlertIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  InfoIcon,
  LeafIcon,
  OperatorIcon,
  SendIcon,
} from '@/components/icons';
import { HANDOFF_OFFER_TEXT } from '@/lib/messages';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation';
import type { DemoTurn, SenderType } from '@/types';

/** APIキーの保存先。体験者のブラウザから出ない */
const STORAGE_KEY = 'botanica-demo-gemini-key';

/** 送信後に次の送信を受け付けないミリ秒数。サーバー側の制限と揃える */
const COOLDOWN_MS = 3000;

const WELCOME_TEXT = `BOTANICAのカスタマーサポートへようこそ。
在庫確認・配送・返品などのご質問をどうぞ。
AIがお答えします。人間のサポートが必要な場合は自動でつなぎます。`;

/** 質問チップ。クリックで入力欄に入るだけで、送信はしない */
const SAMPLE_QUESTIONS = [
  { label: '送料について', text: '送料はいくらですか？' },
  { label: '返品できますか？', text: '返品・交換はできますか？' },
  { label: '在庫を確認したい', text: '在庫切れの商品はいつ再入荷しますか？' },
  {
    label: 'FAQにない質問をする',
    text: '先週注文した商品の請求金額が二重になっているようなので調べてほしい',
  },
];

/** 画面に出す1件分。DBを使わないのでidは連番で足りる */
interface DemoMessage {
  id: number;
  senderType: SenderType;
  content: string;
  createdAt: string;
}

/** キーの中身が読めないよう先頭4文字と末尾4文字だけ見せる */
function maskKey(key: string): string {
  if (key.length <= 8) return '設定済み';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export function DemoChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [escalated, setEscalated] = useState(false);
  /**
   * FAQを案内したうえで担当者を提案した状態。
   * デモにはDBもオペレーターも無いので、選択の結果は画面表示だけで完結する。
   */
  const [pendingHandoff, setPendingHandoff] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 保存済みキーの復元。プライベートウィンドウなどでは例外になるため必ず包む
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setApiKey(saved);
    } catch {
      // 読めなくてもデモは動く。キーを入れ直してもらうだけ
    }
  }, []);

  // スマホでパネルを開いている間、背後のページがスクロールしてしまうのを防ぐ
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
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

  function addMessage(senderType: SenderType, content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId.current++,
        senderType,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !apiKey || isSending || cooldown) return;

    setErrorText(null);
    setIsSending(true);
    setInput('');

    // 今回の発言を含めない履歴を先に作る。
    // 含めると同じ文がAIへ二重に渡る（本番の actions/chat.ts と同じ考え方）
    const history: DemoTurn[] = messages
      .filter((m) => m.senderType === 'customer' || m.senderType === 'ai')
      .map((m) => ({
        role: m.senderType === 'customer' ? ('user' as const) : ('model' as const),
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
      // 新しい往復の結果で必ず上書きする（本番チャットと同じ考え方）
      setPendingHandoff(result.data.handoffOffer);
    } catch (error) {
      console.error('[DemoChatWidget] 送信に失敗:', error);
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
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="BOTANICA カスタマーサポート（デモ）"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-brand-sand shadow-2xl md:inset-auto md:bottom-24 md:right-6 md:h-[min(620px,calc(100vh-8rem))] md:w-[400px] md:rounded-2xl md:border md:border-brand-accent"
        >
          {/* ヘッダー */}
          <header className="flex items-center justify-between bg-brand-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <LeafIcon size={20} />
              <div>
                <p className="text-[15px] font-bold leading-tight tracking-wide">
                  BOTANICA
                </p>
                <p className="text-[11px] leading-tight text-white/80">
                  カスタマーサポート（デモ）
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="チャットを閉じる"
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <CloseIcon size={20} />
            </button>
          </header>

          {!isReady ? (
            /* ---- APIキー未入力：入力フォームだけ出す ---- */
            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
              <div className="flex items-start gap-2">
                <InfoIcon size={18} className="mt-0.5 shrink-0 text-brand-secondary" />
                <div>
                  <p className="text-[15px] font-bold text-brand-text">
                    Gemini APIキーを入力してください
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-brand-secondary">
                    デモは体験する方ご自身のAPIキーで動きます。
                    入力したキーはご自身のブラウザにのみ保存され、AIの呼び出しにだけ使用します。
                    サーバーには保存しません。キーは Google AI Studio で無料発行できます。
                  </p>
                </div>
              </div>

              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Gemini APIキーを入力"
                aria-label="Gemini APIキー"
                autoComplete="off"
                className="mt-5 rounded-xl border border-brand-accent bg-white px-3.5 py-2.5 text-[15px] text-brand-text outline-none transition-colors placeholder:text-brand-secondary/60 focus:border-brand-secondary"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="mt-2.5 rounded-xl bg-brand-primary px-5 py-2.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
              >
                デモを開始する
              </button>

              {errorText && (
                <p className="mt-3 flex items-start gap-1.5 text-[13px] text-red-700">
                  <AlertIcon size={15} className="mt-0.5 shrink-0" />
                  {errorText}
                </p>
              )}

              {isEditingKey && (
                <button
                  type="button"
                  onClick={() => setIsEditingKey(false)}
                  className="mt-3 self-start text-[13px] text-brand-secondary underline"
                >
                  入力をやめる
                </button>
              )}

              <p className="mt-6 text-[12px] leading-relaxed text-brand-secondary">
                ダミーFAQ18件を根拠に回答します。
                <br />
                会話は保存されず、閉じると消えます。
                <br />
                実際の個人情報は入力しないでください。
              </p>
            </div>
          ) : (
            /* ---- APIキー入力済み：チャット ---- */
            <>
              {/* キーの状態 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-accent bg-white px-4 py-2">
                <span className="flex items-center gap-1.5 text-[12px] text-brand-text">
                  <CheckIcon size={14} className="text-brand-primary" />
                  APIキー設定済み
                  <span className="font-mono text-brand-secondary">
                    {apiKey ? maskKey(apiKey) : ''}
                  </span>
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingKey(true)}
                    className="text-[12px] text-brand-secondary underline"
                  >
                    変更
                  </button>
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="text-[12px] text-brand-secondary underline"
                  >
                    削除
                  </button>
                </span>
              </div>

              {/* メッセージ一覧 */}
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-1 px-1 text-xs text-brand-secondary">
                    <LeafIcon size={13} />
                    AIサポート
                  </span>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-brand-text shadow-sm">
                    <p className="whitespace-pre-wrap">{WELCOME_TEXT}</p>
                  </div>
                </div>

                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    senderType={m.senderType}
                    content={m.content}
                    createdAt={m.createdAt}
                    timezone="Asia/Tokyo"
                  />
                ))}

                {isSending && (
                  <div className="flex flex-col items-start gap-1">
                    <span className="flex items-center gap-1 px-1 text-xs text-brand-secondary">
                      <LeafIcon size={13} />
                      AIサポート
                    </span>
                    <div className="rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-4 py-3 shadow-sm">
                      <span
                        className="flex gap-1"
                        role="status"
                        aria-label="AIが入力しています"
                      >
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-secondary [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}

                {/* 引き継ぎの選択カード。デモでは通信せず表示だけを切り替える */}
                {pendingHandoff && !escalated && (
                  <HandoffChoice
                    text={HANDOFF_OFFER_TEXT}
                    isBusy={isSending}
                    onContinue={() => setPendingHandoff(false)}
                    onHandoff={() => {
                      setPendingHandoff(false);
                      setEscalated(true);
                    }}
                  />
                )}

                {/* 引き継ぎ表示。デモなので実際には誰にもつながらないことを明示する */}
                {escalated && (
                  <div className="flex items-start gap-2 rounded-xl border border-brand-accent bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-text">
                    <OperatorIcon
                      size={16}
                      className="mt-0.5 shrink-0 text-brand-secondary"
                    />
                    <p>
                      担当者への引き継ぎ（デモ）
                      <br />
                      <span className="text-brand-secondary">
                        FAQに根拠が無い、または人間の判断が必要と判定されました。
                        実運用ではここで管理画面に未対応として通知されます。
                      </span>
                    </p>
                  </div>
                )}

                {errorText && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700"
                  >
                    <AlertIcon size={15} className="mt-0.5 shrink-0" />
                    <p>{errorText}</p>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* 質問チップ。押しても送信はせず入力欄に入れるだけ */}
              <div className="border-t border-brand-accent bg-white px-3 pt-2.5">
                <p className="px-1 text-[11px] text-brand-secondary">試せる質問の例</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <li key={q.label}>
                      <button
                        type="button"
                        onClick={() => handlePickQuestion(q.text)}
                        className="rounded-full border border-brand-accent bg-brand-sand px-3 py-1 text-[12px] text-brand-text transition-colors hover:border-brand-secondary"
                      >
                        {q.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 入力欄 */}
              <div className="bg-white px-3 py-3">
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
                    className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-brand-accent bg-brand-sand px-3 py-2.5 text-[15px] text-brand-text outline-none transition-colors placeholder:text-brand-secondary/60 focus:border-brand-secondary"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    aria-label="送信"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-35"
                  >
                    <SendIcon size={18} />
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-brand-secondary/70">
                  {cooldown && !isSending
                    ? '送信しました。次の送信まで少しお待ちください'
                    : 'Enterで送信 / Shift+Enterで改行'}
                </p>
              </div>
            </>
          )}
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
