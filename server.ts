import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes/api.ts';
import { getOpenUpiBundleJs } from './server/sdk/openupi-bundle.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for development API visibility
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/openupi.js') {
      console.log(`[OpenUPI API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Module 1: Serve Universal JavaScript SDK at /openupi.js
  app.get('/openupi.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getOpenUpiBundleJs());
  });

  // Mount API Router at /api/v1
  app.use('/api/v1', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'OpenUPI Gateway',
      time: new Date().toISOString(),
    });
  });

  // Mount Vite development middlewares or serve static dist
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 OpenUPI Gateway Server running on port ${PORT}`);
    console.log(`📦 Universal SDK: http://localhost:${PORT}/openupi.js`);
    console.log(`⚡ REST API:      http://localhost:${PORT}/api/v1`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting OpenUPI server:', err);
  process.exit(1);
});
