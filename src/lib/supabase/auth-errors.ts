export function toAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "認証処理に失敗しました。しばらくしてからもう一度お試しください";
  }

  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが違います";
  }
  if (message.includes("email not confirmed")) {
    return "メールアドレスの確認が完了していません。受信メールを確認してください";
  }
  if (message.includes("user already registered")) {
    return "登録処理を完了できませんでした。入力内容を確認するか、ログインをお試しください";
  }
  return "認証処理に失敗しました。しばらくしてからもう一度お試しください";
}
