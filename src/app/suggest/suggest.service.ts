import { Injectable, computed, signal } from '@angular/core';
import { CANDIDATE_COUNT, DEFAULT_ZONES, INITIAL_ZONES, type Zone } from '../../api/zones';
import { readSseEvents } from './sse-stream';
import type { AvailableDomain, CheckEvent, Phase, ZoneGroup } from './types';

@Injectable({ providedIn: 'root' })
export class SuggestService {
  readonly zones = DEFAULT_ZONES;
  readonly description = signal('');
  readonly selectedZones = signal<Set<Zone>>(new Set(INITIAL_ZONES));
  readonly phase = signal<Phase>('idle');
  readonly error = signal<string | null>(null);
  readonly checkedCount = signal(0);
  readonly totalCount = signal(0);
  readonly freeDomains = signal<AvailableDomain[]>([]);

  readonly loading = computed(() => {
    const currentPhase = this.phase();
    return currentPhase === 'generating' || currentPhase === 'checking';
  });

  readonly canSubmit = computed(() => {
    const description = this.description().trim();
    return !this.loading() && description.length >= 3 && this.selectedZones().size > 0;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalCount();
    if (!total) return 0;
    return Math.round((this.checkedCount() / total) * 100);
  });

  readonly grouped = computed<ZoneGroup[]>(() => {
    const domains = this.freeDomains();
    const byZone = new Map<Zone, AvailableDomain[]>();
    for (const zone of DEFAULT_ZONES) byZone.set(zone, []);
    for (const domain of domains) byZone.get(domain.zone)?.push(domain);
    return [...byZone.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([zone, list]) => ({ zone, list }));
  });

  toggleZone(zone: Zone, checked: boolean) {
    const next = new Set(this.selectedZones());
    if (checked) next.add(zone);
    else next.delete(zone);
    this.selectedZones.set(next);
  }

  isZoneSelected(zone: Zone): boolean {
    return this.selectedZones().has(zone);
  }

  async start() {
    if (!this.canSubmit()) return;
    this.phase.set('generating');
    this.error.set(null);
    this.checkedCount.set(0);
    this.totalCount.set(0);
    this.freeDomains.set([]);

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: this.description().trim(),
          zones: [...this.selectedZones()],
        }),
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server error ${response.status}`);
      }

      for await (const sseEvent of readSseEvents(response.body)) {
        this.handleEvent(sseEvent.event, sseEvent.data);
      }
      if (this.phase() !== 'error') this.phase.set('done');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unexpected error');
      this.phase.set('error');
    }
  }

  private handleEvent(eventName: string, data: string) {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    switch (eventName) {
      case 'start': {
        const startPayload = payload as { zones: Zone[] };
        this.totalCount.set(CANDIDATE_COUNT * startPayload.zones.length);
        break;
      }
      case 'candidates': {
        this.phase.set('checking');
        break;
      }
      case 'check': {
        const checkPayload = payload as CheckEvent;
        this.checkedCount.set(checkPayload.checked);
        this.totalCount.set(checkPayload.total);
        if (checkPayload.available === true) {
          this.freeDomains.update((list) => [
            ...list,
            {
              fqdn: checkPayload.fqdn,
              base: checkPayload.base,
              zone: checkPayload.zone,
              rationale: checkPayload.rationale,
            },
          ]);
        }
        break;
      }
      case 'done': {
        const donePayload = payload as { checked: number; total: number };
        this.checkedCount.set(donePayload.checked);
        this.totalCount.set(donePayload.total);
        break;
      }
      case 'error': {
        const errorPayload = payload as { message: string };
        this.error.set(errorPayload.message);
        this.phase.set('error');
        break;
      }
    }
  }
}
