import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const fillColorStart = hasWarning ? '#EF4444' : '#06B6D4';
  const fillColorEnd = hasWarning ? '#DC2626' : '#3B82F6';
  const subUnitPrecisionWarning =
    isValidInput && syringeUnits > 0 && syringeUnits < minorStep;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.DrawLabel}>DRAW TO MARK</Text>
          <View style={styles.primaryReadoutRow}>
            <Text
              style={[
                styles.unitsValue,
                hasWarning && styles.unitsValueDanger,
              ]}
            >
              {isValidInput ? formatUnitsReadout(syringeUnits) : '—'}
            </Text>
            <Text style={styles.unitsSuffix}>UNITS ({syringeScale})</Text>
          </View>
        </View>
        <View style={styles.volumePill}>
          <Text style={styles.volumePillLabel}>EXACT VOLUME</Text>
          <Text style={styles.volumePillValue}>
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
              <Stop offset="0" stopColor={fillColorStart} stopOpacity="0.88" />
              <Stop offset="1" stopColor={fillColorEnd} stopOpacity="0.95" />
            </LinearGradient>
            <LinearGradient id="barrelGlass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1E293B" stopOpacity="0.9" />
              <Stop offset="0.5" stopColor="#0F172A" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#1E293B" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Needle tip (left) */}
          <Line
            x1={8}
            y1={barrelY + barrelHeight / 2}
            x2={28}
            y2={barrelY + barrelHeight / 2}
            stroke="#94A3B8"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          {/* Needle hub cone */}
          <Path
            d={`M 28 ${barrelY + barrelHeight / 2 - 5} L ${barrelX} ${
              barrelY + 8
            } L ${barrelX} ${barrelY + barrelHeight - 8} L 28 ${
              barrelY + barrelHeight / 2 + 5
            } Z`}
            fill="#334155"
            stroke="#64748B"
            strokeWidth={1.2}
          />

          {/* Plunger rod (extending right) */}
          <Rect
            x={barrelX + fillWidth + 6}
            y={barrelY + barrelHeight / 2 - 5}
            width={Math.max(18, barrelWidth - fillWidth + 28)}
            height={10}
            fill="#334155"
          />
          {/* Plunger thumb pad */}
          <Rect
            x={Math.min(svgWidth - 12, barrelX + barrelWidth + 24)}
            y={barrelY + 6}
            width={8}
            height={barrelHeight - 12}
            rx={3}
            fill="#64748B"
          />

          {/* Syringe Barrel Background */}
          <Rect
            x={barrelX}
            y={barrelY}
            width={barrelWidth}
            height={barrelHeight}
            rx={4}
            fill="url(#barrelGlass)"
            stroke="#475569"
            strokeWidth={1.8}
          />

          {/* Barrel Finger Flange (Right end of barrel) */}
          <Rect
            x={barrelX + barrelWidth - 3}
            y={barrelY - 10}
            width={6}
            height={barrelHeight + 20}
            rx={3}
            fill="#475569"
          />

          {/* Liquid Fill Inside Barrel */}
          {fillWidth > 0 && (
            <Rect
              x={barrelX}
              y={barrelY + 2}
              width={Math.max(1, fillWidth)}
              height={barrelHeight - 4}
              fill="url(#liquidGrad)"
            />
          )}

          {/* Rubber Plunger Stopper */}
          <Rect
            x={barrelX + fillWidth}
            y={barrelY + 1.5}
            width={8}
            height={barrelHeight - 3}
            rx={1.5}
            fill="#0F172A"
            stroke="#E2E8F0"
            strokeWidth={1.2}
          />

          {/* Graduation Tick Marks & Unit Labels */}
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
                  stroke={isMajor ? '#F8FAFC' : '#94A3B8'}
                  strokeWidth={isMajor ? 1.6 : 0.9}
                />
                {isMajor && (
                  <SvgText
                    x={xPos}
                    y={barrelY + barrelHeight + 18}
                    fill="#CBD5E1"
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

          {/* Target Indicator Marker Above Barrel */}
          {fillWidth > 0 && (
            <Path
              d={`M ${barrelX + fillWidth} ${barrelY - 2} L ${
                barrelX + fillWidth - 5
              } ${barrelY - 11} L ${barrelX + fillWidth + 5} ${
                barrelY - 11
              } Z`}
              fill={hasWarning ? '#EF4444' : '#22D3EE'}
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
            🚨 DANGER: Target draw exceeds the entire mass of the vial! Verify
            whether your target is in mcg (µg) or mg.
          </Text>
        </View>
      )}

      {isValidInput && !exceedsVialMass && exceedsCapacity && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Target volume ({volumeToDrawMl.toFixed(3)} mL /{' '}
            {formatUnitsReadout(syringeUnits)} units) exceeds this{' '}
            {syringeVolumeMl} mL ({maxSyringeUnits}u) syringe capacity
            {syringesNeededCount > 1
              ? ` (requires ${syringesNeededCount} syringes)`
              : ''}
            . Switch to a larger syringe or use less diluent.
          </Text>
        </View>
      )}

      {subUnitPrecisionWarning && (
        <View style={styles.amberBanner}>
          <Text style={styles.amberText}>
            ⚠️ High Concentration Alert: {formatUnitsReadout(syringeUnits)}{' '}
            units is less than 1 tick mark ({minorStep}{' '}
            {minorStep === 1 ? 'unit' : 'units'}) on this syringe and is
            difficult to measure accurately. Consider adding more diluent (mL)
            or using a 0.3 mL (30u) syringe.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  DrawLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  primaryReadoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  unitsValue: {
    color: '#22D3EE',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unitsValueDanger: {
    color: '#F87171',
  },
  unitsSuffix: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  volumePill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155',
  },
  volumePillLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  volumePillValue: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  warningBanner: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  warningText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  amberBanner: {
    marginTop: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  amberText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
