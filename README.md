# FB Social Graph Visualiser

Visualise how Facebook's ML ranks your friends — 100% client-side, nothing leaves your browser.

**Live demo:** [rareone0602.github.io/fb-social-graph](https://rareone0602.github.io/fb-social-graph/)

## How Facebook's EdgeRank Works

EdgeRank was Facebook's original algorithm for deciding what appears in your News Feed. While Facebook has since evolved it into a more complex ML system, the core principles remain the same.

### The Classic EdgeRank Formula

```
EdgeRank = Affinity × Weight × Decay
```

| Factor | What it measures |
|--------|-----------------|
| **Affinity** | How close you are to the content creator. Built from one-directional signals: profile views, message frequency, photo tag interactions, and reaction patterns. If you stalk someone's profile but they never visit yours, *your* affinity toward them is high but theirs toward you is low. |
| **Weight** | The type of interaction. Comments > Reactions > Clicks > Views. A comment signals far stronger engagement than a passive scroll-past. Different content types (photos, videos, links, text) also carry different base weights. |
| **Decay** | How fresh the content is. A post from 5 minutes ago scores much higher than one from 5 hours ago. This is why your feed constantly reshuffles. |

### What This Tool Extracts

Modern Facebook doesn't use the simple three-factor formula anymore — it runs a deep learning model with thousands of features. But the page source still exposes two key signals from the **search typeahead** system:

- **Feature 16173 (Base Affinity):** A float (~0.389–0.414) representing how strongly Facebook's model associates you with each friend. This is the raw ML output that powers autocomplete rankings when you type a name in the search bar.

- **Feature 16174 (Engagement Multiplier):** Typically half of the base affinity, but friends you actively interact with receive a **+0.5 structural bonus**. This is the "Active" flag in the visualisation — it reveals who Facebook *knows* you're engaging with right now.

### Why the Score Range Is So Narrow

The raw values (0.389–0.414) look nearly identical, but this is by design. These are **probability-calibrated weights** — the model outputs values in a compressed range where small differences translate to large ranking changes. A difference of 0.025 between your #1 and #390 friend is enough to completely reorder your search results, feed, and chat sidebar.

### The Bigger Picture

These scores influence more than just search:

- **News Feed ranking** — whose posts you see first
- **Chat sidebar ordering** — who appears at the top of Messenger
- **Birthday notifications** — which birthdays get prominent placement
- **Friend suggestions** — who gets recommended to your contacts
- **Ad targeting** — lookalike audiences based on your social cluster

## Usage

1. Go to [facebook.com](https://www.facebook.com)
2. Press `Ctrl+U` to view page source
3. Select all (`Ctrl+A`) and copy (`Ctrl+C`)
4. Paste into the text area on the app and click **Analyse**

## Privacy

All parsing happens locally in your browser. No data is sent to any server.

## Acknowledgements

Thanks to [Yuda](https://github.com/Yuda) and [Axun0402](https://github.com/Axun0402) for help with testing.
