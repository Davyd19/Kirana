import express from 'express';
import { pathToFileURL } from 'node:url';

export function createGateway({
  upstream = process.env.KIRANA_FLASK_URL ?? 'http://127.0.0.1:5000',
  frontend = process.env.KIRANA_FRONTEND_URL ?? 'http://localhost:5173',
  timeoutMs = 7000,
} = {}) {
  const upstreamOrigin = new URL(upstream).origin;
  const allowedOrigin = new URL(frontend).origin;
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.vary('Origin');
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Origin frontend tidak diizinkan.' });
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', allowedOrigin);
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    return req.method === 'OPTIONS' ? res.sendStatus(204) : next();
  });
  app.use('/api', express.raw({ type: () => true, limit: '16kb', inflate: false }), async (req, res) => {
    const target = new URL(req.originalUrl, upstreamOrigin);
    if (target.origin !== upstreamOrigin) {
      return res.status(400).json({ error: 'Bad Request', message: 'Alamat API tidak valid.' });
    }
    const headers = {};
    for (const name of ['authorization', 'content-type']) {
      if (req.get(name)) headers[name] = req.get(name);
    }
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : req.body;
    try {
      const upstreamResponse = await fetch(target, {
        method: req.method, body, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
      });
      const type = upstreamResponse.headers.get('content-type');
      if (type) res.set('Content-Type', type);
      const bytes = Buffer.from(await upstreamResponse.arrayBuffer());
      return res.status(upstreamResponse.status).send(bytes);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        return res.status(504).json({ error: 'Gateway Timeout', message: 'Flask tidak merespons tepat waktu.' });
      }
      return res.status(502).json({ error: 'Bad Gateway', message: 'Layanan Flask tidak dapat dihubungi.' });
    }
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status ?? 500).json({ error: 'Gateway Error', message: 'Permintaan API tidak dapat diproses.' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.KIRANA_GATEWAY_HOST ?? '127.0.0.1';
  const port = Number(process.env.KIRANA_GATEWAY_PORT ?? '3000');
  createGateway().listen(port, host, () => console.log(`Kirana Express listening at http://${host}:${port}`));
}
