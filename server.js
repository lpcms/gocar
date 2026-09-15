/**
 * Production entry point for hosts that start an application by a file rather
 * than by `npm start`: the CityHost panel asks for a startup file, and panels
 * of that kind either run it (`node server.js`) or require it in-process.
 * CommonJS on purpose - a panel that requires the file cannot load an ES
 * module, and `node server.js` runs this form just as well.
 *
 * It is the programmatic form of `next start`: the same production server,
 * reading the build in .next. The working directory is pinned to this file's
 * own directory - the application resolves db/gocar.db, public/uploads and
 * config.local.json relative to process.cwd(), and a panel may start the
 * process from somewhere else entirely.
 *
 * Two ways of being reached, decided by PORT:
 *
 *  - CityHost HOSTING 2.0 puts the PATH of a unix socket in PORT (the panel
 *    calls it "Шлях до сокету") and NGINX proxies to that socket. A stale
 *    socket file from the previous run must be removed before listen(), or
 *    the bind fails with EADDRINUSE, and the socket must be chmod 0777 so
 *    NGINX - a different user - can connect to it.
 *  - Anywhere else PORT is a TCP port number, and the listen address is
 *    0.0.0.0 unless HOST says otherwise. `HOSTNAME` is deliberately ignored:
 *    on Linux the shell exports it as the machine name, so honouring it would
 *    bind the server to a name the proxy never connects to.
 */
const { createServer } = require('node:http');
const fs = require('node:fs');
const next = require('next');

process.chdir(__dirname);

const rawPort = process.env.PORT ?? '3000';
const isSocket = !/^\d+$/.test(rawPort.trim());
const host = process.env.HOST ?? '0.0.0.0';
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

/**
 * Startup failures must reach the panel's log, otherwise a dead process is
 * indistinguishable from a misconfigured proxy: both answer 502.
 */
function fail(stage, error) {
  const detail = error && error.stack ? error.stack : String(error);
  process.stderr.write(`gocar: ${stage} failed: ${detail}\n`);
  process.exitCode = 1;
}

/**
 * Drop a socket file left behind by the previous run so listen() can bind.
 */
function clearStaleSocket(path) {
  try {
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch {
    /** If it cannot be removed, listen() reports the real reason below. */
  }
}

/**
 * Let NGINX, which runs as another user, open the socket. Non-fatal: some
 * environments manage the permissions themselves.
 */
function openSocketToProxy(path) {
  try {
    fs.chmodSync(path, 0o777);
  } catch {
    /** Ignored on purpose; the server is already listening. */
  }
}

module.exports = app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });
    server.on('error', (error) => {
      fail(`listen on ${rawPort}`, error);
    });
    if (isSocket) {
      clearStaleSocket(rawPort);
      server.listen(rawPort, () => {
        openSocketToProxy(rawPort);
        process.stdout.write(
          `gocar: listening on socket ${rawPort}, node ${process.version}, cwd ${process.cwd()}\n`
        );
      });
    } else {
      server.listen(Number(rawPort), host, () => {
        process.stdout.write(
          `gocar: listening on ${host}:${rawPort}, node ${process.version}, cwd ${process.cwd()}\n`
        );
      });
    }
    return server;
  })
  .catch((error) => {
    fail('next prepare', error);
  });
