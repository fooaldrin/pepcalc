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

const SCALE_UNITS_PER_ML: Record<SyringeScale, number> = {
  'U-100': 100,
  'U-50': 50,
  'U-40': 40,
};

export function calculateReconstitution(
  input: ReconstitutionInput
): ReconstitutionResult {
  const safeVialMg = Math.max(0.001, input.vialMassMg || 0);
  const safeDiluentMl = Math.max(0.01, input.diluentVolumeMl || 0);
  const rawTarget = Math.max(0, input.targetDose || 0);

  const targetDoseMg =
    input.targetDoseUnit === 'mg' ? rawTarget : rawTarget / 1000;
  const targetDoseMcg =
    input.targetDoseUnit === 'mcg' ? rawTarget : rawTarget * 1000;

  const concentrationMgPerMl = safeVialMg / safeDiluentMl;
  const concentrationMcgPerMl = concentrationMgPerMl * 1000;

  const volumeToDrawMl =
    concentrationMgPerMl > 0 ? targetDoseMg / concentrationMgPerMl : 0;

  const unitsPerMl = SCALE_UNITS_PER_ML[input.syringeScale];
  const syringeUnits = volumeToDrawMl * unitsPerMl;
  const maxSyringeUnits = input.syringeVolumeMl * unitsPerMl;

  const fillPercentage =
    maxSyringeUnits > 0
      ? Math.min(100, Math.max(0, (syringeUnits / maxSyringeUnits) * 100))
      : 0;

  const dosesPerVial =
    targetDoseMg > 0 ? Math.floor((safeVialMg / targetDoseMg) * 100) / 100 : 0;

  const mcgPerUnit = unitsPerMl > 0 ? concentrationMcgPerMl / unitsPerMl : 0;

  return {
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
    exceedsSyringeCapacity: syringeUnits > maxSyringeUnits,
    exceedsVialMass: targetDoseMg > safeVialMg,
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

  const secondaryConcentrationMcgPerMl =
    diluentMl > 0 ? (secondaryMg * 1000) / diluentMl : 0;
  const secondaryDeliveredMcg =
    primaryResult.volumeToDrawMl * secondaryConcentrationMcgPerMl;

  return {
    ...primaryResult,
    secondaryConcentrationMcgPerMl,
    secondaryDeliveredMcg,
  };
}
