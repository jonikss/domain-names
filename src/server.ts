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
import { checkMany } from './api/availability';
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
    ? body.zones.filter((z): z is string => typeof z === 'string').filter(isZone)
    : [...DEFAULT_ZONES];
  const finalZones = zones.length ? zones : [...DEFAULT_ZONES];

  try {
    const candidates = await generateCandidates(description, 20);
    const bases = candidates.map((c) => c.name);
    const checks = await checkMany(bases, finalZones);

    const rationaleByBase = new Map(candidates.map((c) => [c.name, c.rationale]));
    const free = checks
      .filter((r) => r.available === true)
      .map((r) => ({
        fqdn: r.fqdn,
        base: r.base,
        zone: r.zone,
        rationale: rationaleByBase.get(r.base) ?? '',
      }));

    res.json({
      description,
      zones: finalZones,
      candidateCount: candidates.length,
      checkedCount: checks.length,
      available: free,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
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
