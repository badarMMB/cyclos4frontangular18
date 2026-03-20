/// <reference types="@types/google-maps" />

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Loader } from '@googlemaps/loader';
import { Address, AddressManage, GeographicalCoordinate, MapData } from 'app/api/models';
import { DataForFrontendHolder } from 'app/core/data-for-frontend-holder';
import { LayoutService } from 'app/core/layout.service';
import { ScriptLoaderService } from 'app/core/script-loader.service';
import { blank, empty } from 'app/shared/helper';
import { UiLayoutService } from 'app/ui/core/ui-layout.service';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

const StaticUrl = 'https://maps.googleapis.com/maps/api/staticmap';
const ExternalUrl = 'https://www.google.com/maps/search/';
const MarkerClustererPlusUrl = 'https://unpkg.com/@google/markerclustererplus@5.0.3/dist/markerclustererplus.min.js';
const OpenStreetMapSearchUrl = 'https://nominatim.openstreetmap.org/search';

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

/**
 * Helper classes to work with maps and geocoding
 */
@Injectable({
  providedIn: 'root'
})
export class MapsService {
  private geocoderCache = new Map<string, GeographicalCoordinate | null>();
  private _data: MapData;
  private loader: Loader;

  constructor(
    private dataForFrontendHolder: DataForFrontendHolder,
    private layout: LayoutService,
    private uiLayout: UiLayoutService,
    private scriptLoader: ScriptLoaderService,
    private http: HttpClient
  ) {
    this.dataForFrontendHolder.subscribe(dataForFrontend => (this._data = dataForFrontend.dataForUi.mapData));
    if (dataForFrontendHolder.dataForUi) {
      this._data = dataForFrontendHolder.dataForUi.mapData;
    }
  }

  /**
   * Returns whether maps are enabled, that is, there is a Google Maps API key set.
   */
  get enabled(): boolean {
    const mapData = this.data;
    return mapData == null ? false : mapData.googleMapsApiKey != null;
  }

  /**
   * Returns whether address geocoding is available.
   * Geocoding is backed by OpenStreetMap / Nominatim and doesn't require a Google Maps key.
   */
  get geocodingEnabled(): boolean {
    return true;
  }

  /**
   * Returns the map data
   */
  get data(): MapData {
    return this._data;
  }

  /**
   * Geocodes the given address fields, that is, transforms an address to a geographical coordinate
   * @param fields The address field values
   */
  geocode(fields: AddressManage | string[]): Observable<GeographicalCoordinate> {
    if (!this.geocodingEnabled || fields == null) {
      return of(null);
    }
    return this.doGeocode(fields);
  }

  /**
   * Returns the URL for a static map showing the given address / location, with the given dimensions
   * @param location Wither an `Address` or a `GeographicalCoordinate`
   * @param width The image width
   * @param width The image height
   */
  staticUrl(location: Address | GeographicalCoordinate, width: number, height: number): string {
    const coords = this.coords(location);
    if (coords == null) {
      return null;
    }
    const icon = encodeURIComponent(this.dataForFrontendHolder.dataForFrontend.mapMarkerUrl);
    const key = this.data.googleMapsApiKey;
    const scale = (window.devicePixelRatio || 0) >= 2 ? 2 : 1;
    return (
      `${StaticUrl}?size=${width}x${height}&scale=${scale}&zoom=15` +
      `&markers=icon:${icon}|${coords.latitude},${coords.longitude}&key=${key}` +
      this.styles()
    );
  }

  private styles(): string {
    const mapStyles = this.uiLayout.googleMapStyles;
    if (empty(mapStyles)) {
      return '';
    }
    const toStyle = (s: google.maps.MapTypeStyle) => {
      const parts: string[] = [];
      if (s.featureType) {
        parts.push(`feature:${s.featureType}`);
      }
      if (s.elementType) {
        parts.push(`element:${s.elementType}`);
      }
      (s.stylers || []).forEach(st => {
        for (const key of Object.keys(st)) {
          let value = String(st[key]);
          if (blank(value)) {
            continue;
          }
          if (value.startsWith('#')) {
            // Colors must be encoded as hex
            value = value.replace('#', '0x');
          }
          parts.push(`${key}:${value}`);
        }
      });
      return `&style=` + parts.join('|');
    };
    return mapStyles.map(toStyle).join('');
  }

