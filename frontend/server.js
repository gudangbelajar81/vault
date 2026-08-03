import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'http://localhost:5001';

// Reverse Proxy for API requests
app.use(
  '/api',
  createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
  })
);

// Serve static Vite build files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Handle React Router fallback (Single Page Application)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Frontend proxy server running on port ${PORT}`);
  console.log(`Proxying /api to ${API_URL}`);
});
