# Lobby Display — Social Forces

An auto-rotating HTML slideshow of recent *Social Forces* journal content, designed for a TV near the elevator in the UNC Sociology department.

Live site: <https://social-forces.github.io/lobby-display/>

## What's on screen

The slideshow cycles every 20 seconds through four kinds of cards:

- **Finding** — the punchy takeaway from a newly published article, lifted from our Bluesky posts
- **Article** — a recent research article: title, authors, opening sentences of the abstract
- **Book review** — book title, author, year, and (when found) the cover image
- **Classic** — entries from the journal's "Most Read" and "Most Cited" lists

Every slide carries a QR code so passers-by can scan to read the full piece.

## Operation

This repo is regenerated automatically by the [`sf_socialmedia`](https://github.com/nealcaren/sf_socialmedia) pipeline. After each Bluesky publish run, `displays/build_data.py` rewrites `data.json` and the sync script pushes any changes here. The slideshow refetches `data.json` every 30 minutes in the browser, so the TV picks up new content without a restart.

## TV setup

Open `https://social-forces.github.io/lobby-display/` in the TV's browser and press <kbd>f</kbd> to enter fullscreen. Keyboard shortcuts for one-off use:

- <kbd>←</kbd>/<kbd>→</kbd> — previous / next slide
- <kbd>space</kbd> — pause for 10 minutes
- <kbd>f</kbd> — toggle fullscreen
