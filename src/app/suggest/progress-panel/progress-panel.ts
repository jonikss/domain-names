import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Phase } from '../types';

@Component({
  selector: 'app-progress-panel',
  standalone: true,
  templateUrl: './progress-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressPanel {
  readonly phase = input.required<Phase>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly progressPercent = input.required<number>();
  readonly freeCount = input.required<number>();
}
