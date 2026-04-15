import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postSession, getSession, listSessions, deleteSessionHandler } from './api/sessions.js';
import { getDb } from './db/schema.js';
import { llmRouter } from './llm/router.js';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();

// CORS — allow frontend origin (configurable via env, defaults to localhost dev ports)
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500').split(',');
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  // Allow requests with no origin (e.g. direct file:// open, curl, Postman)
  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    else res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.post('/api/sessions', upload.single('resumeFile'), postSession);
app.get('/api/sessions', listSessions);
app.get('/api/sessions/:id', getSession);
app.delete('/api/sessions/:id', deleteSessionHandler);

// Pool status — useful for monitoring/debugging which models are active
app.get('/api/pool-status', (_req: Request, res: Response) => {
  res.status(200).json(llmRouter.getPoolStatus());
});

// Global error handler — never exposes stack traces
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve index.html and any static files (style.css etc.) from project root
app.use(express.static(ROOT_DIR));

// Fallback — serve index.html for any non-API route
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Initialize DB on startup
getDb();

app.listen(PORT, () => {
  console.log(`CareerSense server listening on port ${PORT}`);
});

export { app };
