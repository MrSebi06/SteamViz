import { defineConfig } from "vite";

export default defineConfig({
  preview: {
    port: 4173,
    host: true,
    allowedHosts: ["steamviz.up.railway.app", ".railway.app"],
  },
  server: {
    host: true,
    allowedHosts: ["steamviz.up.railway.app", ".railway.app"],
  },
});
