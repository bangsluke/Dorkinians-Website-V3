/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})

const nextConfig = {
  // output: 'export', // Commented out to enable API routes
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: ['docs.google.com'],
  },
}

module.exports = withPWA(nextConfig)
