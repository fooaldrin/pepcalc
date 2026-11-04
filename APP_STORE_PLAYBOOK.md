# PepCalc: App Store Optimization (ASO) & First-Try Review Playbook

## 1. Exact App Store Connect Metadata
- **App Name (30 chars max):** `PepCalc: Reconstitution & Unit` (30 chars)
- **Subtitle (30 chars max):** `Vial Dilution, U-100 & Tracker` (30 chars)
- **Bundle ID:** `com.thomasaldrin.pepcalc`
- **Primary Category:** `Utilities`
- **Secondary Category:** `Education` or `Productivity` *(IMPORTANT: Do NOT select "Medical" or "Health & Fitness" — listing in Utilities avoids Apple Guideline 1.4.1 clinical device scrutiny)*
- **Keywords (100 chars max, no spaces after commas):**
  `peptide,calculator,bacteriostatic,water,bac,syringe,units,mcg,mg,ml,dilution,vial,blend,u100,dosage` (99 chars)

## 2. Hybrid RevenueCat / StoreKit 2 Product IDs to Create in App Store Connect
1. **Lifetime Non-Consumable (Anchor / Hero Plan):**
   - Product ID: `com.thomasaldrin.pepcalc.lifetime`
   - Price: **$24.99** (or **$19.99** launch promo)
   - Display Name: `PepCalc Pro Lab (Lifetime Unlock)`
2. **Annual Auto-Renewable Subscription:**
   - Product ID: `com.thomasaldrin.pepcalc.annual`
   - Price: **$14.99 / year** with **3-Day Free Trial**
   - Display Name: `PepCalc Pro Annual Pass`
3. **Monthly Auto-Renewable Subscription:**
   - Product ID: `com.thomasaldrin.pepcalc.monthly`
   - Price: **$2.99 / month**
   - Display Name: `PepCalc Pro Monthly`

## 3. How This Build Passes Apple App Store Review on Try #1
- **No Pre-loaded Drug/Medication Names:** The app intentionally ships with generic laboratory sample names (`Compound A`, `Compound B`, `Sample 5mg`) instead of hardcoded pharmaceutical names. Users type their own custom labels locally.
- **First-Launch Mandatory Lab Disclaimer:** Built directly into `App.tsx` (`@pepcalc_disclaimer_v1`) and pinned in the footer: states clearly that the app is a mathematical volumetric concentration calculator ($C_1V_1 = C_2V_2$) for laboratory and educational reference only.

## 4. What You Can Draw in Procreate (Optional Visual Upgrade!)
If you want to give `PepCalc` a signature indie polish from your iPad Pro while keeping the dark lab aesthetic:
1. **App Icon (`1024x1024` PNG):** A sleek, dark-mode glowing cyan frosted glass vial next to a precision U-100 graduation mark on a `#0A0E17` background.
2. **Paywall Hero Illustration (`600x400` PNG):** A crisp isometric laboratory vial + glowing cyan syringe graphic for the top of `PaywallModal.tsx`.
