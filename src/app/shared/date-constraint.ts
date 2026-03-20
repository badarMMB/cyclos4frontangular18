import { addDays, addYears, endOfDay, endOfYear, getHours, isValid, parseISO, startOfDay, startOfYear, subDays, subYears } from 'date-fns';

/**
 * A constraint to be used either as minimum / maximum date
 */
export type DateConstraint =
  /** Any date */
  | 'any'
  /** Current date, begin of day */
  | 'today'
  /** Current date, end of date */
  | 'todayEnd'
  /** Current date + 1 */
  | 'tomorrow'
  /** Current date - 1 */
  | 'yesterday'
  /** 100 years ago */
  | 'past100'
  /** 100 years from now */
  | 'future100'
  /** 5 years ago */
  | 'past5'
  /** 5 years from now */
  | 'future5'
  /** A specific date */
  | string;

/**
 * Returns a date constraint as a Date instance
 * @param constraint The constraint
 * @returns The corresponding Date, or null if the constraint is null or 'any'
 */
export function dateConstraintAsDate(constraint: DateConstraint, now: Date): Date {
  switch (constraint || 'any') {
    case 'any':
      return null;
    case 'today':
      return startOfDay(now);
    case 'todayEnd':
      return endOfDay(now);
    case 'yesterday':
      return startOfDay(subDays(now, 1));
    case 'tomorrow':
      return startOfDay(addDays(now, 1));
    case 'past100':
      return startOfYear(subYears(now, 100));
    case 'future100':
      return endOfYear(addYears(now, 100));
    case 'past5':
      return startOfYear(subYears(now, 5));
    case 'future5':
      return startOfDay(endOfYear(addYears(now, 5)));
    default: {
      const date = parseISO(constraint as string);
      if (!isValid(date)) {
        throw new Error(`Got an invalid date constraint: ${constraint}`);
      }
      if (getHours(date) > 12) {
        return addDays(date, 1);
      }
      return date;
    }
  }
}

/**
 * @deprecated Use dateConstraintAsDate instead
 */
export function dateConstraintAsMoment(constraint: DateConstraint, now: Date): Date {
  return dateConstraintAsDate(constraint, now);
}
