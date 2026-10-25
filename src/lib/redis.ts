import { Redis } from "@upstash/redis";

/**
 * Upstash Redis のクライアント（サーバー専用）。
 * 接続先は .env.local の UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN から読む。
 *
 * 最初に使うときに作る（環境変数が無くても、Redis を使わない画面は動くようにするため）。
 * automaticDeserialization は切っておき、JSON への変換は自分で行う。
 * （有効のままだと、ニックネーム "123" が数値の 123 に変わってしまうなどの事故が起きる）
 */
let client: Redis | null = null;

export function redis(): Redis {
  if (client) return client;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "環境変数 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていません（.env.local を確認してください）",
    );
  }
  client = Redis.fromEnv({ automaticDeserialization: false });
  return client;
}
