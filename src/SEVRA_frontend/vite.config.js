import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from 'fs';
import path from 'path';

const homedir = process.env.HOME || process.env.USERPROFILE;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    define: {
      global: "window",
      "process.env": {
        VITE_BACKEND_HOST: env.VITE_BACKEND_HOST,
        VITE_RWA_CANISTER_ID: env.VITE_RWA_CANISTER_ID,
      },
    },
    resolve: {
      alias: {
        process: "process/browser",
        stream: "stream-browserify",
        zlib: "browserify-zlib",
        util: "util",
        buffer: "buffer",
      },
    },
    server: {
      https: {
        key: fs.readFileSync(path.join(homedir, '.vite-certs', 'localhost+2-key.pem')),
        cert: fs.readFileSync(path.join(homedir, '.vite-certs', 'localhost+2.pem')),
      },
      host: true, // Untuk mengizinkan akses dari jaringan
    },
  };
});