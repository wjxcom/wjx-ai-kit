# Survey Logic DSL Consistency Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align DSL/JSONL capability contracts and documentation, strengthen DSL preflight validation, and remove known contradictory examples.

**Architecture:** Establish one machine-readable classification for JSONL qtypes, use it to align SDK/MCP/docs contracts, and keep unverified logic explicitly marked as透传/不可验证. Add lexical safeguards to the lightweight DSL validator without introducing a full parser.

**Tech Stack:** TypeScript, Node.js tests, Markdown/JSON resource contracts.

---

### Task 1: Batch A capability and release boundaries
- Fix missing DSL dist outputs and add a build/runtime guard.
- Remove rejected qtypes from creatable/framework descriptions.
- Align MCP Resource, capability JSON, tool descriptions, prompts, changelog, architecture, and compatibility docs.

### Task 2: Batch B validator and migration safety
- Add failing tests for missing semicolons and quoted pseudo-blocks.
- Implement lexical masking and delimiter validation.
- Add migration semantic-loss checklist.

### Task 3: Batch C low-cost documentation fixes
- Downgrade randomchoice wording.
- Fix formula quote examples and dead anchors.
- Run all available checks and summarize remaining environment limitations.
