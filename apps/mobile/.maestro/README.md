# Maestro E2E flows

Critical-path flows for the Elysia mobile app, run with [Maestro](https://maestro.mobile.dev).

## Run locally

```bash
# Install Maestro once
curl -Ls "https://get.maestro.mobile.dev" | bash

# Boot a simulator/emulator that matches your dev build, then:
maestro test apps/mobile/.maestro/login_and_dashboard.yaml
maestro test apps/mobile/.maestro/food_quick_log.yaml
```

## Flows

| File | Critical path | Notes |
| ---- | -------------- | ----- |
| `login_and_dashboard.yaml` | Auth → dashboard renders Energy + Daily Overview | Requires a seeded test user. |
| `food_quick_log.yaml` | Tracker → quick-log a food via OFF search | Hits the real Open Food Facts API. |

Add new flows for premium-paywall, photo recognition, wearable connect once
those screens stabilize. CI integration goes through `maestro cloud` once we
provision an account.