  /**
   * Returns the URL for an external map view of a specific location
   * @param location Wither an `Address` or a `GeographicalCoordinate`
   */
  externalUrl(location: Address | GeographicalCoordinate): string {
    const coords = this.coords(location);
    if (coords == null) {
      return null;
    }
    return `${ExternalUrl}${coords.latitude},${coords.longitude}`;
  }

  private coords(location: Address | GeographicalCoordinate): GeographicalCoordinate {
    return (location as Address).location ? (location as any).location : location;
  }

  private doGeocode(fieldsOrAddress: AddressManage | string[]): Observable<GeographicalCoordinate> {
    let fields: string[];
    if (fieldsOrAddress instanceof Array) {
      // When the input is an array of fields, use it directly
      fields = fieldsOrAddress;
    } else {
      // When an address, extract each field
      const a = fieldsOrAddress as AddressManage;
      fields = [
        a.addressLine1,
        a.addressLine2,
        a.street,
        a.buildingNumber,
        a.neighborhood,
        a.city,
        a.zip,
        a.region,
        a.country
      ];
    }
    fields = (fields || []).filter(f => !empty(f));
    if (fields.length === 0) {
      return of(null);
    }
    const query = fields.join(', ');
    const cached = this.geocoderCache.get(query);
    if (cached !== undefined) {
      // The value is already cached
      return of(cached);
    }
    return this.http
      .get<NominatimSearchResult[]>(OpenStreetMapSearchUrl, {
        params: this.buildGeocodeParams(fieldsOrAddress, query)
      })
      .pipe(
        map(results => {
          const firstResult = (results || [])[0];
          if (firstResult == null) {
            this.geocoderCache.set(query, null);
            return null;
          }
          const coords: GeographicalCoordinate = {
            latitude: Number(firstResult.lat),
            longitude: Number(firstResult.lon)
          };
          this.geocoderCache.set(query, coords);
          return coords;
        })
      );
  }

  private buildGeocodeParams(fieldsOrAddress: AddressManage | string[], query: string): HttpParams {
    let params = new HttpParams().set('format', 'jsonv2').set('limit', '1').set('q', query);
    const countryCode = this.countryCode(fieldsOrAddress);
    if (!empty(countryCode)) {
      params = params.set('countrycodes', countryCode.toLowerCase());
    }
    if (typeof navigator !== 'undefined' && !empty(navigator.language)) {
      params = params.set('accept-language', navigator.language);
    }
    return params;
  }

  private countryCode(fieldsOrAddress: AddressManage | string[]): string {
    if (!(fieldsOrAddress instanceof Array)) {
      const address = fieldsOrAddress as AddressManage;
      if (!empty(address.country)) {
        return address.country;
      }
    }
    return this.dataForFrontendHolder.dataForUi?.country;
  }

  /**
   * Instantiates a new google map in the given container element
   */
  newGoogleMap(container: HTMLElement) {
    return new google.maps.Map(container, {
      mapTypeControl: false,
      streetViewControl: false,
      gestureHandling: this.layout.ltsm ? 'cooperative' : 'greedy',
      minZoom: 2,
      maxZoom: 17,
      styles: this.uiLayout.googleMapStyles
    });
  }

  /**
   * Returns an `Observable` that emits when the google maps script is fully loaded
   */
  ensureScriptLoaded(): Observable<void> {
    if (this.loader == null) {
      this.loader = new Loader({
        apiKey: this.data.googleMapsApiKey
      });
    }
    return from(this.loader.loadPromise()).pipe(switchMap(() => this.scriptLoader.loadScript(MarkerClustererPlusUrl)));
  }
}
