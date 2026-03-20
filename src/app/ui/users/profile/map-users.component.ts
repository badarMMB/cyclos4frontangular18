import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Host,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  SkipSelf,
  ViewChild,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { ControlContainer } from '@angular/forms';
import {
  CustomField,
  CustomFieldBinaryValues,
  CustomFieldDetailed,
  CustomFieldValue,
  UserImageKind,
  UserResult
} from 'app/api/models';
import { ImagesService } from 'app/api/services/images.service';
import { UsersService } from 'app/api/services/users.service';
import { NextRequestState } from 'app/core/next-request-state';
import { BaseFormFieldComponent } from 'app/shared/base-form-field.component';
import * as L from 'leaflet';
import 'leaflet-draw';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';

type LayerKind = 'marker' | 'zone';

interface MapFeatureProperties {
  cyclosId?: string;
  displayName?: string;
  photoUrl?: string | null;
  customFields?: Record<string, string>;
  confirmed?: boolean;
  type?: LayerKind;
}

type MapLayer = L.Layer & {
  customData?: MapFeatureProperties;
  toGeoJSON?: (precision?: number | false) => GeoJSON.Feature;
  bindPopup: (content: string | HTMLElement, options?: L.PopupOptions) => L.Layer;
  openPopup: () => L.Layer;
  closePopup: () => L.Layer;
  unbindPopup?: () => L.Layer;
};

const DEFAULT_CENTER = L.latLng(11.5797, 43.1216);
const DEFAULT_ZOOM = 13;
const DEFAULT_ZONE_NAME = "Zone d'action";
const GEOSERVER_WMS_URL = 'http://localhost:8080/geoserver/djibouti_map/wms';

