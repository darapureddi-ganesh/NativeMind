import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for small Docker images.
  output: "standalone",
  // Pin the workspace root to this project so file tracing ignores unrelated
  // lockfiles elsewhere on the machine (e.g. a stray pnpm-lock in $HOME).
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
