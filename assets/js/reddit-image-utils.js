function decodeRedditUrl(url) {
  return url ? url.replace(/&amp;/g, '&') : null;
}

function galleryImageUrls(data) {
  const meta = data.media_metadata;
  const items = data.gallery_data?.items;
  if (!meta || !items?.length) return [];
  const urls = [];
  for (const item of items) {
    const m = meta[item.media_id];
    const u = m?.s?.u || m?.p?.[m.p.length - 1]?.u;
    const d = decodeRedditUrl(u);
    if (d) urls.push(d);
  }
  return urls;
}

function primaryImageUrlFromPostData(data) {
  if (!data) return null;
  if (data.is_gallery && data.gallery_data) {
    const urls = galleryImageUrls(data);
    return urls[0] || null;
  }
  const preview = data.preview?.images?.[0];
  if (preview?.source?.url) return decodeRedditUrl(preview.source.url);
  const thumb = data.thumbnail;
  if (thumb && !['self', 'default', 'nsfw', 'spoiler', ''].includes(thumb)) {
    return decodeRedditUrl(thumb);
  }
  return null;
}

function collectFirstNImageUrls(newsJson, n) {
  const urls = [];
  const keys = Object.keys(newsJson).filter((k) => !k.startsWith('_'));
  for (const key of keys) {
    if (urls.length >= n) break;
    const entry = newsJson[key];
    const u = primaryImageUrlFromPostData(entry?.data);
    if (u) urls.push(u);
  }
  return urls;
}
