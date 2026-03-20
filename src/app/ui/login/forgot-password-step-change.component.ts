import { ChangeDetectionStrategy, Component, Injector, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { DataForChangeForgottenPassword } from 'app/api/models';
import { BaseComponent } from 'app/shared/base.component';
import { UiSharedModule } from 'app/ui/shared/ui-shared.module';

/**
 * Forgot password step: display the user principals and change password
 */
@Component({
  selector: 'forgot-password-step-change',
  templateUrl: 'forgot-password-step-change.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [UiSharedModule]
})
export class ForgotPasswordStepChangeComponent extends BaseComponent {
  @Input({ required: true }) data: DataForChangeForgottenPassword;
  @Input({ required: true }) form: UntypedFormGroup;

  constructor(injector: Injector) {
    super(injector);
  }
}
