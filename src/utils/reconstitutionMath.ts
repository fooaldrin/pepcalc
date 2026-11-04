export type SyringeScale = 'U-100' | 'U-50' | 'U-40';
export type SyringeVolumeMl = 0.3 | 0.5 | 1.0;
export type DoseUnit = 'mcg' | 'mg';

export interface ReconstitutionInput {
  vialMassMg: number;        // e.g. 5 mg, 10 mg, 15 mg
  diluentVolumeMl: number;   // e.g. 1 mL, 2 mL, 3 mL BAC water
  targetDose: number;        // e.g. 250 mcg or 2.5 mg
  targetDoseUnit: DoseUnit;
  syringeScale: SyringeScale;
  syringeVolumeMl: SyringeVolumeMl;
}

export interface ReconstitutionResult {
  isValidInput: boolean;
  concentrationMgPerMl: number;
  concentrationMcgPerMl: number;
  targetDoseMg: number;
  targetDoseMcg: number;
  volumeToDrawMl: number;
  syringeUnits: number;
  maxSyringeUnits: number;
  fillPercentage: number;
  dosesPerVial: number;
  mcgPerUnit: number;
  exceedsSyringeCapacity: boolean;
  exceedsVialMass: boolean;
  syringesNeededCount: number;
}

export interface BlendCompound {
  id: string;
  name: string;
  massMg: number;
  targetDoseMcg?: number;
}

export interface SavedProtocol {
  id: string;
  label: string;
  notes?: string;
  input: ReconstitutionInput;
  remainingVolumeMl: number;
  reconstitutedDateISO: string; // YYYY-MM-DD (Sweden ISO default)
  expirationDays: number;       // Default 28 days for reconstituted solutions
}

export const SYRINGE_PRESETS: {
  label: string;
  scale: SyringeScale;
  volumeMl: SyringeVolumeMl;
  maxUnits: number;
  majorTickStep: number;
  minorTickStep: number;
}[] = [
  {
    label: '0.3 mL (30 Units)',
    scale: 'U-100',
    volumeMl: 0.3,
    maxUnits: 30,
    majorTickStep: 5,
    minorTickStep: 1,
  },
  {
    label: '0.5 mL (50 Units)',
    scale: 'U-100',
    volumeMl: 0.5,
    maxUnits: 50,
    majorTickStep: 10,
    minorTickStep: 1,
  },
  {
    label: '1.0 mL (100 Units)',
    scale: 'U-100',
    volumeMl: 1.0,
    maxUnits: 100,
    majorTickStep: 10,
    minorTickStep: 2,
  },
  {
    label: '1.0 mL U-40 (40 Units)',
    scale: 'U-40',
    volumeMl: 1.0,
    maxUnits: 40,
    majorTickStep: 5,
    minorTickStep: 1,
  },
];

export const SCALE_UNITS_PER_ML: Record<SyringeScale, number> = {
  'U-100': 100,
  'U-50': 50,
  'U-40': 40,
};

/**
 * Safely parses numeric input strings from both US/UK (dot decimal "2.5")
 * and European/Swedish (comma decimal "2,5") keyboards.
 * Rejects NaN, Infinity, and negative values.
 */
