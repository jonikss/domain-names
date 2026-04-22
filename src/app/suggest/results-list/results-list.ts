import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PLATFORM_LABEL } from '../../../api/platforms';
import type { CandidateCard } from '../types';

@Component({
  selector: 'app-results-list',
  standalone: true,
  templateUrl: './results-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsList {
  readonly cards = input.required<CandidateCard[]>();
  readonly platformLabel = PLATFORM_LABEL;
}
