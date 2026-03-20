import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Host,
  Injector,
  OnInit,
  Optional,
  SkipSelf,
  ViewChild
} from '@angular/core';
import { ControlContainer, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CustomFieldSizeEnum, TimeFieldEnum, TimeInterval } from 'app/api/models';
import { BaseFormFieldComponent } from 'app/shared/base-form-field.component';
import { empty } from 'app/shared/helper';

/**
 * A field that allows to enter a time interval by specifing amount and field (days, months, etc)
 */
@Component({
  selector: 'time-interval-field',
  templateUrl: 'time-interval-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: TimeIntervalFieldComponent, multi: true }]
})
export class TimeIntervalFieldComponent extends BaseFormFieldComponent<TimeInterval> implements OnInit {
  @ViewChild('inputField') private inputRef: ElementRef;

  form: UntypedFormGroup;
  amountControl: UntypedFormControl;

  constructor(
    injector: Injector,
    @Optional() @Host() @SkipSelf() controlContainer: ControlContainer,
    private formBuilder: UntypedFormBuilder
  ) {
    super(injector, controlContainer);
  }

  ngOnInit() {
    super.ngOnInit();

    if (this.fieldSize == null) {
      this.fieldSize = CustomFieldSizeEnum.MEDIUM;
    }

    this.form = this.formBuilder.group(this.defaultValue);

    this.addSub(
      this.form.valueChanges.subscribe(value => {
        if (empty(value.amount)) {
          this.value = null;
        } else {
          this.value = value;
        }
      })
    );
  }

  onValueInitialized(value: TimeInterval) {
    this.form.setValue(value || this.defaultValue);
  }

  get defaultValue(): TimeInterval {
    return {
      amount: null,
      field: TimeFieldEnum.DAYS
    };
  }

  protected getDisabledValue(): string {
    return this.format.formatTimeInterval(this.form.value);
  }

  protected getFocusableControl() {
    return this.inputRef ? this.inputRef.nativeElement : null;
  }
}
