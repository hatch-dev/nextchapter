# Social banners

The picture shown when a link to an app is shared (Facebook, LinkedIn, X,
Slack, WhatsApp, Teams). `index.php` writes the `og:image` / `twitter:image`
tags from whatever file is here — drop a file in, no code change needed.

**Size:** 1200 × 630 px (1.91:1), JPG or PNG, under ~1 MB.
Keep text and logos away from the edges; some platforms crop to a square.

**Name each file after the app's URL** (`.jpg`, `.jpeg`, `.png` or `.webp`):

| File                                | Used for                                  |
|-------------------------------------|-------------------------------------------|
| `default.jpg`                       | launchpad, role hubs, sign-up, admin, and any program without its own |
| `executive-readiness.jpg`           | Executive Readiness                       |
| `innovation-pipeline.jpg`           | AI Innovation Pipeline                    |
| `responsible-ai-governance.jpg`     | Responsible AI Governance                 |
| `ai-ready-architecture.jpg`         | AI-Ready Architecture                     |
| `ai-ready-culture.jpg`              | AI-Ready Culture                          |
| `workforce-readiness.jpg`           | Workforce Readiness                       |
| `judgment-critical-thinking.jpg`    | Judgment                                  |
| `friction-map.jpg`                  | The Friction Map                          |
| `connection-practice.jpg`           | The Connection Practice                   |
| `conscience-ethical-reasoning.jpg`  | Conscience                                |
| `authorship-studio.jpg`             | The Authorship Studio                     |
| `narrative-forge.jpg`               | The Narrative Forge                       |

Lookup order for a program page: its slug → its storage id (e.g.
`decision-lab.jpg`) → `default.jpg`.

Platforms cache cards. After replacing a banner, re-scrape the link with
the Facebook Sharing Debugger / LinkedIn Post Inspector.
