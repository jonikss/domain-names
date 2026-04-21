import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ZoneGroup } from '../types';

@Component({
  selector: 'app-results-list',
  standalone: true,
  templateUrl: './results-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsList {
  readonly groups = input.required<ZoneGroup[]>();
}
