// Capture Hostinger Passenger socket path before Next.js dotenv overrides process.env.PORT
const port = process.env.PORT || 3000;

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = false;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
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