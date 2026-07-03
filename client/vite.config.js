import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const sharedDir = path.resolve(__dirname, "../shared");

export default defineConfig({
  plugins: [
    react(),
    {
      name: "shared-esm",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith("@shared/")) {
          return { id: "\0" + id, moduleSideEffects: false };
        }
      },
      load(id) {
        const prefix = "\0@shared/";
        if (!id.startsWith(prefix)) return;
        const filePath = path.join(sharedDir, id.slice(prefix.length) + ".js");
        let code = fs.readFileSync(filePath, "utf-8");
        if (code.includes("module.exports")) {
          code = code.replace(
            /module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m,
            (_, exports) =>
              exports
                .split(",")
                .map((s) => s.trim().split(/\s*:\s*/)[0])
                .filter(Boolean)
                .map((n) => `export { ${n} };`)
                .join("\n")
          );
        }
        return { code, map: null };
      },
    },
  ],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
