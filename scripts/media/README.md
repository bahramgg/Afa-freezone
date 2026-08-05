# The guides

Four videos and four PDFs, one of each per panel, served from the landing page.

They are for somebody who has not been told what the system is for — an official
who will watch once, on a screen, without narration. So the videos are a tour of
the real panels: a screenshot fills the frame, a single line of Persian sits
under it, and nothing is described that is not visible at that moment.

The first version of these was nine minutes of paragraphs over a diagram. It
explained screens the viewer had never been shown, at a pace that assumed they
were studying rather than watching.

## Rebuilding

```bash
npm run guides            # videos and documents
npm run guides -- bank    # one panel
npm run guides -- --pdf   # documents only, which is quick
```

`FFMPEG_PATH` must point at an ffmpeg binary. Output lands in `public/guide/`
and is committed, because it is what the site serves.

That command uses the screenshots already in `scripts/media/shots/`, which are
committed too. Nothing else is needed to rebuild a video.

## Re-taking the screenshots

Only necessary when a panel's own layout changes.

```bash
# 1. a scratch database, and a believable few weeks of trade in it
createdb afa_guide
DATABASE_URL="postgresql://…/afa_guide?schema=public" npx prisma migrate deploy
GUIDE_DATABASE_URL="postgresql://…/afa_guide" npm run guides:demo

# 2. a dev server pointed at it, on its own port
DATABASE_URL="postgresql://…/afa_guide?schema=public" EMAIL_PROVIDER=console \
  AUTH_RATE_LIMIT=500 npx next dev -p 3100

# 3. the photographs
GUIDE_BASE_URL=http://localhost:3100 npm run guides:shoot
```

The demo database is separate on purpose. These screenshots go on a public page,
so the names, amounts and account numbers in them have to be invented — and the
seed refuses to run without `GUIDE_DATABASE_URL`, so it cannot be pointed at a
real one by forgetting a flag.

## The files

| | |
|---|---|
| `storyboard.ts` | what each video shows, in order, and what each shot is of |
| `content.ts` | the flow diagrams and the written guides the PDFs are set from |
| `demo-world.ts` | the invented trade the screenshots are taken of |
| `capture.ts` | drives the browser: signs in, opens, fills, frames, shoots |
| `video-stage.ts` | the video's own look, and the diagram drawn to fill a frame |
| `stage.ts` | the shared look, and the diagram drawn to fit a page |
| `render-video.ts` | beats → stills → mp4 |
| `render-pdf.ts` | sections → pdf |

## When a flow changes

Change `content.ts` and `storyboard.ts` together. A guide that describes a path
the system no longer has is worse than no guide, and the two files describe the
same paths from different distances — `storyboard.ts` in captions, `content.ts`
in paragraphs.

If the change is visible on a panel, re-take the screenshots too. A caption that
points at a button which has moved is the same failure, one step quieter.
