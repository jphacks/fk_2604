# 期限付きファイル共有：実装・適用・検証手順

作業日：2026-10-26（JST）。共有SupabaseへのSQL適用、Edge Functionデプロイ、Cron有効化、commit/push/PR/mergeは実施していません。

## Git調査と作業範囲

- 開始ブランチ：`File-upload` (`66835a0`)。作業ツリーはクリーンで、保護すべき未コミット変更はありませんでした。stash/resetは使用していません。
- `git fetch origin`後の開発統合先：`origin/develop` = `d7516b9`。ローカルdevelopは更新していません。
- 作業ブランチ：`feature/file-storage`。`origin/develop`から作成しました。
- `origin/main` = `1c53db0`。mainのみのコミットは `0093f20`, `c393f4a`, `1c53db0`。develop側にも独自のREADME・要件・アーキテクチャ更新があります。ローカルmain (`f4b9eb0`)／develop (`214f330`)は変更していません。
- main/develop間の差分はREADME、要件定義、アーキテクチャ図と`src/app/(admin)/rooms/new/page.tsx`の文言です。今回のAPIに必要なmain限定のバックエンド変更は見つかりませんでした。mainは統合していません。文言をdevelopへ移す必要性はUI担当と別途判断してください。
- File-uploadのアップロード／ダウンロードはdev-store依存、messagesはSupabase認証＋Redis保存でした。既存の型・API形式・ファイル制限・安全なダウンロード方針を継承しています。
- 通常ブランチに旧`20261025150000_create_room_files.sql`はありません。ローカル履歴`8389c6f`にSQL、Storage試作、cleanup関数があり、内容を確認しました。DB適用済みであることを意味する履歴ではありません。
- 旧SQLにはroomsへのON DELETE CASCADE、Storage全体を対象とするpermissive `false`ポリシーがありました。旧ポリシーは拒否を強制できず、既存の広い許可ポリシーを防げません。新SQLはroom-filesだけを制限するrestrictiveポリシーを追加し、他バケットのアクセス条件を変えません。
- 接続済みSupabase一覧にこのプロジェクトはありませんでした。`.env.local`のURLとの不一致を確認済みで、ローカルの`SUPABASE_SERVICE_ROLE_KEY`も未設定です。対象共有DBのスキーマ・手動SQL・マイグレーション履歴・稼働Cronは**未検証**です。秘密の値は出力していません。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `.env.example` | サーバー専用キーの説明 |
| `package.json`, `package-lock.json` | テストコマンド、テスト専用PGlite固定バージョン |
| `src/app/api/rooms/[roomId]/files/route.ts` | 認証、サイズ検査、DB容量予約、Storageアップロード |
| `src/app/api/rooms/[roomId]/files/[fileId]/route.ts` | 認証、ルーム別取得、Storageダウンロード、安全なヘッダー |
| `src/app/api/rooms/[roomId]/messages/route.ts` | 共通認証、DBファイル一覧、通知再試行 |
| `src/lib/room-authorization.ts` | Supabase Auth＋所有者／未退室メンバー認可 |
| `src/lib/supabase/admin.ts` | server-only管理クライアント、通信タイムアウト |
| `src/lib/room-files.ts` | DB一覧、通知処理への橋渡し |
| `src/lib/file-validation.ts` | MIME署名検査、ファイル名、ダウンロードヘッダー |
| `src/lib/redis-messages.ts` | ファイル通知重複防止キーのTTL同期を追加 |
| `supabase/migrations/20261025163556_room_file_storage_lifecycle.sql` | 旧テーブル互換補正、非公開バケット、容量予約RPC、削除RPC、期限延長ガード |
| `supabase/functions/_shared/file-jobs.ts` | 再試行可能な通知とStorage削除処理 |
| `supabase/functions/room-file-maintenance/index.js` | 認証必須の保守ジョブ |
| `supabase/functions/deno.json`, `supabase/config.toml` | Edge import map／単独関数設定 |
| `supabase/operations/room-file-preflight.sql` | 適用前の読み取り専用調査SQL |
| `supabase/operations/room-file-maintenance-cron.sql` | 手動有効化用Cron SQL（migration外） |
| `tests/file-storage-loader.cjs` | 実サーバーモジュールの隔離テストローダー |
| `tests/file-storage-api.test.cjs` | API・外部サービス障害テスト |
| `tests/file-storage-security.test.cjs` | ファイル検証・ジョブ認証テスト |
| `tests/file-storage-sql.test.cjs` | 組み込みPostgreSQLでのSQLテスト |
| `docs/file-storage.md` | 本手順書 |

