import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @types/node を足さずにビルド時の環境変数だけ参照するための最小宣言。
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // Cloudflare Pages はルート配信(base='/')、GitHub Pages はサブパス配信。
  // CF_PAGES は Cloudflare Pages のビルドで自動的に "1" が入る環境変数。
  base: process.env.CF_PAGES ? '/' : '/peer-review-game/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
