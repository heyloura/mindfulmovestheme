# Mindful Moves

A Micro.blog theme for a tai chi site that is a blog and a course at once. Ink
wash on rice paper, one seal-red mark, and ordered video lessons with a bamboo
stalk that grows as the course is filmed.

Everything on the site is written in Micro.blog. The theme reads your pages
(matched by title), your categories and a few small conventions. No content ever
lives in a theme file.

- **How to enter content:** `docs/content-guide.md` in the source repository
- **Why it looks and works this way:** `docs/design-brief.md`

## Settings

Set these in Micro.blog's settings for the theme (they come from `plugin.json`):

| Setting | What it does |
|---|---|
| Wordmark, first line | the large line in the header lockup (default: the site title) |
| Wordmark, small second line | the small capitals under it, e.g. "Tai Chi Chuan" |
| Tinylytics site code | page counts, the "I practiced this" kudos, and button events |
| Newsletter freebie, link text / address | the link at the end of every newsletter email |

## In brief

| Thing | How the theme knows |
|---|---|
| A course | a page whose title matches a category name |
| Its outline | the first numbered list on that page |
| An episode | a post in that category whose title matches an outline line (or that a line links to) |
| A deep dive | any other post in a course category; linking to an episode adds "Go deeper" there |
| A cue card | a post in Cue Cards; pairs with the episode of the same title |
| Home hero, notice, classes, signup | the pages Home, Notice, Classes, Subscribe |
| A card picture | `class="card-image"` on an image, otherwise the first image |

## Micro.blog integration

`microblog_head.html` and `author.html` follow Micro.blog's blank theme and come
from the Dragon Gate theme: feeds named `feed.xml`, `rel=me`, IndieAuth, Micropub,
Webmention, custom CSS and plug-in hooks, all guarded so the theme also builds
outside Micro.blog. `layouts/newsletter.html` is the newsletter email; a template
pasted into Newsletter → Settings overrides it.

## Credits

- Fonts (self-hosted, SIL Open Font License, licenses in `static/fonts/`):
  Cormorant Garamond, Source Serif 4, Atkinson Hyperlegible
- The theme draws its own brush strokes, seal and bamboo in SVG
