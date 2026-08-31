/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 旧 /chat を本番チャットのページ /botanica へ寄せる（2026-08-31）。
   *
   * ページを1枚に統合したので、以前のURLで来た人を落とさないよう転送する。
   *
   * middleware ではなくここで処理するのは、middleware の matcher に /chat を
   * 足すと、匿名サインイン前のアクセスにも Auth 問い合わせが走ってしまうため。
   * 静的なリダイレクトに認証は不要。
   *
   * permanent: false（307）にしているのは、ブラウザに恒久キャッシュさせないため。
   * 将来 /chat を別用途で使う可能性が残っている段階で 308 を返すと、
   * ユーザーの端末に残ったキャッシュを消せなくなる。
   */
  async redirects() {
    return [
      {
        source: '/chat',
        destination: '/botanica',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
