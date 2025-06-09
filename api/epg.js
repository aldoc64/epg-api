const https = require('https');
const { XMLParser } = require('fast-xml-parser');

let cache = { time: 0, xml: null };
const parser = new XMLParser({ ignoreAttributes: false });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const now = new Date();
  const url = 'https://iptv-org.github.io/epg/guides/en.xml';

  try {
    if (!cache.xml || Date.now() - cache.time > 5 * 60 * 1000) {
      const data = await new Promise((resolve, reject) => {
        https.get(url, r => {
          let xml = '';
          r.on('data', chunk => xml += chunk);
          r.on('end', () => resolve(xml));
        }).on('error', reject);
      });

      const parsed = parser.parse(data);
      if (!parsed || !parsed.tv || !parsed.tv.programme) {
        throw new Error("XML parsed but missing 'tv.programme' node");
      }

      cache.xml = parsed;
      cache.time = Date.now();
    }

    const progs = Array.isArray(cache.xml.tv.programme) ? cache.xml.tv.programme : [cache.xml.tv.programme];

    const matches = progs.filter(p => p['@_channel'] === id)
      .map(p => ({
        title: typeof p.title === 'string' ? p.title : (p.title['#text'] || 'Untitled'),
        start: new Date(p['@_start'].slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00')),
        stop:  new Date(p['@_stop'].slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00'))
      }))
      .filter(p => p.stop > now)
      .sort((a, b) => a.start - b.start);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json({
      now: matches[0]?.start <= now ? matches[0] : null,
      next: matches[1] || null
    });

  } catch (e) {
    res.status(500).json({ error: 'EPG load failed', details: e.message });
  }
};
