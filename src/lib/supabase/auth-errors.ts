export function toAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "認証処理に失敗しました。しばらくしてからもう一度お試しください";
  }

  const message = error.message.toLowerCase();
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";

  if (
    message.includes("invalid login credentials") ||
    code === "invalid_credentials"
  ) {
    return "メールアドレスまたはパスワードが違います";
  }
  if (
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed") ||
    code === "email_not_confirmed"
  ) {
    return "メールアドレスの確認が完了していません。受信メールを確認してください";
  }
  if (
    message.includes("user already registered") ||
    message.includes("already registered") ||
    code === "user_already_exists"
  ) {
    return "登録処理を完了できませんでした。入力内容を確認するか、ログインをお試しください";
  }
  if (
    message.includes("password") &&
    (message.includes("weak") || message.includes("should contain"))
  ) {
    return "パスワードの強度が不足しています";
  }
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    code === "over_request_rate_limit"
  ) {
    return "試行回数が多すぎます。しばらくしてからもう一度お試しください";
  }
  if (
    message.includes("redirect") ||
    message.includes("not authorized") ||
    code === "email_address_not_authorized"
  ) {
    return "認証設定を確認できませんでした。管理者へ連絡してください";
  }
  if (
    message.includes("signups not allowed") ||
    message.includes("signup is disabled")
  ) {
    return "現在、新規登録を受け付けていません。管理者へ連絡してください";
  }
  if (
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("timeout")
  ) {
    return "認証サーバーに接続できませんでした。しばらくしてからもう一度お試しください";
  }
  return "認証処理に失敗しました。しばらくしてからもう一度お試しください";
}
