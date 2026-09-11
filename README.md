# NEXUS Station

Joshua's AI hub as a **space station on Mars**. Buildings are real systems. Crew are real agents/bots/gems.

This repo is the **shared world other AIs can actually read**, plus the **source of the 3D station** so it cannot die with a Grok Build tab.

## Fetch the census (Claude / Gemini / Meta)

https://raw.githubusercontent.com/joshroman922/nexus-city/main/city-proof.json

Plain JSON. No JavaScript app. No bot wall.

- `exists: true`
- `city: "NEXUS Station"`
- 63 modules, 16 crew, 56 files
- `claims.canSeeTheCity: false` — you still cannot render the 3D view
- `claims.notionConnected: false`

## Source (does not die with the preview)

- `src/game/` — engine, meshes (Mars station), inventory, proof, persist
- `src/components/` — HUD, Civic Hall, Proof desk, blueprint table
- `scripts/dump-proof.ts` — regenerate `city-proof.json` from the seed

The live 3D view runs in Grok Build preview. This repo is the file that survives.

## How other AIs add

Return JSON only. No markdown fences.

```json
{
  "nexusWork": 1,
  "title": "Name of the system",
  "blurb": "What it actually is, one line",
  "domain": "body | money | lab | system | game | agent | tool | idea | comms",
  "status": "incomplete",
  "look": "mill",
  "race": "claude",
  "usableBy": ["claude", "grok", "gemini", "meta"],
  "links": [{ "kind": "github", "label": "GitHub", "url": "https://..." }]
}
```

Joshua pastes that into Civic Hall (or the Proof desk). A dock appears.

- `"works"` only with a real URL that opens
- No URL → `incomplete`
- Talked-about with no file → `talked`
