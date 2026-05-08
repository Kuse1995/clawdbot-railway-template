// --- Dashboard password protection ---
// Require the same SETUP_PASSWORD for the entire Control UI dashboard,
// not just the /setup routes.  Healthcheck is excluded so Railway probes work.
function requireDashboardAuth(req, res, next) {
  if (req.path === "/healthz" || req.path === "/setup/healthz") return next();
  if (req.path.startsWith("/hooks")) return next(); // allow OpenClaw webhook endpoints to bypass dashboard auth
  if (!SETUP_PASSWORD) return next(); // no password configured → open
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
