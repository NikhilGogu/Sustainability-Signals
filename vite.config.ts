import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { ServerResponse } from "http";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    {
      name: 'local-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', async (req: Connect.IncomingMessage, res: ServerResponse, _next: Connect.NextFunction) => {
          try {
            // @ts-ignore
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            // @ts-ignore
            const host = req.headers.host;
            const url = new URL(req.url || '', `${protocol}://${host}`);
            const targetUrl = url.searchParams.get('url');

            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            console.log(`Proxying request to: ${targetUrl}`);

            // @ts-ignore
            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });

            // Copy headers
            response.headers.forEach((value: string, key: string) => {
              // Strip blocking headers
              if (key.toLowerCase() !== 'x-frame-options' &&
                key.toLowerCase() !== 'content-security-policy') {
                res.setHeader(key, value);
              }
            });

            // Add CORS
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Pipe body
            if (response.body) {
              // @ts-ignore - ReadableStream/Node stream mismatch
              const reader = response.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            } else {
              res.end();
            }
          } catch (error) {
            console.error('Proxy error:', error);
            res.statusCode = 500;
            res.end(`Proxy error: ${String(error)}`);
          }
        });
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'charts': ['apexcharts', 'react-apexcharts'],
        },
      },
    },
  },
});
