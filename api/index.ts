// Vercel serverless entry point. Vercel maps any /api/* request that matches
// the rewrite in vercel.json to this function, invoking the Express app
// directly as the (req, res) handler.
import app from "../server.js";

export default app;
