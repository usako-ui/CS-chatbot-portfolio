/**
 * オペレーターログイン画面（T-24・FR-OPS-001・AC-011）
 */
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AlertIcon, LeafIcon } from '@/components/icons';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // middleware が付けてくれる元の行き先。無ければ一覧へ
  const redirectTo = params.get('redirect') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Supabaseの原文（Invalid login credentials）は英語で分かりにくいうえ、
        // 「メールが存在しない」と「パスワードが違う」を区別して伝えると
        // アカウントの存在有無を外部から探れてしまうため、一律の文言にする
        setError('メールアドレスまたはパスワードが正しくありません。');
        return;
      }

      // middleware にCookieを読ませてから遷移させる。
      // refresh() を挟まないと、遷移先で未ログイン扱いになり弾かれることがある
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      console.error('[login] サインインに失敗:', err);
      setError('ログインに失敗しました。時間をおいてお試しください。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-sand px-5">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2">
          <LeafIcon size={34} className="text-brand-primary" />
          <p className="text-xl font-bold tracking-[0.18em] text-brand-primary">
            BOTANICA
          </p>
          <p className="text-xs tracking-wide text-brand-secondary">
            カスタマーサポート管理画面
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-brand-accent bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-lg border border-brand-accent bg-brand-sand px-3 py-2.5 text-[15px] text-brand-text outline-none transition-colors focus:border-brand-secondary"
            />
          </div>

          <div className="mb-5">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-brand-accent bg-brand-sand px-3 py-2.5 text-[15px] text-brand-text outline-none transition-colors focus:border-brand-secondary"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
            >
              <AlertIcon size={15} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-primary py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'ログインしています...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams はプリレンダリング時に Suspense 境界を要求する
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-sand" />}>
      <LoginForm />
    </Suspense>
  );
}
