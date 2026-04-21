import 'dotenv/config';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { generateCandidates } from './api/llm';
import { checkAllStreaming } from './api/availability';
import { DEFAULT_ZONES, isZone, type Zone } from './api/zones';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '16kb' }));

app.post('/api/suggest', async (req, res) => {
  const body = req.body as { description?: unknown; zones?: unknown };
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 3 || description.length > 2000) {
    res.status(400).json({ error: 'description must be 3-2000 characters' });
    return;
  }

  const zones: Zone[] = Array.isArray(body.zones)
    ? body.zones.filter((zone): zone is string => typeof zone === 'string').filter(isZone)
    : [...DEFAULT_ZONES];
  const finalZones = zones.length ? zones : [...DEFAULT_ZONES];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('start', { description, zones: finalZones });
    const candidates = await generateCandidates(description, 20);
    send('candidates', { candidates });

    const bases = candidates.map((candidate) => candidate.name);
    const total = bases.length * finalZones.length;
    const rationaleByBase = new Map(
      candidates.map((candidate) => [candidate.name, candidate.rationale]),
    );
    let checked = 0;

    await checkAllStreaming(bases, finalZones, (result) => {
      checked++;
      send('check', {
        fqdn: result.fqdn,
        base: result.base,
        zone: result.zone,
        available: result.available,
        rationale: rationaleByBase.get(result.base) ?? '',
        checked,
        total,
      });
    });

    send('done', { checked, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    send('error', { message });
  } finally {
    res.end();
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
