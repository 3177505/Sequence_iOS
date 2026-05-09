(function () {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  try {
    const es = new EventSource('/__livereload');
    es.addEventListener('message', () => location.reload());
    es.onerror = () => es.close();
  } catch (_) {}
})();
