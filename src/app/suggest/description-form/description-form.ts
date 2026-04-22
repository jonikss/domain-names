import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PLATFORM_LABEL, type Platform } from '../../../api/platforms';
import type { Zone } from '../../../api/zones';
import { SuggestService } from '../suggest.service';

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
  readonly platforms = this.service.platforms;
  readonly platformLabel = PLATFORM_LABEL;
  readonly description = this.service.description;
  readonly loading = this.service.loading;
  readonly canSubmit = this.service.canSubmit;

  isZoneSelected(zone: Zone): boolean {
    return this.service.isZoneSelected(zone);
  }

  toggleZone(zone: Zone, checked: boolean) {
    this.service.toggleZone(zone, checked);
  }

  isPlatformSelected(platform: Platform): boolean {
    return this.service.isPlatformSelected(platform);
  }

  togglePlatform(platform: Platform, checked: boolean) {
    this.service.togglePlatform(platform, checked);
  }

  submit() {
    this.service.start();
  }
}
