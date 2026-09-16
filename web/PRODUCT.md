# Product brief · Motor Agéntico

## Who it is for

One developer who uses several AI coding agents (Claude Code, Codex, Hermes
Agent, OpenClaw, models through OpenRouter) on their own machine and wants to
know, without sending their transcripts anywhere, three things:

1. **What does this cost?** Token usage valued at dated public prices, next to
   what the subscription actually charges, plus the only real money that
   leaves the account (OpenRouter).
2. **What do I actually use?** Declared skills, agents, MCP servers and
   plugins crossed with real invocations from the transcripts.
3. **What could I do better?** A nightly review whose findings are SQL
   computations; an LLM may only phrase them.

## Principles

- **Local and single-user.** It binds to 127.0.0.1, has no authentication by
  design and must not be deployed.
- **Read-only as a property.** The web opens SQLite with `readOnly: true`;
  other programs' databases are opened with `?mode=ro`.
- **Honest gaps.** A value that does not exist is shown as "no data" with the
  reason, never as zero. Hermes and OpenClaw do not record tokens, so their
  spend is empty, not estimated.
- **The lag is always visible.** Every screen shows how old the index is.

## Out of scope

- Multi-user, remote access, alerts, writing back to any agent.
- Functional health checks: the tool reads files; it does not prove that an
  agent's tools respond (see "Limits" in the README).
