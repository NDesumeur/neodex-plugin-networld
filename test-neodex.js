// lancé par le test « local » de NeoDex : un /26, un découpage VLSM, une IPv6, une adresse web, la recherche d'un port
module.exports = async ({ pj, sleep }) => {
  const out = () => pj(`document.getElementById('nw_out')?.textContent || ''`);
  const set = (id, v) => pj(`(() => { const i = document.getElementById(${JSON.stringify(id)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); })(), 0`);
  const tab = k => pj(`document.querySelector('[data-tab=${k}]').click(), 0`);
  await sleep(400);
  await tab('v4'); await set('nw_v4', '192.168.10.77/26');
  if (!/192\.168\.10\.64\/26/.test(await out()) || !/192\.168\.10\.127/.test(await out()) || !/62 \/ 64/.test(await out())) throw new Error('IPv4 : ' + await out());
  await set('nw_v4', '300.1.1.1/24'); if (!/invalide/.test(await pj(`document.getElementById('nw_err').textContent`))) throw new Error('erreur IPv4 non signalée');
  await tab('split'); await set('nw_split', '10.0.0.0/22');
  if (!/10\.0\.0\.0\/24/.test(await out()) || !/10\.0\.1\.176\/30/.test(await out())) throw new Error('VLSM : ' + await out());
  await tab('v6'); await set('nw_v6', '2001:0db8:0000:0000:0000:ff00:0042:8329/48');
  if (!/2001:db8::ff00:42:8329/.test(await out()) || !/2001:db8::\/48/.test(await out())) throw new Error('IPv6 : ' + await out());
  await tab('url'); await set('nw_url', 'https://exemple.fr:8443/a/b?x=1&y=deux#fin');
  if (!/8443/.test(await out()) || !/deux/.test(await out())) throw new Error('URL : ' + await out());
  await tab('ref'); await set('nw_ref', 'ssh');
  if (await pj(`document.querySelectorAll('.nwOut')[0].rows.length`) !== 2) throw new Error('recherche de port');
  await tab('v4'); await set('nw_v4', '192.168.1.42/24'); await sleep(100);
  return 'IPv4, VLSM, IPv6, URL et ports ok';
};
