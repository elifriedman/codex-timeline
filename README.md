# Codex Session Timeline

Codex Session Timeline is a small, dependency-free web app for exploring Codex session history on a scrollable 24-hour timeline. Each session appears as a colored block, so overlapping work is easy to spot. The app reads local session data from `sessions.json`; it does not send session content to a server.

![Session timeline showing two overlapping sample sessions](assets/timeline-overlap.png)


## Run locally

Requirements: Python 3 and a local Codex session directory.

Run the extractor and webserver together:

   ```bash
   python3 app.py 8000
   ```

Open [http://localhost:8000](http://localhost:8000).

Install the optional AI summarizer dependencies with:

   ```bash
   python3 -m pip install -r requirements.txt
   ```

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. `OPENAI_BASE_URL` can
point to an alternate OpenAI-compatible API domain; it should include the API
path, such as `/v1`. Generate summaries during extraction with:

   ```bash
   python3 app.py --summarize 8000
   ```

Without `--summarize`, session content is not sent to an API. If a transcript
is larger than `OPENAI_SUMMARY_MAX_CHARS` (60,000 characters by default), the
summarizer sends only the user's messages and clips that text to the limit.

By default, `app.py` extracts sessions and starts the webserver. Use
`--only-extract` to only generate `sessions.json`, or `--only-server` to only run the webserver.

All command-line options supported by `python3 -m http.server` are passed
through, including `--bind`, `--directory`, `--cgi`, and `--protocol`.

For example:

   ```bash
   python3 app.py --bind 127.0.0.1 --directory . 8000
   ```

The browser loads `sessions.json` with `fetch`, so opening `index.html` directly from the filesystem will not work in browsers that block local file requests.

## How it works

- `app.py` scans the Codex session index and JSONL files, groups activity into sessions, optionally generates AI summaries, writes `sessions.json`, and serves the app.
- `index.html` defines the page structure and date controls.
- `app.js` groups sessions by date, calculates overlapping lanes, renders the timeline, and opens summary details in a sidebar when a session is selected.
- `style.css` provides the layout, colors, responsive behavior, hover details, and sidebar.

Use the date field or the previous/next buttons to move between dates. Hover over a session block to see its title, start and end times, and duration. Click a block to open its AI summary; blocks extracted without `--summarize` show an unavailable message instead.

## Notes

Session data can contain private conversation metadata. Keep `sessions.json` local and review the file before committing or publishing it. The repository ignores generated session data by default.
