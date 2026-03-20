import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Host,
  Injector,
  Input,
  OnInit,
  Optional,
  SkipSelf,
  ViewChild
} from '@angular/core';
import {
  AbstractControl,
  ControlContainer,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';
import { CustomFieldSizeEnum } from 'app/api/models';
import { ISO_DATE } from 'app/core/format.service';
import { LayoutService } from 'app/core/layout.service';
import { BaseFormFieldComponent } from 'app/shared/base-form-field.component';
import { DateConstraint, dateConstraintAsDate } from 'app/shared/date-constraint';
import { empty } from 'app/shared/helper';
import { format as dateFnsFormat, isValid, parseISO } from 'date-fns';

/**
 * Input used to edit a single date
 */
@Component({
  selector: 'date-field',
  templateUrl: 'date-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: DateFieldComponent, multi: true },
    { provide: NG_VALIDATORS, useExisting: DateFieldComponent, multi: true }
  ]
})
export class DateFieldComponent extends BaseFormFieldComponent<string> implements Validator, OnInit, AfterViewChecked {
  @Input() minDate: DateConstraint = 'any';
  @Input() maxDate: DateConstraint = 'any';

  private tempValue: string;

  min: Date;
  max: Date;

  @ViewChild('input') inputRef: ElementRef;

  constructor(
    injector: Injector,
    @Optional() @Host() @SkipSelf() controlContainer: ControlContainer,
    public layout: LayoutService
  ) {
    super(injector, controlContainer);
  }

  setFromDate(date: Date) {
    this.value = this.format.parseAsDate(date);
  }

  get minMomentAsDate() {
    return this.format.formatAsDate(this.max);
  }

  protected getFocusableControl() {
    return ((this.inputRef || {}) as any).nativeElement;
  }

  get valueAsDate(): Date {
    const value = this.value;
    if (empty(value)) {
      return null;
    } else {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed : null;
    }
  }

  set valueAsDate(value: Date) {
    this.value = value && isValid(value) ? dateFnsFormat(value, ISO_DATE) : null;
  }

  get minValue() {
    return this.min && isValid(this.min) ? dateFnsFormat(this.min, ISO_DATE) : '';
  }

  get maxValue() {
    return this.max && isValid(this.max) ? dateFnsFormat(this.max, ISO_DATE) : '';
  }

  ngOnInit() {
    super.ngOnInit();
    if (this.fieldSize == null) {
      this.fieldSize = CustomFieldSizeEnum.MEDIUM;
    }
    const now = this.dataForFrontendHolder.now();
    this.min = dateConstraintAsDate(this.minDate, now);
    this.max = dateConstraintAsDate(this.maxDate, now);
  }

  ngAfterViewChecked() {
    if (this.tempValue) {
      this.onValueInitialized(this.tempValue);
      this.tempValue = null;
    }
  }

  setValue(value: string, notifyChanges = false) {
    super.setValue(value, notifyChanges);
    this.onValueInitialized(value);
  }

  get input(): HTMLInputElement {
    return this.inputRef ? this.inputRef.nativeElement : null;
  }

  onValueInitialized(value: string) {
    const input = this.input;
    if (value) {
      value = value.split('T')[0];
    }
    if (input) {
      input.value = value;
    } else {
      this.tempValue = value;
    }
  }

  protected getDisabledValue(): string {
    return this.format.formatAsDate(this.value);
  }

  // Validator methods
  validate(c: AbstractControl): ValidationErrors {
    const errors: ValidationErrors = {};
    const value = c.value;
    if (empty(value)) {
      // Don't validate empty values
      return null;
    } else if (value === undefined) {
      // The value is already pre-validated with error
      errors.date = true;
    } else {
      var date = new Date(value.substring(0, 10));
      if (isNaN(date.getTime())) {
        errors.date = true;
      } else {
        var min = this.min && isValid(this.min) ? this.min : null;
        if (min && date < min) {
          errors.minDate = {
            min: this.format.formatAsDate(this.min)
          };
        }
        var max = this.max && isValid(this.max) ? this.max : null;
        if (max && date > max) {
          errors.maxDate = {
            max: this.format.formatAsDate(this.max)
          };
        }
      }
    }
    return Object.keys(errors).length === 0 ? null : errors;
  }
}
