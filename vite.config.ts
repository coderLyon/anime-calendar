import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages 子路径部署：https://<owner>.github.io/anime-calendar/
// 若仓库名变化，同步修改此处（与仓库名一致）。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png", "logos/bili.png", "logos/tencent.png", "logos/youku.png", "logos/iqiyi.png"],
      manifest: {
        name: "追番日历",
        short_name: "追番日历",
        description: "动漫更新看板：哔哩哔哩 / 腾讯视频 / 优酷 / 爱奇艺 周更看板、追番收藏与日历视图",
        lang: "zh-CN",
        theme_color: "#F4F5F7",
        background_color: "#F4F5F7",
        display: "standalone",
        start_url: "/anime-calendar/",
        scope: "/anime-calendar/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        navigateFallback: "/anime-calendar/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/coderLyon\/anime-calendar\/main\/data\/(updates|history)\.json/,
            handler: "NetworkFirst",
            options: {
              cacheName: "anime-calendar-data",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: "/anime-calendar/",
});
