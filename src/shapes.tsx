/**
 * Preschool optotypes. Five-year-olds mostly cannot read letters yet, so the
 * acuity games use picture symbols in the spirit of the LEA Symbols chart
 * used in children's eye tests: shapes that blur into one another (apple into
 * circle, house into square) when detail is lost.
 */

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'house' | 'apple' | 'heart';

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: 'circle',
  square: 'square',
  triangle: 'triangle',
  house: 'house',
  apple: 'apple',
  heart: 'heart',
};

/** Look-alike families: distractors come from the same family as the target. */
export const SHAPE_FAMILIES: ShapeKind[][] = [
  ['circle', 'apple', 'heart'],
  ['square', 'house', 'triangle'],
];

export const ALL_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'house', 'apple', 'heart'];

const PATHS: Record<ShapeKind, string> = {
  circle: 'M50 12 A38 38 0 1 1 49.99 12 Z',
  square: 'M15 15 H85 V85 H15 Z',
  triangle: 'M50 10 L90 86 L10 86 Z',
  house: 'M50 10 L90 46 L80 46 L80 88 L20 88 L20 46 L10 46 Z',
  apple: 'M50 32 C 32 16, 8 26, 12 54 C 16 80, 34 94, 50 86 C 66 94, 84 80, 88 54 C 92 26, 68 16, 50 32 Z M47 8 H55 V30 H47 Z',
  heart: 'M50 86 C 22 66, 8 48, 14 30 C 20 14, 42 12, 50 30 C 58 12, 80 14, 86 30 C 92 48, 78 66, 50 86 Z',
};

export const ShapeIcon = ({ kind, color, size, className = '' }: {
  kind: ShapeKind;
  color: string;
  size: number | string;
  className?: string;
}) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
    <path d={PATHS[kind]} fill={color} fillRule="evenodd" />
  </svg>
);
