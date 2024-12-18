/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: {
        allowedOrigins: ['your-twilio-domain.com']
      }
    }
  };
  
  export default nextConfig;