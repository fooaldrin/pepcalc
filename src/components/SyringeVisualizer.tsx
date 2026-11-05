import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import {
  SyringeScale,
  SyringeVolumeMl,
  roundClean,
} from '../utils/reconstitutionMath';

interface SyringeVisualizerProps {
  syringeUnits: number;
  maxSyringeUnits: number;
  volumeToDrawMl: number;
  syringeScale: SyringeScale;
  syringeVolumeMl: SyringeVolumeMl;
  exceedsCapacity: boolean;
  exceedsVialMass?: boolean;
  isValidInput?: boolean;
  syringesNeededCount?: number;
  diluentVolumeMl?: number;
  onSelectDiluentMl?: (mlStr: string) => void;
  onSelect30uSyringe?: () => void;
}

export function formatUnitsReadout(units: number): string {
  if (!Number.isFinite(units) || units <= 0) return '0';
  if (units < 0.01) return '< 0.01';
  const rounded2 = roundClean(units, 2);
  // If exact integer (e.g. 10), show 10
  if (Math.abs(rounded2 - Math.round(rounded2)) < 1e-4) {
    return Math.round(rounded2).toString();
  }
  // If 1 decimal place (e.g. 12.5), show 12.5
  const rounded1 = roundClean(units, 1);
  if (Math.abs(rounded2 - rounded1) < 1e-4) {
    return rounded1.toFixed(1);
  }
  // Otherwise preserve 2 decimal places (e.g. 6.25 units or 1.25 units)
  return rounded2.toFixed(2);
}

