const DAY = 86400000;
const SLOT = 900000;
const ROW = 30;
const SESSION_INSET = 3;
const SESSION_GAP = 6;
const MIN_SESSION_HEIGHT = 18;
const COMPACT_MARKER_HEIGHT = 6;
const COMPACT_SESSION_THRESHOLD = ((MIN_SESSION_HEIGHT + SESSION_GAP) / ROW) * SLOT;

const timeline = document.querySelector('#timeline');
const dateInput = document.querySelector('#date');
const tip = document.querySelector('#tip');
const details = document.querySelector('#details');
const detailsTitle = document.querySelector('#details-title');
const detailsMeta = document.querySelector('#details-meta');
const detailsProject = document.querySelector('#details-project');
const summaryList = document.querySelector('#summary-list');
const summaryEmpty = document.querySelector('#summary-empty');

const PROJECT_COLORS = [
  '#9f4936', '#326e9b', '#5a5598', '#2c7863', '#995a2d',
  '#933d64', '#456d7c', '#765f2c', '#4f7139', '#704d85',
];

let sessions = [];
let dates = [];
let lastFocusedSession = null;

const key = d => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateOf = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const time = value => new Date(value).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
});

const rootId = value => String(value || '').split('#segment-', 1)[0];

function sessionDuration(session) {
  return Math.max(0, new Date(session.end) - new Date(session.start));
}

function sessionInterval(session, date, next) {
  return {
    start: Math.max(date.getTime(), new Date(session.start).getTime()),
    end: Math.min(next.getTime(), new Date(session.end).getTime()),
  };
}

function barGeometry(session, date, next, marker = false) {
  const interval = sessionInterval(session, date, next);
  const start = interval.start;
  const end = interval.end;
  const clippedDuration = Math.max(0, end - start);
  const compact = marker && sessionDuration(session) < COMPACT_SESSION_THRESHOLD;
  const top = compact
    ? (start - date.getTime()) / SLOT * ROW - COMPACT_MARKER_HEIGHT
    : (start - date.getTime()) / SLOT * ROW + SESSION_INSET;
  const height = compact
    ? MIN_SESSION_HEIGHT
    : Math.max(clippedDuration / SLOT * ROW - SESSION_GAP, MIN_SESSION_HEIGHT);
  const pixelsToMilliseconds = SLOT / ROW;

  return {
    compact,
    top,
    height,
    layoutStart: date.getTime() + top * pixelsToMilliseconds,
    layoutEnd: date.getTime() + (top + height) * pixelsToMilliseconds,
  };
}

function info(session) {
  const duration = new Date(session.end) - new Date(session.start);
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.round(duration % 3600000 / 60000);
  const project = session.project || 'Unknown project';
  return `${session.title} · ${project} · ${time(session.start)}–${time(session.end)} (${hours ? `${hours}h ` : ''}${minutes}m)`;
}

function projectColor(session) {
  const value = String(session.project_key || session.project || 'unknown');
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

function closeDetails() {
  document.body.classList.remove('details-open');
  details.classList.remove('open');
  details.setAttribute('inert', '');
  details.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.session.selected').forEach(session => session.classList.remove('selected'));
  if (lastFocusedSession) lastFocusedSession.focus();
  lastFocusedSession = null;
}

function openDetails(session, element) {
  detailsTitle.textContent = session.title;
  detailsMeta.textContent = info(session);
  detailsProject.textContent = session.project_path || session.project || 'Unknown project';
  summaryList.replaceChildren();

  const summary = Array.isArray(session.summary) ? session.summary : [];
  summary.forEach(point => {
    const item = document.createElement('li');
    item.textContent = point;
    summaryList.append(item);
  });
  summaryEmpty.hidden = summary.length > 0;

  document.querySelectorAll('.session.selected').forEach(item => item.classList.remove('selected'));
  lastFocusedSession = element;
  element.classList.add('selected');
  details.classList.add('open');
  document.body.classList.add('details-open');
  details.removeAttribute('inert');
  details.setAttribute('aria-hidden', 'false');
  document.querySelector('#details-close').focus();
}

function addBar(session, track, lane, total, geometry) {
  const bar = document.createElement('div');
  bar.className = 'session';
  if (geometry.compact) bar.classList.add('compact');
  bar.style.setProperty('--project-color', projectColor(session));
  bar.style.top = `${geometry.top}px`;
  bar.style.height = `${geometry.height}px`;
  bar.style.left = `calc(${lane * 100 / total}% + 8px)`;
  bar.style.width = `calc(${100 / total}% - 16px)`;
  bar.textContent = session.title;
  bar.setAttribute('aria-label', info(session));
  bar.setAttribute('role', 'button');
  bar.tabIndex = 0;

  bar.onmousemove = event => {
    tip.style.display = 'block';
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.top = `${event.clientY + 12}px`;
    tip.textContent = info(session);
  };
  bar.onmouseleave = () => tip.style.display = 'none';
  bar.onclick = () => openDetails(session, bar);
  bar.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetails(session, bar);
    }
  };
  track.append(bar);
}

