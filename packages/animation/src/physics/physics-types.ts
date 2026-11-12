/**
 * LuminaLearn Physics Animation Engine — Types & Scientific Formulas
 * Wavelengths, refractive indices, Snell's law, and Descartes rainbow angles.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface SpectralBand {
  name: string;
  vietnameseName: string;
  wavelengthNm: number;
  colorHex: string;
  glowColor: string;
  waterRefractiveIndex: number;
  glassRefractiveIndex: number;
  rainbowExitAngleDeg: number; // Descartes caustic angle (relative to incoming anti-solar ray)
}

export const SPECTRUM_BANDS: readonly SpectralBand[] = [
  {
    name: 'Red',
    vietnameseName: 'Đỏ',
    wavelengthNm: 700,
    colorHex: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    waterRefractiveIndex: 1.331,
    glassRefractiveIndex: 1.514,
    rainbowExitAngleDeg: 42.3
  },
  {
    name: 'Orange',
    vietnameseName: 'Cam',
    wavelengthNm: 620,
    colorHex: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.7)',
    waterRefractiveIndex: 1.333,
    glassRefractiveIndex: 1.517,
    rainbowExitAngleDeg: 41.9
  },
  {
    name: 'Yellow',
    vietnameseName: 'Vàng',
    wavelengthNm: 580,
    colorHex: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.7)',
    waterRefractiveIndex: 1.335,
    glassRefractiveIndex: 1.519,
    rainbowExitAngleDeg: 41.6
  },
  {
    name: 'Green',
    vietnameseName: 'Lục',
    wavelengthNm: 530,
    colorHex: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    waterRefractiveIndex: 1.337,
    glassRefractiveIndex: 1.522,
    rainbowExitAngleDeg: 41.2
  },
  {
    name: 'Cyan',
    vietnameseName: 'Lam',
    wavelengthNm: 490,
    colorHex: '#06B6D4',
    glowColor: 'rgba(6, 182, 212, 0.7)',
    waterRefractiveIndex: 1.340,
    glassRefractiveIndex: 1.524,
    rainbowExitAngleDeg: 40.8
  },
  {
    name: 'Blue',
    vietnameseName: 'Chàm',
    wavelengthNm: 450,
    colorHex: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.7)',
    waterRefractiveIndex: 1.342,
    glassRefractiveIndex: 1.526,
    rainbowExitAngleDeg: 40.6
  },
  {
    name: 'Violet',
    vietnameseName: 'Tím',
    wavelengthNm: 400,
    colorHex: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.7)',
    waterRefractiveIndex: 1.344,
    glassRefractiveIndex: 1.528,
    rainbowExitAngleDeg: 40.3
  }
] as const;

/**
 * Snell's Law of Refraction:
 * n1 * sin(theta1) = n2 * sin(theta2)
 * Returns theta2 in radians.
 */
export function snellRefraction(thetaIncidentRad: number, n1 = 1.0, n2 = 1.333): number {
  const sinR = (n1 / n2) * Math.sin(thetaIncidentRad);
  if (Math.abs(sinR) > 1.0) {
    // Total internal reflection condition
    return -1;
  }
  return Math.asin(sinR);
}

/**
 * Descartes Rainbow Caustic Angle:
 * Returns the primary rainbow exit angle (in degrees) for a given refractive index n.
 * At caustic: cos(i_0) = sqrt((n^2 - 1) / 3), r_0 = asin(sin(i_0)/n).
 * Exit angle relative to incoming parallel sunlight: theta_exit = 4*r_0 - 2*i_0.
 */
export function computeDescartesCausticAngleDeg(n: number): {
  incidentAngleDeg: number;
  refractedAngleDeg: number;
  exitAngleDeg: number;
} {
  const cosI0 = Math.sqrt((n * n - 1.0) / 3.0);
  const i0 = Math.acos(cosI0);
  const r0 = Math.asin(Math.sin(i0) / n);
  const exitRad = 4.0 * r0 - 2.0 * i0;
  const toDeg = 180.0 / Math.PI;
  return {
    incidentAngleDeg: i0 * toDeg,
    refractedAngleDeg: r0 * toDeg,
    exitAngleDeg: exitRad * toDeg
  };
}

