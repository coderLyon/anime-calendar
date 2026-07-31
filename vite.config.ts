import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 子路径部署：https://<owner>.github.io/anime-calendar/
// 若仓库名变化，同步修改此处（与仓库名一致）。
export default defineConfig({
  plugins: [react()],
  base: "/anime-calendar/",
});