フロントエンド変更は**0件**です。`src/components/**`, `src/hooks/**`, page/layout、CSS、Tailwind、画像・アイコンは変更していません。Supabase Auth、参加・招待処理の変更もありません。dev-storeの既存コードは削除していません。

## 保存とAPI互換性

- Privateバケット`room-files`に`{roomId}/{fileId}`で保存。ファイル名はパスに使いません。公開URL・署名付きURLは発行しません。
- PostgreSQL `room_files`にID、ルームID、パス、名前、MIME、サイズ、投稿者ID、DB由来ニックネーム、アップロード時刻と処理状態を保存します。
- 上限は既存どおり1ファイル10MiB、1ルーム50MiB。ルーム行を`FOR UPDATE`でロックし、アップロード中・物理削除未確認の削除待ちを含む全サイズで予約します。Storage削除成功をDBに記録したものは容量を解放します。DBで直列化するため複数サーバーでも容量判定を共有します。
- multipartはContent-Lengthだけでなく、実際のストリームを10MiB＋64KiBで打ち切ります。空ファイル、構文不正MIME、サイズ超過を拒否します。
- `POST files`は従来の`{file, message}`と201。`GET messages`も`messages/nextCursor/memberCount/members/room/files`を維持し、filesのみDBから取得します。既存SharedFile/Message型は変更していません。
- `guestId/nickname`やURLの`guestId`は互換入力として受け付けますが、認証・認可・投稿者決定には使用しません。
- 毎回`auth.getUser()`でCookieを検証し、`rooms.owner_id`または`room_members.user_id`かつ`kicked_at IS NULL`を検査します。nicknameはゲストのDB値、管理者は既存の「管理者」です。
- 未認証401 `NOT_MEMBER`、非参加・kick済403 `NOT_MEMBER`、期限前／期限切れ／不存在ルーム404 `ROOM_GONE`、不存在・別ルームのファイル404 `FILE_NOT_FOUND`、サービス障害503 `SERVICE_UNAVAILABLE`。エラーコードは既存のunionのままです。
- 認可処理は管理クライアントでルームの存在と参加者を検査するため、RLSが隠す非参加ルームも403にできます。ファイルパスを参照する前に認可し、DBクエリでroom_idとfile_idを両方照合します。
- PNG/JPEG/GIF/WebPは署名も検査し、一致するものだけinline。偽装画像はoctet-streamへ降格します。その他は常にattachment＋octet-stream。`nosniff`, CSP sandbox, `private, no-store`, RFC 6266/5987のfilenameを付けます。ファイル名は制御文字・パス区切り・双方向制御文字を除去し、Unicodeを壊さず120文字以内にします。
- Storage取得の後にも認可を再確認し、取得中に期限切れ／kickになった場合も拒否します。ダウンロード済みのコピーを期限後に回収する機能ではありません。

## 障害時の整合性とRedis

1. DBに`uploading`を予約。Storage保存前にパスと容量が永続化されます。
2. Storage保存成功後、DB RPCで期限・権限・予約期限を再確認して`ready`にします。
3. `ready AND notified_at IS NULL`を永続outboxとしてRedisに通知します。
4. Redis Luaでメッセージ追加・既存形式のheat更新・EXPIREAT・重複防止をまとめます。通知IDはfile IDに固定します。Redis応答消失やDB確認失敗でも、再実行は同一通知を重複追加しません。マーカーが先に失効した場合は既存メッセージのIDでも確認します。
5. 通知失敗だけなら保存済みアップロードを201で返し、messagesポーリングまたはCronで再試行します。既存画面による再アップロードを誘発しません。
6. Storage失敗やDB完了失敗では予約を残します。15分を超えた未完了予約を削除対象にします。Storage保存済みか不明なタイムアウトも同じパスを後で削除します。

通常メッセージのRedisリスト、cursor、本文送信、heat形式は維持します。通知重複防止setもルームのEXPIREATに合わせます。ルーム延長時は既存どおりmessages GETのTTL同期で更新します。

