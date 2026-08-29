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
        },
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-jp)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
