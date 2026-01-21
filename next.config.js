/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  images: { unoptimized: true },
  swcMinify: true,
  // Increase static generation timeout
  staticPageGenerationTimeout: 300, 
  webpack: (config) => {
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
    config.module.rules.push({ test: /\.py$/, use: "raw-loader" });
    return config;
  },
};

module.exports = nextConfig;