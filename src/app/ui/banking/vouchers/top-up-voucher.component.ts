import { ChangeDetectionStrategy, Component, Injector } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, ValidatorFn, Validators } from '@angular/forms';
import {
  CreateDeviceConfirmation,
  DeviceConfirmationTypeEnum,
  TopUpVoucher,
  VoucherDataForTopUp,
  VoucherGenerationAmountEnum,
  VoucherInitialDataForTransaction,
  VoucherPinOnActivationEnum,
  VoucherTopUpPreview,
  VoucherTransactionResult
} from 'app/api/models';
import { empty, validateBeforeSubmit } from 'app/shared/helper';
import { BaseVoucherTransactionComponent } from 'app/ui/banking/vouchers/base-voucher-transaction.component';
import { BehaviorSubject, Observable } from 'rxjs';

export const PIN_REQUIRED_UNLESS_NOTIFICATION: ValidatorFn = control => {
  const form = control.parent as UntypedFormGroup;
  if (form != null) {
    const value = form.value as TopUpVoucher;
    if (empty(value.email) && empty(value.mobilePhone)) {
      return Validators.required(control);
    }
  }
  return null;
};

@Component({
  selector: 'top-up-voucher',
  templateUrl: './top-up-voucher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopUpVoucherComponent extends BaseVoucherTransactionComponent<VoucherDataForTopUp, VoucherTopUpPreview> {
  VoucherGenerationAmountEnum = VoucherGenerationAmountEnum;

  confirmationPassword = new UntypedFormControl('', Validators.required);
  showSubmit$ = new BehaviorSubject(true);

  customFieldControlsMap: Map<string, UntypedFormControl>;

  pinIsSent: boolean;

  constructor(injector: Injector) {
    super(injector);
  }

  protected getInitialData(user: string): Observable<VoucherInitialDataForTransaction> {
    return this.vouchersService.getVoucherInitialDataForTopUp({ user });
  }

  protected getVoucherTransactionData(params: { user: string; token: string }): Observable<VoucherDataForTopUp> {
    return this.vouchersService.getVoucherDataForTopUp(params);
  }

  protected setupForm(form: UntypedFormGroup, data: VoucherDataForTopUp): void {
    if (data.generationAmount !== VoucherGenerationAmountEnum.GENERATION) {
      form.addControl('amount', new UntypedFormControl(data.amount, Validators.required));
    }
    if (data.isActivation) {
      form.addControl('email', new UntypedFormControl(null));
      form.addControl('mobilePhone', new UntypedFormControl(null));
      if (data.pinOnActivation === VoucherPinOnActivationEnum.INPUT) {
        form.addControl('pin', new UntypedFormControl(null, PIN_REQUIRED_UNLESS_NOTIFICATION));
        form.addControl('pinConfirmation', new UntypedFormControl(null, PIN_REQUIRED_UNLESS_NOTIFICATION));
        form.addControl('checkPinConfirmation', new UntypedFormControl(true));
      }
    }
    form.addControl('voucherCustomValues', this.fieldHelper.customValuesFormGroup(data.voucherCustomFields));

    this.pinIsSent = data.pinOnActivation === VoucherPinOnActivationEnum.SEND;
  }

  protected previewTransaction(params: { user: string; token: string; body: any }): Observable<VoucherTopUpPreview> {
    return this.vouchersService.previewVoucherTopUp(params);
  }

  protected performTransaction(
    preview: VoucherTopUpPreview,
    params: { user: string; token: string; body?: any } & { confirmationPassword: string }
  ): Observable<VoucherTransactionResult> {
    params.confirmationPassword = this.confirmationPassword.value;
    if (preview) {
      params.body = preview.topUp;
    }
    return this.vouchersService.topUpVoucher(params);
  }

  protected validatePerformFromForm(data: VoucherDataForTopUp, form: UntypedFormGroup): boolean {
    return (
      !!validateBeforeSubmit(form) &&
      (!data.confirmationPasswordInput || !!validateBeforeSubmit(this.confirmationPassword))
    );
  }

  protected validatePerformFromPreview(preview: VoucherTopUpPreview): boolean {
    return !preview.confirmationPasswordInput || !!validateBeforeSubmit(this.confirmationPassword);
  }

  get createDeviceConfirmation(): () => CreateDeviceConfirmation {
    return () => ({
      type: DeviceConfirmationTypeEnum.TOP_UP_VOUCHER,
      voucherType: this.preview?.type?.id ?? this.dataForTransaction?.type?.id,
      amount: this.preview?.amount ?? this.dataForTransaction?.amount ?? this.form.value.amount
    });
  }
}
