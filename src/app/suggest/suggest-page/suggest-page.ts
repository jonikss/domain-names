import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DescriptionForm } from '../description-form/description-form';
import { ProgressPanel } from '../progress-panel/progress-panel';
import { ResultsList } from '../results-list/results-list';
import { SuggestService } from '../suggest.service';

@Component({
  selector: 'app-suggest-page',
  standalone: true,
  imports: [DescriptionForm, ProgressPanel, ResultsList],
  templateUrl: './suggest-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestPage {
  private readonly service = inject(SuggestService);

  readonly phase = this.service.phase;
  readonly error = this.service.error;
  readonly checkedCount = this.service.checkedCount;
  readonly totalCount = this.service.totalCount;
  readonly progressPercent = this.service.progressPercent;
  readonly freeDomains = this.service.freeDomains;
  readonly grouped = this.service.grouped;
}