function addDay(value) {
  const date = dateOf(value);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const block = document.createElement('section');
  block.className = 'day-block';
  block.id = `date-${value}`;
  block.dataset.date = value;
  block.innerHTML = `<div class="date-marker">${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}<span>${value}</span></div>`;

  const body = document.createElement('div');
  body.className = 'day-body';
  const track = document.createElement('div');
  track.className = 'session-track';

  for (let index = 0; index < 96; index += 1) {
    const row = document.createElement('div');
    row.className = `row${index % 4 === 0 ? ' hour' : ''}`;
    const minutes = index * 15;
    row.innerHTML = `<span class="time">${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}</span>`;
    body.append(row);
  }

  const visible = sessions.filter(session => new Date(session.start) < next && new Date(session.end) >= date);
  const visibleById = new Map(visible.map(session => [session.id, session]));
  const lanesByRoot = new Map();
  const visibleSessionsByRoot = new Map();
  visible.forEach(session => {
    const root = rootId(session.id);
    if (!visibleSessionsByRoot.has(root)) visibleSessionsByRoot.set(root, session);
  });
  const depthOf = session => {
    let depth = 0;
    let current = session;
    const seen = new Set();
    while (current.parent_id) {
      const parentRoot = rootId(current.parent_id);
      if (seen.has(parentRoot)) break;
      seen.add(parentRoot);
      current = visibleSessionsByRoot.get(parentRoot);
      if (!current) break;
      depth += 1;
    }
    return depth;
  };
  const ordered = [...visible].sort((a, b) => {
    const depthDifference = depthOf(a) - depthOf(b);
    if (depthDifference) return depthDifference;
    const startDifference = new Date(a.start) - new Date(b.start);
    return startDifference || String(a.id).localeCompare(String(b.id));
  });
  const layouts = new Map();
  const lanes = [];
  const intervalsOverlap = (first, second) => (
    first.start < second.end && second.start < first.end
  );
  ordered.forEach(session => {
    const interval = sessionInterval(session, date, next);
    const parentRoot = session.parent_id ? rootId(session.parent_id) : null;
    const parentLanes = parentRoot ? lanesByRoot.get(parentRoot) || [] : [];
    const minimumLane = parentLanes.length ? Math.max(...parentLanes) + 1 : 0;
    let lane = -1;
    for (let candidate = minimumLane; candidate < lanes.length; candidate += 1) {
      const occupied = lanes[candidate].some(existing => intervalsOverlap(existing, interval));
      if (!occupied) {
        lane = candidate;
        break;
      }
    }
    if (lane < 0) {
      lane = Math.max(minimumLane, lanes.length);
      while (lanes.length <= lane) lanes.push([]);
    }
    lanes[lane].push(interval);
    layouts.set(session.id, { interval, lane });
    const root = rootId(session.id);
    const assignedLanes = lanesByRoot.get(root) || [];
    if (!assignedLanes.includes(lane)) assignedLanes.push(lane);
    lanesByRoot.set(root, assignedLanes);
  });

  // Lane assignment is based on real intervals. Only then can we decide
  // whether a short session needs a marker based on its next session in the
  // same lane; a session in another lane cannot visually collide with it.
  const sessionsByLane = new Map();
  layouts.forEach((layout, sessionId) => {
    const laneSessions = sessionsByLane.get(layout.lane) || [];
    laneSessions.push({ session: visibleById.get(sessionId), layout });
    sessionsByLane.set(layout.lane, laneSessions);
  });
  const markerSessions = new Set();
  sessionsByLane.forEach(laneSessions => {
    laneSessions.sort((a, b) => {
      const startDifference = a.layout.interval.start - b.layout.interval.start;
      return startDifference || String(a.session.id).localeCompare(String(b.session.id));
    });
    for (let index = laneSessions.length - 2; index >= 0; index -= 1) {
      const current = laneSessions[index].session;
      if (sessionDuration(current) >= COMPACT_SESSION_THRESHOLD) continue;
      const nextSession = laneSessions[index + 1].session;
      const currentGeometry = barGeometry(current, date, next);
      const nextGeometry = barGeometry(
        nextSession,
        date,
        next,
        markerSessions.has(nextSession.id),
      );
      if (currentGeometry.layoutEnd > nextGeometry.layoutStart) {
        markerSessions.add(current.id);
      }
    }
  });
  ordered.forEach(session => {
    const layout = layouts.get(session.id);
    const geometry = barGeometry(session, date, next, markerSessions.has(session.id));
    addBar(session, track, layout.lane, lanes.length || 1, geometry);
  });

  body.append(track);
  block.append(body);
  timeline.append(block);
}

function jump(value) {
  const target = document.querySelector(`#date-${value}`);
  if (target) timeline.scrollTo({ top: target.offsetTop + 9 * 60 / 15 * ROW, behavior: 'auto' });
  dateInput.value = value;
}

document.querySelector('#details-close').onclick = closeDetails;
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && details.classList.contains('open')) closeDetails();
});

fetch('sessions.json')
  .then(response => response.json())
  .then(data => {
    sessions = data;
    if (!sessions.length) {
      timeline.innerHTML = '<div class="empty">No sessions found.</div>';
      document.querySelector('#day-label').textContent = 'No sessions';
      return;
    }

    const first = new Date(Math.min(...sessions.map(session => new Date(session.start))));
    const last = new Date(Math.max(...sessions.map(session => new Date(session.start))));
    for (let date = new Date(first.getFullYear(), first.getMonth(), first.getDate()); date <= last; date.setDate(date.getDate() + 1)) {
      dates.push(key(date));
    }
    dates.forEach(addDay);
    dateInput.value = dates.at(-1);
    document.querySelector('#day-label').textContent = `${sessions.length} sessions across ${dates.length} dates`;
    document.querySelector('#count').textContent = 'Scroll to explore';
    requestAnimationFrame(() => jump(dates.at(-1)));
  })
  .catch(() => {
    timeline.innerHTML = '<div class="empty">Run <code>python3 app.py --only-extract</code> first.';
  });

document.querySelector('#prev').onclick = () => {
  const index = dates.indexOf(dateInput.value);
  if (index > 0) jump(dates[index - 1]);
};
document.querySelector('#next').onclick = () => {
  const index = dates.indexOf(dateInput.value);
  if (index < dates.length - 1) jump(dates[index + 1]);
};
document.querySelector('#today').onclick = () => jump(key(new Date()));
dateInput.onchange = () => jump(dateInput.value);
