/**
 * Shared validation helpers used across sensor/health data pipelines.
 *
 * Backend ingestion rejects out-of-range values with HTTP 422, so the mobile
 * layer must convert any out-of-range reading to null before upload.
 * Values are NEVER clamped — they are either valid or null.
 */

/**
 * Return `value` unchanged when it falls within [min, max] (inclusive).
 * Returns null when the value is null, undefined, NaN, or outside the range.
 *
 * @param value  The numeric candidate to validate.
 * @param min    Inclusive lower bound.
 * @param max    Inclusive upper bound.
 */
export function validateRange<T extends number>(
  value: T | null | undefined,
  min: number,
  max: number,
): T | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null; // out of range → null, no clamping
  return value;
}
