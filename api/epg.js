const https = require('https');
const { parseStringPromise } = require('xml2js');

let cache = {
  time: 0,
  xml: null
};

module.exports = async (req, res) => {
  const id = req.query.id;
  if (!id) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Missing id' });
  }

  const now = new Date();
  const url = 'https://iptv-org.github.io/epg/guides/en.xml';

  async function loadXML() {
    return new Promise((resolve, reject) => {
      https.get(url, r => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => parseStringPromise(data).then(resolve).catch(reject));
      }).on('error', reject);
    });
  }

  try {
    if (!cache.xml || Date.now() - cache.time > 5 * 60 * 1000) {
      cache.xml = await loadXML();
      cache.time = Date.now();
    }

    const progs = (cache.xml.tv.programme || []).filter(p => p.$.channel === id)
      .map(p => ({
        title: p.title[0]._,
        start: new Date(p.$.start.slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00')),
        stop:  new Date(p.$.stop.slice(0,14).replace(/(.{4})(.{2})(.{2})(.{2})(.{2})/, '$1-$2-$3T$4:$5:00'))
      }))
      .filter(p => p.stop > now)
      .sort((a,b) => a.start - b.start);

    const current = progs[0], next = progs[1];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({
      now: current?.start <= now ? current : null,
      next: next || null
    });
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'EPG load failed', details: e.message });
  }
};
