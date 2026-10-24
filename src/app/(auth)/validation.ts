export const PASSWORD_MIN_LENGTH = 8;
export const TOTP_CODE_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email) return "メールアドレスを入力してください";
  if (!EMAIL_PATTERN.test(email)) return "メールアドレスの形式が正しくありません";
}

// 新規登録・パスワード変更で使う（ログイン時は入力の有無だけを見る）
export function validateNewPassword(password: string): string | undefined {
  if (!password) return "パスワードを入力してください";
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で、英字と数字を両方含めてください`;
  }
}

export function validateTotpCode(code: string): string | undefined {
  if (!code) return "確認コードを入力してください";
  if (!new RegExp(`^[0-9]{${TOTP_CODE_LENGTH}}$`).test(code)) {
    return `確認コードは${TOTP_CODE_LENGTH}桁の数字で入力してください`;
  }
}
