import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Injector, OnInit } from '@angular/core';
import {
  AccountWithStatus,
  AdKind,
  BasicProfileFieldEnum,
  Currency,
  FieldSection,
  PhoneKind,
  PhoneView,
  RoleEnum,
  User,
  UserCustomField,
  UserImportedFileKind,
  UserProfileSectionEnum,
  UserRelationshipEnum,
  UserView
} from 'app/api/models';
import { ContactsService } from 'app/api/services/contacts.service';
import { UsersService } from 'app/api/services/users.service';
import { ValidationService } from 'app/api/services/validation.service';
import { ErrorStatus } from 'app/core/error-status';
import { SvgIcon } from 'app/core/svg-icon';
import { HeadingAction } from 'app/shared/action';
import { ApiHelper } from 'app/shared/api-helper';
import { empty } from 'app/shared/helper';
import { MapsService } from 'app/ui/core/maps.service';
import { RecordHelperService } from 'app/ui/core/records-helper.service';
import { RunOperationHelperService } from 'app/ui/core/run-operation-helper.service';
import { TokenHelperService } from 'app/ui/core/token-helper.service';
import { UserHelperService } from 'app/ui/core/user-helper.service';
import { WizardHelperService } from 'app/ui/core/wizard-helper.service';
import { BaseViewPageComponent } from 'app/ui/shared/base-view-page.component';
import { Menu } from 'app/ui/shared/menu';
import { BehaviorSubject } from 'rxjs';

type BudgetStatus = NonNullable<AccountWithStatus['status']> & {
  upperLimit?: string;
};

interface FormattedBudgetAmountParts {
  prefix: string;
  value: string;
  suffix: string;
}

const PROJECT_ACCOUNT_TYPES = [
  'achatsMarchandises',
  'indemnitesPersonnelAuxiliaire',
  'TitresRestaurantPersonnel',
  'titresCommunication'
] as const;

/**
 * Displays an user profile
 */
