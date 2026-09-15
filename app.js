const DAY = 86400000;
const SLOT = 900000;
const ROW = 30;

const timeline = document.querySelector('#timeline');
const dateInput = document.querySelector('#date');
const tip = document.querySelector('#tip');
const details = document.querySelector('#details');
const detailsTitle = document.querySelector('#details-title');
const detailsMeta = document.querySelector('#details-meta');
const summaryList = document.querySelector('#summary-list');
const summaryEmpty = document.querySelector('#summary-empty');
const detailsBackdrop = document.querySelector('#details-backdrop');

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

function info(session) {
  const duration = new Date(session.end) - new Date(session.start);
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.round(duration % 3600000 / 60000);
  return `${session.title} · ${time(session.start)}–${time(session.end)} (${hours ? `${hours}h ` : ''}${minutes}m)`;
}

function closeDetails() {
  details.classList.remove('open');
  detailsBackdrop.classList.remove('open');
  details.setAttribute('inert', '');
  details.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.session.selected').forEach(session => session.classList.remove('selected'));
  if (lastFocusedSession) lastFocusedSession.focus();
  lastFocusedSession = null;
}

function openDetails(session, element) {
  detailsTitle.textContent = session.title;
  detailsMeta.textContent = info(session);
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
  detailsBackdrop.classList.add('open');
  details.removeAttribute('inert');
  details.setAttribute('aria-hidden', 'false');
  document.querySelector('#details-close').focus();
}

function addBar(session, date, track, lane, total) {
  const start = Math.max(date.getTime(), new Date(session.start));
  const end = Math.min(date.getTime() + DAY, new Date(session.end));
  const bar = document.createElement('div');
  bar.className = 'session';
  bar.style.top = `${(start - date) / SLOT * ROW + 3}px`;
  bar.style.height = `${Math.max((end - start) / SLOT * ROW - 6, 18)}px`;
  bar.style.left = `calc(${lane * 100 / total}% + 8px)`;
  bar.style.width = `calc(${100 / total}% - 16px)`;
  bar.textContent = session.title;
  bar.title = info(session);
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
  const lanes = [];
  visible
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .forEach(session => {
      const start = Math.max(date.getTime(), new Date(session.start));
      const end = Math.min(next.getTime(), new Date(session.end));
      let lane = lanes.findIndex(laneEnd => laneEnd <= start);
      if (lane < 0) {
        lane = lanes.length;
        lanes.push(end);
      } else {
        lanes[lane] = end;
      }
      session._lane = lane;
    });
  visible.forEach(session => addBar(session, date, track, session._lane, lanes.length));

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
detailsBackdrop.onclick = closeDetails;
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
