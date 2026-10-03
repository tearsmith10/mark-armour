import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep tracing anchored to THIS project even though a parent
  // directory contains another lockfile.
  outputFileTracingRoot: __dirname,
  // Load these through Node's own resolver — bundling them picks up
  // browser-field shims (PGlite stubs fs/path/url) which break in the server.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
