/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig = {
  images: {
    unoptimized: true,
    domains: ['docs.google.com'],
  },
  experimental: {
    appDir: true,
  },
}

module.exports = withPWA(nextConfig)
