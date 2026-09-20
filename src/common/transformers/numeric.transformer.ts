import { Transform } from 'class-transformer';

export class ColumnNumericTransformer {
  to(value?: number | null): number | null {
    return value ?? null;
  }

  from(value?: string | number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === 'number' ? value : parseFloat(value);
  }
}

export function ToNumber() {
  return Transform(({ value }) =>
    value === null || value === undefined || value === '' ? value : Number(value),
  );
}
