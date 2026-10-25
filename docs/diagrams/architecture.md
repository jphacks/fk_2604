# くもとーく アーキテクチャ図（Mermaid）

発表資料・README・動画に載せる図の元になる内容。GitHub 上ではそのまま図として表示される。
別のツール（draw.io など）で描き直すときも、ここに書いた「何をつなぐか」を元にする。

> 実装の確認元: `src/app/api/rooms/`、`src/lib/redis-messages.ts`、`src/lib/invite.ts`、`src/app/(guest)/join/`、`src/app/rooms/[roomId]/page.tsx`

---

## 1. 全体構成（どこに何を置くか）

一番伝えたいこと: **メッセージは Redis にだけ置き、期限が来ると自動で消える**。Supabase にはメッセージを保存しない。

```mermaid
flowchart LR
  subgraph Client["ブラウザ"]
    A["管理者<br/>ダッシュボード・ルーム作成・設定"]
    G["ゲスト<br/>QRコード/URLから参加"]
  end

  subgraph Vercel["Vercel（Next.js）"]
    P["画面（Server Components）"]
    API["API Routes<br/>/api/rooms/[roomId]/messages<br/>/api/rooms/[roomId]/files<br/>/api/rooms/heat"]
  end

  subgraph SB["Supabase"]
    AUTH["Auth<br/>管理者: メール+パスワード<br/>ゲスト: 匿名認証"]
    DB[("PostgreSQL + RLS<br/>rooms / room_members<br/>room_invites（ハッシュ値のみ）")]
  end

  R[("Upstash Redis<br/>メッセージ・盛り上がり<br/>期限（EXPIREAT）で自動削除")]

  A --> P
  G --> P
  A -- "2.5秒ごとにポーリング" --> API
  G -- "2.5秒ごとにポーリング" --> API
  P --> AUTH
  P --> DB
  API -- "参加者かを確認" --> DB
  API -- "メッセージの保存・取得" --> R
```

---

## 2. データの置き場所（「そもそも残さない」設計）

| 保存先 | 置くもの | 消え方 |
|---|---|---|
| **Upstash Redis** | メッセージ（`chat:room:{roomId}:messages`）、会話の盛り上がり（`chat:room:{roomId}:heat`） | ルームの終了日時（23:59:59 JST）に Redis が自動で削除 |
| **Supabase（PostgreSQL）** | ルーム情報、参加者（ニックネーム）、招待URLの**ハッシュ値** | 期限切れのルームは `purge_expired_rooms` で削除（※現在は定期実行を設定していない） |
| **サーバーのメモリ** | 共有ファイルの中身（開発用ストア） | サーバーの再起動で消える（保存先は未決） |

```mermaid
flowchart TB
  M["メッセージ本文"] --> R[("Redis<br/>期限つき")]
  M -. "保存しない" .-> D[("Supabase")]
  I["招待URLのトークン"] -- "SHA-256 ハッシュ値だけ" --> D
  I -. "元のトークンは保存しない" .-> D
  R -- "終了日の23:59:59 JST" --> X["自動で削除"]
```

---

## 3. 管理者がルームを作って共有する流れ

```mermaid
sequenceDiagram
  actor Admin as 管理者
  participant Web as Next.js
  participant DB as Supabase
  Admin->>Web: ログイン（メール+パスワード）
  Admin->>Web: ルーム名・利用期間（カレンダー）を入力
  Web->>DB: rooms に作成（終了日の23:59:59 JST）
  Web->>Web: 今日の招待トークンを作る<br/>HMAC-SHA256(INVITE_SECRET, roomId:日付)
  Web->>DB: issue_room_invite（トークンのハッシュ値だけ保存）
  Web-->>Admin: 共有URLとQRコードを表示
  Note over Web,DB: 毎日0:00（JST）に別のURLになる。<br/>その日に初めて設定画面を開いたとき新しいURLが登録される
```

---

## 4. ゲストが参加して会話する流れ

ゲストはアカウント登録不要だが、匿名認証で一時ユーザーになるので、**サーバー側で「誰がどのルームの参加者か」を確認できる**（なりすまし防止）。

```mermaid
sequenceDiagram
  actor Guest as ゲスト
  participant Web as Next.js
  participant Auth as Supabase Auth
  participant DB as Supabase DB
  participant R as Redis
  Guest->>Web: QRコード/URLを開く（/join/[inviteToken]）
  Web->>DB: get_room_by_invite（トークンのハッシュ値で検索）
  DB-->>Web: ルーム名（有効なURLのときだけ）
  Guest->>Web: ニックネームを入力
  Web->>Auth: 匿名ログイン
  Web->>DB: join_room（room_members に登録）
  Web-->>Guest: チャット画面へ
  loop 2.5秒ごと
    Guest->>Web: GET /api/rooms/[roomId]/messages
    Web->>DB: 参加者か確認
    Web->>R: 新着メッセージを取得
    Web-->>Guest: メッセージ・参加者一覧
  end
  Guest->>Web: POST メッセージ送信
  Web->>DB: 参加者か確認
  Web->>R: メッセージを追加＋期限を設定
```

---

## 5. 期限が来たときに消えるもの

```mermaid
flowchart LR
  T["ルームの終了日時<br/>終了日の23:59:59 JST"] --> R1["Redis のメッセージ<br/>自動削除"]
  T --> R2["Redis の盛り上がり<br/>自動削除"]
  T --> S1["Supabase のルーム情報<br/>参加できなくなる"]
  T --> S2["招待URL・QRコード<br/>入れなくなる"]
```

---

## 6. 発表用に絞った1枚（簡略版）

細部を省いて、「何が・どこにあって・どう消えるか」だけを描いたもの。スライドや動画に載せるならこれ。

```mermaid
flowchart LR
  U["参加者<br/>（登録不要）"] -- "QRコード" --> W["くもとーく<br/>Next.js on Vercel"]
  W --> S[("Supabase<br/>ルーム・参加者・認証")]
  W --> R[("Redis<br/>メッセージ<br/>期限つき")]
  R --> E(("期限が来ると<br/>自動で消える"))
```
