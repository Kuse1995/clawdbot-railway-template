import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Boilerplate to restore __dirname functionality in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variables from your Railway Environment
const SETUP_PASSWORD = process.env.SETUP_PASSWORD;

// --- 1. THE AUTH BYPASS ---
function requireDashboardAuth(req, res, next) {
  // Allow Railway and OpenClaw health checks
  if (req.path === "/healthz" || req.path === "/setup/healthz") return next();

  // Allow webhook endpoints to bypass password protection
  if (req.path.startsWith("/hooks") || req.path === "/webhook") return next();

  if (!SETUP_PASSWORD) return next();

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (password !== SETUP_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Invalid password");
  }
  return next();
}

// Apply Auth to the dashboard/routes
app.use(requireDashboardAuth);

// --- 2. YOUR ROUTES ---
app.get('/', (req, res) => {
  res.send('Omanut AI Gateway is Operational in ESM Mode.');
});

// The Webhook route for WhatsApp/Omanut
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('EVENT_RECEIVED');
});

// --- 3. THE HEALTHY LISTENER ---
const PORT = process.env.PORT || 8080;

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Omanut AI server is live on port ${PORT} (ESM)`);
});
