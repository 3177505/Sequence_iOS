const USER_AGENT = 'Sequence/1.0 (private research scraper)';
const PAGE_SIZE = 100;
const WANT_PER_SUB = 10;

export const REDDIT_VIDEO_WRAPPERS = [
  { key: 'datamoshing', subreddit: 'datamoshing' },
  { key: 'ObscureMedia', subreddit: 'ObscureMedia' },
];

function decodeAmp(u) {
  if (!u || typeof u !== 'string') return null;
  return u.replace(/&amp;/g, '&');
}

function redditMp4FromData(data) {
  if (!data) return null;
  const rv = data.secure_media?.reddit_video || data.media?.reddit_video;
  if (rv?.fallback_url) return decodeAmp(rv.fallback_url);
  const parent = data.crosspost_parent_list?.[0];
  if (parent) {
    const rv2 = parent.secure_media?.reddit_video || parent.media?.reddit_video;
    if (rv2?.fallback_url) return decodeAmp(rv2.fallback_url);
  }
  return null;
}

function youtubeId11(id) {
  return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function youtubeMinimalEmbedFromId(id) {
  const y = youtubeId11(id);
  if (!y) return null;
  const q = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    modestbranding: '1',
    rel: '0',
    fs: '0',
    disablekb: '1',
    iv_load_policy: '3',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${y}?${q}`;
}

function youtubeEmbedFromPageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let url;
  try {
    url = new URL(rawUrl, 'https://www.reddit.com');
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0];
    return youtubeMinimalEmbedFromId(id);
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/').filter(Boolean)[1]?.split('?')[0];
      return youtubeMinimalEmbedFromId(id);
    }
    const v = url.searchParams.get('v');
    return youtubeMinimalEmbedFromId(v);
  }
  return null;
}

function slimEntry(child) {
  const d = child.data;
  const redditVideoUrl = redditMp4FromData(d);
  const sourceUrl = d.url?.startsWith('/')
    ? `https://www.reddit.com${d.url}`
    : d.url || null;
  const youtubeEmbedUrl = redditVideoUrl ? null : youtubeEmbedFromPageUrl(d.url);

  const permalink = d.permalink?.startsWith('http')
    ? d.permalink
    : `https://www.reddit.com${d.permalink}`;

  return {
    id: d.id,
    title: d.title,
    permalink,
    created_utc: d.created_utc,
    subreddit: d.subreddit,
    is_video: d.is_video === true,
    post_hint: d.post_hint || null,
    sourceUrl,
    redditVideoUrl,
    youtubeEmbedUrl,
  };
}

function hasPlayableVideo(row) {
  return !!(row.redditVideoUrl || row.youtubeEmbedUrl);
}

async function fetchListing(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

function pickVideoPosts(listingJson) {
  const children = listingJson?.data?.children ?? [];
  const out = [];
  for (const child of children) {
    if (child.kind !== 't3') continue;
    const row = slimEntry(child);
    if (!hasPlayableVideo(row)) continue;
    out.push(row);
    if (out.length >= WANT_PER_SUB) break;
  }
  return out;
}

export async function fetchRedditVideosPayload() {
  const payload = {
    _lastUpdated: new Date().toISOString(),
    _meta: {
      wantPerSub: WANT_PER_SUB,
      pageSize: PAGE_SIZE,
      wrappers: REDDIT_VIDEO_WRAPPERS.map((w) => w.key),
      playback:
        'redditVideoUrl = Reddit-hosted MP4 (video element); youtubeEmbedUrl = iframe embed',
    },
  };

  for (const { key, subreddit } of REDDIT_VIDEO_WRAPPERS) {
    try {
      const json = await fetchListing(subreddit);
      payload[key] = pickVideoPosts(json);
    } catch (e) {
      payload[key] = [];
      payload._errors = payload._errors || {};
      payload._errors[key] = String(e.message || e);
    }
  }

  return payload;
}
