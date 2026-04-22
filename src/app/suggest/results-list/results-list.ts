import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PLATFORM_LABEL } from '../../../api/platforms';
import type { ResultGroup } from '../types';

@Component({
  selector: 'app-results-list',
  standalone: true,
  templateUrl: './results-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsList {
  readonly groups = input.required<ResultGroup[]>();
  readonly platformLabel = PLATFORM_LABEL;

  trackGroup(_index: number, group: ResultGroup): string {
    return group.kind === 'zone' ? `z:${group.zone}` : `p:${group.platform}`;
  }
}
