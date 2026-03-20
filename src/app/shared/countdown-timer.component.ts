import { ChangeDetectionStrategy, Component, OnDestroy, computed, input, signal } from '@angular/core';

interface CountdownState {
  invalid: boolean;
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Component({
  selector: 'countdown-timer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['countdown-timer.component.scss'],
  template: `
    @let remaining = remainingTime();
    @if (remaining.invalid) {
      <span class="badge badge-danger countdown-badge countdown-badge-single">Invalid date</span>
    } @else if (remaining.expired) {
      <span class="badge badge-secondary countdown-badge countdown-badge-single">Expired</span>
    } @else {
      <span class="countdown-timer d-inline-flex flex-wrap align-items-center">
        <span class="badge badge-info countdown-badge">{{ remaining.days }}d</span>
        <span class="badge badge-info countdown-badge">{{ remaining.hours }}h</span>
        <span class="badge badge-info countdown-badge">{{ remaining.minutes }}m</span>
        <span class="badge badge-info countdown-badge">{{ remaining.seconds }}s</span>
      </span>
    }
  `
})
export class CountdownTimerComponent implements OnDestroy {
  readonly targetDate = input.required<string>();

  private readonly now = signal(Date.now());
  private intervalId: ReturnType<typeof setInterval> | null = setInterval(() => {
    this.now.set(Date.now());
  }, 1000);

  readonly remainingTime = computed<CountdownState>(() => {
    const targetTime = new Date(this.targetDate()).getTime();
    if (Number.isNaN(targetTime)) {
      return {
        invalid: true,
        expired: false,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }

    const diffMs = targetTime - this.now();
    if (diffMs <= 0) {
      return {
        invalid: false,
        expired: true,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      invalid: false,
      expired: false,
      days,
      hours,
      minutes,
      seconds
    };
  });

  ngOnDestroy(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
