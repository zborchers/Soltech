# Soltech — private deploy

This is a stripped-down clone of the Root Cause infrastructure pattern, aimed
at one person: you. No paywall, no password gate, no analytics, no marketing
copy. Same proxy pattern (`chat.js`), same model, but `max_tokens: 4000`
instead of the artifact-sandboxed 1000 — this is what actually matches the
original tool that produced the transcript you liked.

## What's in here

- `index.html` — the whole frontend. Plain HTML/JS, no build step, no framework.
- `api/chat.js` — your existing serverless proxy, unchanged. Protects your
  Anthropic API key the same way Root Cause and Energetic Direction do.
- `vercel.json` — bumps the function timeout so long responses (4000 tokens
  can take a while) don't get cut off by Vercel's default limit.

## Deploy

1. Push this folder to a new GitHub repo (private is fine — recommended,
   since this isn't meant to be public), e.g. `zborchers/soltech-private`.
2. Import it into Vercel as a new project.
3. In Vercel project settings → Environment Variables, add
   `ANTHROPIC_API_KEY` with your key (same one your other projects use).
4. Deploy. Vercel will auto-detect `api/chat.js` as a serverless function
   and serve `index.html` as the static root.
5. Optional: don't link to it from anywhere, don't add it to your sitemap,
   and consider adding a `robots.txt` with `Disallow: /` if you want to be
   extra sure it stays unlisted. The Vercel-assigned URL alone is already
   very hard to guess.

## What's different from the version I ran in-artifact

The in-chat version I gave you earlier calls `api.anthropic.com` directly
from the browser inside Claude's artifact sandbox, capped at 1000 output
tokens — a constraint of that sandbox, not of the prompt. This version calls
your own `/api/chat`, same as Root Cause, at `max_tokens: 4000`, matching
what `BASTInterpreter-5.jsx` actually used. If you want to compare the two
side by side, ask the same open-ended question in both and look at where
the shorter one gets cut off.

## System prompt

`index.html` has the full `systemPrompt-4.js` content — the exact one you
uploaded — inlined directly into the page. If you ever want to update the
voice, edit the `SYSTEM_PROMPT` constant near the top of the `<script>` tag.
