import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

function envFlag(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useProxy = envFlag(env.VITE_USE_API_PROXY);
  const apiTarget = (env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames(assetInfo) {
            const name = assetInfo.names?.[0] || assetInfo.name || "";
            if (name.endsWith(".mjs")) return "assets/[name]-[hash].js";
            return "assets/[name]-[hash][extname]";
          },
        },
      },
    },
    server: apiTarget
      ? {
          proxy: {
            ...(useProxy
              ? {
                  "/admin": {
                    target: apiTarget,
                    changeOrigin: true,
                    secure: true,
                  },
                }
              : {}),
            "/storage": {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
    preview: apiTarget
      ? {
          proxy: {
            "/storage": {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
            },
          },
          headers: {
            // Same policy the live admin host sends. The meta tag cannot loosen it.
            "Content-Security-Policy":
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
        }
      : undefined,
  };
});