HTTPアップロード自体には、既存画面から再試行を識別するキーがありません。最終DB確定後にHTTP応答だけが失われ、ユーザーが同じファイルを手動で再アップロードすると、別ファイルになる可能性があります。Redis通知の再試行とは区別します。厳密なHTTP再送の同一性が必要なら、将来クライアントからIdempotency-Keyを継続送信する仕様が必要です。今回はフロントを変更していません。

## 有効期限と自動削除

- APIはCronと独立してrooms.expires_atを毎回検査します。物理削除の遅れで期限後のアクセスが許可されることはありません。
- CronがEdge Functionを毎分起動。1回20件、最大5並列、通信10秒タイムアウトで処理します。
- 削除対象は期限切れルーム、既に削除されたルーム、15分以上未完了のアップロード、既存の削除待ちです。
- DBでルーム行をロックして期限を再確認し、`deleting`と5分の処理リース・ランダムトークンを発行。延長が先に確定すれば削除しません。
- 期限切れルームで削除処理の取得が先に確定した場合は、DBトリガーがその後の期限延長を拒否します。既に消し始めたファイルを復活させることはできません。通常の期限前の延長は妨げません。
- Storage API `remove()`成功後だけ完了RPCを呼び、`storage_deleted_at`を記録して容量を解放します。Storage失敗・DB応答消失・実行中断では行を残し、リース満了後に再試行します。古いリースのworkerは新しい処理のメタデータを消せません。
- 遅れて到着したStorageアップロードも回収するため、最初の削除開始から24時間は削除記録を保持して同じパスを繰り返し削除します。24時間後、Storage削除が再び成功した時点でメタデータを削除します。`deleted`は成功したStorage削除試行の件数であり、最終削除したDB行数ではありません。
- room_filesはrooms/auth.usersのFK連鎖削除から切り離します。ルーム物理削除や既存`purge_expired_rooms()`でメタデータが消えないため、Storageを後から回収できます。
- 未登録の既存Storageオブジェクトは誤削除しません。旧実装で既にメタデータが消えているものは、preflightの孤立オブジェクト照合で調査し、所有者判断で個別対応してください。
- ジョブは`FILE_MAINTENANCE_SECRET`を必須とし、通常ユーザーJWT・無認証・短い秘密値では実行不可。認証後のみPOSTを受け付けます。外部サービス障害時は503で記録し、次回ジョブへ残します。

## 環境変数（値は記載しない）