export const SyringeVisualizer: React.FC<SyringeVisualizerProps> = ({
  syringeUnits,
  maxSyringeUnits,
  volumeToDrawMl,
  syringeScale,
  syringeVolumeMl,
  exceedsCapacity,
  exceedsVialMass = false,
  isValidInput = true,
  syringesNeededCount = 0,
  diluentVolumeMl = 0,
  onSelectDiluentMl,
  onSelect30uSyringe,
}) => {
  const clampedUnits = Math.min(maxSyringeUnits, Math.max(0, syringeUnits));
  const fillRatio = maxSyringeUnits > 0 ? clampedUnits / maxSyringeUnits : 0;

  // Horizontal SVG layout dimensions for crisp mobile viewing
  const svgWidth = 340;
  const svgHeight = 128;
  const barrelX = 48;
  const barrelY = 26;
  const barrelWidth = 230;
  const barrelHeight = 46;
  const fillWidth = barrelWidth * fillRatio;

  const majorStep =
    maxSyringeUnits === 30 ? 5 : maxSyringeUnits === 40 ? 5 : 10;
  const minorStep = maxSyringeUnits === 100 ? 2 : 1;

  const ticks: { unit: number; isMajor: boolean; isMedium: boolean }[] = [];
  for (let u = 0; u <= maxSyringeUnits; u += minorStep) {
    const isMajor = u % majorStep === 0;
    const isMedium = !isMajor && u % 5 === 0;
    ticks.push({ unit: u, isMajor, isMedium });
  }

  const hasWarning = exceedsCapacity || exceedsVialMass;
  const fillColorStart = hasWarning ? '#FCA5A5' : '#38BDF8';
  const fillColorEnd = hasWarning ? '#EF4444' : '#0284C7';
  const meniscusStroke = hasWarning ? '#DC2626' : '#0284C7';
  const subUnitPrecisionWarning =
    isValidInput && syringeUnits > 0 && syringeUnits < minorStep;
  const canFixBySmallerSyringe =
    subUnitPrecisionWarning && syringeUnits >= 1 && minorStep > 1;
  const minDiluentForOneUnitMl =
    diluentVolumeMl > 0 && syringeUnits > 0
      ? Math.ceil((diluentVolumeMl / syringeUnits) * 100) / 100
      : 0;
  const minDiluentForTickMl =
    diluentVolumeMl > 0 && syringeUnits > 0
      ? Math.ceil(((diluentVolumeMl * minorStep) / syringeUnits) * 100) / 100
      : 0;
  const isU40 = syringeScale === 'U-40';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.DrawLabel}>DRAW TO CALIBRATED MARK</Text>
          <View style={styles.primaryReadoutRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.unitsValue,
                hasWarning && styles.unitsValueDanger,
              ]}
            >
              {isValidInput ? formatUnitsReadout(syringeUnits) : '—'}
            </Text>
            <Text numberOfLines={1} style={styles.unitsSuffix}>
              UNITS
            </Text>
            <View
              style={[
                styles.scaleBadge,
                isU40 ? styles.scaleBadgeU40 : styles.scaleBadgeU100,
              ]}
            >
              <Text
                style={[
                  styles.scaleBadgeText,
                  isU40 ? styles.scaleBadgeTextU40 : styles.scaleBadgeTextU100,
                ]}
              >
                {syringeScale}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.volumePill}>
          <Text style={styles.volumePillLabel}>EXACT VOLUME</Text>
          <Text numberOfLines={1} style={styles.volumePillValue}>
            {isValidInput ? `${volumeToDrawMl.toFixed(3)} mL` : '— mL'}
          </Text>
        </View>
      </View>

      <View style={styles.svgWrapper}>
        <Svg
          width="100%"
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <Defs>
            <LinearGradient id="liquidGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={fillColorStart} stopOpacity="0.48" />
              <Stop offset="1" stopColor={fillColorEnd} stopOpacity="0.76" />
            </LinearGradient>
            <LinearGradient id="barrelGlass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#E2E8F0" stopOpacity="0.92" />
              <Stop offset="0.28" stopColor="#FFFFFF" stopOpacity="0.98" />
              <Stop offset="0.72" stopColor="#F8FAFC" stopOpacity="0.96" />
              <Stop offset="1" stopColor="#E2E8F0" stopOpacity="0.92" />
            </LinearGradient>
          </Defs>

          {/* Stainless needle shaft (left) */}
          <Line
            x1={8}
            y1={barrelY + barrelHeight / 2}
            x2={28}
            y2={barrelY + barrelHeight / 2}
            stroke="#64748B"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          {/* Polypropylene needle hub cone */}
          <Path
            d={`M 28 ${barrelY + barrelHeight / 2 - 5} L ${barrelX} ${
              barrelY + 8
            } L ${barrelX} ${barrelY + barrelHeight - 8} L 28 ${
              barrelY + barrelHeight / 2 + 5
            } Z`}
            fill="#E2E8F0"
            stroke="#94A3B8"
            strokeWidth={1.2}
          />

          {/* Plunger rod (extending right) */}
          <Rect
            x={barrelX + fillWidth + 7}
            y={barrelY + barrelHeight / 2 - 5}
            width={Math.max(18, barrelWidth - fillWidth + 27)}
            height={10}
            fill="#CBD5E1"
            stroke="#94A3B8"
            strokeWidth={0.8}
          />
          {/* Plunger thumb pad */}
          <Rect
            x={Math.min(svgWidth - 12, barrelX + barrelWidth + 24)}
            y={barrelY + 6}
            width={8}
            height={barrelHeight - 12}
            rx={3}
            fill="#94A3B8"
          />

          {/* Translucent Polypropylene Syringe Barrel */}
          <Rect
            x={barrelX}
            y={barrelY}
            width={barrelWidth}
            height={barrelHeight}
            rx={4}
            fill="url(#barrelGlass)"
            stroke="#94A3B8"
            strokeWidth={1.6}
          />

          {/* Barrel Finger Flange (Right end of barrel) */}
          <Rect
            x={barrelX + barrelWidth - 3}
            y={barrelY - 10}
            width={6}
            height={barrelHeight + 20}
            rx={3}
            fill="#CBD5E1"
            stroke="#94A3B8"
            strokeWidth={1}
          />

          {/* Calibrated Solution Meniscus Fill Inside Barrel */}
          {fillWidth > 0 && (
            <>
              <Rect
                x={barrelX}
                y={barrelY + 1.5}
                width={Math.max(1, fillWidth)}
                height={barrelHeight - 3}
                fill="url(#liquidGrad)"
              />
              <Line
                x1={barrelX + fillWidth}
                y1={barrelY + 1.5}
                x2={barrelX + fillWidth}
                y2={barrelY + barrelHeight - 1.5}
                stroke={meniscusStroke}
                strokeWidth={1.5}
              />
            </>
          )}

          {/* Double-Ribbed Elastomer Plunger Stopper */}
          <Rect
            x={barrelX + fillWidth}
            y={barrelY + 1.5}
            width={9}
            height={barrelHeight - 3}
            rx={1.5}
            fill="#1E293B"
            stroke="#0F172A"
            strokeWidth={1}
          />
          <Line
            x1={barrelX + fillWidth + 4.5}
            y1={barrelY + 3}
            x2={barrelX + fillWidth + 4.5}
            y2={barrelY + barrelHeight - 3}
            stroke="#475569"
            strokeWidth={1.1}
          />

          {/* High-Contrast Engraved Graduation Tick Marks & Unit Labels */}
          {ticks.map(({ unit, isMajor, isMedium }) => {
            const xPos = barrelX + (unit / maxSyringeUnits) * barrelWidth;
            const tickHeight = isMajor ? 16 : isMedium ? 11 : 6;
            return (
              <React.Fragment key={unit}>
                <Line
                  x1={xPos}
                  y1={barrelY}
                  x2={xPos}
                  y2={barrelY + tickHeight}
                  stroke={
                    isMajor ? '#0F172A' : isMedium ? '#334155' : '#64748B'
                  }
                  strokeWidth={isMajor ? 1.6 : isMedium ? 1.1 : 0.85}
                />
                {isMajor && (
                  <SvgText
                    x={xPos}
                    y={barrelY + barrelHeight + 18}
                    fill="#0F172A"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {unit}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}

          {/* Precision Target Indicator Marker Above Barrel */}
          {fillWidth > 0 && (
            <Path
              d={`M ${barrelX + fillWidth} ${barrelY - 2} L ${
                barrelX + fillWidth - 5
              } ${barrelY - 11} L ${barrelX + fillWidth + 5} ${
                barrelY - 11
              } Z`}
              fill={hasWarning ? '#DC2626' : '#0284C7'}
            />
          )}
        </Svg>
      </View>

      {!isValidInput && (
        <View style={styles.amberBanner}>
          <Text style={styles.amberText}>
            Enter a valid Vial Mass (&gt; 0 mg) and Diluent Volume (&gt; 0 mL)
            below to calculate syringe units.
          </Text>
        </View>
      )}

      {isValidInput && exceedsVialMass && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            [LIMIT EXCEEDED] Target aliquot mass exceeds total lyophilized
            solute mass in the vial. Verify unit selection (µg vs. mg).
          </Text>
        </View>
      )}

      {isValidInput && !exceedsVialMass && exceedsCapacity && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            [BARREL CAPACITY] Target aliquot volume ({volumeToDrawMl.toFixed(3)}{' '}
            mL / {formatUnitsReadout(syringeUnits)} units) exceeds the{' '}
            {syringeVolumeMl} mL ({maxSyringeUnits}u) barrel capacity
            {syringesNeededCount > 1
              ? ` (requires ${syringesNeededCount} draws)`
              : ''}
            . Select a larger barrel volume or reduce diluent volume.
          </Text>
        </View>
      )}

      {subUnitPrecisionWarning && (
        <View style={styles.amberBanner}>
          {canFixBySmallerSyringe ? (
            <>
              <Text style={styles.amberText}>
                [SCALE RESOLUTION] Sub-division draw (
                {formatUnitsReadout(syringeUnits)} units): A 1.0 mL (100u)
                barrel is graduated in 2-unit increments. Select the 0.3 mL
                (30u) or 0.5 mL (50u) barrel for 1-unit graduations
                {minDiluentForTickMl > 0
                  ? `, or increase diluent volume to ≥ ${minDiluentForTickMl.toFixed(
                      2
                    )} mL.`
                  : '.'}
              </Text>
              {(onSelect30uSyringe ||
                (onSelectDiluentMl && minDiluentForTickMl > 0)) && (
                <View style={styles.amberActionRow}>
                  {onSelect30uSyringe && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.amberActionBtn}
                      onPress={onSelect30uSyringe}
                    >
                      <Text style={styles.amberActionBtnText}>
                        Select 0.3 mL (30u) Barrel
                      </Text>
                    </TouchableOpacity>
                  )}
                  {onSelectDiluentMl && minDiluentForTickMl > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.amberActionBtn}
                      onPress={() =>
                        onSelectDiluentMl(minDiluentForTickMl.toString())
                      }
                    >
                      <Text style={styles.amberActionBtnText}>
                        Set Diluent: {minDiluentForTickMl.toFixed(2)} mL (2u)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.amberText}>
                [HIGH CONCENTRATION] Aliquot volume (
                {formatUnitsReadout(syringeUnits)} units /{' '}
                {volumeToDrawMl.toFixed(3)} mL) falls below 1.0 graduation unit
                on {syringeScale} scales (changing barrel capacity does not
                alter {syringeScale} unit volume).{' '}
                {minDiluentForOneUnitMl > 0
                  ? `Increase diluent volume to ≥ ${minDiluentForOneUnitMl.toFixed(
                      2
                    )} mL for a 1.0-unit draw (or ${(
                      minDiluentForOneUnitMl * 2
                    ).toFixed(2)} mL for 2.0 units).`
                  : 'Increase diluent volume (mL) so the target aliquot measures ≥ 1.0 unit.'}
              </Text>
              {onSelectDiluentMl && minDiluentForOneUnitMl > 0 && (
                <View style={styles.amberActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.amberActionBtn}
                    onPress={() =>
                      onSelectDiluentMl(minDiluentForOneUnitMl.toString())
                    }
                  >
                    <Text style={styles.amberActionBtnText}>
                      Set Diluent: {minDiluentForOneUnitMl.toFixed(2)} mL (1u)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.amberActionBtn}
                    onPress={() =>
                      onSelectDiluentMl(
                        roundClean(minDiluentForOneUnitMl * 2, 2).toString()
                      )
                    }
                  >
                    <Text style={styles.amberActionBtnText}>
                      Set Diluent: {(minDiluentForOneUnitMl * 2).toFixed(2)} mL
                      (2u)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  DrawLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  primaryReadoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'nowrap',
  },
  unitsValue: {
    color: '#0284C7',
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  unitsValueDanger: {
    color: '#DC2626',
  },
  unitsSuffix: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    flexShrink: 0,
  },
  scaleBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  scaleBadgeU100: {
    backgroundColor: '#E0F2FE',
    borderColor: '#7DD3FC',
  },
  scaleBadgeU40: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  scaleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  scaleBadgeTextU100: {
    color: '#0369A1',
  },
  scaleBadgeTextU40: {
    color: '#B45309',
  },
  volumePill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 0,
  },
  volumePillLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  volumePillValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    marginTop: 2,
  },
  warningBanner: {
    marginTop: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  amberBanner: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  amberText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  amberActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  amberActionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  amberActionBtnText: {
    color: '#B45309',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
