import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  output: 'export',
  experimental: {
    // Next.js 15/16 default = 0 (no client-side router cache)
    // bump to 60s so navigating between pages within 1 min is instant
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
}

export default nextConfig
