---
name: mcp-tool-authoring
description: Template for authoring Model Context Protocol (MCP) tool, resource, and prompt schemas compatible with AgentsOpen al:1/ac:1 packs. Use when a task involves drafting an MCP tool schema.
class: prompt-only
verified: false
digest: sha256:57362c483e8a381dbc25acd129355e12c2deb969742b2c3947c76b4e4b8b01f5
---

# mcp-tool-authoring

Template for authoring Model Context Protocol (MCP) tool, resource, and prompt schemas compatible with AgentsOpen al:1/ac:1 packs.

## Input

tool name + input JSON Schema + side-effect class

## Output

al:1 + JSON MCP tool definition with server-side secret-hygiene and 100KB pack constraints

## Limits

prompt-only-template | no-live-service-call | no-account | no-booking | no-send

## Cost

free-here

## Account

none

## Permissions

none

## Example input

tool=aiws_convert | side-effect=read

## Example output

MCP tool definition draft, exec=none, schema-valid=true

Canonical source: skills/mcp-tool-authoring.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
