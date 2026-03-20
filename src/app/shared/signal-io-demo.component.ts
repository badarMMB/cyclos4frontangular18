import { Component, input, output } from '@angular/core';

@Component({
  selector: 'signal-io-demo',
  standalone: true,
  template: `
    <div class="d-none" aria-hidden="true">
      {{ title() }} - {{ count() }}
      <button type="button" (click)="emitIncrement()">increment</button>
    </div>
  `
})
export class SignalIoDemoComponent {
  // Angular 18 signal-based inputs
  readonly title = input.required<string>();
  readonly count = input(0);

  // Angular 18 signal-based output
  readonly incremented = output<number>();

  emitIncrement(): void {
    this.incremented.emit(this.count() + 1);
  }
}
