import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Stub out Node.js modules for browser (embedding-atlas uses worker_threads)
      worker_threads: { browser: "./src/lib/empty.js" },
    },
  },
};

export default withWorkflow(nextConfig);