@Component({
  selector: 'view-profile',
  templateUrl: 'view-profile.component.html',
  styleUrls: ['view-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewProfileComponent extends BaseViewPageComponent<UserView> implements OnInit {
  constructor(
    injector: Injector,
    private usersService: UsersService,
    private validationService: ValidationService,
    private contactsService: ContactsService,
    private runOperationHelper: RunOperationHelperService,
    private wizardHelper: WizardHelperService,
    private recordHelper: RecordHelperService,
    private tokenHelper: TokenHelperService,
    public maps: MapsService,
    public userHelper: UserHelperService
  ) {
    super(injector);
  }

  param: string;
  mobilePhone: PhoneView;
  landLinePhone: PhoneView;
  mobilePhones: PhoneView[];
  landLinePhones: PhoneView[];
  imageEnabled: boolean;

  showActions$ = new BehaviorSubject(false);
  bankingActions: HeadingAction[] = [];
  managementActions: HeadingAction[] = [];

  fieldsWithoutSection: Array<UserCustomField>;
  fieldsWithSection = new Map<FieldSection, UserCustomField[]>();
  activeModal: AccountWithStatus = null;
  totalCollected = 0;
  totalGoal = 0;
  globalPercent = 0;
  globalPercentText = '0%';
  displayCurrency: Currency;
  isProjectProfile = false;
  projectAccounts: AccountWithStatus[] = [];

  get user(): UserView {
    return this.data;
  }

  ngOnInit() {
    super.ngOnInit();
    this.stateManager.manageValue(this.showActions$, 'showActions');
    this.param = this.route.snapshot.params.user || ApiHelper.SELF;
    this.errorHandler.requestWithCustomErrorHandler(defaultHandling => {
      this.addSub(
        this.usersService.viewUser({ user: this.param }).subscribe(
          user => {
            this.data = user;
          },
          (resp: HttpErrorResponse) => {
            if (resp.status === ErrorStatus.NOT_FOUND && this.dataForFrontendHolder.user == null) {
              // When not logged in and got a not found, redirect to login
              this.login.goToLoginPage(this.router.url);
            } else if ([ErrorStatus.FORBIDDEN, ErrorStatus.UNAUTHORIZED].includes(resp.status)) {
              this.notification.error(this.i18n.user.profile.noPermission);
              this.breadcrumb.back();
              this.data = {};
            } else {
              defaultHandling(resp);
            }
          }
        )
      );
    });
  }

  onDataInitialized(user: UserView) {
    this.fieldsWithSection.clear();
    this.bankingActions = [];
    this.managementActions = [];
    this.activeModal = null;
    const enabledFields = user.enabledProfileFields;
    this.imageEnabled = enabledFields == null || enabledFields.includes(BasicProfileFieldEnum.IMAGE);
    const accounts = user.accounts || [];
    this.projectAccounts = accounts.filter(acc => this.isProjectAccount(acc) && !!acc.status);
    this.isProjectProfile = this.projectAccounts.length > 0;
    this.calculateFinancing(this.projectAccounts);

    // We'll show the phones either as single or multiple
    this.mobilePhones = user.phones.filter(p => p.type === PhoneKind.MOBILE);
    this.landLinePhones = user.phones.filter(p => p.type === PhoneKind.LAND_LINE);
    if (this.mobilePhones.length === 1) {
      this.mobilePhone = this.mobilePhones[0];
      this.mobilePhones = [];
    }
    if (this.landLinePhones.length === 1) {
      this.landLinePhone = this.landLinePhones[0];
      this.landLinePhones = [];
    }

    const operator = user.role === RoleEnum.OPERATOR;

    // Get the actions
    const permissions = user.permissions || {};
    const profile = permissions.profile || {};
    const passwords = permissions.passwords || {};
    const identityProviders = permissions.identityProviders || {};
    const accountTypes = (permissions.accounts || []).map(a => a.type);
    const accountVisibilitySettings = permissions.accountVisibilitySettings || {};
    const contact = permissions.contact || {};
    const payment = permissions.payment || {};
    const scheduledPayments = permissions.scheduledPayments || {};
    const authorizedPayments = permissions.authorizedPayments || {};
    const paymentRequests = permissions.paymentRequests || {};
    const externalPayments = permissions.externalPayments || {};
    const tickets = permissions.tickets || {};
    const marketplace = permissions.marketplace || {};
    const simpleAds = marketplace.simple || {};
    const webshop = marketplace.webshop || {};
    const notificationSettings = permissions.notificationSettings || {};
    const status = permissions.status || {};
    const group = permissions.group || {};
    const agreements = permissions.agreements || {};
    const operators = permissions.operators || {};
    const brokering = permissions.brokering || {};
    const vouchers = permissions.vouchers || {};
    const documents = permissions.documents || {};
    const tokens = permissions.tokens || [];
    const products = permissions.products || {};
    const messages = permissions.messages || {};
    const quickAccess = permissions.quickAccess || {};
    const imports = permissions.imports || {};

    const manager = [
      UserRelationshipEnum.ADMINISTRATOR,
      UserRelationshipEnum.BROKER,
      UserRelationshipEnum.OWNER
    ].includes(user.relationship);

    const customValues = user.customValues || [];
    this.fieldsWithoutSection = customValues.filter(v => v.field.section == null) || [];
    const sections = new Map();
    customValues
      .map(v => v.field.section)
      .forEach(s => {
        if (s != null) {
          sections.set(s.id, s);
        }
      });
    sections.forEach(s => {
      const filter = customValues.filter(v => v.field.section != null && v.field.section.id === s.id);
      if (!empty(filter)) {
        this.fieldsWithSection.set(s, filter);
      }
    });

    if (user.relationship === UserRelationshipEnum.SELF) {
      // For the own user, we just show the edit or privacy settings as a top-level actions
      const headingActions: HeadingAction[] = [];
      const myPermissions = this.dataForFrontendHolder.auth?.permissions || {};
      if (myPermissions.privacySettings?.view) {
        headingActions.push(
          new HeadingAction(
            SvgIcon.EyeSlash,
            this.i18n.user.profile.privacySettings,
            () => {
              this.router.navigate(['/users', this.param, 'privacy-settings']);
            },
            true
          )
        );
      }
      if (myPermissions.myProfile?.editProfile || myPermissions.myProfile?.manageContactInfos) {
        const edit = new HeadingAction(
          SvgIcon.Pencil,
          this.i18n.general.edit,
          () => {
            this.router.navigateByUrl(this.router.url + '/edit');
          },
          true
        );
        headingActions.push(edit);
      }
      this.headingActions = headingActions;
    } else {
      // For others, will have actions in sections
      if (accountTypes.length > 6) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2, this.i18n.user.profile.accountsSummary, () => {
            this.router.navigate(['/banking', this.param, 'accounts-summary']);
          })
        );
      } else {
        for (const accountType of accountTypes) {
          this.bankingActions.push(
            new HeadingAction(SvgIcon.Wallet2, this.i18n.user.profile.viewAccount(accountType.name), () => {
              this.router.navigate(['/banking', this.param, 'account', ApiHelper.internalNameOrId(accountType)]);
            })
          );
        }
      }
      if (accountVisibilitySettings.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Eye, this.i18n.user.profile.accountVisibility, () => {
            this.router.navigate(['/banking', this.param, 'account-visibility']);
          })
        );
      }
      if (payment.userToUser) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowRight, this.i18n.user.profile.pay, () => {
            this.router.navigate(['/banking', ApiHelper.SELF, 'payment', this.param]);
          })
        );
      }
      if (payment.systemToUser) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowRight, this.i18n.user.profile.paySystemToUser, () => {
            this.router.navigate(['/banking', ApiHelper.SYSTEM, 'payment', this.param]);
          })
        );
      }
      if (payment.asUserToUser) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowRight, this.i18n.user.profile.payAsUserToUser, () => {
            this.router.navigate(['/banking', this.param, 'payment']);
          })
        );
      }
      if (payment.asUserToSelf) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowLeftRight, this.i18n.user.profile.payAsUserToSelf, () => {
            this.router.navigate(['/banking', this.param, 'payment', ApiHelper.SELF]);
          })
        );
      }
      if (payment.asUserToSystem) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowRight, this.i18n.user.profile.payAsUserToSystem, () => {
            this.router.navigate(['/banking', this.param, 'payment', ApiHelper.SYSTEM]);
          })
        );
      }
      if (imports.kinds?.includes(UserImportedFileKind.USER_PAYMENTS)) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.ArrowUpCircle, this.i18n.user.profile.batchPayments, () => {
            this.router.navigate(['/imports', this.param, UserImportedFileKind.USER_PAYMENTS, 'files']);
          })
        );
      }
      if (scheduledPayments.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Clock, this.i18n.user.profile.viewScheduledPayments, () => {
            this.router.navigate(['/banking', this.param, 'installments']);
          })
        );
      }
      if (paymentRequests.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowLeft, this.i18n.user.profile.paymentRequests, () => {
            this.router.navigate(['/banking', this.param, 'payment-requests']);
          })
        );
      }
      if (paymentRequests.sendFromUser) {
        const label = manager ? this.i18n.user.profile.requestPayment : this.i18n.user.profile.requestPayment;
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowLeft, label, () => {
            this.router.navigate(['/banking', ApiHelper.SELF, 'payment-request', this.param]);
          })
        );
      }
      if (externalPayments.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2ArrowUpRight, this.i18n.user.profile.externalPayments, () => {
            this.router.navigate(['/banking', this.param, 'external-payments']);
          })
        );
      }

      if (tickets.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Wallet2Check, this.i18n.user.profile.tickets, () => {
            this.router.navigate(['/banking', this.param, 'tickets']);
          })
        );
      }

      const balanceLimitsPermissions = permissions.balanceLimits || {};
      if (balanceLimitsPermissions.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.ArrowDownUp, this.i18n.user.profile.accountsBalanceLimits, () => {
            this.router.navigate(['/banking', this.param, 'account-balance-limits']);
          })
        );
      }
      const paymentLimitsPermissions = permissions.paymentLimits || {};
      if (paymentLimitsPermissions.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.ArrowDownUp, this.i18n.user.profile.accountsPaymentLimits, () => {
            this.router.navigate(['/banking', this.param, 'account-payment-limits']);
          })
        );
      }
      if (authorizedPayments.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.CheckCircle, this.i18n.user.profile.viewAuthorizedPayments, () => {
            this.router.navigate(['/banking', this.param, 'authorized-payments']);
          })
        );
      }
      if (vouchers.view) {
        this.bankingActions.push(
          new HeadingAction(SvgIcon.Ticket, this.i18n.user.profile.vouchers, () => {
            this.router.navigate(['/banking', this.param, 'vouchers']);
          })
        );
        if (vouchers.buy) {
          this.bankingActions.push(
            new HeadingAction(SvgIcon.TicketArrowLeft, this.i18n.user.profile.voucherBuy, () => {
              this.router.navigate(['/banking', this.param, 'vouchers', 'buy']);
            })
          );
        }
        if (vouchers.send) {
          this.bankingActions.push(
            new HeadingAction(SvgIcon.TicketArrowRight, this.i18n.user.profile.voucherSend, () => {
              this.router.navigate(['/banking', this.param, 'vouchers', 'send']);
            })
          );
        }
      }
      if (vouchers.viewTransactions) {
        const voucherTransactionsLabel = vouchers.topUpEnabled
          ? this.i18n.user.profile.voucherTransactions
          : this.i18n.user.profile.voucherTransactionsRedeems;
        this.bankingActions.push(
          new HeadingAction(SvgIcon.TicketDetailed, voucherTransactionsLabel, () => {
            this.router.navigate(['/banking', this.param, 'voucher-transactions']);
          })
        );
        if (vouchers.redeem) {
          this.bankingActions.push(
            new HeadingAction(SvgIcon.TicketArrowDown, this.i18n.user.profile.voucherRedeem, () => {
              this.router.navigate(['/banking', this.param, 'vouchers', 'redeem']);
            })
          );
        }
        if (vouchers.topUp) {
          this.bankingActions.push(
            new HeadingAction(SvgIcon.TicketArrowUp, this.i18n.user.profile.voucherTopUp, () => {
              this.router.navigate(['/banking', this.param, 'vouchers', 'top-up']);
            })
          );
        }
      }
      if (profile.editProfile || profile.manageContactInfos) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Pencil, this.i18n.user.profile.edit, () => {
            this.router.navigateByUrl(this.router.url + '/edit');
          })
        );
      }
      if (passwords.manage) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Key, this.i18n.user.profile.managePasswords, () => {
            this.router.navigate(['/users', this.param, 'passwords']);
          })
        );
      }
      if (identityProviders.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonBadge, this.i18n.user.profile.viewIdentityProviders, () => {
            this.router.navigate(['/users', this.param, 'identity-providers']);
          })
        );
      }

      const validation = permissions.validation || {};
      if (validation.resendEmailChange) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.EnvelopeCheck, this.i18n.user.profile.resendEmailChange, () => {
            this.addSub(
              this.validationService
                .resendEmailChangeEmail({ user: this.param })
                .subscribe(() => this.notification.snackBar(this.i18n.user.profile.resendEmailChangeDone))
            );
          })
        );
      }
      if (validation.validateEmailChange) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Check2, this.i18n.user.profile.validateEmailChange, () => {
            this.addSub(
              this.validationService.manuallyValidateEmailChange({ user: this.param }).subscribe(() => {
                this.reload();
                this.notification.snackBar(this.i18n.user.profile.validateEmailChangeDone);
              })
            );
          })
        );
      }

      if (validation.resendRegistrationValidation) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.EnvelopeCheck, this.i18n.user.profile.resendRegistrationValidation, () => {
            this.addSub(
              this.validationService
                .resendUserRegistrationEmail({ user: this.param })
                .subscribe(() => this.notification.snackBar(this.i18n.user.profile.resendRegistrationValidationDone))
            );
          })
        );
      }
      if (validation.validateRegistration) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Check2, this.i18n.user.profile.validateRegistration, () => {
            this.addSub(
              this.validationService.manuallyValidateUserRegistration({ user: this.param }).subscribe(() => {
                this.reload();
                this.notification.snackBar(this.i18n.user.profile.validateRegistrationDone);
              })
            );
          })
        );
      }

      if (profile.physicallyRemove) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Trash, this.i18n.user.profile.remove, () => {
            this.confirmation.confirm({
              message: this.i18n.general.removeConfirm(user.display),
              callback: () =>
                this.addSub(
                  this.usersService.deletePendingUser({ user: this.param }).subscribe(() => {
                    if (this.breadcrumb.empty || this.breadcrumb.breadcrumb$.value.length === 1) {
                      this.router.navigate(['/users', 'search']);
                    } else {
                      this.breadcrumb.back();
                    }
                    this.notification.snackBar(this.i18n.general.removeDone(user.display));
                  })
                )
            });
          })
        );
      }

      if (status.view) {
        this.managementActions.push(
          new HeadingAction(
            SvgIcon.PersonCheck,
            operator ? this.i18n.user.profile.statusOperator : this.i18n.user.profile.statusUser,
            () => {
              this.router.navigate(['/users', this.param, 'status']);
            }
          )
        );
      }
      if (group.view) {
        this.managementActions.push(
          new HeadingAction(
            SvgIcon.People,
            operator ? this.i18n.user.profile.groupOperator : this.i18n.user.profile.groupUser,
            () => {
              this.router.navigate(['/users', this.param, 'group']);
            }
          )
        );
      }
      if (agreements.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.UiChecks, this.i18n.user.profile.agreements, () => {
            this.router.navigate(['/users', this.param, 'agreements']);
          })
        );
      }
      if (brokering.viewMembers) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonSquareOutline, this.i18n.user.profile.viewBrokerings, () => {
            this.router.navigate(['/users', this.param, 'brokerings']);
          })
        );
      }
      if (brokering.viewBrokers) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonSquareOutline, this.i18n.user.profile.viewBrokers, () => {
            this.router.navigate(['/users', this.param, 'brokers']);
          })
        );
      }
      if (operators.viewOperators) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonCircleOutline, this.i18n.user.profile.viewOperators, () => {
            this.router.navigate(['/users', this.param, 'operators']);
          })
        );
      }
      if (operators.viewGroups) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.People, this.i18n.user.profile.viewOperatorGroups, () => {
            this.router.navigate(['/users', this.param, 'operator-groups']);
          })
        );
      }
      if (products.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Shield, this.i18n.user.profile.products, () => {
            this.router.navigate(['/users', this.param, 'product-assignment']);
          })
        );
      }
      if (contact.add) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonPlus, this.i18n.user.profile.addContact, () => {
            this.addContact();
          })
        );
      }
      if (contact.remove) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.PersonDash, this.i18n.user.profile.removeContact, () => {
            this.removeContact();
          })
        );
      }
      if (messages.send) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Envelope, this.i18n.user.profile.sendMessage, () => {
            this.router.navigate(['/users', 'messages', 'send'], { queryParams: { to: this.param } });
          })
        );
      }
      if (simpleAds.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Basket, this.i18n.user.profile.viewAds, () => {
            this.router.navigate(['/marketplace', this.param, AdKind.SIMPLE, 'list']);
          })
        );
      }
      if (webshop.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Basket, this.i18n.user.profile.viewWebshop, () => {
            this.router.navigate(['/marketplace', this.param, AdKind.WEBSHOP, 'list']);
          })
        );
      }
      if (webshop.viewPurchases) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Bag2, this.i18n.user.profile.purchases, () => {
            this.router.navigate(['/marketplace', this.param, 'purchases']);
          })
        );
      }
      if (webshop.viewSales) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Receipt, this.i18n.user.profile.sales, () => {
            this.router.navigate(['/marketplace', this.param, 'sales']);
          })
        );
      }
      if (marketplace.viewInterests) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Star, this.i18n.user.profile.adInterests, () => {
            this.router.navigate(['/marketplace', this.param, 'ad-interests']);
          })
        );
      }
      if (marketplace.viewFavorites) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Heart, this.i18n.user.profile.favoriteAds, () => {
            this.router.navigate(['/marketplace', this.param, 'list-favorites']);
          })
        );
      }
      if (webshop.viewSettings) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Truck, this.i18n.user.profile.deliveryMethods, () => {
            this.router.navigate(['/marketplace', this.param, 'delivery-methods']);
          })
        );
        this.managementActions.push(
          new HeadingAction(SvgIcon.Gear, this.i18n.user.profile.webshopSettings, () => {
            this.router.navigate(['/marketplace', this.param, 'webshop-settings', 'view']);
          })
        );
      }
      for (const token of tokens) {
        this.managementActions.push(
          new HeadingAction(this.tokenHelper.icon(token.type), token.type.pluralName, () => {
            this.router.navigate(['/users', this.param, 'tokens', token.type.id]);
          })
        );
      }
      if (notificationSettings.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.BellSlash, this.i18n.user.profile.notificationSettings, () => {
            this.router.navigate(['/users', this.param, 'notification-settings']);
          })
        );
      }
      if (permissions.privacySettings?.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.EyeSlash, this.i18n.user.profile.privacySettings, () => {
            this.router.navigate(['/users', this.param, 'privacy-settings']);
          })
        );
      }
      // References
      if (permissions.references?.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Star, this.i18n.user.profile.references, () => {
            this.router.navigate(['/users', this.param, 'references', 'search']);
          })
        );
      }
      // Quick access
      if (quickAccess.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Grid2, this.i18n.user.profile.quickAccess, () => {
            this.router.navigate(['/users', this.param, 'quick-access', 'settings']);
          })
        );
      }
      // Feedbacks
      if (permissions.paymentFeedbacks?.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.Award, this.i18n.user.profile.feedbacks, () => {
            this.router.navigate(['/users', this.param, 'feedbacks', 'search']);
          })
        );
      }
      // Documents
      if (documents.view) {
        this.managementActions.push(
          new HeadingAction(SvgIcon.FileEarmarkText, this.i18n.document.action(user.documents?.count), () => {
            this.router.navigate(['/users', this.param, 'documents', 'search']);
          })
        );
      }
      // Records
      for (const record of permissions.records || []) {
        const type = record.type;
        const addTo =
          type.userProfileSection === UserProfileSectionEnum.BANKING ? this.bankingActions : this.managementActions;
        const icon = this.recordHelper.icon(type);
        const recordDetails = user.records[type.id] || user.records[type.internalName];
        addTo.push(
          new HeadingAction(
            icon,
            this.i18n.record.action({ type: type.pluralName, count: recordDetails?.count }),
            () => {
              this.router.navigateByUrl(this.recordHelper.resolvePath(record, this.param));
            }
          )
        );
      }
      // Custom operations
      for (const operation of permissions.operations || []) {
        const addTo =
          operation.userProfileSection === UserProfileSectionEnum.BANKING
            ? this.bankingActions
            : this.managementActions;
        addTo.push(this.runOperationHelper.headingAction(operation, user.id));
      }
      // Wizards
      for (const wizard of permissions.wizards || []) {
        const addTo =
          wizard.userProfileSection === UserProfileSectionEnum.BANKING ? this.bankingActions : this.managementActions;
        addTo.push(this.wizardHelper.headingAction(wizard, user.id));
      }
      const actionsCount = this.bankingActions.length + this.managementActions.length;
      if (actionsCount > 0) {
        if (manager) {
          if (this.bankingActions.length < 10 && this.managementActions.length < 10) {
            // when there are less than 10 options per category, show the actions directly
            this.showActions$.next(true);
          } else {
            this.updateHeadingActions();
          }
        } else {
          this.headingActions = [...this.bankingActions, ...this.managementActions];
        }
      }
    }
  }

  referencesPath() {
    return ['/users', this.param, 'references', 'search'];
  }

  feedbackPath() {
    return ['/users', this.param, 'feedbacks', 'search'];
  }

  private updateHeadingActions() {
    const show = !this.showActions$.value;
    const icon = show ? SvgIcon.FilePlay : SvgIcon.FileX;
    const label = show ? this.i18n.user.profile.showActions : this.i18n.user.profile.hideActions;
    const headingAction = new HeadingAction(
      icon,
      label,
      () => {
        this.showActions$.next(show);
        this.updateHeadingActions();
      },
      true
    );
    this.headingActions = [headingAction];
  }

  private addContact(): any {
    this.addSub(
      this.contactsService
        .createContact({
          user: ApiHelper.SELF,
          body: {
            contact: this.user.id
          }
        })
        .subscribe(() => {
          this.notification.snackBar(this.i18n.user.profile.addContactDone(this.user.name || this.user.display));
          this.reload();
        })
    );
  }

  private removeContact(): any {
    this.addSub(
      this.contactsService.deleteContact({ id: this.user.contact.id }).subscribe(() => {
        this.notification.snackBar(this.i18n.user.profile.removeContactDone(this.user.name || this.user.display));
        this.reload();
      })
    );
  }

  get myProfile(): boolean {
    return !!this.user && (this.login.user || {}).id === this.user.id;
  }

  get title(): string {
    return this.myProfile ? this.i18n.user.title.myProfile : this.user.name || this.user.display;
  }

  get mobileTitle(): string {
    return this.myProfile ? this.i18n.user.mobileTitle.myProfile : this.i18n.user.mobileTitle.userProfile;
  }

  /**
   * Will show the activation date when it is different than the registration date
   */
  get showActivationDate(): boolean {
    return (
      this.user.activationDate &&
      this.format.formatAsDate(this.user.activationDate) !== this.format.formatAsDate(this.user.registrationDate)
    );
  }

  get showOperatorOwner(): boolean {
    return (
      this.user.role === RoleEnum.OPERATOR &&
      ![UserRelationshipEnum.OWNER, UserRelationshipEnum.SAME_OWNER].includes(this.user.relationship)
    );
  }

  get mainBroker(): User {
    return this.data.brokers?.find(b => b.mainBroker).broker;
  }

  get otherBrokers(): User[] {
    return this.data.brokers?.filter(b => !b.mainBroker).map(b => b.broker);
  }

  openModal(acc: AccountWithStatus) {
    this.activeModal = acc;
  }

  closeModal() {
    this.activeModal = null;
  }

  onModalOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  contribute(acc: AccountWithStatus) {
    if (!acc) {
      return;
    }
    this.closeModal();
    this.router.navigate(['/banking', 'self', 'payment', this.user.id], {
      queryParams: { type: acc.type?.internalName }
    });
  }

  budgetIcon(acc: AccountWithStatus): string {
    const name = (acc?.type?.name || '').toLowerCase();
    if (name.includes('logistique') || name.includes('transport')) {
      return '🚛';
    }
    if (name.includes('achat') || name.includes('livraison') || name.includes('marchandise')) {
      return '🛒';
    }
    if (name.includes('personnel') || name.includes('indemnite') || name.includes('auxiliaire')) {
      return '👥';
    }
    if (name.includes('communication') || name.includes('sensibilisation')) {
      return '📢';
    }
    return '💼';
  }

  budgetLabel(index: number): string {
    return `L${index + 1}`;
  }

  budgetIndex(acc: AccountWithStatus): number {
    const index = this.projectAccounts.findIndex(account => account === acc || account.id === acc?.id);
    return index < 0 ? 0 : index;
  }

  accountCollected(acc: AccountWithStatus): number {
    return this.asNumber(this.budgetStatus(acc)?.balance);
  }

  accountGoal(acc: AccountWithStatus): number {
    const status = this.budgetStatus(acc);
    return this.asNumber(status?.upperLimit ?? status?.upperCreditLimit);
  }

  accountRemaining(acc: AccountWithStatus): number {
    return this.accountGoal(acc) - this.accountCollected(acc);
  }

  accountPercent(acc: AccountWithStatus): number {
    return this.calculatePercent(this.accountCollected(acc), this.accountGoal(acc));
  }

  accountPercentWidth(acc: AccountWithStatus): number {
    return Math.max(0, Math.min(this.accountPercent(acc), 100));
  }

  accountAvailableBalance(acc: AccountWithStatus): number {
    return this.asNumber(this.budgetStatus(acc)?.availableBalance);
  }

  accountPercentText(acc: AccountWithStatus): string {
    const formatted = this.formatPercent(this.accountPercent(acc));
    return this.isAccountComplete(acc) ? `${formatted} ✓` : formatted;
  }

  isAccountComplete(acc: AccountWithStatus): boolean {
    const goal = this.accountGoal(acc);
    return goal > 0 && this.accountCollected(acc) >= goal;
  }

  formatBudgetAmount(amount: number, currency?: Currency): string {
    return this.format.formatAsCurrency(this.resolveCurrency(currency), amount);
  }

  budgetAmountParts(amount: number, currency?: Currency): FormattedBudgetAmountParts {
    return this.formatBudgetAmountParts(amount, currency);
  }

  formatCompactBudgetAmount(amount: number, currency?: Currency): string {
    const resolvedCurrency = this.resolveCurrency(currency);
    const absolute = Math.abs(amount);
    let compact: string;

    if (absolute >= 1000000) {
      compact = `${this.trimTrailingZeros((absolute / 1000000).toFixed(1))}M`;
    } else if (absolute >= 1000) {
      compact = `${this.trimTrailingZeros((absolute / 1000).toFixed(1))}k`;
    } else {
      compact = this.format.formatAsNumber(absolute, resolvedCurrency.decimalDigits || 0);
    }

    return `${resolvedCurrency.prefix || ''}${amount < 0 ? '-' : ''}${compact}${resolvedCurrency.suffix || ''}`;
  }

  compactBudgetAmountParts(amount: number, currency?: Currency): FormattedBudgetAmountParts {
    return this.formatBudgetAmountParts(amount, currency, true);
  }

  modalDeltaLabel(acc: AccountWithStatus): string {
    return this.isAccountComplete(acc) ? 'Surplus' : 'Reste a collecter';
  }

  modalDeltaValue(acc: AccountWithStatus): string {
    const remaining = this.accountRemaining(acc);
    return this.isAccountComplete(acc)
      ? `+${this.formatBudgetAmount(Math.abs(remaining), acc.currency)}`
      : this.formatBudgetAmount(remaining, acc.currency);
  }

  modalDeltaParts(acc: AccountWithStatus): FormattedBudgetAmountParts {
    const remaining = this.accountRemaining(acc);
    return this.isAccountComplete(acc)
      ? this.formatBudgetAmountParts(Math.abs(remaining), acc.currency, false, true)
      : this.formatBudgetAmountParts(remaining, acc.currency);
  }

  budgetDescription(acc: AccountWithStatus): string {
    const name = acc?.type?.name || 'cette ligne budgetaire';
    if (this.isAccountComplete(acc)) {
      return `Objectif atteint pour ${name}.`;
    }
    if ((name || '').toLowerCase().includes('communication')) {
      return `Budget dedie aux campagnes et actions de ${name}.`;
    }
    if ((name || '').toLowerCase().includes('logistique')) {
      return `Budget prioritaire pour assurer ${name}.`;
    }
    return `Budget destine a ${name}.`;
  }

  resolveMenu(user: UserView) {
    switch (user.relationship) {
      case UserRelationshipEnum.SELF:
        return Menu.MY_PROFILE;
      case UserRelationshipEnum.OWNER:
      case UserRelationshipEnum.SAME_OWNER:
        return Menu.MY_OPERATORS;
      case UserRelationshipEnum.BROKER:
        return Menu.MY_BROKERED_USERS;
      default:
        return this.login.user ? Menu.SEARCH_USERS : Menu.PUBLIC_DIRECTORY;
    }
  }

  private budgetStatus(acc: AccountWithStatus): BudgetStatus {
    return (acc?.status || {}) as BudgetStatus;
  }

  private isProjectAccount(acc: AccountWithStatus): boolean {
    return PROJECT_ACCOUNT_TYPES.includes(acc?.type?.internalName as (typeof PROJECT_ACCOUNT_TYPES)[number]);
  }

  private calculateFinancing(accounts: AccountWithStatus[]) {
    this.displayCurrency = this.resolveCurrency(accounts[0]?.currency);
    this.totalCollected = accounts.reduce((sum, acc) => sum + this.accountCollected(acc), 0);
    this.totalGoal = accounts.reduce((sum, acc) => sum + this.accountGoal(acc), 0);
    this.globalPercent = this.calculatePercent(this.totalCollected, this.totalGoal);
    this.globalPercentText = this.formatPercent(this.globalPercent);
  }

  private resolveCurrency(currency?: Currency): Currency {
    return {
      decimalDigits: currency?.decimalDigits == null ? 0 : currency.decimalDigits,
      prefix: currency?.prefix || '',
      suffix: currency?.suffix || ' Fdj',
      ...currency
    };
  }

  private formatBudgetAmountParts(
    amount: number,
    currency?: Currency,
    compact = false,
    forcePlus = false
  ): FormattedBudgetAmountParts {
    const resolvedCurrency = this.resolveCurrency(currency);
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? '-' : forcePlus && amount > 0 ? '+' : '';
    const prefix = (resolvedCurrency.prefix || '').trim();
    const suffix = (resolvedCurrency.suffix || '').trim();
    let value: string;

    if (compact) {
      if (absolute >= 1000000) {
        value = `${this.trimTrailingZeros((absolute / 1000000).toFixed(1))}M`;
      } else if (absolute >= 1000) {
        value = `${this.trimTrailingZeros((absolute / 1000).toFixed(1))}k`;
      } else {
        value = this.format.formatAsNumber(absolute, resolvedCurrency.decimalDigits || 0);
      }
    } else {
      value = this.format.formatAsNumber(absolute, resolvedCurrency.decimalDigits || 0);
    }

    return {
      prefix: prefix ? `${sign}${prefix}` : '',
      value: prefix ? value : `${sign}${value}`,
      suffix
    };
  }

  private asNumber(value: number | string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private calculatePercent(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }
    return Math.round((value / total) * 1000) / 10;
  }

  private formatPercent(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
  }

  private trimTrailingZeros(value: string): string {
    return value.replace(/\.0$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }
}
