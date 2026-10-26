---
name: mcp-tool-authoring
description: Template for authoring Model Context Protocol (MCP) tool, resource, and prompt schemas compatible with AI Workspace al:1/ac:1 packs. Use when a task involves drafting an MCP tool schema.
class: prompt-only
verified: false
digest: sha256:7e058387c7c75f8e5cec2da67c1d86e6590805b2920e407557d7cb26707b6f23
---

# mcp-tool-authoring

Template for authoring Model Context Protocol (MCP) tool, resource, and prompt schemas compatible with AI Workspace al:1/ac:1 packs.

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
