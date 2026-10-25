# 管理者TOTP：実装・運用・検証

作業ブランチは `feature/admin-2fa`。開始時はクリーンな `e12b6e6` でした。今回の変更は未コミットです。commit・push・PR・main/developへのmerge・Vercelデプロイ・共有SupabaseへのSQL適用や設定変更は行っていません。

## 最新ブランチの調査

fetch後のorigin/mainは `c38d3bb`、origin/developは `8f59c71`。認証・管理者処理・API・Supabaseクライアントは両ブランチと作業基準HEADで一致していました。作業基準から最新developの追加変更はREADME、main限定の変更はアイコン関連です。これらを勝手に統合していません。

既存TOTP画面はダミーQR／固定secret、登録・確認ActionはTODOでした。パスワードログインはdashboardへ直行していました。管理者処理はルーム作成、期間更新、招待発行、参加者操作のDB権限、heat APIです。チャット／ファイルAPIは管理者とゲストが共用しています。

既存モデルに従って、非匿名の登録ユーザーを管理者候補として扱い、対象ルームの操作では別途owner_idを照合します。aal2だけで他人のルームを操作できません。user_metadataによるロール判定は行いません。将来別の一般登録ユーザーロールを導入する場合は、管理者用の別の信頼できる権限属性が必要です。

## 既存デザインの維持

- 共通 `src/app/(auth)/_components/totp-code-form.tsx` はHEADと同一です。
- `/signup/totp`と`/login/verify`の既存className、カード構造、6桁フォーム、ボタン、リンクを維持しています。
- 登録画面の既存QR枠内にSupabaseの本物のQR画像を表示し、既存のコード表示位置に本物のsecretを表示します。
- 登録ページにデータ取得用の状態とeffectを追加。Strict Modeのeffect再実行では同じPOST Promiseを再利用し、初期取得を重複させません。タブタイトルも従来のものを維持します。
- 既存CardDescription内で取得失敗を表示。読み込み時は既存QRアイコンと「取得中…」を使います。新しい登録ボタン、factor選択UI、復旧ページは追加していません。
- factor IDはServer Actionのbind引数で渡し、共通フォームへhidden inputやpropsを追加していません。サーバー側では改ざんを想定して本人のfactorと照合します。
- 管理者ページの変更はデータ取得前の認証ガードだけです。JSXのデザインは変更していません。
- CSS、Tailwind設定、既存UIコンポーネント、チャット／ファイル画面、アニメーション、レスポンシブ設定、画像・アイコンファイルは変更していません。フロントエンドファイルの移動・削除もありません。
- 自動差分テストで両TOTP画面の全className、カード／フォームの構成数、共通フォームの完全一致を確認しています。実ブラウザでのスクリーンショット比較は未実施です。

## 登録・ログイン・API認可

初回：メール／パスワード認証 → `/signup/totp` → Supabase `mfa.enroll({factorType:'totp', issuer:'KumoTalk'})` → Google Authenticatorへ登録 → `challengeAndVerify` → aal2を検証してdashboard。

通常：パスワード認証 → 検証済みTOTPがあれば `/login/verify` → `challengeAndVerify` → aal2を検証してdashboard。未登録は登録画面へ、有効なaal2はdashboardへ進みます。メール確認callbackでも同じMFA要件を適用し、nextによる外部リダイレクトも防止します。

本人確認には `auth.getUser()`、JWT署名・有効期限・sub・aal確認には `auth.getClaims()` を使います。引数なしの `getAuthenticatorAssuranceLevel()` や未検証Cookieのuser情報だけでは権限を判断しません。検証済みTOTPがAuth側に残っていることも確認します。

`admin_mfa_session_is_live()` RPCは現在のJWTのsession_idがauth.sessionsに存在するか検査します。署名期限が残る失効済みJWTも拒否し、紛失後に新factorが登録されても古いセッションが復活しないようにします。Auth内部テーブルは非公開スキーマの限定したSECURITY DEFINERで読み取り、固定search_pathと本人照合、PUBLIC/anonの実行権限剥奪を設定します。

| 対象 | 強制内容 |
| --- | --- |
| dashboard／新規作成／設定ページ | ページ自身とmiddlewareで管理者MFAを確認 |
| 作成・期間更新Server Action | Action自身でMFAを確認。設定更新はowner_idも確認 |
| heat API | 未認証・匿名401、MFA不足403、確認不能503。取得対象は本人所有ルームのみ |
| messages/files共用API | 所有者のみMFA必須。既存レスポンスを維持し、MFA不足403 NOT_MEMBER |
| 招待・参加者管理・bridgeのDB操作 | 最終強制SQLのrestrictive RLSと所有者ポリシーを併用 |
| issue_room_invite | definerによるRLS迂回を関数内のMFA＋所有者チェックで防止 |
| 匿名ゲスト | MFA不要。既存の招待・参加者・期限チェックを維持 |

middlewareのファイル名は維持しています。Next.js 16では非推奨の名称ですが、今回の変更を認証処理に限定するため、ファイル移動はしていません。更新時のCookieチャンクをすべて保持し、リダイレクトにも引き継ぎます。

