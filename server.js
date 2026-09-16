// Capture Hostinger Passenger socket path before Next.js dotenv overrides process.env.PORT
const port = process.env.PORT || 3000;

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = false;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

const fs = require('fs');

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // 1. Universal CSS Fallback:
      // If any browser or edge cache requests ANY CSS file that doesn't exist,
      // serve the active production stylesheet so the page is NEVER unstyled!
      if (pathname && pathname.startsWith('/_next/static/css/') && pathname.endsWith('.css')) {
        const directPath = path.join(__dirname, '.next', pathname.replace('/_next/', ''));
        if (!fs.existsSync(directPath)) {
          const cssDir = path.join(__dirname, '.next', 'static', 'css');
          if (fs.existsSync(cssDir)) {
            const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
            if (files.length > 0) {
              const activeCssPath = path.join(cssDir, files[0]);
              res.setHeader('Content-Type', 'text/css; charset=UTF-8');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return fs.createReadStream(activeCssPath).pipe(res);
            }
          }
        }
      }

      // 2. Legacy JS Chunk Auto-Refresh:
      // If a client browser tries to fetch a deleted JS chunk from an older deployment,
      // instead of crashing on 404, send a lightweight auto-reload instruction to get latest build
      if (pathname && pathname.startsWith('/_next/static/chunks/') && pathname.endsWith('.js')) {
        const directPath = path.join(__dirname, '.next', pathname.replace('/_next/', ''));
        if (!fs.existsSync(directPath)) {
          res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          res.setHeader('Cache-Control', 'no-store, must-revalidate');
          return res.end(
            `console.warn('Obsolete bundle chunk requested (${pathname}). Refreshing to latest app build...');` +
            `try { if (!sessionStorage.getItem('hrm_chunk_reload_' + location.pathname)) { sessionStorage.setItem('hrm_chunk_reload_' + location.pathname, '1'); window.location.reload(); } } catch(e) { window.location.reload(); }`
          );
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, () => {
    console.log(`Ready on port ${port}`);
  });
}).catch((err) => {
  console.error('Next prepare failed:', err);
});