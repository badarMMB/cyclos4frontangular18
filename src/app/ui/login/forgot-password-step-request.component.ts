import { ChangeDetectionStrategy, Component, Injector, Input, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { DataForLogin, PrincipalTypeInput } from 'app/api/models';
import { BaseComponent } from 'app/shared/base.component';
import { UiSharedModule } from 'app/ui/shared/ui-shared.module';

/**
 * Forgot password step: send the request
 */
@Component({
  selector: 'forgot-password-step-request',
  templateUrl: 'forgot-password-step-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [UiSharedModule]
})
export class ForgotPasswordStepRequestComponent extends BaseComponent implements OnInit {
  @Input({ required: true }) data: DataForLogin;
  @Input({ required: true }) form: UntypedFormGroup;

  principalTypes: PrincipalTypeInput[];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit() {
    super.ngOnInit();
    this.principalTypes = [...(this.data.extraForgotPasswordPrincipalTypes || []), ...(this.data.principalTypes || [])];
  }
}
