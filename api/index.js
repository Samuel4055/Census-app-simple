// Vercel entry point: every /api/* request (and /health) is rewritten here by
// vercel.json. Static pages in /public are served by Vercel's CDN, not by this.
const { configProblem, ensureReady } = require('../src/bootstrap');

let app;

module.exports = async (req, res) => {
  const problem = configProblem();
  if (problem) {
    console.error('Configuration problem:', problem);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'The server is not configured yet. Please contact the administrator.' }));
  }

  try {
    await ensureReady();
  } catch (err) {
    console.error('Setup failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'The server could not finish setting up. Please try again shortly.' }));
  }

  if (!app) app = require('../src/app');
  return app(req, res);
};