入力は6桁を検証し、factorは本人所有・TOTP・適切なstatusに限定します。誤コード・期限切れ・rate limit・通信エラー時は管理画面へ進みません。QR/secret/コードをログ、URL、独自Cookie、localStorage、アプリDBに保存しません。QRはimgで描画し、HTML注入しません。登録・確認画面はprivate/no-store、no-referrerです。

画面の再読み込みは、このアプリが作成した未検証factorだけを整理してやり直します。検証済みfactorを勝手に削除しません。複数タブで古い未完了QRが無効になった場合は、最新画面で登録してください。Supabaseのfactor上限・rate limitに達した場合はエラー表示し、検証済み登録を壊して回避しません。

## 予備端末・通常の解除／再登録

UIを増やさず、同じ登録actionsファイルにサーバー処理を用意しています。

- `addTotpFactor()`：現在のaal2が必須。本物のQR/secretを返す。
- `verifyAdditionalTotpFactor(factorId, code)`：aal2と本人の未検証TOTPが必須。
- `removeTotpFactor(factorId)`：aal2と本人の検証済みTOTPが必須。最後の1個は削除せず、先に新要素の登録・確認を要求。

新しい予備端末用画面や解除ボタンは未実装です。これらは既存UIに将来接続するためのバックエンド処理であり、復旧用service_role権限を持つ公開APIではありません。

予備TOTPが登録済みの場合、既存確認画面は `/login/verify?factorId=<本人の予備factor ID>` に対応します。通常は最初の検証済みTOTPを使い、指定IDは本人の検証済み要素に含まれる場合だけ採用します。URLにコードやsecretを入れません。運用担当者は本人確認のうえfactor一覧と対象リンクを案内できます。画面内の要素選択UIは追加していません。

## 紛失時の運用復旧

1. 運用担当者が既存のチーム連絡経路・対面／通話など独立した経路で本人確認。可能なら別担当者も確認し、メール申告だけで解除しません。パスワード、seed、QR、6桁コードを提出させません。
2. 利用可能な予備factorや、本人が事前設定していたAuthenticatorの復元方法を確認。紛失端末が第三者に渡ったリスクも確認します。
3. 対象環境、user UUID、紛失factor UUIDを照合し、権限のある運用担当者が承認・監査記録を残してSupabase Admin MFA API `deleteFactor({userId, id})` でそのfactorだけを削除します。一般公開の復旧APIは作っていません。
4. Supabase公式仕様では、検証済みfactorのAdmin削除は全アクティブセッションをログアウト対象にします。対象のauth.sessions失効を実環境で確認してください。未検証factor削除に同じ失効効果は期待しません。
5. 旧JWTで管理機能に入れないことを確認。今回のRPC／最終RLSはsessionの存在を照合するため、JWTの署名期限だけでは許可しません。
6. 本人が再ログインし、予備factorが残っていればそれで確認。最後のfactorが消えていれば新規TOTP登録を必須にします。新端末での再ログインまで確認し、従来の連絡経路で本人へ完了通知します。
7. 日時・対象UUID・承認者・結果だけを監査記録へ残し、秘密値は記録しません。

メールとパスワードだけによる自己解除、独自のMFA迂回、auth内部テーブルの直接DELETEは実装していません。experimentalなrecovery-code APIにも依存していません。

## 段階的導入とSupabase設定

共有DBはmain/develop/Vercel Previewから同時に使われる可能性があります。**古い画面にMFA導線がないまま強制用SQLを共有DBへ適用しないでください。**

1. まずローカルまたは隔離したSupabase検証プロジェクトで確認します。現在のDocker daemonは停止していたため、本作業でstackは起動していません。
2. 担当者が検証先のAuthでTOTPの登録・確認を有効にします。匿名ログインは維持。ローカルconfig.tomlでは `[auth.mfa.totp] enroll_enabled=true, verify_enabled=true` にしましたが、共有設定へは適用していません。
3. 既存migrationの適用履歴とAuthスキーマを確認し、最後に準備用 `supabase/migrations/20261025183833_admin_totp_enforcement.sql` を適用します。これはsession確認RPC等の準備だけで、既存RLSや招待RPCをまだ強制変更しません。
4. 本コードはこの準備RPCを必要とします。準備SQLとTOTP設定が整ってから新コードを検証します。コード自身はAAL1の管理者操作を拒否します。
5. 既存の2FA画面で実機登録・ログイン・再読み込み・誤コード・ゲスト利用を確認し、同じDBを参照する全デプロイへの対応を調整します。pushもVercel自動Previewを起こし得るため、実行前にユーザー承認が必要です。
6. MFA導線が動作する全環境の準備と承認後に限り、`supabase/operations/enable-admin-totp.sql` を手動適用します。これがrestrictive RLSと招待RPCの最終強制です。自動migrationには含めず、準備だけで旧管理者を締め出さないようにしています。
7. この第2段階が未適用の間は、旧デプロイ／直接Supabase管理操作に対するDBのMFA強制は未完了です。最終強制の実施と結果を運用記録に残してください。
8. Database Advisors、auth.sessions／mfa_factorsのスキーマ、関数の権限、他人のルーム拒否、旧JWT失効を確認します。既存のファイル共有SQL・Edge Functionsには手を加えていません。

