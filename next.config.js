/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Removed deprecated experimental.appDir
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    domains: [],
    unoptimized: true,
  },
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Handle audio files
    config.module.rules.push({
      test: /\.(mp3|wav|ogg|m4a)$/,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/audio/",
          outputPath: "static/audio/",
        },
      },
    });

    // Handle Python files
    config.module.rules.push({
      test: /\.py$/,
      use: "raw-loader",
    });

    return config;
  },
};

module.exports = nextConfig;
