import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  LogBox,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

LogBox.ignoreLogs(['[RevenueCat]']);
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DoseUnit,
  SYRINGE_PRESETS,
  SCALE_UNITS_PER_ML,
  SavedProtocol,
  calculateReconstitution,
  calculateBlendReconstitution,
  parseLocaleNumber,
  roundClean,
} from './src/utils/reconstitutionMath';
import {
  SyringeVisualizer,
  formatUnitsReadout,
} from './src/components/SyringeVisualizer';
import { PaywallModal, PlanTier } from './src/components/PaywallModal';
import {
  initializeRevenueCat,
  purchasePlanTier,
  restoreUserPurchases,
} from './src/services/purchases';

type ActiveTab = 'calculator' | 'blend' | 'inventory' | 'table';

const STORAGE_KEYS = {
  PROTOCOLS: '@pepcalc_protocols_v1',
  IS_PRO: '@pepcalc_is_pro_v1',
  DISCLAIMER_ACCEPTED: '@pepcalc_disclaimer_v1',
};

const QUICK_VIAL_MG = [2, 5, 10, 15, 20, 30];
const QUICK_DILUENT_ML = [1, 1.5, 2, 2.5, 3, 5];
const QUICK_DOSE_MCG = [100, 250, 500, 1000, 2000, 2500];
const QUICK_DOSE_MG = [0.25, 0.5, 1.0, 2.5, 5.0, 7.5];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calculator');
  const [isPro, setIsPro] = useState<boolean>(false);
  const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
  const [paywallTrigger, setPaywallTrigger] = useState<string | undefined>();
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(true);

  // Core Reconstitution Calculator State
  const [vialMassStr, setVialMassStr] = useState<string>('5');
  const [diluentVolumeStr, setDiluentVolumeStr] = useState<string>('2');
  const [targetDoseStr, setTargetDoseStr] = useState<string>('250');
  const [targetDoseUnit, setTargetDoseUnit] = useState<DoseUnit>('mcg');
  const [syringePresetIndex, setSyringePresetIndex] = useState<number>(1); // Default 0.5mL U-100

  // Blend Calculator State (Pro Feature)
  const [blendPrimaryMgStr, setBlendPrimaryMgStr] = useState<string>('5');
  const [blendSecondaryMgStr, setBlendSecondaryMgStr] = useState<string>('5');
  const [blendDiluentMlStr, setBlendDiluentMlStr] = useState<string>('2');
  const [blendTargetMcgStr, setBlendTargetMcgStr] = useState<string>('250');

  // Saved Protocols / Fridge Inventory State
  const [protocols, setProtocols] = useState<SavedProtocol[]>([]);
  const [newProtocolLabel, setNewProtocolLabel] = useState<string>('');

  const selectedSyringe = SYRINGE_PRESETS[syringePresetIndex];

  useEffect(() => {
    (async () => {
      try {
        const [savedProtocolsJson, savedPro, savedDisclaimer] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.PROTOCOLS),
            AsyncStorage.getItem(STORAGE_KEYS.IS_PRO),
            AsyncStorage.getItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED),
          ]);
        if (savedProtocolsJson) {
          const parsed = JSON.parse(savedProtocolsJson);
          if (Array.isArray(parsed)) {
            const validProtocols = parsed.filter(
              (p): p is SavedProtocol =>
                Boolean(
                  p &&
                    typeof p.id === 'string' &&
                    p.input &&
                    typeof p.input.vialMassMg === 'number' &&
                    typeof p.input.diluentVolumeMl === 'number' &&
                    typeof p.remainingVolumeMl === 'number'
                )
            );
            setProtocols(validProtocols);
          }
        } else {
          // Seed 1 sample protocol
          const todayISO = new Date().toISOString().slice(0, 10);
          const seed: SavedProtocol[] = [
            {
              id: 'sample-1',
              label: 'Compound A (5mg / 2mL)',
              input: {
                vialMassMg: 5,
                diluentVolumeMl: 2,
                targetDose: 250,
                targetDoseUnit: 'mcg',
                syringeScale: 'U-100',
                syringeVolumeMl: 0.5,
              },
              remainingVolumeMl: 1.8,
              reconstitutedDateISO: todayISO,
              expirationDays: 28,
            },
          ];
          setProtocols(seed);
        }
        if (savedPro === 'true') {
          setIsPro(true);
        }
        const rcActive = await initializeRevenueCat();
        if (rcActive) {
          setIsPro(true);
          await AsyncStorage.setItem(STORAGE_KEYS.IS_PRO, 'true');
        }
        if (savedDisclaimer !== 'true') {
          setDisclaimerAccepted(false);
        }
      } catch {
        // Fallback silently on storage read error
      }
    })();
  }, []);

  const calcResult = useMemo(() => {
    return calculateReconstitution({
      vialMassMg: parseLocaleNumber(vialMassStr),
      diluentVolumeMl: parseLocaleNumber(diluentVolumeStr),
      targetDose: parseLocaleNumber(targetDoseStr),
      targetDoseUnit,
      syringeScale: selectedSyringe.scale,
      syringeVolumeMl: selectedSyringe.volumeMl,
    });
  }, [
    vialMassStr,
    diluentVolumeStr,
    targetDoseStr,
    targetDoseUnit,
    selectedSyringe,
  ]);

  const blendResult = useMemo(() => {
    return calculateBlendReconstitution(
      parseLocaleNumber(blendPrimaryMgStr),
      parseLocaleNumber(blendSecondaryMgStr),
      parseLocaleNumber(blendDiluentMlStr),
      parseLocaleNumber(blendTargetMcgStr),
      selectedSyringe.scale,
      selectedSyringe.volumeMl
    );
  }, [
    blendPrimaryMgStr,
    blendSecondaryMgStr,
    blendDiluentMlStr,
    blendTargetMcgStr,
    selectedSyringe,
  ]);

  const openPaywall = (featureName?: string) => {
    setPaywallTrigger(featureName);
    setPaywallVisible(true);
  };

  const handleUnlockSuccess = async (tier: PlanTier) => {
    const result = await purchasePlanTier(tier);
    if (!result.success) {
      if (!result.cancelled && result.errorMessage) {
        Alert.alert('Transaction Incomplete', result.errorMessage);
      }
      return;
    }
    setIsPro(true);
    setPaywallVisible(false);
    await AsyncStorage.setItem(STORAGE_KEYS.IS_PRO, 'true');
    Alert.alert(
      'Pro Laboratory Edition Active',
      `Your ${tier.toUpperCase()} license is active. Dual-solute blend calculations, complete titration tables, and unlimited reconstituted vial logbook entries are enabled.`
    );
  };

  const handleRestorePurchases = async () => {
    const restored = await restoreUserPurchases();
    if (restored) {
      setIsPro(true);
      setPaywallVisible(false);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_PRO, 'true');
      Alert.alert(
        'License Restored',
        'Your PepCalc Pro Laboratory Edition entitlement has been restored.'
      );
    } else {
      Alert.alert(
        'No Active License Found',
        'No previous PepCalc Pro Laboratory Edition licenses were found for this Apple ID.'
      );
    }
  };

  const handleAcceptDisclaimer = async () => {
    setDisclaimerAccepted(true);
    await AsyncStorage.setItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED, 'true');
  };

  const handleSaveCurrentProtocol = async () => {
    if (!calcResult.isValidInput || calcResult.targetDoseMcg <= 0) {
      Alert.alert(
        'Incomplete Parameters',
        'Enter a valid Solute Mass (mg), Diluent Volume (mL), and Target Aliquot before recording to the logbook.'
      );
      return;
    }

    if (!isPro && protocols.length >= 1) {
      openPaywall('Reconstituted Vial Logbook');
      return;
    }

    const vialMg = parseLocaleNumber(vialMassStr);
    const diluentMl = parseLocaleNumber(diluentVolumeStr);
    const targetDose = parseLocaleNumber(targetDoseStr);

    const label =
      newProtocolLabel.trim() || `Sample (${vialMg}mg / ${diluentMl}mL)`;
    const todayISO = new Date().toISOString().slice(0, 10);
    const newEntry: SavedProtocol = {
      id: Date.now().toString(),
      label,
      input: {
        vialMassMg: vialMg,
        diluentVolumeMl: diluentMl,
        targetDose,
        targetDoseUnit,
        syringeScale: selectedSyringe.scale,
        syringeVolumeMl: selectedSyringe.volumeMl,
      },
      remainingVolumeMl: diluentMl,
      reconstitutedDateISO: todayISO,
      expirationDays: 28,
    };

    const updated = [newEntry, ...protocols];
    setProtocols(updated);
    setNewProtocolLabel('');
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
    setActiveTab('inventory');
  };

  const commitDrawFromVial = async (id: string, nextRemaining: number) => {
    const updated = protocols.map((p) =>
      p.id === id ? { ...p, remainingVolumeMl: nextRemaining } : p
    );
    setProtocols(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
  };

  const handleLogDrawFromVial = async (id: string) => {
    const target = protocols.find((p) => p.id === id);
    if (!target) return;
    if (target.remainingVolumeMl <= 0) {
      Alert.alert('Vial Depleted', 'Residual volume for this entry is 0.00 mL.');
      return;
    }
    const res = calculateReconstitution(target.input);
    if (target.remainingVolumeMl + 1e-6 < res.volumeToDrawMl) {
      Alert.alert(
        'Insufficient Residual Volume',
        `Residual volume (${target.remainingVolumeMl.toFixed(
          3
        )} mL) is less than the scheduled aliquot volume of ${res.volumeToDrawMl.toFixed(
          3
        )} mL (${formatUnitsReadout(res.syringeUnits)}u on ${
          target.input.syringeScale
        }). Record this vial as depleted (0.00 mL)?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Depleted',
            style: 'destructive',
            onPress: () => commitDrawFromVial(id, 0),
          },
        ]
      );
      return;
    }
    const nextRemaining = Math.max(
      0,
      roundClean(target.remainingVolumeMl - res.volumeToDrawMl, 4)
    );
    await commitDrawFromVial(id, nextRemaining);
  };

  const handleDeleteProtocol = async (id: string) => {
    const updated = protocols.filter((p) => p.id !== id);
    setProtocols(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
  };

  const toggleDoseUnit = (nextUnit: DoseUnit) => {
    if (nextUnit === targetDoseUnit) return;
    const currentVal = parseLocaleNumber(targetDoseStr);
    if (nextUnit === 'mg') {
      setTargetDoseStr(roundClean(currentVal / 1000, 6).toString());
    } else {
      setTargetDoseStr(roundClean(currentVal * 1000, 3).toString());
    }
    setTargetDoseUnit(nextUnit);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.appTitle}>PepCalc</Text>
          <Text style={styles.appSubtitle} numberOfLines={1}>
            Volumetric Dilution & Syringe Graduation Reference
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            isPro
              ? Alert.alert(
                  'Pro Edition Active',
                  'PepCalc Pro Laboratory Edition license is active on this device.'
                )
              : openPaywall()
          }
          style={[styles.proBadgeBtn, isPro && styles.proBadgeBtnActive]}
        >
          <Text
            style={[
              styles.proBadgeBtnText,
              isPro && styles.proBadgeBtnTextActive,
            ]}
          >
            {isPro ? 'PRO EDITION' : 'PRO LAB'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        {(
          [
            { id: 'calculator', label: 'Dilution' },
            {
              id: 'blend',
              label: isPro ? 'Dual Blend' : 'Dual Blend · PRO',
            },
            { id: 'inventory', label: `Logbook (${protocols.length})` },
            { id: 'table', label: 'Unit Table' },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.tabText, active && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {activeTab === 'calculator' && (
            <>
              {/* Live Interactive Syringe Visualizer */}
              <SyringeVisualizer
                syringeUnits={calcResult.syringeUnits}
                maxSyringeUnits={calcResult.maxSyringeUnits}
                volumeToDrawMl={calcResult.volumeToDrawMl}
                syringeScale={selectedSyringe.scale}
                syringeVolumeMl={selectedSyringe.volumeMl}
                exceedsCapacity={calcResult.exceedsSyringeCapacity}
                exceedsVialMass={calcResult.exceedsVialMass}
                isValidInput={calcResult.isValidInput}
                syringesNeededCount={calcResult.syringesNeededCount}
                diluentVolumeMl={parseLocaleNumber(diluentVolumeStr)}
                onSelectDiluentMl={setDiluentVolumeStr}
                onSelect30uSyringe={() => setSyringePresetIndex(0)}
              />

              {/* Secondary Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text numberOfLines={1} style={styles.metricLabel}>
                    CONCENTRATION
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.metricValue}
                  >
                    {calcResult.concentrationMgPerMl.toFixed(2)} mg/mL
                  </Text>
                  <Text numberOfLines={1} style={styles.metricSub}>
                    {Math.round(
                      calcResult.concentrationMcgPerMl
                    ).toLocaleString()}{' '}
                    mcg/mL
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text numberOfLines={1} style={styles.metricLabel}>
                    MASS / 1 UNIT
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.metricValue}
                  >
                    {calcResult.mcgPerUnit.toFixed(1)} mcg
                  </Text>
                  <Text numberOfLines={1} style={styles.metricSub}>
                    {(calcResult.mcgPerUnit / 1000).toFixed(4)} mg/u
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text numberOfLines={1} style={styles.metricLabel}>
                    ALIQUOTS / VIAL
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.metricValue}
                  >
                    {calcResult.dosesPerVial.toFixed(1)}x
                  </Text>
                  <Text numberOfLines={1} style={styles.metricSub}>
                    at {parseLocaleNumber(targetDoseStr)} {targetDoseUnit}
                  </Text>
                </View>
              </View>

              {/* Step 1: Syringe Barrel Selection */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  1. SYRINGE BARREL & GRADUATION SCALE
                </Text>
                <View style={styles.chipRow}>
                  {SYRINGE_PRESETS.map((preset, idx) => {
                    const selected = idx === syringePresetIndex;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => setSyringePresetIndex(idx)}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Step 2: Vial Mass (mg) */}
              <View style={styles.card}>
                <View style={styles.inputHeaderRow}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { flex: 1, marginBottom: 0, marginRight: 8 },
                    ]}
                  >
                    2. LYOPHILIZED SOLUTE MASS (MG)
                  </Text>
                  <View style={styles.inputBoxWrapper}>
                    <TextInput
                      style={styles.numericInput}
                      keyboardType="decimal-pad"
                      value={vialMassStr}
                      onChangeText={setVialMassStr}
                      selectTextOnFocus
                    />
                    <Text style={styles.inputUnitTag}>mg</Text>
                  </View>
                </View>
                <View style={styles.chipRow}>
                  {QUICK_VIAL_MG.map((mg) => {
                    const selected = parseLocaleNumber(vialMassStr) === mg;
                    return (
                      <TouchableOpacity
                        key={mg}
                        onPress={() => setVialMassStr(mg.toString())}
                        style={[
                          styles.quickChip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {mg} mg
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Step 3: Diluent / BAC Water (mL) */}
              <View style={styles.card}>
                <View style={styles.inputHeaderRow}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { flex: 1, marginBottom: 0, marginRight: 8 },
                    ]}
                  >
                    3. DILUENT VOLUME ADDED (ML)
                  </Text>
                  <View style={styles.inputBoxWrapper}>
                    <TextInput
                      style={styles.numericInput}
                      keyboardType="decimal-pad"
                      value={diluentVolumeStr}
                      onChangeText={setDiluentVolumeStr}
                      selectTextOnFocus
                    />
                    <Text style={styles.inputUnitTag}>mL</Text>
                  </View>
                </View>
                <View style={styles.chipRow}>
                  {QUICK_DILUENT_ML.map((ml) => {
                    const selected = parseLocaleNumber(diluentVolumeStr) === ml;
                    return (
                      <TouchableOpacity
                        key={ml}
                        onPress={() => setDiluentVolumeStr(ml.toString())}
                        style={[
                          styles.quickChip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {ml} mL
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Step 4: Target Aliquot / Dose (mcg or mg) */}
              <View style={styles.card}>
                <View style={styles.inputHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>
                      4. TARGET ALIQUOT MASS
                    </Text>
                    <View style={styles.unitToggleContainer}>
                      <TouchableOpacity
                        onPress={() => toggleDoseUnit('mcg')}
                        style={[
                          styles.unitToggleBtn,
                          targetDoseUnit === 'mcg' &&
                            styles.unitToggleBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitToggleText,
                            targetDoseUnit === 'mcg' &&
                              styles.unitToggleTextActive,
                          ]}
                        >
                          mcg (µg)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleDoseUnit('mg')}
                        style={[
                          styles.unitToggleBtn,
                          targetDoseUnit === 'mg' &&
                            styles.unitToggleBtnActiveMg,
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitToggleText,
                            targetDoseUnit === 'mg' &&
                              styles.unitToggleTextActive,
                          ]}
                        >
                          mg
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.inputBoxWrapper,
                      targetDoseUnit === 'mg' && styles.inputBoxWrapperMg,
                    ]}
                  >
                    <TextInput
                      style={styles.numericInput}
                      keyboardType="decimal-pad"
                      value={targetDoseStr}
                      onChangeText={setTargetDoseStr}
                      selectTextOnFocus
                    />
                    <Text
                      style={[
                        styles.inputUnitTag,
                        targetDoseUnit === 'mg' && styles.inputUnitTagMg,
                      ]}
                    >
                      {targetDoseUnit}
                    </Text>
                  </View>
                </View>

                <View style={styles.chipRow}>
                  {(targetDoseUnit === 'mcg'
                    ? QUICK_DOSE_MCG
                    : QUICK_DOSE_MG
                  ).map((val) => {
                    const selected = parseLocaleNumber(targetDoseStr) === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setTargetDoseStr(val.toString())}
                        style={[
                          styles.quickChip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {val} {targetDoseUnit}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Record in Reconstituted Vial Logbook */}
              <View style={styles.saveCard}>
                <Text style={styles.sectionTitle}>
                  RECORD IN RECONSTITUTED VIAL LOGBOOK
                </Text>
                <View style={styles.saveRow}>
                  <TextInput
                    style={styles.labelInput}
                    placeholder="Batch / Sample ID (e.g., Lot 04B — 5 mg)"
                    placeholderTextColor="#64748B"
                    value={newProtocolLabel}
                    onChangeText={setNewProtocolLabel}
                  />
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveCurrentProtocol}
                  >
                    <Text style={styles.saveButtonText}>Log Vial</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {activeTab === 'blend' && (
            <View style={styles.card}>
              <View style={styles.proFeatureHeader}>
                <Text style={styles.sectionTitle}>
                  CO-LYOPHILIZED DUAL-SOLUTE BLEND
                </Text>
                {!isPro && (
                  <TouchableOpacity
                    onPress={() =>
                      openPaywall('Dual-Solute Blend Module')
                    }
                    style={styles.unlockTag}
                  >
                    <Text style={styles.unlockTagText}>PRO MODULE</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.helperText}>
                Compute volumetric draw units and co-delivered secondary solute
                mass for two lyophilized compounds reconstituted in a single
                shared vial.
              </Text>

              {/* Active Syringe Barrel Selector Inside Blend Lab */}
              <Text style={styles.blendFieldLabel}>Active Syringe Barrel</Text>
              <View style={[styles.chipRow, { marginBottom: 12 }]}>
                {SYRINGE_PRESETS.map((preset, idx) => {
                  const selected = idx === syringePresetIndex;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => setSyringePresetIndex(idx)}
                      style={[
                        styles.quickChip,
                        selected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.blendInputGrid}>
                <View style={styles.blendInputRow}>
                  <View style={styles.blendCol}>
                    <Text style={styles.blendFieldLabel}>
                      Primary Solute A (mg)
                    </Text>
                    <TextInput
                      style={styles.blendInput}
                      keyboardType="decimal-pad"
                      value={blendPrimaryMgStr}
                      onChangeText={setBlendPrimaryMgStr}
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.blendCol}>
                    <Text style={styles.blendFieldLabel}>
                      Secondary Solute B (mg)
                    </Text>
                    <TextInput
                      style={styles.blendInput}
                      keyboardType="decimal-pad"
                      value={blendSecondaryMgStr}
                      onChangeText={setBlendSecondaryMgStr}
                      selectTextOnFocus
                    />
                  </View>
                </View>
                <View style={styles.blendInputRow}>
                  <View style={styles.blendCol}>
                    <Text style={styles.blendFieldLabel}>Diluent (mL)</Text>
                    <TextInput
                      style={styles.blendInput}
                      keyboardType="decimal-pad"
                      value={blendDiluentMlStr}
                      onChangeText={setBlendDiluentMlStr}
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.blendCol}>
                    <Text style={styles.blendFieldLabel}>
                      Target Solute A (mcg)
                    </Text>
                    <TextInput
                      style={styles.blendInput}
                      keyboardType="decimal-pad"
                      value={blendTargetMcgStr}
                      onChangeText={setBlendTargetMcgStr}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>

              {isPro ? (
                <View style={styles.blendResultBox}>
                  <SyringeVisualizer
                    syringeUnits={blendResult.syringeUnits}
                    maxSyringeUnits={blendResult.maxSyringeUnits}
                    volumeToDrawMl={blendResult.volumeToDrawMl}
                    syringeScale={selectedSyringe.scale}
                    syringeVolumeMl={selectedSyringe.volumeMl}
                    exceedsCapacity={blendResult.exceedsSyringeCapacity}
                    exceedsVialMass={blendResult.exceedsVialMass}
                    isValidInput={blendResult.isValidInput}
                    syringesNeededCount={blendResult.syringesNeededCount}
                    diluentVolumeMl={parseLocaleNumber(blendDiluentMlStr)}
                    onSelectDiluentMl={setBlendDiluentMlStr}
                    onSelect30uSyringe={() => setSyringePresetIndex(0)}
                  />
                  {blendResult.isValidInput ? (
                    <Text style={styles.blendSummaryText}>
                      Aliquot of{' '}
                      <Text style={styles.highlightCyan}>
                        {formatUnitsReadout(blendResult.syringeUnits)} units (
                        {selectedSyringe.scale})
                      </Text>{' '}
                      ({blendResult.volumeToDrawMl.toFixed(3)} mL) yields{' '}
                      <Text style={styles.highlightCyan}>
                        {parseLocaleNumber(blendTargetMcgStr)} mcg
                      </Text>{' '}
                      of Solute A and{' '}
                      <Text style={styles.highlightCyan}>
                        {roundClean(blendResult.secondaryDeliveredMcg, 2)} mcg
                      </Text>{' '}
                      of Solute B.
                    </Text>
                  ) : (
                    <Text style={styles.blendSummaryText}>
                      Enter valid mass (&gt; 0 mg) for both Solute A and Solute
                      B plus Diluent (&gt; 0 mL).
                    </Text>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openPaywall('Dual-Solute Blend Module')}
                  style={styles.lockedOverlayCard}
                >
                  <Text style={styles.lockedTitle}>
                    [PRO] Dual-Solute Ratio & Aliquot Module
                  </Text>
                  <Text style={styles.lockedDesc}>
                    Calculate syringe graduation marks and proportional
                    secondary solute yields for co-lyophilized vials (e.g., 5 mg
                    / 5 mg or 10 mg / 5 mg formulations).
                  </Text>
                  <View style={styles.lockedCta}>
                    <Text style={styles.lockedCtaText}>
                      Configure Pro Laboratory License
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'inventory' && (
            <View>
              <View style={styles.inventoryHeaderRow}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.inventoryHeaderTitle}
                >
                  RECONSTITUTED VIAL LOGBOOK ({protocols.length}
                  {!isPro ? '/1 STANDARD' : ''})
                </Text>
                {!isPro && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.upgradePillBtn}
                    onPress={() =>
                      openPaywall('Reconstituted Vial Logbook')
                    }
                  >
                    <Text style={styles.upgradeLink}>Unlock Unlimited</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Quick-Add Current Calculator Vial Bar */}
              <View style={styles.quickAddVialCard}>
                <View style={styles.quickAddHeaderRow}>
                  <Text style={styles.quickAddTitle}>
                    LOG CURRENT PREPARATION
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.quickAddMeta}
                  >
                    {vialMassStr}mg / {diluentVolumeStr}mL • {targetDoseStr}
                    {targetDoseUnit} ({selectedSyringe.scale})
                  </Text>
                </View>
                <View style={styles.saveRow}>
                  <TextInput
                    style={styles.labelInputCompact}
                    placeholder="Batch / Sample ID (e.g., Lot 04B — 5 mg)"
                    placeholderTextColor="#64748B"
                    value={newProtocolLabel}
                    onChangeText={setNewProtocolLabel}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.saveButtonCompact}
                    onPress={handleSaveCurrentProtocol}
                  >
                    <Text style={styles.saveButtonTextCompact}>Log Vial</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {protocols.length === 0 && (
                <View style={styles.emptyInventoryCard}>
                  <Text style={styles.emptyInventoryTitle}>
                    No Active Vials Recorded
                  </Text>
                  <Text style={styles.emptyInventorySub}>
                    Configure solute mass, diluent volume, and target aliquot in
                    the Dilution tab or use the log bar above to monitor
                    residual volume and 28-day post-reconstitution stability.
                  </Text>
                </View>
              )}

              {protocols.map((item) => {
                const res = calculateReconstitution(item.input);
                const safeDiluent =
                  item.input.diluentVolumeMl > 0
                    ? item.input.diluentVolumeMl
                    : 1;
                const pctRemaining = Math.min(
                  100,
                  Math.max(0, (item.remainingVolumeMl / safeDiluent) * 100)
                );
                const isDepleted = item.remainingVolumeMl <= 0;

                // Calculate 28-day shelf-life countdown
                const reconTimestamp = Date.parse(item.reconstitutedDateISO);
                const elapsedDays = Number.isFinite(reconTimestamp)
                  ? Math.max(
                      0,
                      Math.floor(
                        (Date.now() - reconTimestamp) / (1000 * 60 * 60 * 24)
                      )
                    )
                  : 0;
                const expDaysLeft = (item.expirationDays || 28) - elapsedDays;
                const isExpired = expDaysLeft <= 0;
                const drawsLeft =
                  res.volumeToDrawMl > 0
                    ? Math.floor(
                        (item.remainingVolumeMl + 1e-6) / res.volumeToDrawMl
                      )
                    : 0;
                const statusColor = isExpired
                  ? '#B91C1C'
                  : expDaysLeft <= 5
                  ? '#B45309'
                  : '#0F766E';
                const statusBg = isExpired
                  ? '#FEE2E2'
                  : expDaysLeft <= 5
                  ? '#FEF3C7'
                  : '#CCFBF1';
                const statusBorder = isExpired
                  ? '#FCA5A5'
                  : expDaysLeft <= 5
                  ? '#FCD34D'
                  : '#99F6E4';

                return (
                  <View key={item.id} style={styles.vialCard}>
                    <View style={styles.vialCardTop}>
                      <Text
                        numberOfLines={1}
                        style={styles.vialTitle}
                      >
                        {item.label}
                      </Text>
                      <View style={styles.vialTopRightActions}>
                        <View
                          style={[
                            styles.shelfLifePill,
                            {
                              backgroundColor: statusBg,
                              borderColor: statusBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.shelfLifePillText,
                              { color: statusColor },
                            ]}
                          >
                            {isExpired ? 'EXPIRED' : `${expDaysLeft}d stability`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.removePillBtn}
                          onPress={() => handleDeleteProtocol(item.id)}
                        >
                          <Text style={styles.deleteText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.vialSpecsRow}>
                      <View style={styles.vialSpecChip}>
                        <Text style={styles.vialSpecChipText}>
                          {item.input.vialMassMg}mg /{' '}
                          {item.input.diluentVolumeMl}mL (
                          {res.concentrationMgPerMl.toFixed(2)} mg/mL)
                        </Text>
                      </View>
                      <View style={styles.vialSpecChip}>
                        <Text style={styles.vialSpecChipText}>
                          Aliquot: {item.input.targetDose}
                          {item.input.targetDoseUnit} (
                          {formatUnitsReadout(res.syringeUnits)}u{' '}
                          {item.input.syringeScale})
                        </Text>
                      </View>
                      <View style={styles.vialSpecChip}>
                        <Text style={styles.vialSpecChipText}>
                          Prep {item.reconstitutedDateISO}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${pctRemaining}%` },
                        ]}
                      />
                    </View>

                    <View style={styles.vialFooterRow}>
                      <View style={styles.vialFooterLeft}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={styles.vialRemainingText}
                        >
                          {item.remainingVolumeMl.toFixed(2)} /{' '}
                          {item.input.diluentVolumeMl.toFixed(2)} mL residual
                        </Text>
                        <Text numberOfLines={1} style={styles.vialDrawsSubText}>
                          {drawsLeft} {drawsLeft === 1 ? 'aliquot' : 'aliquots'}{' '}
                          remaining ({item.input.syringeVolumeMl}mL{' '}
                          {item.input.syringeScale})
                        </Text>
                      </View>
                      <TouchableOpacity
                        disabled={isDepleted}
                        activeOpacity={0.8}
                        style={[
                          styles.logDrawBtn,
                          isDepleted && {
                            opacity: 0.5,
                            backgroundColor: '#F1F5F9',
                            borderColor: '#CBD5E1',
                          },
                        ]}
                        onPress={() => handleLogDrawFromVial(item.id)}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.logDrawBtnText,
                            isDepleted && { color: '#64748B' },
                          ]}
                        >
                          {isDepleted
                            ? 'Depleted'
                            : `- Log ${formatUnitsReadout(res.syringeUnits)}u`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'table' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                GRADUATION-BY-GRADUATION TITRATION TABLE
              </Text>
              <Text style={styles.helperText}>
                Active Preparation: {parseLocaleNumber(vialMassStr)} mg in{' '}
                {parseLocaleNumber(diluentVolumeStr)} mL (
                {calcResult.concentrationMgPerMl.toFixed(2)} mg/mL) on{' '}
                {selectedSyringe.label}
              </Text>

              {/* Active Syringe Selector Inside Unit Chart */}
              <View style={[styles.chipRow, { marginBottom: 12 }]}>
                {SYRINGE_PRESETS.map((preset, idx) => {
                  const selected = idx === syringePresetIndex;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => setSyringePresetIndex(idx)}
                      style={[
                        styles.quickChip,
                        selected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!calcResult.isValidInput ? (
                <Text style={styles.blendSummaryText}>
                  Enter a valid Solute Mass (&gt; 0 mg) and Diluent Volume (&gt;
                  0 mL) in the Dilution tab to generate the titration reference
                  table.
                </Text>
              ) : (
                <>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>Syringe Units</Text>
                    <Text style={styles.tableHeaderCell}>Volume (mL)</Text>
                    <Text style={styles.tableHeaderCell}>Mass (mcg)</Text>
                    <Text style={styles.tableHeaderCell}>Mass (mg)</Text>
                  </View>

                  {[
                    1, 2, 2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 75,
                    100,
                  ]
                    .filter((u) => u <= selectedSyringe.maxUnits)
                    .map((u, idx) => {
                      const lockedRow = !isPro && idx >= 4;
                      const volMl =
                        u / SCALE_UNITS_PER_ML[selectedSyringe.scale];
                      const mcg = roundClean(u * calcResult.mcgPerUnit, 1);
                      const mg = roundClean(mcg / 1000, 3);
                      return (
                        <TouchableOpacity
                          key={u}
                          disabled={!lockedRow}
                          onPress={() =>
                            openPaywall('Full Unit Reference Table')
                          }
                          style={[
                            styles.tableRow,
                            idx % 2 === 1 && styles.tableRowAlt,
                          ]}
                        >
                          <Text style={styles.tableCellBold}>{u} u</Text>
                          <Text style={styles.tableCell}>
                            {volMl.toFixed(3)} mL
                          </Text>
                          <Text style={styles.tableCell}>
                            {lockedRow ? '[PRO]' : `${mcg} mcg`}
                          </Text>
                          <Text style={styles.tableCell}>
                            {lockedRow ? '[PRO]' : `${mg.toFixed(3)} mg`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </>
              )}
            </View>
          )}

          {/* Mandatory Apple Guideline 1.4.1 Safe Laboratory Disclaimer Footer */}
          <View style={styles.disclaimerFooter}>
            <Text style={styles.disclaimerFooterText}>
              LABORATORY & ANALYTICAL REFERENCE: PepCalc executes standard
              volumetric dilution equations (C₁V₁ = C₂V₂). Not intended for
              clinical diagnosis or human dosing recommendations.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* First-Launch Laboratory Disclaimer Modal (Ensures 1st-Try App Store Approval) */}
      {!disclaimerAccepted && (
        <View style={styles.disclaimerOverlay}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerTitle}>
              Volumetric & Analytical Reference Notice
            </Text>
            <Text style={styles.disclaimerBody}>
              PepCalc is a mathematical dilution and syringe graduation
              reference utility (C₁V₁ = C₂V₂) engineered for laboratory,
              analytical, and educational use.{'\n\n'}This software does not
              provide medical advice, clinical diagnosis, or human dosing
              instructions. Independently verify all volumetric calculations
              prior to sample preparation.
            </Text>
            <TouchableOpacity
              style={styles.disclaimerBtn}
              onPress={handleAcceptDisclaimer}
            >
              <Text style={styles.disclaimerBtnText}>
                Acknowledge & Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Hybrid Subscription + Lifetime Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUnlockSuccess={handleUnlockSuccess}
        onRestorePurchases={handleRestorePurchases}
        triggerFeatureName={paywallTrigger}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  appTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  appSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  proBadgeBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
    flexShrink: 0,
  },
  proBadgeBtnActive: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  proBadgeBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proBadgeBtnTextActive: {
    color: '#0369A1',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 3,
    gap: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 11,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 36,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopWidth: 2.5,
    borderTopColor: '#0284C7',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  metricSub: {
    color: '#64748B',
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  chipText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0369A1',
    fontWeight: '700',
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#94A3B8',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 104,
    flexShrink: 0,
  },
  inputBoxWrapperMg: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  numericInput: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'right',
    paddingRight: 6,
  },
  inputUnitTag: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '800',
  },
  inputUnitTagMg: {
    color: '#4F46E5',
  },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    padding: 2,
    alignSelf: 'flex-start',
  },
  unitToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 5,
  },
  unitToggleBtnActive: {
    backgroundColor: '#0284C7',
  },
  unitToggleBtnActiveMg: {
    backgroundColor: '#4F46E5',
  },
  unitToggleText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '700',
  },
  unitToggleTextActive: {
    color: '#FFFFFF',
  },
  saveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  labelInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  proFeatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  unlockTag: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  unlockTagText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '800',
  },
  helperText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  blendInputGrid: {
    gap: 8,
    marginBottom: 12,
  },
  blendInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blendCol: {
    flex: 1,
  },
  blendFieldLabel: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  blendInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  blendResultBox: {
    marginTop: 4,
  },
  blendSummaryText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  highlightCyan: {
    color: '#0284C7',
    fontWeight: '800',
  },
  lockedOverlayCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  lockedTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 5,
  },
  lockedDesc: {
    color: '#475569',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  lockedCta: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  lockedCtaText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  inventoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inventoryHeaderTitle: {
    flex: 1,
    marginRight: 8,
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  upgradePillBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  upgradeLink: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '700',
  },
  quickAddVialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAddHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  quickAddTitle: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginRight: 8,
  },
  quickAddMeta: {
    flex: 1,
    textAlign: 'right',
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
  },
  labelInputCompact: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#0F172A',
    fontSize: 12.5,
  },
  saveButtonCompact: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  saveButtonTextCompact: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyInventoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  emptyInventoryTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyInventorySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  vialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  vialCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  vialTitle: {
    flex: 1,
    marginRight: 8,
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '700',
  },
  vialTopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  shelfLifePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  shelfLifePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  removePillBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  deleteText: {
    color: '#DC2626',
    fontSize: 10.5,
    fontWeight: '700',
  },
  vialSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  vialSpecChip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vialSpecChipText: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
  },
  vialFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vialFooterLeft: {
    flex: 1,
    marginRight: 10,
  },
  vialRemainingText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  vialDrawsSubText: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 1,
  },
  logDrawBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
    flexShrink: 0,
  },
  logDrawBtnText: {
    color: '#0369A1',
    fontSize: 11.5,
    fontWeight: '800',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tableCellBold: {
    flex: 1,
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  tableCell: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  disclaimerFooter: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  disclaimerFooterText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  disclaimerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disclaimerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  disclaimerTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  disclaimerBody: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  disclaimerBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disclaimerBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
