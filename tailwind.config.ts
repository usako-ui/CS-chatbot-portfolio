import type { Config } from 'tailwindcss';

/**
 * BOTANICA ブランドカラー（Q-010 確定）
 *
 * 色は CSS 変数（app/globals.css の :root）で定義し、ここでは変数を参照するだけにする。
 * こうしておくと、後からブランドカラーを差し替えるときに globals.css の
 * 数値を1か所変えるだけで済み、コンポーネント側の修正が不要になる。
 * コンポーネントで #2D6A4F のような直値を書かないこと。
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary)',     // メイン #2D6A4F
          secondary: 'var(--color-secondary)', // サブ #40916C
          accent: 'var(--color-accent)',       // アクセント #B7E4C7
          text: 'var(--color-text)',           // テキスト #1B4332
          sand: 'var(--color-sand)',           // 背景サンド #FAF7F2
          sidebar: 'var(--color-sidebar)',     // サイドバー #3D7A65
          // ランディングページのダーク面（/chat・管理画面では使わない）
          night: {
            DEFAULT: 'var(--color-night)',      // 背景ダーク #0F1F17
            card: 'var(--color-night-card)',    // カード背景 #1A2E20
            line: 'var(--color-night-line)',    // 罫線 #24402F
            text: 'var(--color-night-text)',    // テキスト白 #F0FAF4
            muted: 'var(--color-night-muted)',  // テキスト薄 #8FA9BD
            accent: 'var(--color-night-accent)', // アクセント #5EEAD4
            'accent-soft': 'var(--color-night-accent-soft)', // #2DD4BF
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-jp)', 'sans-serif'],
      },
      /*
       * ランディングのモック画面用アニメーション。
       * 実際に人が触っているように見せるための演出であり、
       * 動きを減らす設定の利用者には motion-reduce: で止める。
       */
      keyframes: {
        'caret-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'bubble-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'row-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1s steps(1, end) infinite',
        'bubble-in': 'bubble-in 320ms ease-out',
        'row-in': 'row-in 420ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
