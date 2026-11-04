import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';

export type PlanTier = 'monthly' | 'annual' | 'lifetime';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUnlockSuccess: (tier: PlanTier) => void;
  triggerFeatureName?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onUnlockSuccess,
  triggerFeatureName,
}) => {
  const [selectedTier, setSelectedTier] = useState<PlanTier>('lifetime');

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
      title: 'Lifetime Lab Unlock',
      subtitle: 'Pay once, own forever — zero recurring fees',
      price: '$24.99',
      period: 'ONE-TIME',
      badge: 'MOST POPULAR • NO SUBSCRIPTION',
      highlight: true,
    },
    {
      id: 'annual',
      title: 'Annual Pro Pass',
      subtitle: 'Equivalent to $1.25 / month • 3-Day Free Trial',
      price: '$14.99',
      period: '/ YEAR',
      badge: 'SAVE 58%',
    },
    {
      id: 'monthly',
      title: 'Monthly Flex',
      subtitle: 'Cancel anytime in 1 tap',
      price: '$2.99',
      period: '/ MONTH',
    },
  ];

  const proBenefits = [
    {
      icon: '🧪',
      title: 'Multi-Compound Blend Calculator',
      desc: 'Calculate dual-vial ratios (e.g., Compound A + Compound B in a single syringe draw) with zero math errors.',
    },
    {
      icon: '❄️',
      title: 'Unlimited Vial Fridge Inventory & Expiry Tracker',
      desc: 'Track remaining mL per reconstituted vial, reconstitution ISO dates, and 28-day shelf-life alerts.',
    },
    {
      icon: '📊',
      title: 'Reverse Titration & Micro-Dose Table',
      desc: 'Instant unit-by-unit reference table for every tick mark on 0.3 mL, 0.5 mL, and 1.0 mL syringes.',
    },
    {
      icon: '🚫',
      title: '100% Ad-Free & Offline Privacy',
      desc: 'All saved protocols stay encrypted locally on your device. No account or cloud login ever required.',
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
              <Text style={styles.proPillText}>PEPCALC PRO LAB</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
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
              Eliminate Reconstitution Math Errors Forever
            </Text>
            <Text style={styles.subheadline}>
              {triggerFeatureName
                ? `Unlock ${triggerFeatureName} plus unlimited saved vials & multi-compound blend math.`
                : 'Protect expensive vials with precision volumetric tools, blend calculators, and fridge inventory tracking.'}
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
              style={styles.ctaButton}
              onPress={() => onUnlockSuccess(selectedTier)}
            >
              <Text style={styles.ctaButtonText}>
                {selectedTier === 'lifetime'
                  ? 'Unlock Lifetime Pro ($24.99 Once)'
                  : selectedTier === 'annual'
                  ? 'Start 3-Day Free Trial ($14.99/yr)'
                  : 'Continue with Monthly ($2.99/mo)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => onUnlockSuccess('lifetime')}>
                <Text style={styles.footerLinkText}>Restore Purchases</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLinkText}>Terms</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
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
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    borderColor: '#22D3EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  proPillText: {
    color: '#22D3EE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  heroBanner: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headline: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 6,
  },
  subheadline: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  benefitsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 18,
  },
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  planBadgeLifetime: {
    backgroundColor: '#22D3EE',
  },
  planBadgeSave: {
    backgroundColor: '#3B82F6',
  },
  planBadgeText: {
    color: '#020617',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22D3EE',
  },
  planInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  planTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  planSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  planPeriod: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  ctaButton: {
    backgroundColor: '#22D3EE',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  footerLinkText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  footerDot: {
    color: '#475569',
    marginHorizontal: 8,
  },
});