export function parseLocaleNumber(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.trim().replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

/**
 * Eliminates IEEE-754 floating-point drift (e.g. 0.30000000000000004 -> 0.3)
 */
export function roundClean(val: number, decimals = 6): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export function calculateReconstitution(
  input: ReconstitutionInput
): ReconstitutionResult {
  const unitsPerMl = SCALE_UNITS_PER_ML[input.syringeScale];
  const maxSyringeUnits = roundClean(input.syringeVolumeMl * unitsPerMl, 2);

  const vialMg = Number.isFinite(input.vialMassMg) ? input.vialMassMg : 0;
  const diluentMl = Number.isFinite(input.diluentVolumeMl)
    ? input.diluentVolumeMl
    : 0;
  const rawTarget = Number.isFinite(input.targetDose)
    ? Math.max(0, input.targetDose)
    : 0;

  const targetDoseMg = roundClean(
    input.targetDoseUnit === 'mg' ? rawTarget : rawTarget / 1000,
    6
  );
  const targetDoseMcg = roundClean(
    input.targetDoseUnit === 'mcg' ? rawTarget : rawTarget * 1000,
    4
  );

  // CRITICAL SAFETY: Never substitute phantom non-zero defaults when vial or diluent is 0/empty
  if (vialMg <= 0 || diluentMl <= 0) {
    return {
      isValidInput: false,
      concentrationMgPerMl: 0,
      concentrationMcgPerMl: 0,
      targetDoseMg,
      targetDoseMcg,
      volumeToDrawMl: 0,
      syringeUnits: 0,
      maxSyringeUnits,
      fillPercentage: 0,
      dosesPerVial: 0,
      mcgPerUnit: 0,
      exceedsSyringeCapacity: false,
      exceedsVialMass: false,
      syringesNeededCount: 0,
    };
  }

  const concentrationMgPerMl = roundClean(vialMg / diluentMl, 6);
  const concentrationMcgPerMl = roundClean(concentrationMgPerMl * 1000, 4);

  const volumeToDrawMl =
    concentrationMgPerMl > 0
      ? roundClean(targetDoseMg / concentrationMgPerMl, 6)
      : 0;

  const syringeUnits = roundClean(volumeToDrawMl * unitsPerMl, 4);

  const fillPercentage =
    maxSyringeUnits > 0
      ? Math.min(100, Math.max(0, (syringeUnits / maxSyringeUnits) * 100))
      : 0;

  const dosesPerVial =
    targetDoseMg > 0 ? roundClean(vialMg / targetDoseMg, 2) : 0;

  const mcgPerUnit =
    unitsPerMl > 0 ? roundClean(concentrationMcgPerMl / unitsPerMl, 4) : 0;

  const exceedsSyringeCapacity = syringeUnits > maxSyringeUnits + 1e-6;
  const exceedsVialMass = targetDoseMg > vialMg + 1e-6;
  const syringesNeededCount =
    maxSyringeUnits > 0 && syringeUnits > 0
      ? Math.ceil(roundClean(syringeUnits / maxSyringeUnits, 4))
      : 0;

  return {
    isValidInput: true,
    concentrationMgPerMl,
    concentrationMcgPerMl,
    targetDoseMg,
    targetDoseMcg,
    volumeToDrawMl,
    syringeUnits,
    maxSyringeUnits,
    fillPercentage,
    dosesPerVial,
    mcgPerUnit,
    exceedsSyringeCapacity,
    exceedsVialMass,
    syringesNeededCount,
  };
}

export function calculateBlendReconstitution(
  primaryMg: number,
  secondaryMg: number,
  diluentMl: number,
  primaryTargetMcg: number,
  syringeScale: SyringeScale,
  syringeVolumeMl: SyringeVolumeMl
) {
  const primaryResult = calculateReconstitution({
    vialMassMg: primaryMg,
    diluentVolumeMl: diluentMl,
    targetDose: primaryTargetMcg,
    targetDoseUnit: 'mcg',
    syringeScale,
    syringeVolumeMl,
  });

  const safeSecondaryMg =
    Number.isFinite(secondaryMg) && secondaryMg > 0 ? secondaryMg : 0;

  const secondaryConcentrationMcgPerMl =
    primaryResult.isValidInput && diluentMl > 0
      ? roundClean((safeSecondaryMg * 1000) / diluentMl, 4)
      : 0;
  const secondaryDeliveredMcg = primaryResult.isValidInput
    ? roundClean(
        primaryResult.volumeToDrawMl * secondaryConcentrationMcgPerMl,
        4
      )
    : 0;

  return {
    ...primaryResult,
    secondaryConcentrationMcgPerMl,
    secondaryDeliveredMcg,
  };
}
