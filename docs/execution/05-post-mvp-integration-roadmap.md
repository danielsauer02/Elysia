# Post-MVP Integration and Growth Roadmap

## Prioritization Framework
Prioritize by:
- Target-user demand fit
- Integration feasibility and API maturity
- Retention impact
- Monetization leverage
- Compliance and partner dependencies

## Phase 2 Priorities (0-6 months post-launch)
1. **Wearable Integration V1**
   - First production connector(s): Apple Health then one of Oura/Garmin based on beta cohort.
   - Build sync quality monitoring, retry logic, and source health dashboards.
2. **Nutrition Tracking V1**
   - Food logs, macro targets, recent foods.
   - Barcode scanning in controlled beta.
3. **Insights Expansion**
   - Cross-domain trend summaries (habits + recovery + nutrition).
   - Trigger-based recommendation cards.
4. **Partner Service Workflow**
   - Lead capture and booking handoff flows.

## Phase 3 Priorities (6-18 months)
1. **Diagnostics Expansion**
   - Structured ingestion contracts for blood, genetics, skin/hair panels.
   - Provenance and confidence metadata attached to imported results.
2. **Adaptive Coaching Engine**
   - Rule-based recommendations, then model-assisted personalization.
3. **Community Layer**
   - Lightweight accountability loops before full social feature sets.
4. **Marketplace Ecosystem**
   - Attributed partner offers and conversion optimization by user profile.

## Dependency Map
- **Wearables depend on:** OAuth/permissions model, normalization pipeline, source sync monitoring.
- **Nutrition depends on:** food database strategy, barcode provider, macro calculation rules.
- **Diagnostics depend on:** legal review, partner APIs, schema versioning, claims governance.
- **Community depends on:** identity/privacy controls, moderation policy, abuse handling.
- **Marketplace depends on:** attribution analytics, partner contracts, region restrictions.

## Integration Readiness Checklist Template
- Data contract drafted and versioned.
- Authentication and token lifecycle defined.
- Backfill and incremental sync strategy designed.
- Error handling and observability plan complete.
- User consent and legal language approved.
- Rollout strategy includes phased cohort testing.