新しい環境変数は不要です。既存のSupabase公開URL・anon/publishable key、ファイル共有用service_role key、Redis接続、INVITE_SECRET、NEXT_PUBLIC_SITE_URLを使用します。ローカル検証ではプロセスの環境変数をローカルstackと検証用Redisへ向け、既存の共有用.env.localを無断で上書きしないでください。

## Google Authenticatorでの手動確認

Dockerを起動してローカルSupabaseを使う場合は、CLI `start --help`を確認したうえで起動してください。共有DBに対するreset/pushは実行しません。既存migration→準備SQL→コード確認→手動強制SQLの順に、使い捨て環境で試します。

- テスト管理者を登録し、必要ならローカルメールでメール確認。既存QR枠の本物のコードをGoogle Authenticatorで読み取るか、既存位置のsecretを手入力します。
- 正しい6桁で登録し、ログアウト後に別ブラウザでパスワードだけではdashboardへ行けないこと、正しいコードならaal2で進めることを確認します。
- 誤コード・期限切れコード、登録途中の更新、二重タブ、ネットワーク失敗、rate limitを確認。コード不一致ではスマホOS／PCの自動時刻、対象アカウント、古いQRの使用を確認します。
- AAL1で作成・設定更新・招待・参加者管理・heat APIが拒否され、AAL2でも他人のルームを管理できないことを確認します。
- 別ブラウザの匿名ゲストで招待参加、Redis送受信・TTL、ファイルのアップロード／取得／プレビューを確認します。
- 予備要素によるログイン、使い捨てアカウントでの紛失復旧、再登録後も旧JWTが拒否されることを確認します。
- 2画面のレイアウト、色、余白、フォント、アニメーション、レスポンシブ表示を元の画面と目視比較してください。

## テスト結果

- `npm run test:admin-mfa`：18件成功。API／Action、session失効、factor所有権・登録状態、AAL2、予備要素・解除、Cookie保持、callback迂回防止、UI差分、段階的SQLを確認。
- `npm run test:file-storage`：19件成功。所有者AAL1拒否とゲストAAL1のチャット・ファイル共有を含む。
- `npx tsc --noEmit`、`npm run lint`、`npm run build`：最終変更後にすべて成功。
- Auth呼び出しはテストダブル。SQLはPGliteの実PostgreSQLで既存DB定義と新SQLを読み込み、所有者・他人・ゲスト・kick・招待RPC・セッション失効・段階導入を検証しました。
- 実Supabase AuthでのQR取得／TOTP登録・Google Authenticator実機・実ブラウザ描画・共有DB適用・実セッション失効は未検証です。成功したと扱っていません。

## 変更ファイル一覧

- `middleware.ts`：管理画面へのMFA誘導、Cookie保持、認証画面no-store。
- `src/lib/admin-mfa.ts`, `src/lib/admin-authorization.ts`：検証済みJWT、session確認、管理者ガード。
- `src/app/(auth)/signup/totp/page.tsx`, `actions.ts`：既存枠での本物の登録、追加要素・解除のサーバー処理。
- `src/app/(auth)/login/verify/page.tsx`, `actions.ts`：既存フォームのTOTP確認。
- `src/app/(auth)/login/actions.ts`, `signup/actions.ts`, `src/app/auth/callback/route.ts`：認証後の最小限の遷移。
- `src/app/dashboard/page.tsx`, `src/app/(admin)/rooms/new/page.tsx`, `actions.ts`, `src/app/(admin)/rooms/[roomId]/settings/page.tsx`, `actions.ts`, `src/app/rooms/[roomId]/page.tsx`：サーバー認証ガードだけ。
- `src/app/api/rooms/heat/route.ts`, `src/lib/room-authorization.ts`：管理者／所有者のAPI保護。
- `supabase/config.toml`：ローカルTOTP有効化。
- `supabase/migrations/20261025183833_admin_totp_enforcement.sql`：準備用SQL。
- `supabase/operations/enable-admin-totp.sql`：手動の最終強制SQL。
- `tests/admin-mfa.test.cjs`, `tests/admin-mfa-sql.test.cjs`, `tests/admin-mfa-ui.test.cjs`, `tests/file-storage-api.test.cjs`：テスト。
- `package.json`：MFAテストコマンド。
- `docs/admin-mfa.md`：本書。

共通TOTPコンポーネント、CSS、デザイン設定、既存Storage SQL／Edge Functionsに差分がないことも最終diffで確認済みです。

## 公式資料

- Supabase TOTP：https://supabase.com/docs/guides/auth/auth-mfa/totp
- 検証済みClaims：https://supabase.com/docs/reference/javascript/auth-getclaims
- 管理者factor削除とセッション失効：https://supabase.com/docs/reference/javascript/auth-admin-deletefactor
- Google Authenticator：https://support.google.com/accounts/answer/1066447?hl=ja

Next.jsの認証・middleware／Proxy仕様はインストール済み `node_modules/next/dist/docs/` も参照しました。
