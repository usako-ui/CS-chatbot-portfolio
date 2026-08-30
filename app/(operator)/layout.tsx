/**
 * 管理画面グループのレイアウト
 *
 * ここでは何も足さない。ログイン画面（/login）もこのグループに属するが、
 * サイドバーを出してはいけないため、シェルは各ページ側で使う。
 */
export default function OperatorGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
