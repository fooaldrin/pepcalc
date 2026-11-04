import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DoseUnit,
  SyringeScale,
  SyringeVolumeMl,
  SYRINGE_PRESETS,
  SavedProtocol,
  calculateReconstitution,
  calculateBlendReconstitution,
} from './src/utils/reconstitutionMath';
import { SyringeVisualizer } from './src/components/SyringeVisualizer';
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
          setProtocols(JSON.parse(savedProtocolsJson));
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
      vialMassMg: parseFloat(vialMassStr) || 0,
      diluentVolumeMl: parseFloat(diluentVolumeStr) || 0,
      targetDose: parseFloat(targetDoseStr) || 0,
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
      parseFloat(blendPrimaryMgStr) || 0,
      parseFloat(blendSecondaryMgStr) || 0,
      parseFloat(blendDiluentMlStr) || 0,
      parseFloat(blendTargetMcgStr) || 0,
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
    const purchased = await purchasePlanTier(tier);
    if (!purchased) return;
    setIsPro(true);
    setPaywallVisible(false);
    await AsyncStorage.setItem(STORAGE_KEYS.IS_PRO, 'true');
    Alert.alert(
      'PepCalc Pro Unlocked',
      `Your ${tier.toUpperCase()} Lab Pass is now active. All multi-compound blend calculators, titration charts, and unlimited vial inventory slots are unlocked.`
    );
  };

  const handleAcceptDisclaimer = async () => {
    setDisclaimerAccepted(true);
    await AsyncStorage.setItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED, 'true');
  };

  const handleSaveCurrentProtocol = async () => {
    if (!isPro && protocols.length >= 1) {
      openPaywall('Unlimited Vial Fridge Inventory');
      return;
    }

    const label =
      newProtocolLabel.trim() ||
      `Sample (${vialMassStr}mg in ${diluentVolumeStr}mL)`;
    const todayISO = new Date().toISOString().slice(0, 10);
    const newEntry: SavedProtocol = {
      id: Date.now().toString(),
      label,
      input: {
        vialMassMg: parseFloat(vialMassStr) || 5,
        diluentVolumeMl: parseFloat(diluentVolumeStr) || 2,
        targetDose: parseFloat(targetDoseStr) || 250,
        targetDoseUnit,
        syringeScale: selectedSyringe.scale,
        syringeVolumeMl: selectedSyringe.volumeMl,
      },
      remainingVolumeMl: parseFloat(diluentVolumeStr) || 2,
      reconstitutedDateISO: todayISO,
      expirationDays: 28,
    };

    const updated = [newEntry, ...protocols];
    setProtocols(updated);
    setNewProtocolLabel('');
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
    setActiveTab('inventory');
  };

  const handleLogDrawFromVial = async (id: string) => {
    const updated = protocols.map((p) => {
      if (p.id !== id) return p;
      const res = calculateReconstitution(p.input);
      const nextRemaining = Math.max(
        0,
        Math.round((p.remainingVolumeMl - res.volumeToDrawMl) * 1000) / 1000
      );
      return { ...p, remainingVolumeMl: nextRemaining };
    });
    setProtocols(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
  };

  const handleDeleteProtocol = async (id: string) => {
    const updated = protocols.filter((p) => p.id !== id);
    setProtocols(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTOCOLS, JSON.stringify(updated));
  };

  const toggleDoseUnit = (nextUnit: DoseUnit) => {
    if (nextUnit === targetDoseUnit) return;
    const currentVal = parseFloat(targetDoseStr) || 0;
    if (nextUnit === 'mg') {
      setTargetDoseStr((currentVal / 1000).toString());
    } else {
      setTargetDoseStr((currentVal * 1000).toString());
    }
    setTargetDoseUnit(nextUnit);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>PepCalc</Text>
          <Text style={styles.appSubtitle}>
            Volumetric Reconstitution & Syringe Unit Lab
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            isPro
              ? Alert.alert('Pro Active', 'PepCalc Pro Lab is unlocked.')
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
            {isPro ? '★ PRO LAB' : 'UNLOCK PRO'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        {(
          [
            { id: 'calculator', label: 'Syringe Calc' },
            { id: 'blend', label: 'Blend Lab 🔒' },
            { id: 'inventory', label: `Vials (${protocols.length})` },
            { id: 'table', label: 'Unit Chart' },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {isPro ? tab.label.replace(' 🔒', '') : tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
            />

            {/* Secondary Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>CONCENTRATION</Text>
                <Text style={styles.metricValue}>
                  {calcResult.concentrationMgPerMl.toFixed(2)} mg/mL
                </Text>
                <Text style={styles.metricSub}>
                  {Math.round(calcResult.concentrationMcgPerMl).toLocaleString()}{' '}
                  mcg/mL
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>PER 1 SYRINGE UNIT</Text>
                <Text style={styles.metricValue}>
                  {calcResult.mcgPerUnit.toFixed(1)} mcg
                </Text>
                <Text style={styles.metricSub}>
                  {(calcResult.mcgPerUnit / 1000).toFixed(4)} mg/unit
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TOTAL VIAL DOSES</Text>
                <Text style={styles.metricValue}>
                  {calcResult.dosesPerVial.toFixed(1)}x
                </Text>
                <Text style={styles.metricSub}>
                  at {targetDoseStr} {targetDoseUnit}
                </Text>
              </View>
            </View>

            {/* Step 1: Syringe Barrel Selection */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>1. SYRINGE TYPE & VOLUME</Text>
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
                <Text style={styles.sectionTitle}>
                  2. VIAL LYOPHILIZED MASS (MG)
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
                  const selected = parseFloat(vialMassStr) === mg;
                  return (
                    <TouchableOpacity
                      key={mg}
                      onPress={() => setVialMassStr(mg.toString())}
                      style={[styles.quickChip, selected && styles.chipSelected]}
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
                <Text style={styles.sectionTitle}>
                  3. DILUENT / WATER ADDED (ML)
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
                  const selected = parseFloat(diluentVolumeStr) === ml;
                  return (
                    <TouchableOpacity
                      key={ml}
                      onPress={() => setDiluentVolumeStr(ml.toString())}
                      style={[styles.quickChip, selected && styles.chipSelected]}
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
                <View>
                  <Text style={styles.sectionTitle}>4. TARGET DRAW AMOUNT</Text>
                  <View style={styles.unitToggleContainer}>
                    <TouchableOpacity
                      onPress={() => toggleDoseUnit('mcg')}
                      style={[
                        styles.unitToggleBtn,
                        targetDoseUnit === 'mcg' && styles.unitToggleBtnActive,
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
                        targetDoseUnit === 'mg' && styles.unitToggleBtnActive,
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
                <View style={styles.inputBoxWrapper}>
                  <TextInput
                    style={styles.numericInput}
                    keyboardType="decimal-pad"
                    value={targetDoseStr}
                    onChangeText={setTargetDoseStr}
                    selectTextOnFocus
                  />
                  <Text style={styles.inputUnitTag}>{targetDoseUnit}</Text>
                </View>
              </View>

              <View style={styles.chipRow}>
                {(targetDoseUnit === 'mcg'
                  ? QUICK_DOSE_MCG
                  : QUICK_DOSE_MG
                ).map((val) => {
                  const selected = parseFloat(targetDoseStr) === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setTargetDoseStr(val.toString())}
                      style={[styles.quickChip, selected && styles.chipSelected]}
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

            {/* Save to Vial Fridge Inventory */}
            <View style={styles.saveCard}>
              <Text style={styles.sectionTitle}>
                SAVE TO VIAL FRIDGE INVENTORY
              </Text>
              <View style={styles.saveRow}>
                <TextInput
                  style={styles.labelInput}
                  placeholder="Label (e.g. Sample B - 5mg)"
                  placeholderTextColor="#64748B"
                  value={newProtocolLabel}
                  onChangeText={setNewProtocolLabel}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveCurrentProtocol}
                >
                  <Text style={styles.saveButtonText}>+ Save Vial</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {activeTab === 'blend' && (
          <View style={styles.card}>
            <View style={styles.proFeatureHeader}>
              <Text style={styles.sectionTitle}>
                DUAL-COMPOUND BLEND CALCULATOR
              </Text>
              {!isPro && (
                <TouchableOpacity
                  onPress={() => openPaywall('Dual-Compound Blend Calculator')}
                  style={styles.unlockTag}
                >
                  <Text style={styles.unlockTagText}>PRO FEATURE</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.helperText}>
              Calculate exact syringe units and secondary compound delivery when
              two lyophilized compounds share a single reconstituted vial.
            </Text>

            <View style={styles.blendInputGrid}>
              <View style={styles.blendCol}>
                <Text style={styles.blendFieldLabel}>Compound A (mg)</Text>
                <TextInput
                  style={styles.blendInput}
                  keyboardType="decimal-pad"
                  value={blendPrimaryMgStr}
                  onChangeText={setBlendPrimaryMgStr}
                />
              </View>
              <View style={styles.blendCol}>
                <Text style={styles.blendFieldLabel}>Compound B (mg)</Text>
                <TextInput
                  style={styles.blendInput}
                  keyboardType="decimal-pad"
                  value={blendSecondaryMgStr}
                  onChangeText={setBlendSecondaryMgStr}
                />
              </View>
              <View style={styles.blendCol}>
                <Text style={styles.blendFieldLabel}>Diluent (mL)</Text>
                <TextInput
                  style={styles.blendInput}
                  keyboardType="decimal-pad"
                  value={blendDiluentMlStr}
                  onChangeText={setBlendDiluentMlStr}
                />
              </View>
              <View style={styles.blendCol}>
                <Text style={styles.blendFieldLabel}>Target A (mcg)</Text>
                <TextInput
                  style={styles.blendInput}
                  keyboardType="decimal-pad"
                  value={blendTargetMcgStr}
                  onChangeText={setBlendTargetMcgStr}
                />
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
                />
                <Text style={styles.blendSummaryText}>
                  Drawing{' '}
                  <Text style={styles.highlightCyan}>
                    {blendResult.syringeUnits.toFixed(1)} units
                  </Text>{' '}
                  ({blendResult.volumeToDrawMl.toFixed(3)} mL) delivers{' '}
                  <Text style={styles.highlightCyan}>
                    {blendTargetMcgStr} mcg
                  </Text>{' '}
                  of Compound A +{' '}
                  <Text style={styles.highlightCyan}>
                    {Math.round(blendResult.secondaryDeliveredMcg)} mcg
                  </Text>{' '}
                  of Compound B.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openPaywall('Dual-Compound Blend Calculator')}
                style={styles.lockedOverlayCard}
              >
                <Text style={styles.lockedTitle}>
                  🔒 Unlock Multi-Compound Blend Math
                </Text>
                <Text style={styles.lockedDesc}>
                  See exact syringe tick marks and secondary mcg ratios for
                  blended vials (e.g., 5mg/5mg or 10mg/5mg combinations).
                </Text>
                <View style={styles.lockedCta}>
                  <Text style={styles.lockedCtaText}>
                    Unlock Pro Lab (Trial or Lifetime)
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'inventory' && (
          <View>
            <View style={styles.inventoryHeaderRow}>
              <Text style={styles.sectionTitle}>
                ACTIVE RECONSTITUTED VIALS ({protocols.length}
                {!isPro ? '/1 Free' : ''})
              </Text>
              {!isPro && (
                <TouchableOpacity
                  onPress={() => openPaywall('Unlimited Vial Fridge Inventory')}
                >
                  <Text style={styles.upgradeLink}>+ Unlock Unlimited</Text>
                </TouchableOpacity>
              )}
            </View>

            {protocols.map((item) => {
              const res = calculateReconstitution(item.input);
              const pctRemaining = Math.min(
                100,
                Math.max(
                  0,
                  (item.remainingVolumeMl / item.input.diluentVolumeMl) * 100
                )
              );
              return (
                <View key={item.id} style={styles.vialCard}>
                  <View style={styles.vialCardTop}>
                    <View>
                      <Text style={styles.vialTitle}>{item.label}</Text>
                      <Text style={styles.vialMeta}>
                        Mixed: {item.reconstitutedDateISO} •{' '}
                        {item.input.vialMassMg}mg in{' '}
                        {item.input.diluentVolumeMl}mL (
                        {res.concentrationMgPerMl.toFixed(2)} mg/mL)
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteProtocol(item.id)}
                    >
                      <Text style={styles.deleteText}>Remove</Text>
                    </TouchableOpacity>
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
                    <Text style={styles.vialRemainingText}>
                      Remaining: {item.remainingVolumeMl.toFixed(2)} mL /{' '}
                      {item.input.diluentVolumeMl} mL (
                      {Math.floor(
                        item.remainingVolumeMl /
                          Math.max(0.001, res.volumeToDrawMl)
                      )}{' '}
                      draws left)
                    </Text>
                    <TouchableOpacity
                      style={styles.logDrawBtn}
                      onPress={() => handleLogDrawFromVial(item.id)}
                    >
                      <Text style={styles.logDrawBtnText}>
                        - Log {res.syringeUnits.toFixed(1)}u Draw
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
              UNIT-BY-UNIT TITRATION REFERENCE TABLE
            </Text>
            <Text style={styles.helperText}>
              Current Mix: {vialMassStr} mg in {diluentVolumeStr} mL (
              {calcResult.concentrationMgPerMl.toFixed(2)} mg/mL) on{' '}
              {selectedSyringe.label}
            </Text>

            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Syringe Units</Text>
              <Text style={styles.tableHeaderCell}>Volume (mL)</Text>
              <Text style={styles.tableHeaderCell}>Mass (mcg)</Text>
              <Text style={styles.tableHeaderCell}>Mass (mg)</Text>
            </View>

            {[2, 5, 10, 12.5, 15, 20, 25, 30, 40, 50]
              .filter((u) => u <= selectedSyringe.maxUnits)
              .map((u, idx) => {
                const lockedRow = !isPro && idx >= 4;
                const volMl = u / (selectedSyringe.scale === 'U-40' ? 40 : 100);
                const mcg = u * calcResult.mcgPerUnit;
                const mg = mcg / 1000;
                return (
                  <TouchableOpacity
                    key={u}
                    disabled={!lockedRow}
                    onPress={() => openPaywall('Full Unit Reference Table')}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && styles.tableRowAlt,
                    ]}
                  >
                    <Text style={styles.tableCellBold}>{u} u</Text>
                    <Text style={styles.tableCell}>{volMl.toFixed(3)} mL</Text>
                    <Text style={styles.tableCell}>
                      {lockedRow ? '🔒 Pro' : `${Math.round(mcg)} mcg`}
                    </Text>
                    <Text style={styles.tableCell}>
                      {lockedRow ? '🔒 Pro' : `${mg.toFixed(2)} mg`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* Mandatory Apple Guideline 1.4.1 Safe Laboratory Disclaimer Footer */}
        <View style={styles.disclaimerFooter}>
          <Text style={styles.disclaimerFooterText}>
            LABORATORY & EDUCATIONAL UTILITY: PepCalc performs mathematical
            volumetric concentration conversions (C₁V₁ = C₂V₂). Not intended for
            clinical or medical dosing advice.
          </Text>
        </View>
      </ScrollView>

      {/* First-Launch Laboratory Disclaimer Modal (Ensures 1st-Try App Store Approval) */}
      {!disclaimerAccepted && (
        <View style={styles.disclaimerOverlay}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerTitle}>
              Laboratory & Mathematical Reference Tool
            </Text>
            <Text style={styles.disclaimerBody}>
              PepCalc is a volumetric solution dilution and unit conversion
              calculator (C₁V₁ = C₂V₂) designed for laboratory, research, and
              educational mathematics.{'\n\n'}This application does not provide
              medical advice, clinical diagnoses, or human dosing
              recommendations. Always verify volumetric measurements
              independently.
            </Text>
            <TouchableOpacity
              style={styles.disclaimerBtn}
              onPress={handleAcceptDisclaimer}
            >
              <Text style={styles.disclaimerBtnText}>
                I Understand & Agree
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
        triggerFeatureName={paywallTrigger}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  appTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  appSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  proBadgeBtn: {
    backgroundColor: '#22D3EE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  proBadgeBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  proBadgeBtnText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  proBadgeBtnTextActive: {
    color: '#22D3EE',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#0A0E17',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabItemActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderColor: '#22D3EE',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#22D3EE',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  metricSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSelected: {
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    borderColor: '#22D3EE',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#22D3EE',
    fontWeight: '700',
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 110,
  },
  numericInput: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
    paddingRight: 6,
  },
  inputUnitTag: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '700',
  },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  unitToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitToggleBtnActive: {
    backgroundColor: '#22D3EE',
  },
  unitToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  unitToggleTextActive: {
    color: '#020617',
  },
  saveCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  saveRow: {
    flexDirection: 'row',
    gap: 10,
  },
  labelInput: {
    flex: 1,
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#22D3EE',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '800',
  },
  proFeatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unlockTag: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unlockTagText: {
    color: '#22D3EE',
    fontSize: 10,
    fontWeight: '800',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  blendInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  blendCol: {
    width: '48%',
  },
  blendFieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  blendInput: {
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  blendResultBox: {
    marginTop: 6,
  },
  blendSummaryText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  highlightCyan: {
    color: '#22D3EE',
    fontWeight: '800',
  },
  lockedOverlayCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  lockedTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  lockedDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
  },
  lockedCta: {
    backgroundColor: '#22D3EE',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  lockedCtaText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '800',
  },
  inventoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  upgradeLink: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '700',
  },
  vialCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  vialCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  vialTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  vialMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22D3EE',
  },
  vialFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vialRemainingText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  logDrawBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  logDrawBtnText: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  tableRowAlt: {
    backgroundColor: '#1E293B',
  },
  tableCellBold: {
    flex: 1,
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '800',
  },
  tableCell: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
  },
  disclaimerFooter: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1E293B',
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
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disclaimerCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disclaimerTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  disclaimerBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  disclaimerBtn: {
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disclaimerBtnText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '800',
  },
});
