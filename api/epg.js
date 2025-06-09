const https = require('https');
const { parseStringPromise } = require('xml2js');

let cache = { time: 0, xml: null };

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
          r.on('end', () => parseStringPromise(xml).then(resolve).catch(reject));
        }).on('error', reject);
      });
      cache.xml = data;
      cache.time = Date.now();
    }

    const progs = (cache.xml.tv.programme || []).filter(p => p.$.channel === id)
      .map(p => ({
        title: p.title[0]._ || p.title[0],
        start: new Date(p.$.start.slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00')),
        stop:  new Date(p.$.stop.slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00'))
      }))
      .filter(p => p.stop > now)
      .sort((a,b) => a.start - b.start);

    const nowProg = progs[0];
    const nextProg = progs[1];

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json({
      now: nowProg?.start <= now ? nowProg : null,
      next: nextProg || null
    });
  } catch (e) {
    res.status(500).json({ error: 'EPG load failed', details: e.message });
  }
};