| 配置 | 名前 |
| --- | --- |
| Next.js既存 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Next.js追加 | `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用） |
| Edge標準環境 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Edge追加Secrets | `FILE_MAINTENANCE_SECRET`（ランダム32バイト以上推奨、文字列長32以上必須）, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Vault | `room_file_maintenance_url`, `room_file_maintenance_secret` |

service_roleキーとRedisトークンと保守ジョブの秘密値は、`NEXT_PUBLIC_`へ絶対に配置しません。既存の招待URL用`INVITE_SECRET`等はそのまま維持してください。

## ユーザーが実施する適用手順

### 1. 対象・既存状態・履歴を確認

Dashboardで対象プロジェクトのURLを`.env.local`と照合し、バックアップを確保してください。`supabase/operations/room-file-preflight.sql`をSQL Editorで実行します。room_filesが存在するときだけコメント内のデータ照合SQLも実行します。既存のSQL・policies・制約・マイグレーション履歴を保存してください。

特に確認するもの：旧`20261025150000`の履歴有無、rooms.starts_at、room_members.kicked_at、room_filesの各型、バケットpublic=false、既存の容量超過データ、metadataとStorageの欠損／孤立、既存purgeジョブ。違うカラム型や手動拡張があればSQLを調整してから進めます。新migrationは既存データ削除・移動・Storage削除を行いません。

CLIを使う場合（本作業ではhelpのみ確認済み、接続・適用は未実施）：

```powershell
npx --yes supabase@2.122.0 login
npx --yes supabase@2.122.0 link --project-ref <対象ref>
npx --yes supabase@2.122.0 migration list --linked
npx --yes supabase@2.122.0 db push --linked --dry-run --skip-vault
```

旧履歴との扱い：

- **旧SQLが手動適用され、旧履歴はない**：今回の補正migrationがそのテーブルを引き継ぎます。旧SQLを改めて実行したり、適用済みと偽ってrepairしたりしないでください。
- **旧`20261025150000`がremote履歴に存在**：その履歴は消さず、元のSQLを保存している担当者／履歴から同じSQLをローカルmigrationとして復元し、dry-runの不一致を解消してください。このローカル環境では`git show 8389c6f:supabase/migrations/20261025150000_create_room_files.sql`で内容を確認できます。ただし`8389c6f`は通常ブランチの共有履歴にはなく、他メンバー環境で参照できる保証はありません。旧SQLの復元を今回勝手にコミット／実行していません。
- **ほかの既存migrationも手動適用済みだが履歴がない**：定義を完全に照合し、そのSQL全体と一致すると確認できたバージョンだけ担当者が`migration repair <version> --status applied --linked`します。部分適用にこの操作は使いません。履歴を消すrepairや`--include-all`で強引に進めないでください。

### 2. SQLの適用順

新規環境では次の順です。共有DBでは**既に正しく適用済みのファイルを再実行しない**でください。

1. `20261024061003_create_ephemeral_chat_schema.sql`
2. `20261024080147_update_ephemeral_chat_schema.sql`
3. `20261024161000_auth_helpers.sql`
4. `20261025090000_invite_preview_details.sql`
5. **今回追加** `20261025163556_room_file_storage_lifecycle.sql`

旧`20261025150000`の履歴を復元した場合のみ、その旧migrationは4と5の間に位置します。通常の新規構築に旧SQLを追加する必要はありません。

CLIのdry-runが想定した新migrationだけを示すことを確認し、ユーザー自身が適用します：

```powershell
npx --yes supabase@2.122.0 db push --linked --skip-vault
```

Dashboard派は新migrationの内容をSQL Editorで実行します。CLIも併用するなら、完全に実行できたと確認した後でのみ、次の履歴登録を行います（これはDDL実行ではなく履歴操作です）：

```powershell
npx --yes supabase@2.122.0 migration repair 20261025163556 --status applied --linked
```

適用後はpreflightを再実行し、Privateバケット、FK連鎖削除なし、room_filesのRLS、anon/authenticatedの権限なし、RPCがservice_role限定、他バケットのポリシー不変を確認します。DashboardのDatabase Advisorsも確認してください。テーブルには直接公開権限を付けません。

### 3. Edge Functionの準備・デプロイ

DashboardのEdge Functions > Secretsへ上記のEdge追加Secretsを登録します。ジョブ秘密値は十分なランダム値を生成し、リポジトリやコマンド履歴へ残さないよう入力してください。Edge標準のSupabase URL/service_roleは通常プラットフォームが提供します。

DockerなしでデプロイするCLI例：

```powershell
npx --yes supabase@2.122.0 functions deploy room-file-maintenance --project-ref <対象ref> --use-api --no-verify-jwt
```

`supabase/config.toml`にもverify_jwt=falseとentrypoint/import_mapを明示しています。この関数はJWTの代わりに独自の保守用secretを検証するため、この設定が必要です。**関数内認証を削除した状態ではデプロイしないでください。** 他の関数のJWT設定は変更しません。

DashboardのInvoke/TestからPOSTし、ヘッダー`x-file-maintenance-secret`を入力します。無ヘッダーと一般ユーザーJWTが401、正しいsecretのPOSTのみ成功することを、まず使い捨て検証ルームで確認します。正しい呼び出しは実際に期限切れファイルを削除するので、共有本番での初回確認に無関係な期限切れデータがないか事前に確認してください。

### 4. Cronを手動有効化

1. Dashboard Integrations/Database Extensionsで`pg_cron`と`pg_net`を有効にします。Vaultも利用可能か確認します。
2. Dashboard Vaultへ`room_file_maintenance_url`（関数URL）と`room_file_maintenance_secret`（Edge Secretと同じ値）を登録します。同名を重複作成しないでください。
3. `supabase/operations/room-file-maintenance-cron.sql`をレビューし、SQL Editorで実行します。毎分の名前付きジョブが作られます。このファイルは自動migration対象ではありません。
4. `cron.job`、`cron.job_run_details`、Edgeログ、`net._http_response`で実処理のHTTP成功を確認します。Cronの成功表示だけではStorage削除完了を意味しません。
5. 停止は`select cron.unschedule('room-file-maintenance');`。APIでの期限拒否はCron停止中も継続します。

ジョブの秘密値は実行時にVaultから読みます。公式ドキュメントの注意どおり、pg_netの送信待ちキューにはHTTPヘッダーが一時的に入るため、DBへの直接ログイン権限も適切に制限してください。

### 5. Next.jsサーバー設定とリリース

Next.jsに`SUPABASE_SERVICE_ROLE_KEY`を設定してサーバーを再起動します。既存messages APIもこのキーを必要とするため、**DB migrationと環境変数を準備してからサーバーコードを切り替える**順序にしてください。既存のメモリ内ファイルはDBへ移行できません。必要な開発ファイルは旧サーバー停止前に参加者自身がダウンロードし、適用後に再共有してください。

## テスト結果と範囲

実行コマンド：`npm run test:file-storage`、`npx tsc --noEmit`、`npm run lint`、`npm run build`。

- 自動テスト：18件成功。実APIモジュール＋外部サービスのテストダブル、およびPGliteの実PostgreSQLエンジンで検証。削除成功後の容量解放、Data API上限を超える一覧取得も確認。
- 型チェック：成功。
- lint：成功。テストローダーのNext固有ルール違反も修正済み。
- build：成功。通常sandboxではGoogle Fonts通信エラーが発生したため、通信制限外で再実行。最終コードでも成功しています。
- Docker daemonが起動していないため、Supabase local stack／Edge runtimeを使うテストは実行していません。

| 必須項目 | ローカル検証 | 実環境E2E |
| --- | --- | --- |
| 1 管理者アップロード | APIテスト、DBの所有者判定で確認 | 未検証 |
| 2 ゲストアップロード | APIテスト、DB membership/kickで確認 | 未検証 |
| 3 一覧API応答 | 既存型・DB一覧で確認 | 未検証 |
| 4 ダウンロード | バイト列・ルーム照合・ヘッダーで確認 | 未検証 |
| 5 画像プレビュー | APIヘッダー・署名・強制downloadで確認 | ブラウザ描画は未検証 |
| 6 未認証拒否 | API401で確認 | 未検証 |
| 7 未参加拒否 | API403で確認 | 未検証 |
| 8 別ルーム拒否 | 認可403／他室file ID404で確認 | 未検証 |
| 9 Next再起動後取得 | モジュール全再読込と外部保存の継続で確認 | 実Next再起動は未検証 |
| 10 期限切れ拒否 | API・DB・取得中の期限切れで確認 | 未検証 |
| 11 Storage削除 | workerのStorage API呼出し順をテストダブルで確認 | 実オブジェクト削除は未検証 |
| 12 削除失敗の再試行 | workerの失敗・再試行、DBリース／トークンで確認 | 未検証 |
| 13 Redis送受信維持 | API本文・cursor・通知失敗の再試行形式で確認 | 実RedisのLua・TTLは未検証 |

PGliteは単一接続なので、容量予約の並行呼び出し試験は実DBの複数セッション競合テストの代替ではありません。共有DBの独立セッションで、40MiB使用中に10MiBを2件同時アップロードし片方だけ成功すること、期限延長とcleanupの同時実行、重複worker、Storage remove後のDB失敗からの回復も検証してください。

## developへのPR前に必要な作業

1. 上記の共有DB調査・履歴整合を完了し、既存データ／バケットの影響を担当者が確認する。
2. 検証用プロジェクトでSQL・Secrets・Edge・Cronを設定し、表の実環境E2E13項目と競合テストを実施する。
3. 実Nextを停止／再起動して保存済みファイルの一覧・取得を確認し、実Redisの通知重複なし・cursor連続性・EXPIREAT・heatを確認する。
4. main限定の画面文言をUI担当と別PRで扱うか決める。今回mainをmergeしない。
5. 最新origin/developとの差分、フロント変更0件、secret混入なし、テスト結果を再確認する。
6. ユーザー承認後にfeature/file-storageをcommit/pushし、develop向けPRを作成する。今回これらは行っていない。

## 参照した公式資料

- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)：Cron＋pg_net＋Vault。
- [Delete Objects](https://supabase.com/docs/guides/storage/management/delete-objects)：Storageの物理削除はStorage APIで行い、storage.objectsをSQL DELETEしない。
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)：Private StorageとRLS／service role。
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)：サービス間呼び出しの認証。
- [Supabase changelog](https://supabase.com/changelog)：変更履歴を確認。今回のクライアントに関係するTLS変更も確認したがAPI構成の変更は不要。
- [PGlite](https://pglite.dev/docs/)：外部DBを変更しない組み込みPostgreSQLテスト。

公式のCron構成を参考にし、関数の認証はこの実装専用のsecretヘッダーで明示的に行っています。
