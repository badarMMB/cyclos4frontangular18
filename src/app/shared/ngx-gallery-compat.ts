import { CommonModule } from '@angular/common';
import { Component, Input, NgModule, OnChanges, SimpleChanges } from '@angular/core';

export interface INgxGalleryImage {
  small?: string;
  medium?: string;
  big?: string;
  description?: string;
  label?: string;
  [key: string]: any;
}

export type NgxGalleryImage = INgxGalleryImage;

export interface NgxGalleryOptions {
  width?: string;
  height?: string;
  image?: boolean;
  thumbnails?: boolean;
  previewArrows?: boolean;
  previewKeyboardNavigation?: boolean;
  previewCloseOnClick?: boolean;
  previewCloseOnEsc?: boolean;
  thumbnailsAutoHide?: boolean;
  imageSize?: NgxGalleryImageSize;
  imageAnimation?: NgxGalleryAnimation;
  [key: string]: any;
}

export enum NgxGalleryAnimation {
  Slide = 'slide',
  Fade = 'fade'
}

export enum NgxGalleryImageSize {
  Cover = 'cover',
  Contain = 'contain'
}

@Component({
  selector: 'ngx-gallery',
  template: `
    @if (images?.length) {
      <div class="ngx-gallery-compat">
        @if (showInlineImage) {
          <img
            [src]="currentDisplayImage"
            [alt]="''"
            (click)="openPreview(activeIndex)"
            [style.width.%]="100"
            [style.object-fit]="imageFit"
            [style.cursor]="images.length > 0 ? 'pointer' : 'default'" />
        }
        @if (showThumbnails) {
          <div class="ngx-gallery-compat-thumbs">
            @for (image of images; track image; let i = $index) {
              <button
                type="button"
                class="ngx-gallery-compat-thumb"
                [class.active]="i === activeIndex"
                (click)="setActive(i)">
                <img [src]="image.small || image.medium || image.big" [alt]="''" />
              </button>
            }
          </div>
        }
      </div>
    }
    
    @if (previewOpen && previewImage) {
      <div class="ngx-gallery-compat-preview" (click)="closePreview()">
        @if (showPreviewArrows) {
          <button
            type="button"
            class="ngx-gallery-compat-nav prev"
            (click)="previous($event)">
            ‹
          </button>
        }
        <img class="ngx-gallery-compat-preview-image" [src]="previewImage.big || previewImage.medium || previewImage.small" [alt]="''" />
        @if (showPreviewArrows) {
          <button
            type="button"
            class="ngx-gallery-compat-nav next"
            (click)="next($event)">
            ›
          </button>
        }
        <button type="button" class="ngx-gallery-compat-close" (click)="closePreview($event)">×</button>
      </div>
    }
    `,
  styles: [
    `
      .ngx-gallery-compat {
        width: 100%;
      }

      .ngx-gallery-compat-thumbs {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
        overflow-x: auto;
      }

      .ngx-gallery-compat-thumb {
        background: transparent;
        border: 1px solid #d0d0d0;
        padding: 0;
        border-radius: 4px;
        width: 64px;
        height: 64px;
        flex: 0 0 auto;
        cursor: pointer;
      }

      .ngx-gallery-compat-thumb.active {
        border-color: #666;
      }

      .ngx-gallery-compat-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .ngx-gallery-compat-preview {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1060;
      }

      .ngx-gallery-compat-preview-image {
        max-width: 92vw;
        max-height: 90vh;
        object-fit: contain;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }

      .ngx-gallery-compat-nav,
      .ngx-gallery-compat-close {
        position: absolute;
        border: 0;
        background: rgba(0, 0, 0, 0.4);
        color: #fff;
        cursor: pointer;
        line-height: 1;
      }

      .ngx-gallery-compat-nav {
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        border-radius: 999px;
        font-size: 28px;
      }

      .ngx-gallery-compat-nav.prev {
        left: 16px;
      }

      .ngx-gallery-compat-nav.next {
        right: 16px;
      }

      .ngx-gallery-compat-close {
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        font-size: 28px;
      }
    `
  ]
})
export class NgxGalleryComponent implements OnChanges {
  @Input() images: INgxGalleryImage[] = [];
  @Input() options: NgxGalleryOptions[] | NgxGalleryOptions = [];

  activeIndex = 0;
  previewOpen = false;
  previewIndex = 0;

  ngOnChanges(_changes: SimpleChanges): void {
    const maxIndex = Math.max((this.images?.length || 1) - 1, 0);
    this.activeIndex = Math.min(this.activeIndex, maxIndex);
    this.previewIndex = Math.min(this.previewIndex, maxIndex);
    if (!this.images?.length) {
      this.previewOpen = false;
    }
  }

  get normalizedOptions(): NgxGalleryOptions {
    return Array.isArray(this.options) ? (this.options[0] || {}) : this.options || {};
  }

  get showInlineImage(): boolean {
    return this.normalizedOptions.image !== false;
  }

  get showThumbnails(): boolean {
    return this.normalizedOptions.thumbnails !== false && (this.images?.length || 0) > 1;
  }

  get showPreviewArrows(): boolean {
    return this.normalizedOptions.previewArrows !== false && (this.images?.length || 0) > 1;
  }

  get currentDisplayImage(): string | null {
    const image = this.images?.[this.activeIndex];
    return image ? image.medium || image.big || image.small || null : null;
  }

  get previewImage(): INgxGalleryImage | null {
    return this.images?.[this.previewIndex] || null;
  }

  get imageFit(): string {
    return this.normalizedOptions.imageSize === NgxGalleryImageSize.Contain ? 'contain' : 'cover';
  }

  setActive(index: number) {
    this.activeIndex = this.clamp(index);
  }

  openPreview(index = 0) {
    if (!this.images?.length) {
      return;
    }
    this.previewIndex = this.clamp(index);
    this.activeIndex = this.previewIndex;
    this.previewOpen = true;
  }

  closePreview(event?: Event) {
    event?.stopPropagation();
    this.previewOpen = false;
  }

  previous(event: Event) {
    event.stopPropagation();
    this.previewIndex = this.clamp(this.previewIndex - 1);
    this.activeIndex = this.previewIndex;
  }

  next(event: Event) {
    event.stopPropagation();
    this.previewIndex = this.clamp(this.previewIndex + 1);
    this.activeIndex = this.previewIndex;
  }

  private clamp(index: number): number {
    if (!this.images?.length) {
      return 0;
    }
    const max = this.images.length - 1;
    if (index < 0) {
      return max;
    }
    if (index > max) {
      return 0;
    }
    return index;
  }
}

@NgModule({
  imports: [CommonModule],
  declarations: [NgxGalleryComponent],
  exports: [NgxGalleryComponent]
})
export class NgxGalleryModule {}
