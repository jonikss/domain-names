import { Injectable, computed, signal } from '@angular/core';
import {
  INITIAL_PLATFORMS,
  PLATFORMS,
  type Platform,
} from '../../api/platforms';
import { CANDIDATE_COUNT, DEFAULT_ZONES, INITIAL_ZONES, type Zone } from '../../api/zones';
import { readSseEvents } from './sse-stream';
import type { AvailableItem, CandidateCard, CheckEvent, Phase } from './types';

@Injectable({ providedIn: 'root' })
export class SuggestService {
  readonly zones = DEFAULT_ZONES;
  readonly platforms = PLATFORMS;
  readonly description = signal('');
  readonly selectedZones = signal<Set<Zone>>(new Set(INITIAL_ZONES));
  readonly selectedPlatforms = signal<Set<Platform>>(new Set(INITIAL_PLATFORMS));
  readonly phase = signal<Phase>('idle');
  readonly error = signal<string | null>(null);
  readonly checkedCount = signal(0);
  readonly totalCount = signal(0);
  readonly freeItems = signal<AvailableItem[]>([]);
  private readonly baseOrder = signal<string[]>([]);
  private readonly rationaleByBase = signal<Map<string, string>>(new Map());
  private readonly segmentsByBase = signal<Map<string, string[]>>(new Map());

  readonly loading = computed(() => {
    const currentPhase = this.phase();
    return currentPhase === 'generating' || currentPhase === 'checking';
  });

  readonly canSubmit = computed(() => {
    const description = this.description().trim();
    const anyTarget = this.selectedZones().size + this.selectedPlatforms().size > 0;
    return !this.loading() && description.length >= 3 && anyTarget;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalCount();
    if (!total) return 0;
    return Math.round((this.checkedCount() / total) * 100);
  });

  readonly cards = computed<CandidateCard[]>(() => {
    const items = this.freeItems();
    const order = this.baseOrder();
    const rationales = this.rationaleByBase();
    const segments = this.segmentsByBase();
    const zoneRank = new Map(DEFAULT_ZONES.map((zone, index) => [zone, index]));
    const platformRank = new Map(PLATFORMS.map((platform, index) => [platform, index]));

    const byBase = new Map<string, CandidateCard>();
    for (const item of items) {
      let card = byBase.get(item.base);
      if (!card) {
        card = {
          base: item.base,
          segments: segments.get(item.base) ?? [item.base],
          rationale: rationales.get(item.base) ?? '',
          zones: [],
          platforms: [],
        };
        byBase.set(item.base, card);
      }
      if (item.target.kind === 'zone') {
        card.zones.push({ zone: item.target.zone, url: item.url });
      } else {
        card.platforms.push({ platform: item.target.platform, url: item.url });
      }
    }

    for (const card of byBase.values()) {
      card.zones.sort((a, b) => (zoneRank.get(a.zone) ?? 0) - (zoneRank.get(b.zone) ?? 0));
      card.platforms.sort(
        (a, b) => (platformRank.get(a.platform) ?? 0) - (platformRank.get(b.platform) ?? 0),
      );
    }

    const cards: CandidateCard[] = [];
    const seen = new Set<string>();
    for (const base of order) {
      const card = byBase.get(base);
      if (card) {
        cards.push(card);
        seen.add(base);
      }
    }
    for (const [base, card] of byBase) {
      if (!seen.has(base)) cards.push(card);
    }
    return cards;
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

  togglePlatform(platform: Platform, checked: boolean) {
    const next = new Set(this.selectedPlatforms());
    if (checked) next.add(platform);
    else next.delete(platform);
    this.selectedPlatforms.set(next);
  }

  isPlatformSelected(platform: Platform): boolean {
    return this.selectedPlatforms().has(platform);
  }

  async start() {
    if (!this.canSubmit()) return;
    this.phase.set('generating');
    this.error.set(null);
    this.checkedCount.set(0);
    const zones = [...this.selectedZones()];
    const platforms = [...this.selectedPlatforms()];
    this.totalCount.set(CANDIDATE_COUNT * (zones.length + platforms.length));
    this.freeItems.set([]);
    this.baseOrder.set([]);
    this.rationaleByBase.set(new Map());
    this.segmentsByBase.set(new Map());

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: this.description().trim(),
          zones,
          platforms,
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
        const startPayload = payload as { zones: Zone[]; platforms: Platform[] };
        const targets = startPayload.zones.length + startPayload.platforms.length;
        this.totalCount.set(CANDIDATE_COUNT * targets);
        break;
      }
      case 'candidates': {
        const payloadCandidates = payload as {
          candidates: Array<{ name: string; segments: string[]; rationale: string }>;
        };
        this.baseOrder.set(payloadCandidates.candidates.map((c) => c.name));
        this.rationaleByBase.set(
          new Map(payloadCandidates.candidates.map((c) => [c.name, c.rationale])),
        );
        this.segmentsByBase.set(
          new Map(payloadCandidates.candidates.map((c) => [c.name, c.segments])),
        );
        this.phase.set('checking');
        break;
      }
      case 'check': {
        const checkPayload = payload as CheckEvent;
        this.checkedCount.set(checkPayload.checked);
        this.totalCount.set(checkPayload.total);
        if (checkPayload.available === true) {
          this.freeItems.update((list) => [
            ...list,
            {
              base: checkPayload.base,
              target: checkPayload.target,
              url: checkPayload.url,
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
