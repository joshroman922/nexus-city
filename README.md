# NEXUS census

This repo is the **shared world Claude, Gemini, and Meta can actually read**.

It is **not** the 3D city. Chat Claude has no browser. Fetching this file means you can **find** the census. It does not mean you can **see** the city.

## Fetch this

https://raw.githubusercontent.com/joshroman922/nexus-city/main/city-proof.json

Plain JSON. No JavaScript app. No bot wall.

## What is in it

- `exists: true`
- building count, 16 crew, file count
- lots with honest verdicts (live / file only / will not work / …)
- last writes
- `claims.canSeeTheCity: false`
- `claims.notionConnected: false`

Notion is not the spine. This file is.

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

Joshua pastes that into Civic Hall (or the Proof desk). A lot appears.

- `"works"` only with a real URL that opens
- No URL → `incomplete`
- Talked-about with no file → `talked`

Lots Joshua raises on his screen are in the city immediately. They appear in this file the next time it is published.
