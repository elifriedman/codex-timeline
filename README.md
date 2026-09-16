# Codex Session Timeline

Codex Session Timeline is a small web app for exploring Codex session history on a scrollable 24-hour timeline. Each session appears as a colored block, so overlapping work is easy to spot. The app reads your codex sessions and builds a static web page to display them; when the optional summarizer is enabled, it summarizes the work done in each session using an OpenAI model.

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

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. 
Generate session summaries during extraction with:

   ```bash
   python3 app.py --summarize 8000
   ```

This will send the text of each session to an OpenAI model to summarize it.

Without `--summarize`, session content is not sent to an API. If a transcript
is larger than `OPENAI_SUMMARY_MAX_CHARS` (60,000 characters by default), the
summarizer sends only the user's messages and clips that text to the limit.
Summaries are cached in `summary_cache.json` and resued whenever
the app is rerun when the transcript and model haven't changed. 

The summarizer runs in parallel (4 workers by default), and temporary rate-limit or
model-overload errors are retried with `Retry-After`-aware exponential backoff
and jitter. Use `OPENAI_SUMMARY_WORKERS`, `OPENAI_SUMMARY_MAX_RETRIES`, or the
matching command-line options to tune those settings.

Sessions are colored by their project.

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

- `app.py` scans the Codex session index and JSONL files, groups files by session ID, then groups their combined activity into contiguous blocks, optionally generates AI summaries for each block, writes `sessions.json`, and serves the app.
- `index.html` defines the page structure and date controls.
- `app.js` groups sessions by date, calculates overlapping lanes, renders the timeline, and opens block-specific summary details in a sidebar when a session block is selected.
- `style.css` provides the layout, colors, responsive behavior, hover details, and sidebar.

Use the date field or the previous/next buttons to move between dates. Hover over a session block to see its title, start and end times, and duration. Click a block to open its AI summary; blocks extracted without `--summarize` show an unavailable message instead.

## Notes

Session data can contain private conversation metadata. Keep `sessions.json` local and review the file before committing or publishing it. The repository ignores generated session data by default.