@Component({
  selector: 'map-users',
  standalone: false,
  templateUrl: './map-users.component.html',
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      map-users {
        display: block;
        width: 100%;
      }

      .map-users-wrapper {
        width: 100%;
        display: flex;
        flex-direction: column;
      }

      .map-users-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .map-users-map {
        width: 100%;
        height: 600px;
        border: 1px solid #d8dee6;
        border-radius: 0.375rem;
        overflow: hidden;
        background: #f7f9fc;
      }

      .map-users-banner {
        margin-top: 0.5rem;
        color: #5f6b7a;
        font-size: 0.8125rem;
      }

      .map-users-wrapper .leaflet-container {
        font: inherit;
      }

      .map-users-wrapper .leaflet-draw-toolbar a,
      .map-users-wrapper .leaflet-draw-toolbar a:hover {
        background-image: url('/assets/leaflet-draw/spritesheet.png');
      }

      .leaflet-retina .map-users-wrapper .leaflet-draw-toolbar a,
      .leaflet-retina .map-users-wrapper .leaflet-draw-toolbar a:hover {
        background-image: url('/assets/leaflet-draw/spritesheet-2x.png');
        background-size: 300px 30px;
      }

      .map-users-leaflet-popup .leaflet-popup-content-wrapper {
        border-radius: 0.5rem;
      }

      .map-users-leaflet-popup .leaflet-popup-content {
        margin: 0;
      }

      .map-users-popup {
        min-width: 260px;
        max-width: 340px;
        padding: 0.875rem;
        color: #2f3c48;
      }

      .map-users-popup__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.875rem;
      }

      .map-users-popup__photo {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #2980b9;
        flex: 0 0 auto;
      }

      .map-users-popup__title {
        margin: 0;
        font-size: 1rem;
        line-height: 1.25rem;
        font-weight: 600;
      }

      .map-users-popup__badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        background: #eef4fb;
        color: #2c6a9b;
        font-size: 0.75rem;
        font-weight: 600;
        margin-top: 0.25rem;
      }

      .map-users-popup__section {
        border-top: 1px solid #e4e9f0;
        padding-top: 0.75rem;
        margin-top: 0.75rem;
      }

      .map-users-popup__field {
        display: grid;
        grid-template-columns: minmax(100px, 1fr) 1.4fr;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        align-items: start;
      }

      .map-users-popup__field:last-child {
        margin-bottom: 0;
      }

      .map-users-popup__field-label {
        font-weight: 600;
        color: #455363;
      }

      .map-users-popup__field-value {
        color: #22313f;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .map-users-popup__muted {
        color: #6d7a88;
        font-size: 0.875rem;
      }

      .map-users-popup__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.875rem;
      }

      .map-users-popup__label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 600;
        color: #455363;
      }

      .map-users-popup .form-control {
        margin-bottom: 0.75rem;
      }

      .map-users-popup textarea.form-control {
        resize: vertical;
        min-height: 88px;
      }

      .map-users-popup__results {
        margin-top: 0.75rem;
      }

      .map-users-popup__result {
        display: block;
        width: 100%;
        text-align: left;
        margin-bottom: 0.5rem;
      }

      .map-users-popup__result-subtitle {
        display: block;
        font-size: 0.75rem;
        color: #6d7a88;
        margin-top: 0.125rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapUsersComponent extends BaseFormFieldComponent<string> implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly imagesService = inject(ImagesService);
  private readonly nextRequestState = inject(NextRequestState);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() field: CustomFieldDetailed | CustomField;
  @Input() fieldValue?: CustomFieldValue;
  @Input() binaryValues?: CustomFieldBinaryValues;

  @ViewChild('mapContainer')
  private mapContainer?: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private drawControl: L.Control.Draw | null = null;
  private readonly drawnItems = new L.FeatureGroup();
  private geoServerLayer: L.TileLayer.WMS | null = null;

  constructor(
    injector: Injector,
    @Optional() @Host() @SkipSelf() controlContainer: ControlContainer
  ) {
    super(injector, controlContainer);
  }

  get isEditMode(): boolean {
    const url = this.router.url;
    return /\/users\/[^/]+\/profile\/edit(?:$|[?#])/.test(url) || /\/users\/operators\/[^/]+\/edit(?:$|[?#])/.test(url);
  }

  override ngOnInit(): void {
    if (this.field?.internalName && !this._id) {
      this.id = this.field.internalName;
    }
    if (this.formControl) {
      super.ngOnInit();
    } else {
      this.setValue(this.readStoredHtml(), false);
    }
  }

  ngAfterViewInit(): void {
    if (!this.mapContainer?.nativeElement) {
      return;
    }
    this.initializeMap();
    this.loadGeoData();
    this.syncValidationState();
    setTimeout(() => this.map?.invalidateSize(), 0);
    this.cdr.markForCheck();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null;
    }
    this.drawControl = null;
    this.geoServerLayer = null;
  }

  refreshGeoServer(): void {
    this.geoServerLayer?.setParams({ _cb: Date.now() } as unknown as L.WMSParams, false);
  }

  saveToField(): void {
    if (!this.isEditMode) {
      return;
    }
    this.replaceFieldValue(true);
  }

  protected override getFocusableControl(): HTMLElement | null {
    return this.mapContainer?.nativeElement || null;
  }

  protected override getDisabledValue(): string {
    return this.readStoredHtml();
  }

  private initializeMap(): void {
    this.configureDefaultMarkerIcon();

    this.map = L.map(this.mapContainer!.nativeElement, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      crs: L.CRS.EPSG4326
    });

    this.geoServerLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
      layers: 'djibouti_map:joueravecmacarte',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      crs: L.CRS.EPSG4326
    });

    this.geoServerLayer.addTo(this.map);
    this.drawnItems.addTo(this.map);

    if (this.isEditMode) {
      this.drawControl = new L.Control.Draw({
        edit: {
          featureGroup: this.drawnItems
        },
        draw: {
          marker: {},
          polygon: {},
          rectangle: false,
          polyline: false,
          circle: false,
          circlemarker: false
        }
      });
      this.map.addControl(this.drawControl);
      this.map.on(L.Draw.Event.CREATED, event => this.handleDrawCreated(event as L.DrawEvents.Created));
      this.map.on(L.Draw.Event.EDITED, () => this.onMapStructureChanged());
      this.map.on(L.Draw.Event.DELETED, () => this.onMapStructureChanged());
    }
  }

  private configureDefaultMarkerIcon(): void {
    const baseUrl = new URL('assets/leaflet/', document.baseURI).toString();
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: `${baseUrl}marker-icon-2x.png`,
      iconUrl: `${baseUrl}marker-icon.png`,
      shadowUrl: `${baseUrl}marker-shadow.png`
    });
  }

  private handleDrawCreated(event: L.DrawEvents.Created): void {
    const layer = event.layer as MapLayer;
    const kind = this.layerKind(layer);
    layer.customData = this.normalizeProperties(
      kind === 'zone'
        ? {
            type: 'zone',
            displayName: DEFAULT_ZONE_NAME,
            customFields: {},
            confirmed: true
          }
        : {
            type: 'marker',
            customFields: {},
            confirmed: false
          },
      kind
    );
    this.drawnItems.addLayer(layer);
    this.bindLayerInteractions(layer);
    this.syncValidationState();

    if (kind === 'marker') {
      this.openAssociationPopup(layer);
    } else {
      this.replaceFieldValue();
      this.openZoneEditorPopup(layer);
    }
  }

  private loadGeoData(): void {
    const raw = this.readStoredHtml();
    if (!raw) {
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    const scriptTag = doc.getElementById('geo-data-storage');
    if (!scriptTag?.textContent) {
      return;
    }

    try {
      const geoJson = JSON.parse(scriptTag.textContent) as GeoJSON.FeatureCollection;
      L.geoJSON(geoJson, {
        pointToLayer: (_feature, latLng) => L.marker(latLng),
        onEachFeature: (feature, layer) => {
          const typedLayer = layer as MapLayer;
          typedLayer.customData = this.normalizeProperties(
            feature.properties as MapFeatureProperties,
            this.layerKind(typedLayer)
          );
          this.drawnItems.addLayer(typedLayer);
          this.bindLayerInteractions(typedLayer);
        }
      });

      const bounds = this.drawnItems.getBounds();
      if (bounds.isValid()) {
        this.map?.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (error) {
      console.error('MapUsers: erreur parsing GeoJSON', error);
    }
  }

  private bindLayerInteractions(layer: MapLayer): void {
    layer.off('click');
    layer.on('click', () => {
      if (this.isEditMode) {
        this.openEditPopup(layer);
      } else {
        this.openViewPopup(layer);
      }
    });
  }

  private openEditPopup(layer: MapLayer): void {
    if (this.layerKind(layer) === 'zone') {
      this.bindPopup(layer, this.createDetailsPopup(layer, true));
      return;
    }

    if (!layer.customData?.cyclosId) {
      this.openAssociationPopup(layer);
      return;
    }

    this.bindPopup(layer, this.createDetailsPopup(layer, true));
  }

  private openViewPopup(layer: MapLayer): void {
    this.bindPopup(layer, this.createDetailsPopup(layer, false));
  }

  private openAssociationPopup(layer: MapLayer, initialValue = ''): void {
    const container = this.createPopupContainer();
    const title = this.appendTextElement(container, 'div', 'Associer un beneficiaire', 'map-users-popup__title');
    title.style.marginBottom = '0.25rem';
    this.appendTextElement(
      container,
      'div',
      'Recherche par identifiant, login, nom ou mot-cle.',
      'map-users-popup__muted'
    );

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.placeholder = 'Recherche utilisateur';
    input.className = 'form-control';
    container.appendChild(input);

    const actions = this.createActionsRow(container);
    const searchButton = this.createActionButton('Rechercher', 'btn btn-sm btn-primary', () => {
      this.searchUsersForLayer(layer, input.value.trim(), status, results);
    });
    const cancelButton = this.createActionButton('Annuler', 'btn btn-sm btn-outline-secondary', () => {
      this.removeLayer(layer);
    });
    actions.append(searchButton, cancelButton);

    const status = this.appendTextElement(container, 'div', '', 'map-users-popup__muted');
    status.style.minHeight = '1.25rem';

    const results = document.createElement('div');
    results.className = 'map-users-popup__results';
    container.appendChild(results);

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.searchUsersForLayer(layer, input.value.trim(), status, results);
      }
    });

    this.bindPopup(layer, container, { closeOnClick: false, autoClose: false });
    setTimeout(() => input.focus(), 0);
  }

  private openZoneEditorPopup(layer: MapLayer): void {
    const props = this.normalizeProperties(layer.customData, 'zone');
    const container = this.createPopupContainer();

    this.appendTextElement(container, 'div', 'Configurer la zone', 'map-users-popup__title');
    this.appendTextElement(container, 'div', 'La zone ne reference pas un utilisateur Cyclos.', 'map-users-popup__muted');

    const nameLabel = this.appendTextElement(container, 'label', 'Nom de la zone', 'map-users-popup__label');
    nameLabel.setAttribute('for', `${this.id}_zone_name`);
    const nameInput = document.createElement('input');
    nameInput.id = `${this.id}_zone_name`;
    nameInput.type = 'text';
    nameInput.value = props.displayName || DEFAULT_ZONE_NAME;
    nameInput.className = 'form-control';
    container.appendChild(nameInput);

    const descriptionLabel = this.appendTextElement(container, 'label', 'Description', 'map-users-popup__label');
    descriptionLabel.setAttribute('for', `${this.id}_zone_description`);
    const descriptionInput = document.createElement('textarea');
    descriptionInput.id = `${this.id}_zone_description`;
    descriptionInput.className = 'form-control';
    descriptionInput.value = props.customFields?.description || '';
    container.appendChild(descriptionInput);

    const actions = this.createActionsRow(container);
    const saveButton = this.createActionButton('Enregistrer la zone', 'btn btn-sm btn-primary', () => {
      const zoneName = (nameInput.value || '').trim() || DEFAULT_ZONE_NAME;
      const description = (descriptionInput.value || '').trim();
      layer.customData = this.normalizeProperties(
        {
          ...layer.customData,
          type: 'zone',
          displayName: zoneName,
          customFields: description ? { description } : {}
        },
        'zone'
      );
      this.syncValidationState();
      this.replaceFieldValue();
      this.map?.closePopup();
    });
    const removeButton = this.createActionButton('Supprimer', 'btn btn-sm btn-outline-danger', () => {
      this.removeLayer(layer);
    });
    const closeButton = this.createActionButton('Fermer', 'btn btn-sm btn-outline-secondary', () => {
      this.map?.closePopup();
    });
    actions.append(saveButton, removeButton, closeButton);

    this.bindPopup(layer, container, { closeOnClick: false, autoClose: false });
    setTimeout(() => nameInput.focus(), 0);
  }

  private searchUsersForLayer(
    layer: MapLayer,
    keywords: string,
    statusElement: HTMLElement,
    resultsElement: HTMLElement
  ): void {
    resultsElement.innerHTML = '';
    if (!keywords) {
      statusElement.textContent = 'Saisis une valeur avant de lancer la recherche.';
      this.setFormError('userNotFound', false);
      this.setFormError('apiError', false);
      return;
    }

    statusElement.textContent = 'Recherche en cours...';
    this.setFormError('userNotFound', false);
    this.setFormError('apiError', false);

    const sub = this.usersService
      .searchUsers({
        keywords,
        fields: ['id', 'display', 'name', 'username', 'email', 'customValues']
      })
      .pipe(first())
      .subscribe({
        next: users => {
          if (!users || users.length === 0) {
            statusElement.textContent = 'Aucun utilisateur trouve.';
            this.setFormError('userNotFound', true);
            return;
          }

          this.setFormError('userNotFound', false);
          if (users.length === 1) {
            statusElement.textContent = 'Utilisateur trouve.';
            this.attachUserToLayer(layer, users[0]);
            return;
          }

          statusElement.textContent = `${users.length} utilisateurs trouves. Selectionne le bon profil.`;
          this.renderSearchResults(layer, users, resultsElement);
        },
        error: error => {
          console.error('MapUsers: erreur recherche utilisateurs', error);
          statusElement.textContent = "Erreur lors de l'appel API.";
          this.setFormError('apiError', true);
        }
      });

    this.addSub(sub);
  }

  private renderSearchResults(layer: MapLayer, users: UserResult[], container: HTMLElement): void {
    container.innerHTML = '';
    users.forEach(user => {
      const button = this.createActionButton('', 'btn btn-sm btn-outline-primary map-users-popup__result', () => {
        this.attachUserToLayer(layer, user);
      });
      button.textContent = '';

      const title = document.createElement('span');
      title.textContent = this.userDisplay(user);
      button.appendChild(title);

      const details: string[] = [];
      if (user.username) {
        details.push(`login: ${user.username}`);
      }
      if (user.id) {
        details.push(`id: ${user.id}`);
      }
      if (user.email) {
        details.push(user.email);
      }
      if (details.length > 0) {
        const subtitle = document.createElement('span');
        subtitle.className = 'map-users-popup__result-subtitle';
        subtitle.textContent = details.join(' | ');
        button.appendChild(subtitle);
      }

      container.appendChild(button);
    });
  }

  private attachUserToLayer(layer: MapLayer, user: UserResult): void {
    this.setFormError('apiError', false);
    const sub = this.imagesService
      .listUserImages({
        user: user.id,
        kind: UserImageKind.PROFILE
      })
      .pipe(first())
      .subscribe({
        next: images => {
          const photoUrl = images?.length ? this.nextRequestState.appendAuth(`/api/images/content/${images[0].id}`) : null;
          this.finalizeLayer(layer, user, photoUrl);
        },
        error: error => {
          console.error('MapUsers: erreur recuperation photo profil', error);
          this.finalizeLayer(layer, user, null);
        }
      });

    this.addSub(sub);
  }

  private finalizeLayer(layer: MapLayer, user: UserResult, photoUrl: string | null): void {
    layer.customData = this.normalizeProperties(
      {
        cyclosId: user.id,
        displayName: this.userDisplay(user),
        photoUrl,
        customFields: this.normalizeUserCustomFields(user.customValues),
        confirmed: false,
        type: 'marker'
      },
      'marker'
    );
    this.setFormError('userNotFound', false);
    this.setFormError('apiError', false);
    this.syncValidationState();
    this.map?.closePopup();
    setTimeout(() => this.openEditPopup(layer), 0);
  }

  private syncValidationState(): void {
    if (!this.formControl) {
      return;
    }
    let hasUnsavedMarkers = false;
    this.drawnItems.eachLayer((layer: L.Layer) => {
      const typedLayer = layer as MapLayer;
      if (
        this.layerKind(typedLayer) === 'marker' &&
        (!typedLayer.customData?.cyclosId || typedLayer.customData?.confirmed === false)
      ) {
        hasUnsavedMarkers = true;
      }
    });
    this.setFormError('unsavedMarker', hasUnsavedMarkers);
  }

  private collectFeatures(): GeoJSON.Feature[] {
    const features: GeoJSON.Feature[] = [];
    this.drawnItems.eachLayer((layer: L.Layer) => {
      const typedLayer = layer as MapLayer;
      if (typeof typedLayer.toGeoJSON !== 'function') {
        return;
      }
      const kind = this.layerKind(typedLayer);
      const feature = typedLayer.toGeoJSON() as GeoJSON.Feature;
      feature.properties = this.normalizeProperties(typedLayer.customData, kind);
      features.push(feature);
    });
    return features;
  }

  private createDetailsPopup(layer: MapLayer, editable: boolean): HTMLElement {
    const kind = this.layerKind(layer);
    const props = this.normalizeProperties(layer.customData, kind);
    const container = this.createPopupContainer();

    const header = document.createElement('div');
    header.className = 'map-users-popup__header';
    if (props.photoUrl && kind === 'marker') {
      const photo = document.createElement('img');
      photo.className = 'map-users-popup__photo';
      photo.src = props.photoUrl;
      photo.alt = props.displayName || 'Photo';
      header.appendChild(photo);
    }

    const headerText = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'map-users-popup__title';
    title.textContent = props.displayName || (kind === 'zone' ? DEFAULT_ZONE_NAME : 'Beneficiaire');
    headerText.appendChild(title);

    const badge = document.createElement('div');
    badge.className = 'map-users-popup__badge';
    badge.textContent = kind === 'marker' ? 'Marqueur' : 'Zone';
    headerText.appendChild(badge);
    header.appendChild(headerText);
    container.appendChild(header);

    const rows = this.popupRows(props, kind);
    if (rows.length > 0) {
      const section = document.createElement('div');
      section.className = 'map-users-popup__section';
      rows.forEach(row => {
        const field = document.createElement('div');
        field.className = 'map-users-popup__field';

        const label = document.createElement('div');
        label.className = 'map-users-popup__field-label';
        label.textContent = row.label;

        const value = document.createElement('div');
        value.className = 'map-users-popup__field-value';
        value.textContent = row.value;

        field.append(label, value);
        section.appendChild(field);
      });
      container.appendChild(section);
    } else {
      const empty = document.createElement('div');
      empty.className = 'map-users-popup__section map-users-popup__muted';
      empty.textContent = 'Aucune donnee complementaire.';
      container.appendChild(empty);
    }

    if (editable) {
      const actions = this.createActionsRow(container);
      if (kind === 'marker') {
        if (props.confirmed) {
          actions.appendChild(
            this.createActionButton('Enregistrer', 'btn btn-sm btn-primary', () => {
              if (this.replaceFieldValue(true)) {
                this.map?.closePopup();
              }
            })
          );
          actions.appendChild(
            this.createActionButton('Supprimer', 'btn btn-sm btn-outline-danger', () => {
              this.removeLayer(layer);
            })
          );
          actions.appendChild(
            this.createActionButton('Annuler', 'btn btn-sm btn-outline-secondary', () => {
              this.map?.closePopup();
            })
          );
        } else {
          actions.appendChild(
            this.createActionButton('Enregistrer', 'btn btn-sm btn-primary', () => {
              this.confirmMarker(layer);
            })
          );
          actions.appendChild(
            this.createActionButton('Annuler', 'btn btn-sm btn-outline-secondary', () => {
              this.removeLayer(layer);
            })
          );
        }
      } else {
        actions.appendChild(
          this.createActionButton('Modifier la zone', 'btn btn-sm btn-outline-primary', () => {
            this.openZoneEditorPopup(layer);
          })
        );
        actions.appendChild(
          this.createActionButton('Supprimer', 'btn btn-sm btn-outline-danger', () => {
            this.removeLayer(layer);
          })
        );
      }
    }

    return container;
  }

  private popupRows(props: MapFeatureProperties, kind: LayerKind): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [];
    if (kind === 'marker' && props.cyclosId) {
      rows.push({ label: 'ID Cyclos', value: props.cyclosId });
    }

    Object.entries(props.customFields || {}).forEach(([key, rawValue]) => {
      const value = this.formatDisplayValue(rawValue);
      if (!value) {
        return;
      }
      rows.push({ label: this.formatFieldLabel(key), value });
    });

    return rows;
  }

  private createPopupContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'map-users-popup';
    return container;
  }

  private createActionsRow(container: HTMLElement): HTMLDivElement {
    const actions = document.createElement('div');
    actions.className = 'map-users-popup__actions';
    container.appendChild(actions);
    return actions;
  }

  private createActionButton(label: string, className: string, callback: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    if (label) {
      button.textContent = label;
    }
    L.DomEvent.on(button, 'click', event => {
      L.DomEvent.stop(event);
      callback();
    });
    return button;
  }

  private appendTextElement<K extends keyof HTMLElementTagNameMap>(
    container: HTMLElement,
    tag: K,
    text: string,
    className?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    container.appendChild(element);
    return element;
  }

  private removeLayer(layer: MapLayer): void {
    layer.off();
    layer.closePopup();
    this.map?.closePopup();
    this.drawnItems.removeLayer(layer);
    if (this.map?.hasLayer(layer)) {
      this.map.removeLayer(layer);
    }
    this.syncValidationState();
    this.replaceFieldValue();
  }

  private bindPopup(layer: MapLayer, content: string | HTMLElement, options?: L.PopupOptions): void {
    layer.unbindPopup?.();
    layer.bindPopup(content, {
      className: 'map-users-leaflet-popup',
      ...options
    });
    layer.openPopup();
    if (content instanceof HTMLElement) {
      L.DomEvent.disableClickPropagation(content);
      L.DomEvent.disableScrollPropagation(content);
    }
  }

  private normalizeProperties(
    props: MapFeatureProperties | undefined,
    fallbackType: LayerKind
  ): MapFeatureProperties {
    const type = props?.type || fallbackType;
    const confirmed = type === 'zone' ? true : props?.confirmed ?? !!props?.cyclosId;
    return {
      cyclosId: props?.cyclosId || undefined,
      displayName: props?.displayName || (type === 'zone' ? DEFAULT_ZONE_NAME : undefined),
      photoUrl: props?.photoUrl || null,
      customFields: { ...(props?.customFields || {}) },
      confirmed,
      type
    };
  }

  private normalizeUserCustomFields(values?: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    const ignoredKey = this.field?.internalName || '';
    Object.entries(values || {}).forEach(([key, rawValue]) => {
      if (!rawValue || key === ignoredKey) {
        return;
      }
      const value = this.formatDisplayValue(rawValue);
      if (!value) {
        return;
      }
      result[key] = value;
    });
    return result;
  }

  private formatFieldLabel(key: string): string {
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, char => char.toUpperCase());
  }

  private formatDisplayValue(value: string): string {
    let text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (/<[a-z][\s\S]*>/i.test(text)) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      doc.querySelectorAll('script, style').forEach(element => element.remove());
      text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    text = text.replace(/\|/g, ', ');
    if (text === 'true') {
      return 'Oui';
    }
    if (text === 'false') {
      return 'Non';
    }
    return text;
  }

  private userDisplay(user: UserResult): string {
    return user.display || user.name || user.username || user.id || 'Utilisateur sans nom';
  }

  private layerKind(layer: MapLayer): LayerKind {
    return layer instanceof L.Marker ? 'marker' : 'zone';
  }

  private readStoredHtml(): string {
    return this.value || this.formControl?.value || this.fieldValue?.stringValue || '';
  }

  private onMapStructureChanged(): void {
    this.syncValidationState();
    this.replaceFieldValue();
  }

  private replaceFieldValue(markAsDirty = false): boolean {
    if (!this.formControl) {
      return false;
    }

    const features = this.collectFeatures();
    const hasUnsavedMarkers = features.some(feature => {
      const props = (feature.properties || {}) as MapFeatureProperties;
      return props.type === 'marker' && (!props.cyclosId || props.confirmed === false);
    });

    this.setFormError('unsavedMarker', hasUnsavedMarkers);
    if (hasUnsavedMarkers) {
      return false;
    }

    const htmlValue = this.serializeFieldValue(features);
    this.setValue(htmlValue, false);
    if (this.formControl.value !== htmlValue) {
      this.formControl.setValue(htmlValue, { emitEvent: false });
    }
    this.notifyValueChange(htmlValue);
    this.setFormError('userNotFound', false);
    this.setFormError('apiError', false);

    if (markAsDirty) {
      this.formControl.markAsDirty();
      this.formControl.markAsTouched();
    }
    this.formControl.updateValueAndValidity({ emitEvent: false });
    return true;
  }

  private confirmMarker(layer: MapLayer): void {
    layer.customData = this.normalizeProperties(
      {
        ...layer.customData,
        confirmed: true
      },
      'marker'
    );
    this.syncValidationState();
    this.replaceFieldValue(true);
    this.map?.closePopup();
  }

  private serializeFieldValue(features: GeoJSON.Feature[]): string {
    const geoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features
    };

    const tableRows = features
      .map(feature => {
        const props = this.normalizeProperties(
          feature.properties as MapFeatureProperties,
          feature.geometry.type === 'Point' ? 'marker' : 'zone'
        );
        const coordinates =
          feature.geometry.type === 'Point'
            ? (feature.geometry as GeoJSON.Point).coordinates.slice().reverse().join(', ')
            : 'Zone polygone';

        return `
      <tr>
        <td style="padding:6px;border:1px solid #d8dee6">${this.escapeHtml(props.displayName || '-')}</td>
        <td style="padding:6px;border:1px solid #d8dee6">${this.escapeHtml(props.cyclosId || '-')}</td>
        <td style="padding:6px;border:1px solid #d8dee6">${this.escapeHtml(coordinates)}</td>
        <td style="padding:6px;border:1px solid #d8dee6">${props.type === 'marker' ? 'Marqueur' : 'Zone'}</td>
      </tr>`;
      })
      .join('');

    return `<table class="geo-summary" style="width:100%;border-collapse:collapse;font-family:sans-serif">
  <thead>
    <tr style="background:#34495e;color:white">
      <th style="padding:8px;border:1px solid #34495e">Famille</th>
      <th style="padding:8px;border:1px solid #34495e">ID Cyclos</th>
      <th style="padding:8px;border:1px solid #34495e">Coordonnees</th>
      <th style="padding:8px;border:1px solid #34495e">Type</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<script type="application/json" id="geo-data-storage">${this.escapeHtmlForScript(JSON.stringify(geoJson))}</script>`;
  }

  private setFormError(key: string, active: boolean): void {
    if (!this.formControl) {
      return;
    }
    const errors = { ...(this.formControl.errors || {}) };
    if (active) {
      errors[key] = true;
    } else {
      delete errors[key];
    }
    this.formControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtmlForScript(value: string): string {
    return value.replace(/<\/script/gi, '<\\/script');
  }
}
