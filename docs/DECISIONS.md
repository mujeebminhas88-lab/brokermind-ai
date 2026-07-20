# BrokerMindAI Architectural Decisions

This document records WHY architectural decisions were made.

---

# Provider Independence

Decision

BrokerMindAI must never depend on a single AI provider.

Reason

AI providers evolve rapidly.

Changing providers should never require rewriting business logic.

Architecture

OCR
↓

LLM
↓

Structured JSON

↓

Verification Engine

---

# Protected Verification Engine

Decision

The verification engine is treated as production infrastructure.

Reason

The business value is downstream verification.

OCR and AI providers are replaceable.

The verification engine is not.

Protected components

- documentRegistry
- verificationStore
- Verification Modal
- Compliance Engine
- DossierGate

---

# Billing Model

Decision

Customers are billed per processed file.

Never by AI credits.

Reason

Customers understand files.

Customers do not understand tokens.

Internally provider costs are tracked separately.

---

# Replay

Decision

Replay is a new processing job.

Replay consumes one file.

Reason

Replay consumes compute.

Replay must remain auditable.

---

# Immutable Processing Jobs

Decision

Processing jobs are append-only.

Never updated.

Reason

Financial software requires traceability.

Every replay becomes a new record.

---

# Developer Mode

Decision

Developer Mode remains permanently.

Reason

Developers need to test validation and UI without paying for AI calls.

Rules

- Hidden behind admin authentication
- Never exposed to customers
- Enables JSON uploads
- Enables debugging tools

---

# Human-in-the-Loop

Decision

AI never makes the final lending decision.

Reason

Mortgage underwriting remains human controlled.

AI assists.

Humans approve.

---

# Small Incremental Development

Decision

Large rewrites are avoided.

Reason

Small changes are easier to verify.

Every phase must compile and be production-ready before moving forward.

---

# Documentation First

Decision

Architecture decisions are documented before implementation.

Reason

Future contributors should understand why decisions exist, not just what was built.

---

# Customer Experience

Decision

Customers should interact with simple concepts.

Examples

Good

- Files processed
- Files remaining
- Next reset

Bad

- Tokens
- API requests
- OCR pages
- AI credits

Technical complexity remains internal.

---

# Long-Term Goal

BrokerMindAI should become a provider-independent underwriting platform.

Changing AI providers should be a configuration change rather than an engineering project.