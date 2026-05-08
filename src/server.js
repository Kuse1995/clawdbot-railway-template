// --- Dashboard password protection ---
// Require the same SETUP_PASSWORD for the entire Control UI dashboard,
// not just the /setup routes. Healthcheck is excluded so Railway probes work.

function requireDashboardAuth(req, res, next) {

  // Allow Railway/OpenClaw health checks
  if (
    req.path === "/healthz" ||
    req.path === "/setup/healthz"
  ) {
    return next();
  }

  // Allow webhook endpoints WITHOUT dashboard auth
  // so Omanut/OpenClaw integrations can post events correctly
  if (
    req.path.startsWith("/hooks") ||
    req.path === "/webhook"
  ) {
    return next();
  }

  // If no dashboard password is configured,
  // leave dashboard publicly accessible
  if (!SETUP_PASSWORD) {
    return next();
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  // Missing or invalid auth header
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Auth required");
  }

  // Decode credentials
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";

  // Wrong password
  if (password !== SETUP_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Invalid password");
  }

  // Auth success
  return next();
}
