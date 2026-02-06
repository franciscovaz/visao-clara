# Billing, Plans & Entitlements

## 1. Overview
This document describes how subscription plans, entitlements, and feature access
are modeled in the application.

The goal is to:
- Keep a single source of truth
- Avoid duplicated logic in UI
- Make backend integration straightforward

---

## 2. Subscription Model

### Plan IDs
- free
- pro
- premium

### Subscription State
Stored in the Zustand store under:

billing.subscription

Fields:
- planId
- billingPeriod
- status

---

## 3. Entitlements

Entitlements represent what the current subscription allows.

They are:
- Derived from `planId` (for now)
- Stored under `billing.entitlements`
- Expected to be provided by backend in the future

### Structure

- limits
  - activeProjects
  - documentsPerProject
  - aiCreditsMonthly

- features
  - exportEnabled
  - advancedExpenses
  - advancedAI
  - projectComparison
  - riskDetection
  - autoSummaries
  - prioritySupport

---

## 4. Plan Definitions

### FREE
Intended for experimentation and basic organization.

Limits:
- activeProjects: 1
- documentsPerProject: X
- aiCreditsMonthly: 2

Features:
- exportEnabled: false
- advancedExpenses: false
- advancedAI: false

---

### PRO
Main plan for active projects.

Limits:
- activeProjects: unlimited
- documentsPerProject: unlimited
- aiCreditsMonthly: unlimited (fair use)

Features:
- exportEnabled: true
- advancedExpenses: true
- advancedAI: true

---

### PREMIUM
Advanced plan for investors and power users.

Includes everything from PRO plus:
- projectComparison
- riskDetection
- autoSummaries
- prioritySupport

---

## 5. Source of Truth Rules

- `billing.subscription.planId` is the source of truth
- `billing.entitlements` is always updated together with planId
- UI must never hardcode plan checks
- UI must rely on helpers (can / limit)

---

## 6. UI Gating Philosophy

- Features are visible but may be disabled with CTA
- No route guards at this stage
- Upgrade prompts are contextual

---

## 7. Backend Integration (Future)

When backend is introduced:
- Subscription endpoint may return:
  - planId
  - entitlements
- Store should hydrate both in a single action
