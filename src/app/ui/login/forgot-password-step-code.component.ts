import { ChangeDetectionStrategy, Component, Injector, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { BaseComponent } from 'app/shared/base.component';
import { UiSharedModule } from 'app/ui/shared/ui-shared.module';

/**
 * Forgot password step: input the code received by e-mail / SMS
 */
@Component({
  selector: 'forgot-password-step-code',
  templateUrl: 'forgot-password-step-code.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [UiSharedModule]
})
export class ForgotPasswordStepCodeComponent extends BaseComponent {
  @Input({ required: true }) form: UntypedFormGroup;

  constructor(injector: Injector) {
    super(injector);
  }
}
