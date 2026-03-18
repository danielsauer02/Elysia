# MVP UX Flows

## 1) Onboarding Flow
1. User signs up or logs in.
2. User completes short profile setup:
   - Name
   - Date of birth
   - Height/weight
   - Optional sex/gender
   - Primary goals
   - Wearable ownership
3. User accepts policy/consent version.
4. App recommends next action:
   - Connect a wearable (optional)
   - Add first habit from library
   - Open dashboard

## 2) Template to Habit Activation Loop
1. User browses `Library` and opens template card.
2. User sees concise explanation + evidence rationale + expected benefit.
3. User taps `Add to habits`.
4. Habit setup screen confirms:
   - Frequency
   - Time of day
   - Reminder time
   - Start date
5. Habit appears in `Habits` tab as `active`.
6. Reminder pushes user to complete action and maintain streak.

## 3) Dashboard Card States
- **Active card:** shows trend/progress insight and relevant CTA.
- **Connect placeholder:** visible card with `Connect Source` CTA.
- **Coming soon placeholder:** visible roadmap slot for diagnostics/future module.
- **Locked card:** visible card with upsell CTA when entitlement is missing.

## 4) Premium Gating Experience
- Gated templates show lock and tier requirement.
- User can preview rationale and outcomes before paywall.
- Upgrade path is one tap from locked entry points.
- After purchase validation, entitlement updates unlock content without app restart.

## 5) Notification UX Principles
- Habit reminders are motivational, not punitive.
- Nudges adapt to inactivity windows (phase 2 logic).
- Celebration moments emphasize consistency and momentum.
