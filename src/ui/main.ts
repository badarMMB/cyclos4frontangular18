import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { UiModule } from '../app/ui/ui.module';
import { environment } from '../environments/environment';

if (environment.production) {
  enableProdMode();
}

// Zoneless preparation note:
// `provideExperimentalZonelessChangeDetection()` is available for standalone bootstrap (`bootstrapApplication`).
// This project still bootstraps an NgModule; keep zone.js for now and enable zoneless during standalone migration.
void environment.zonelessChangeDetection;

platformBrowserDynamic().bootstrapModule(UiModule)
  .catch(err => console.error(err));
