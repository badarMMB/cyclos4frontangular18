import { isDevServer } from 'app/shared/helper';

export const environment = {
  // This is the environment for development
  production: false,


  // On development we're always standalone, that means, never switch to classic frontend
  standalone: true,

  // The API path / URL when in standalone mode
  apiUrl: 'http://localhost:8080/enchere/api',

  // GeoServer WMS URL for map tile layers
  geoServerWmsUrl: 'http://localhost:8080/geoserver/djibouti_map/wms',

  // Keep false for now. Can be enabled after full third-party compatibility validation.
  zonelessChangeDetection: false
};

// When runnng on dev server, always consider standalone to be true
if (isDevServer()) {
  environment.standalone = true;
}
