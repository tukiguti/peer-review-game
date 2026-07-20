import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @types/node を足さずにビルド時の環境変数だけ参照するための最小宣言。
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // 既定はルート配信(base='/')。Cloudflare(Worker/Pages)はこのままでOK。
  // GitHub Pages はサブパス配信なので、Actions側で GHPAGES=1 を渡す。
  base: process.env.GHPAGES ? '/peer-review-game/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
