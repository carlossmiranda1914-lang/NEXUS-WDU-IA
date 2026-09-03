export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';

const DECIMAL_INPUT = /^[+-]?(?:0|[0-9]+)(?:\.[0-9]+)?$/;

function pow10(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0) throw new Error('Decimal scale must be a non-negative integer');
  return 10n ** BigInt(exponent);
}

function digitCount(value: bigint): number {
  return (value < 0n ? -value : value).toString().length;
}

export class ExactDecimal {
  private constructor(readonly coefficient: bigint, readonly scale: number) {}

  static parse(input: string, maxPrecision: number, maxScale: number): ExactDecimal {
    if (!DECIMAL_INPUT.test(input)) throw new Error('Decimal input must be a canonical non-localized string');
    const negative = input.startsWith('-');
    const unsigned = input.replace(/^[+-]/, '');
    const [whole, fraction = ''] = unsigned.split('.');
    if (fraction.length > maxScale) throw new Error('Decimal scale exceeds the permitted envelope');
    const coefficient = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
    return ExactDecimal.fromParts(coefficient, fraction.length, maxPrecision, maxScale);
  }

  static fromParts(coefficient: bigint, scale: number, maxPrecision: number, maxScale: number): ExactDecimal {
    if (!Number.isSafeInteger(scale) || scale < 0 || !Number.isSafeInteger(maxPrecision) || !Number.isSafeInteger(maxScale)) {
      throw new Error('Decimal precision and scale must be non-negative integers');
    }
    if (scale > maxScale) throw new Error('Decimal scale exceeds the permitted envelope');
    let normalizedCoefficient = coefficient;
    let normalizedScale = scale;
    while (normalizedCoefficient !== 0n && normalizedScale > 0 && normalizedCoefficient % 10n === 0n) {
      normalizedCoefficient /= 10n;
      normalizedScale -= 1;
    }
    if (normalizedCoefficient === 0n) normalizedScale = 0;
    if (digitCount(normalizedCoefficient) > maxPrecision) throw new Error('Decimal precision exceeds the permitted envelope');
    return new ExactDecimal(normalizedCoefficient, normalizedScale);
  }

  toCanonicalString(): string {
    if (this.coefficient === 0n) return '0';
    const negative = this.coefficient < 0n;
    const digits = (negative ? -this.coefficient : this.coefficient).toString();
    if (this.scale === 0) return `${negative ? '-' : ''}${digits}`;
    const padded = digits.padStart(this.scale + 1, '0');
    return `${negative ? '-' : ''}${padded.slice(0, -this.scale)}.${padded.slice(-this.scale)}`;
  }

  add(other: ExactDecimal): ExactDecimal {
    const scale = Math.max(this.scale, other.scale);
    return ExactDecimal.unbounded(this.scaledCoefficient(scale) + other.scaledCoefficient(scale), scale);
  }

  subtract(other: ExactDecimal): ExactDecimal {
    const scale = Math.max(this.scale, other.scale);
    return ExactDecimal.unbounded(this.scaledCoefficient(scale) - other.scaledCoefficient(scale), scale);
  }

  multiply(other: ExactDecimal, maxPrecision: number, maxScale: number): ExactDecimal {
    return ExactDecimal.fromParts(this.coefficient * other.coefficient, this.scale + other.scale, maxPrecision, maxScale);
  }

  quantize(scale: number, mode: RoundingMode): ExactDecimal {
    if (!Number.isSafeInteger(scale) || scale < 0) throw new Error('Quantization scale must be a non-negative integer');
    if (this.scale <= scale) return this;
    const divisor = pow10(this.scale - scale);
    const quotient = this.coefficient / divisor;
    const remainder = this.coefficient % divisor;
    if (remainder === 0n) return ExactDecimal.unbounded(quotient, scale);
    const sign = this.coefficient < 0n ? -1n : 1n;
    const magnitudeRemainder = remainder < 0n ? -remainder : remainder;
    let increment = false;
    if (mode === 'up') increment = true;
    if (mode === 'half_up') increment = magnitudeRemainder * 2n >= divisor;
    if (mode === 'half_even') {
      const comparison = magnitudeRemainder * 2n - divisor;
      increment = comparison > 0n || (comparison === 0n && ((quotient < 0n ? -quotient : quotient) % 2n !== 0n));
    }
    if (!['half_up', 'half_even', 'down', 'up'].includes(mode)) throw new Error('Unsupported rounding mode');
    return ExactDecimal.unbounded(quotient + (increment ? sign : 0n), scale);
  }

  compare(other: ExactDecimal): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale);
    const difference = this.scaledCoefficient(scale) - other.scaledCoefficient(scale);
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }

  scaledCoefficient(scale: number): bigint {
    if (scale < this.scale) throw new Error('Cannot losslessly reduce decimal scale');
    return this.coefficient * pow10(scale - this.scale);
  }

  private static unbounded(coefficient: bigint, scale: number): ExactDecimal {
    return ExactDecimal.fromParts(coefficient, scale, 10_000, 10_000);
  }
}
