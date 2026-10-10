# Paperclip Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a loopback-only Paperclip instance inside CV_Agent and verify durable task communication, ownership locking, and review-oriented handoffs without activating external model credentials.

**Architecture:** Paperclip is the local coordination control plane. CV_Agent remains the source of truth for product rules and artifacts. Resume work will be divided into product/evidence/implementation/QA/arbitration roles; the first deployment creates the control plane and a reproducible handoff contract, while model agents remain paused until explicitly configured.

**Tech Stack:** Paperclip CLI 2026.1005.0, Node.js 24, embedded PostgreSQL, local loopback HTTP, Markdown task contracts, curl-based health checks.

---

### Task 1: Isolate the local runtime

**Files:**
- Create: `.gitignore`
- Create: `scripts/paperclip-start.sh`
- Create: `scripts/paperclip-stop.sh`
- Create: `scripts/paperclip-status.sh`

- [ ] **Step 1: Add runtime exclusions and reproducible launch scripts**

The scripts keep Paperclip state under `.runtime/paperclip`, disable anonymous telemetry, bind to loopback, and never read or print existing credentials.

- [ ] **Step 2: Shell-check the scripts**

Run: `zsh -n scripts/paperclip-start.sh scripts/paperclip-stop.sh scripts/paperclip-status.sh`
Expected: exit code 0.

### Task 2: Install and bootstrap the pinned control plane

**Files:**
- Modify: `.runtime/paperclip/` (generated, ignored)
- Create: `outputs/paperclip-deployment-report.md`

- [ ] **Step 1: Run the pinned Paperclip CLI in quickstart mode**

Use `paperclipai@2026.1005.0` with a workspace-local data directory, `--bind loopback`, `--no-install-service`, and telemetry disabled.

- [ ] **Step 2: Start the instance and verify health**

Run the start script, then check the local health endpoint and UI response on `http://127.0.0.1:3100`.

- [ ] **Step 3: Record exact version, bind address, state path, and known limitations**

The report must state that no external LLM adapter, mailbox, browser session, email account, or real application submission was activated.

### Task 3: Verify collaboration primitives before model activation

**Files:**
- Create: `docs/12_Paperclip本地协作控制面与验证.md`
- Modify: `README.md`

- [ ] **Step 1: Document the role-to-task contract**

Define the resume-system roles, single-owner file boundaries, required evidence fields, independent QA gate, and arbitration path.

- [ ] **Step 2: Verify persistence across restart**

Create only sanitized local test data; confirm the instance remains reachable after a stop/start cycle without enabling a provider key.

- [ ] **Step 3: Perform a reverse review**

Check that the deployment does not expose the server beyond localhost, does not touch existing user data, does not claim independent QA, and does not mark any real application as submitted.

---
