# Recorded Cameo evidence

Everything in this folder was written by the Cameo MBSE agent (`tools/cameo`) during real runs against CATIA Magic
through cameo-mcp-bridge: the capability probe, the model build log (one line per MCP call), the native diagram exports
(`diagrams/*.png`, produced by `cameo_get_diagram_image`) and the demo workflow. `index.json` is derived from these files
by `node scripts/index-cameo-evidence.mjs`.

**Public copy.** The private project name, workstation paths and an internal programme name were replaced in the logs.
Diagram images, element counts, values, tool names, durations and results are unchanged. `specDigest` is the SHA-256 of
`tools/cameo/model-spec.json`, the engineering model the run was built from (checked by `npm test`).
