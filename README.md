# BJJ Map

An interactive spider/tree map of high-percentage Brazilian jiu-jitsu positions, techniques and counters, split into top and bottom perspectives.

Built with Next.js (App Router), React Flow and ELK. It deploys to Vercel with zero config.

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` and `npm run build` first compile `content/` into `lib/generated/content.json`, so the app never reads YAML at runtime.

## How the data works

The map is a state graph:

- A **node** is a *position + side*, for example `closed-guard:bottom`.
- An **edge** is a *technique* performed from that side. It leads to a new position and side (a sweep from `closed-guard:bottom` lands you in `mount:top`), or ends the match (a submission).

```
content/
  positions/<id>.yaml           # the position, with a perspective for top/bottom (or neutral)
  techniques/<from>/<id>.yaml   # from → to edges, with steps and counters
  poses/<id>.yaml               # joint coordinates for the stylized diagram
```

### Adding content

```bash
npm run new -- position knee-on-belly
npm run new -- technique baseball-choke knee-on-belly
npm run content   # validates schema and cross-references
```

Validation fails when a technique points to an unknown position or side, a counter references an unknown technique, a submission has a `to`, a non-submission is missing a `to`, or a position has no pose.

### Diagrams

Each pose is 11 joints per athlete (`head, neck, pelvis, l/rElbow, l/rHand, l/rKnee, l/rFoot`) in a 200×120 coordinate space, with the ground at `y≈115`. The top athlete renders in blue and the bottom athlete in orange. The `<PoseDiagram>` component draws them, so a new position needs only data, no artwork.

### Pose editor and animations

Run `npm run dev` and open `/dev/pose-editor`. Drag the joints, then click **Save to content/** (dev only) or **Copy YAML**.

Every technique animates in the detail panel. Without keyframes, it tweens from the `from` position's pose to the `to` position's pose. To show the real mechanics, add intermediate poses:

```yaml
animation:
  keyframes:
    - { pose: hip-bump-sweep-1, performer: bottom } # which slot "you" occupy in this pose
    - { pose: hip-bump-sweep-2, performer: bottom, mirror: false }
  mirrorEnd: true # mirror the final position's pose so the direction matches
```

The athlete performing the move keeps its colour throughout the animation. Interpolation is bone-based (angles and lengths), so limbs rotate instead of stretching. To make a keyframe, open the start pose in the editor, use **Duplicate as…**, and set the previous pose as the onion skin.

### Gi vs no-gi

Every position and technique has `rulesets` (default `[nogi]`). To add gi content, tag it with `[gi]` or `[nogi, gi]`. The Gi/No-Gi toggle appears automatically once there's content for both.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/positions?ruleset=nogi` | All positions |
| `GET /api/positions/:id` | A position with its pose and outgoing techniques |
| `GET /api/techniques?ruleset=nogi` | All techniques |
| `GET /api/techniques/:id` | A single technique |
| `GET /api/graph?root=closed-guard&side=bottom&depth=2` | Expanded option tree |

## Roadmap

- Pose editor (`/dev/pose-editor`) for dragging joints visually
- Gi content
- Postgres-backed content and an admin UI, behind `lib/content.ts`
- Personal progress tracking ("moves I know")
