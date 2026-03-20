import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Injector,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import {
  AvailabilityEnum,
  CustomField,
  FieldSection,
  Image,
  StoredFile,
  UserCustomFieldDetailed,
  UserDataForNew
} from 'app/api/models';
import { ImagesService } from 'app/api/services/images.service';
import { FieldHelperService } from 'app/core/field-helper.service';
import { BaseComponent } from 'app/shared/base.component';
import { empty } from 'app/shared/helper';
import { UserHelperService } from 'app/ui/core/user-helper.service';
import { BehaviorSubject, Observable, of } from 'rxjs';

/**
 * Public registration step: fill in the profile fields
 */
@Component({
  selector: 'registration-step-fields',
  templateUrl: 'registration-step-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationStepFieldsComponent extends BaseComponent implements OnInit {
  @Input() data: UserDataForNew;
  @Input() form: UntypedFormGroup;
  @Input() mobileForm: UntypedFormGroup;
  @Input() landLineForm: UntypedFormGroup;
  @Input() addressForm: UntypedFormGroup;
  @Input() defineAddress: UntypedFormControl;
  @Input() imageControl: UntypedFormControl;
  @Input() fromExternalPayment: boolean;
  @Output() imageUploaded = new EventEmitter<Image>();
  @Output() imageRemoved = new EventEmitter<Image>();
  @Output() customImagesUploaded = new EventEmitter<Image[]>();
  @Output() customFilesUploaded = new EventEmitter<StoredFile[]>();

  editableFields: Set<string>;
  managePrivacyFields: Set<string>;
  fieldsWithoutSection: Array<UserCustomFieldDetailed>;
  fieldsWithSection = new Map<FieldSection, UserCustomFieldDetailed[]>();

  image$ = new BehaviorSubject<Image>(null);
  @Input() get image(): Image {
    return this.image$.value;
  }
  set image(image: Image) {
    this.image$.next(image);
  }

  constructor(
    injector: Injector,
    private userHelper: UserHelperService,
    private imagesService: ImagesService,
    public changeDetector: ChangeDetectorRef,
    private fieldHelper: FieldHelperService
  ) {
    super(injector);
  }

  ngOnInit() {
    super.ngOnInit();

    // Cache the field actions to avoid having to calculate every time
    this.editableFields = this.userHelper.fieldNamesByAction(this.data, 'edit');
    this.managePrivacyFields = this.userHelper.fieldNamesByAction(this.data, 'managePrivacy');

    const fields = Array.from(this.data.customFields.values());
    this.fieldsWithoutSection = fields.filter(field => field.section == null) || [];
    const sections = new Map();
    fields
      .map(v => v.section)
      .forEach(s => {
        if (s != null) {
          sections.set(s.id, s);
        }
      });
    sections.forEach(s => {
      const filter = fields.filter(field => field.section != null && field.section.id === s.id);
      if (!empty(filter)) {
        filter.forEach(cf => {
          if (this.canEdit(cf)) {
            this.fieldsWithSection.set(s, filter);
          }
        });
      }
    });
  }

  get mobileAvailability(): AvailabilityEnum {
    return this.data.phoneConfiguration.mobileAvailability;
  }

  get landLineAvailability(): AvailabilityEnum {
    return this.data.phoneConfiguration.landLineAvailability;
  }

  get addressAvailability(): AvailabilityEnum {
    return this.data.addressConfiguration.availability;
  }

  get imageAvailability(): AvailabilityEnum {
    return this.data.imageConfiguration.availability;
  }

  onUploadDone(image: Image) {
    // First remove any previous image, then emit that a new image is uploaded
    this.addSub(
      this.doRemoveImage().subscribe(() => {
        this.image = image;
        this.imageControl.setValue(this.image.id);
        this.imageUploaded.emit(this.image);
        this.changeDetector.detectChanges();
      })
    );
  }

  removeImage() {
    this.addSub(this.doRemoveImage().subscribe());
  }

  private doRemoveImage(): Observable<Image> {
    this.imageControl.setValue(null);
    if (this.image) {
      const result = this.image;
      return this.errorHandler.requestWithCustomErrorHandler(() => {
        return new Observable(obs => {
          this.imagesService.deleteImage({ id: this.image.id }).subscribe(() => {
            this.imageRemoved.emit(this.image);
            this.image = null;
            this.changeDetector.detectChanges();
            obs.next(result);
          });
        });
      });
    } else {
      return of(null);
    }
  }

  canEdit(field: string | CustomField): boolean {
    return this.editableFields.has(this.fieldHelper.fieldName(field));
  }

  canManagePrivacy(field: string | CustomField): boolean {
    return this.managePrivacyFields.has(this.fieldHelper.fieldName(field));
  }
}
