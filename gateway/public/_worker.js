export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('mowu blog API gateway', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    // Fixed internal service binding: no user-selected upstream, no new database.
    return env.BLOG_API.fetch(request);
  },
};
