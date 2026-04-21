import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuggestService } from '../suggest.service';
import type { Zone } from '../../../api/zones';

@Component({
  selector: 'app-description-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './description-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescriptionForm {
  private readonly service = inject(SuggestService);

  readonly zones = this.service.zones;
  readonly description = this.service.description;
  readonly loading = this.service.loading;
  readonly canSubmit = this.service.canSubmit;

  isZoneSelected(zone: Zone): boolean {
    return this.service.isZoneSelected(zone);
  }

  toggleZone(zone: Zone, checked: boolean) {
    this.service.toggleZone(zone, checked);
  }

  submit() {
    this.service.start();
  }
}
