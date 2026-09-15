const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const logFile = path.join(__dirname, 'tmp', 'server.log');
function logError(msg) {
  try {
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  logError(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  logError(`UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

const dev = false;
const port = process.env.PORT || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logError(`REQUEST ERROR: ${err.stack || err}`);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, () => {
    logError(`SERVER STARTED SUCCESSFULLY ON PORT/SOCKET ${port}`);
    console.log(`> Ready on port/socket ${port}`);
  });
}).catch((err) => {
  logError(`APP PREPARE ERROR: ${err.stack || err}`);
  console.error('Failed to prepare Next app:', err);
  process.exit(1);
});