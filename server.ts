import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { apiRouter } from './server/routes/api.ts';
import { getOpenUpiBundleJs } from './server/sdk/openupi-bundle.ts';
import { logger } from './server/services/loggerService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Global Security Headers & CORS
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Generate correlation ID
    const reqId = (req.headers['x-request-id'] as string) || 'req_' + crypto.randomBytes(8).toString('hex');
    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);

    // Defense-in-depth security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS Headers for API & openupi.js embedding
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Idempotency-Key, X-OpenUPI-Signature, X-OpenUPI-Timestamp');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    // Structured request log
    if (req.path.startsWith('/api') || req.path === '/openupi.js') {
      logger.info('HTTP', `${req.method} ${req.path}`, { ip: req.ip }, reqId);
    }

    next();
  });

  // Module 1: Serve Universal JavaScript SDK at /openupi.js
  app.get('/openupi.js', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(getOpenUpiBundleJs());
  });

  // Mount API Router at /api/v1
  app.use('/api/v1', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'OpenUPI Gateway',
      version: '1.2.0-hardened',
      requestId: req.requestId,
      time: new Date().toISOString(),
    });
  });

  // Centralized Error Handler (Never leak stack traces in responses)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('SERVER', `Unhandled error: ${err.message}`, { stack: err.stack }, req.requestId);
    res.status(err.status || 500).json({
      error: 'An internal gateway error occurred. Reference the Request ID when contacting support.',
      requestId: req.requestId,
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
    console.log(`🚀 OpenUPI Gateway Hardened Server running on port ${PORT}`);
    console.log(`📦 Universal SDK: http://localhost:${PORT}/openupi.js`);
    console.log(`⚡ REST API:      http://localhost:${PORT}/api/v1`);
    console.log(`🔒 Security Mode: Zero-Exposure · Atomic Locks · Multi-Tenant`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting OpenUPI server:', err);
  process.exit(1);
});
