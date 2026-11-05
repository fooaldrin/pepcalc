import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { getAvailablePackages } from '../services/purchases';

export type PlanTier = 'monthly' | 'annual' | 'lifetime';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUnlockSuccess: (tier: PlanTier) => Promise<void> | void;
  onRestorePurchases?: () => Promise<void> | void;
  triggerFeatureName?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onUnlockSuccess,
  onRestorePurchases,
  triggerFeatureName,
}) => {
  const [selectedTier, setSelectedTier] = useState<PlanTier>('lifetime');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localizedPrices, setLocalizedPrices] = useState<
    Record<PlanTier, string>
  >({
    lifetime: '$24.99',
    annual: '$14.99',
    monthly: '$2.99',
  });

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      try {
        const pkgs = await getAvailablePackages();
        if (!active) return;
        setLocalizedPrices((prev) => ({
          lifetime: pkgs.lifetime?.product?.priceString || prev.lifetime,
          annual: pkgs.annual?.product?.priceString || prev.annual,
          monthly: pkgs.monthly?.product?.priceString || prev.monthly,
        }));
      } catch {
        // Keep default USD fallback strings
      }
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  const handlePressPurchase = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUnlockSuccess(selectedTier);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePressRestore = async () => {
    if (isSubmitting || !onRestorePurchases) return;
    setIsSubmitting(true);
    try {
      await onRestorePurchases();
    } finally {
      setIsSubmitting(false);
    }
  };

  const plans: {
    id: PlanTier;
    title: string;
    subtitle: string;
    price: string;
    period: string;
    badge?: string;
    highlight?: boolean;
  }[] = [
    {
      id: 'lifetime',
      title: 'Perpetual Instrument License',
      subtitle: 'Single non-recurring purchase • Permanent local entitlement',
      price: localizedPrices.lifetime,
      period: 'ONE-TIME',
      badge: 'PERPETUAL LICENSE • NO SUBSCRIPTION',
      highlight: true,
    },
    {
      id: 'annual',
      title: 'Annual Laboratory License',
      subtitle: 'Includes 3-day evaluation period • Billed annually',
      price: localizedPrices.annual,
      period: '/ YEAR',
      badge: 'ANNUAL • SAVE 58%',
    },
    {
      id: 'monthly',
      title: 'Monthly Laboratory License',
      subtitle: 'Standard monthly billing cycle • Cancel anytime',
      price: localizedPrices.monthly,
      period: '/ MONTH',
    },
  ];

  const proBenefits = [
    {
      icon: 'DUAL',
      title: 'Co-Lyophilized Dual-Solute Blend Calculator',
      desc: 'Compute exact syringe graduations and proportional secondary solute mass (µg) when two compounds share a single vial.',
    },
    {
      icon: 'LOG',
      title: 'Unlimited Reconstituted Vial Logbook & Stability Tracking',
      desc: 'Record aliquot draws, remaining solution volume (mL), ISO reconstitution dates, and 28-day post-reconstitution stability windows.',
    },
    {
      icon: 'TABLE',
      title: 'Complete Unit-to-Mass Titration Schedule',
      desc: 'Full graduation reference table mapping every unit division on 0.3 mL, 0.5 mL, and 1.0 mL barrels to exact mL, µg, and mg values.',
    },
    {
      icon: 'LOCAL',
      title: 'Offline On-Device Data Architecture',
      desc: 'All saved dilution protocols and vial ledgers reside strictly in local device storage with zero external telemetry.',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PEPCALC PRO EDITION</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
              accessibilityLabel="Close upgrade screen"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Image
              source={require('../../assets/paywall-hero.png')}
              style={styles.heroBanner}
              resizeMode="cover"
            />
            <Text style={styles.headline}>
              PepCalc Pro Laboratory Edition
            </Text>
            <Text style={styles.subheadline}>
              {triggerFeatureName
                ? `Enable ${triggerFeatureName}, co-lyophilized dual-solute blend calculations, and unlimited reconstituted vial logbook entries.`
                : 'Full access to co-lyophilized dual-solute blend calculations, complete unit-to-mass titration schedules, and unlimited vial logbook tracking.'}
            </Text>

            <View style={styles.benefitsContainer}>
              {proBenefits.map((item, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{item.icon}</Text>
                  <View style={styles.benefitTextCol}>
                    <Text style={styles.benefitTitle}>{item.title}</Text>
                    <Text style={styles.benefitDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.plansContainer}>
              {plans.map((plan) => {
                const isSelected = selectedTier === plan.id;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
                    onPress={() => setSelectedTier(plan.id)}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                  >
                    {plan.badge && (
                      <View
                        style={[
                          styles.planBadge,
                          plan.id === 'lifetime'
                            ? styles.planBadgeLifetime
                            : styles.planBadgeSave,
                        ]}
                      >
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}

                    <View style={styles.planRow}>
                      <View style={styles.radioOuter}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.planInfoCol}>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <View style={styles.planPriceCol}>
                        <Text style={styles.planPrice}>{plan.price}</Text>
                        <Text style={styles.planPeriod}>{plan.period}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isSubmitting}
              style={[styles.ctaButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handlePressPurchase}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {selectedTier === 'lifetime'
                    ? `Activate Perpetual License (${localizedPrices.lifetime} Once)`
                    : selectedTier === 'annual'
                    ? `Begin 3-Day Evaluation (${localizedPrices.annual}/yr)`
                    : `Activate Monthly License (${localizedPrices.monthly}/mo)`}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.legalNoticeText}>
              {selectedTier === 'lifetime'
                ? 'One-time non-consumable purchase charged to your Apple ID account at confirmation. Never auto-renews.'
                : 'Payment will be charged to your Apple ID account at confirmation of purchase (or after the 3-day trial). Subscription automatically renews unless canceled at least 24 hours before the end of the current period in Account Settings.'}
            </Text>

            <View style={styles.footerLinks}>
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={handlePressRestore}
              >
                <Text style={styles.footerLinkText}>Restore Purchases</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
                  )
                }
              >
                <Text style={styles.footerLinkText}>Terms (EULA)</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://fooaldrin.github.io/pepcalc/privacy/')
                }
              >
                <Text style={styles.footerLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  proPill: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  proPillText: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  heroBanner: {
    width: '100%',
    height: 116,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  headline: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 6,
  },
  subheadline: {
    color: '#475569',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 16,
  },
  benefitsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 11,
  },
  benefitIcon: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    minWidth: 46,
    textAlign: 'center',
    marginRight: 10,
    marginTop: 1,
    overflow: 'hidden',
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 7,
  },
  planBadgeLifetime: {
    backgroundColor: '#0284C7',
  },
  planBadgeSave: {
    backgroundColor: '#0D9488',
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
  },
  planInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  planTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  planSubtitle: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  planPeriod: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  ctaButton: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  legalNoticeText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  footerLinkText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  footerDot: {
    color: '#94A3B8',
    marginHorizontal: 8,
  },
});
