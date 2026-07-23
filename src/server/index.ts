// Cloudflare Worker のエントリ。
// /api/room/{コード} への WebSocket 接続を、その部屋の Durable Object に振り分ける。
// それ以外はビルド済みの静的アセット(dist)をそのまま返す（SPA フォールバック付き）。
import { Room } from './room';

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export { Room };

const ROOM_PREFIX = '/api/room/';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(ROOM_PREFIX)) {
      const code = decodeURIComponent(url.pathname.slice(ROOM_PREFIX.length)).toUpperCase();
      if (!code) return new Response('room code required', { status: 400 });
      // 同じコード = 同じ Durable Object インスタンス（idFromName は決定的）。
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
