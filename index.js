// NetWorld : la boîte à outils réseau, sans toucher au réseau. Calculateur de sous-réseaux IPv4 (masque, plage, diffusion, binaire)
// et découpage en sous-réseaux selon le nombre de machines (VLSM), IPv6 développée et compressée, décomposition d'une adresse web,
// et un aide-mémoire des ports et des codes HTTP, avec recherche.
const CSS = `
.nwTabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.nwTabs .btn,.nwRow .btn{width:auto;margin:0;padding:6px 12px}
.nwRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.nwRow .f{flex:1;min-width:0;margin:0}
.nwIn{font:16px monospace!important}
.nwOut{font:13px monospace;border-collapse:collapse;width:100%;margin-top:8px}
.nwOut td,.nwOut th{padding:4px 8px;border-bottom:1px solid #241c40;text-align:left;vertical-align:top}
.nwOut th{color:var(--lilac);font-weight:normal;white-space:nowrap;width:1%}
.nwOut td{color:#fff;word-break:break-all}
.nwBits{font:13px monospace;letter-spacing:1px;word-break:break-all}
.nwBits .n{color:#ff4fb0}.nwBits .h{color:#4fc3ff}
.nwErr{color:#ffd34f;font-size:13px;min-height:18px;margin-top:4px}
.nwBar{display:flex;height:26px;border:2px solid var(--line);margin-top:10px;background:#0b0816}
.nwBar i{display:block;height:100%;border-right:2px solid #000;font:10px monospace;color:#000;overflow:hidden;white-space:nowrap;padding:6px 3px 0}
.nwScroll{max-height:420px;overflow:auto}
.nwHint{font-size:12px;color:var(--lilac);line-height:1.5;margin-top:8px}
`;
// ---------- IPv4 ----------
const ip2n = s => { const p = s.trim().split('.'); if (p.length !== 4 || p.some(x => !/^[0-9]{1,3}$/.test(x) || +x > 255)) throw new Error('adresse IPv4 invalide'); return p.reduce((a, x) => a * 256 + +x, 0); };
const n2ip = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
const maskN = p => p === 0 ? 0 : (2 ** 32 - 2 ** (32 - p));
function parseCIDR(s) {
  const m = s.trim().match(/^([0-9.]+)\s*(?:\/\s*([0-9]{1,2})|\s+([0-9.]+))?$/); if (!m) throw new Error('écris par exemple 192.168.1.10/24');
  const ip = ip2n(m[1]); let p = m[2] !== undefined ? +m[2] : 24;
  if (m[3]) { const mk = ip2n(m[3]); p = 32 - Math.log2(2 ** 32 - mk); if (!Number.isInteger(p)) throw new Error('masque invalide (les 1 doivent être à gauche)'); }
  if (p > 32) throw new Error('le préfixe va de 0 à 32'); return {ip, p};
}
function subnet(ip, p) { const size = 2 ** (32 - p), net = Math.floor(ip / size) * size, bc = net + size - 1; return {net, bc, size, first: p >= 31 ? net : net + 1, last: p >= 31 ? bc : bc - 1, hosts: p === 32 ? 1 : p === 31 ? 2 : size - 2, mask: maskN(p), wild: 2 ** 32 - 1 - maskN(p)}; }
function ipClass(ip) { const a = Math.floor(ip / 2 ** 24), r = [];
  if (a === 10 || (a === 172 && Math.floor(ip / 2 ** 16) % 256 >= 16 && Math.floor(ip / 2 ** 16) % 256 < 32) || (a === 192 && Math.floor(ip / 2 ** 16) % 256 === 168)) r.push('privée (RFC 1918)');
  else if (a === 127) r.push('boucle locale'); else if (a === 169 && Math.floor(ip / 2 ** 16) % 256 === 254) r.push('lien local (APIPA)'); else if (a === 100 && Math.floor(ip / 2 ** 16) % 256 >= 64 && Math.floor(ip / 2 ** 16) % 256 < 128) r.push('partagée (CGNAT)');
  else if (a >= 224 && a < 240) r.push('multidiffusion'); else if (a >= 240) r.push('réservée'); else if (a === 0) r.push('« ce réseau »'); else r.push('publique');
  r.push('classe ' + (a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E')); return r.join(', '); }
// VLSM : les plus grands besoins d'abord, chacun dans le plus petit bloc qui le contient
function vlsm(base, p, needs) {
  const start = subnet(base, p).net, end = start + 2 ** (32 - p); let at = start; const out = [];
  for (const [name, n] of needs.map((x, i) => [x[0], x[1], i]).sort((a, b) => b[1] - a[1] || a[2] - b[2])) {
    let q = 32; while (q > 0 && (q >= 31 ? 0 : 2 ** (32 - q) - 2) < n) q--;  // /30 au plus petit : réseau et diffusion à part, comme d'habitude
    const size = 2 ** (32 - q); at = Math.ceil(at / size) * size; if (at + size > end) throw new Error('pas assez de place pour « ' + name + ' » (' + n + ' machines)');
    out.push({name, need: n, p: q, ...subnet(at, q)}); at += size;
  }
  return {out, used: at - start, total: end - start};
}
// ---------- IPv6 ----------
function v6expand(s) {
  let t = s.trim().toLowerCase().replace(/^\[|\]$/g, ''), pre = ''; const pm = t.match(/\/([0-9]{1,3})$/); if (pm) { pre = pm[1]; t = t.slice(0, pm.index); if (+pre > 128) throw new Error('le préfixe va de 0 à 128'); }
  const v4 = t.match(/(.*:)([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)$/); if (v4) { const n = ip2n(v4[2]); t = v4[1] + (Math.floor(n / 65536)).toString(16) + ':' + (n % 65536).toString(16); }
  const parts = t.split('::'); if (parts.length > 2) throw new Error('« :: » une seule fois');
  const a = parts[0] ? parts[0].split(':') : [], b = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  if ([...a, ...b].some(h => !/^[0-9a-f]{1,4}$/.test(h))) throw new Error('adresse IPv6 invalide');
  const fill = 8 - a.length - b.length; if ((parts.length === 1 && fill !== 0) || fill < (parts.length === 2 ? 1 : 0)) throw new Error('il faut 8 groupes');
  return {groups: [...a, ...Array(parts.length === 2 ? fill : 0).fill('0'), ...b].map(h => h.padStart(4, '0')), pre};
}
function v6compress(groups) { const g = groups.map(h => h.replace(/^0+(?=.)/, '')); let best = [-1, 0], cur = [-1, 0];
  g.forEach((h, i) => { if (h === '0') { if (cur[0] < 0) cur = [i, 0]; cur[1]++; if (cur[1] > best[1]) best = [...cur]; } else cur = [-1, 0]; });
  if (best[1] < 2) return g.join(':'); return g.slice(0, best[0]).join(':') + '::' + g.slice(best[0] + best[1]).join(':'); }
function v6kind(g) { const h = parseInt(g[0], 16); return g.every(x => x === '0000') ? 'non spécifiée' : g.slice(0, 7).every(x => x === '0000') && g[7] === '0001' ? 'boucle locale' : (h & 0xffc0) === 0xfe80 ? 'lien local' : (h & 0xfe00) === 0xfc00 ? 'locale unique (privée)' : (h & 0xff00) === 0xff00 ? 'multidiffusion' : g.slice(0, 5).every(x => x === '0000') && g[5] === 'ffff' ? 'IPv4 dans IPv6' : (h & 0xe000) === 0x2000 ? 'globale (publique)' : 'autre'; }
// ---------- les aide-mémoire ----------
const PORTS = [[20, 'TCP', 'FTP (données)'], [21, 'TCP', 'FTP (commandes)'], [22, 'TCP', 'SSH, SFTP'], [23, 'TCP', 'Telnet (non chiffré)'], [25, 'TCP', 'SMTP (envoi de courriel entre serveurs)'], [53, 'TCP/UDP', 'DNS'], [67, 'UDP', 'DHCP (serveur)'], [68, 'UDP', 'DHCP (client)'], [69, 'UDP', 'TFTP'], [80, 'TCP', 'HTTP'], [110, 'TCP', 'POP3'], [123, 'UDP', 'NTP (heure)'], [137, 'UDP', 'NetBIOS (noms)'], [143, 'TCP', 'IMAP'], [161, 'UDP', 'SNMP'], [389, 'TCP', 'LDAP'], [443, 'TCP/UDP', 'HTTPS (et HTTP/3 en UDP)'], [445, 'TCP', 'SMB (partage Windows)'], [465, 'TCP', 'SMTP chiffré'], [514, 'UDP', 'Syslog'], [587, 'TCP', 'SMTP (envoi depuis un logiciel de courriel)'], [636, 'TCP', 'LDAPS'], [853, 'TCP', 'DNS chiffré (DoT)'], [993, 'TCP', 'IMAP chiffré'], [995, 'TCP', 'POP3 chiffré'], [1194, 'UDP', 'OpenVPN'], [1433, 'TCP', 'SQL Server'], [1883, 'TCP', 'MQTT'], [3306, 'TCP', 'MySQL, MariaDB'], [3389, 'TCP', 'Bureau à distance (RDP)'], [5060, 'UDP', 'SIP (téléphonie)'], [5353, 'UDP', 'mDNS (Bonjour)'], [5432, 'TCP', 'PostgreSQL'], [5900, 'TCP', 'VNC'], [6379, 'TCP', 'Redis'], [8080, 'TCP', 'HTTP (autre port courant)'], [8443, 'TCP', 'HTTPS (autre port courant)'], [25565, 'TCP', 'Minecraft (serveur Java)'], [27017, 'TCP', 'MongoDB'], [51820, 'UDP', 'WireGuard']];
const HTTP = [[100, 'Continuer'], [101, 'Changement de protocole (WebSocket)'], [200, 'OK'], [201, 'Créé'], [202, 'Accepté, traité plus tard'], [204, 'Pas de contenu'], [206, 'Contenu partiel (morceau d\'un fichier)'], [301, 'Déplacé pour toujours'], [302, 'Trouvé ailleurs (temporaire)'], [304, 'Pas modifié (le cache est bon)'], [307, 'Redirection temporaire'], [308, 'Redirection permanente'],
  [400, 'Requête mal formée'], [401, 'Il faut s\'identifier'], [403, 'Interdit'], [404, 'Introuvable'], [405, 'Méthode non permise'], [408, 'Trop long à envoyer'], [409, 'Conflit'], [410, 'Parti pour de bon'], [413, 'Trop gros'], [415, 'Type de contenu refusé'], [418, 'Je suis une théière'], [422, 'Contenu impossible à traiter'], [429, 'Trop de requêtes'],
  [500, 'Erreur du serveur'], [501, 'Pas pris en charge'], [502, 'Mauvaise passerelle'], [503, 'Service indisponible'], [504, 'La passerelle a attendu trop longtemps'], [505, 'Version HTTP non prise en charge']];
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el } = ctx.host;
  ctx.host.addStyle(CSS);
  // vérification : un /26, un masque écrit en entier, un découpage VLSM, une IPv6 compressée
  { const a = parseCIDR('192.168.10.77/26'), s = subnet(a.ip, a.p), b = parseCIDR('10.0.0.1 255.255.240.0'), v = vlsm(ip2n('172.16.0.0'), 24, [['A', 100], ['B', 50], ['C', 2]]), x = v6expand('2001:db8::1:0:0:1/64');
    console.assert(n2ip(s.net) === '192.168.10.64' && n2ip(s.bc) === '192.168.10.127' && s.hosts === 62 && b.p === 20 && v.out.map(o => n2ip(o.net) + '/' + o.p).join() === '172.16.0.0/25,172.16.0.128/26,172.16.0.192/30' && v6compress(x.groups) === '2001:db8::1:0:0:1' && v6compress(v6expand('fe80:0:0:0:0:0:0:1').groups) === 'fe80::1' && subnet(ip2n('1.2.3.4'), 32).hosts === 1, 'networld : calculs'); }
  let data = null; try { data = await ctx.folder.read('networld'); } catch {}
  const st = {tab: data?.tab || 'v4', v4: data?.v4 || '192.168.1.42/24', split: data?.split || '10.0.0.0/22', needs: data?.needs || 'Bureaux 200\nWi-Fi invités 120\nServeurs 30\nImprimantes 12\nLiaison 2', v6: data?.v6 || '2001:db8:0:0:8:800:200c:417a/64', url: data?.url || 'https://utilisateur@exemple.fr:8443/dossier/page.html?q=pixel+art&tri=nouveau#haut', ref: ''};
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('networld', st).catch(() => {}), 400); };
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), tabs = el('div', 'nwTabs'), body = el('div', 'sysCard px');
  head.append(el('span', 'label', 'NetWorld · outils réseau')); wrap.append(head, tabs, body); view.append(wrap);
  const TABS = [['v4', 'Sous-réseau IPv4'], ['split', 'Découper un réseau'], ['v6', 'IPv6'], ['url', 'Adresse web'], ['ref', 'Ports et codes HTTP']];
  function drawTabs() { tabs.replaceChildren(...TABS.map(([k, t]) => { const b = el('button', 'btn px' + (st.tab === k ? ' main' : ''), t); b.dataset.tab = k; b.onclick = () => { st.tab = k; save(); drawTabs(); build(); }; return b; })); }
  const table = rows => { const t = el('table', 'nwOut'); for (const [k, v] of rows) { const tr = el('tr'), th = el('th', '', k), td = el('td'); td.translate = false; if (v instanceof Node) td.append(v); else td.textContent = v; tr.append(th, td); t.append(tr); } return t; };
  const input = (key, ph) => { const i = el('input', 'f nwIn'); i.value = st[key]; i.placeholder = ph; i.translate = false; i.spellcheck = false; i.id = 'nw_' + key; return i; };
  function bits(n, p) { const b = n.toString(2).padStart(32, '0'), d = el('span', 'nwBits'); for (let i = 0; i < 32; i++) { if (i && i % 8 === 0) d.append('.'); d.append(el('span', i < p ? 'n' : 'h', b[i])); } return d; }
  function build() {
    body.replaceChildren(); const out = el('div'), err = el('div', 'nwErr'); err.id = 'nw_err'; out.id = 'nw_out';
    if (st.tab === 'v4') {
      const i = input('v4', '192.168.1.42/24'), row = el('div', 'nwRow'); row.append(i); body.append(row, err, out);
      const run = () => { st.v4 = i.value; save(); try { const {ip, p} = parseCIDR(i.value), s = subnet(ip, p); err.textContent = '';
        out.replaceChildren(table([['Adresse', n2ip(ip)], ['Type', ipClass(ip)], ['Réseau', n2ip(s.net) + '/' + p], ['Masque', n2ip(s.mask) + ' (/' + p + ')'], ['Masque inverse', n2ip(s.wild)], ['Diffusion', n2ip(s.bc)], ['Machines', p >= 31 ? n2ip(s.first) + ' – ' + n2ip(s.last) : n2ip(s.first) + ' – ' + n2ip(s.last)], ['Nombre', s.hosts.toLocaleString('fr-FR') + ' / ' + s.size.toLocaleString('fr-FR')], ['Adresse en binaire', bits(ip, p)], ['Masque en binaire', bits(s.mask, p)], ['En hexadécimal', '0x' + ip.toString(16).padStart(8, '0').toUpperCase()]]),
          el('p', 'nwHint', 'En rose : la partie réseau (commune à toutes les machines du sous-réseau). En bleu : la partie machine.')); }
        catch (e) { err.textContent = e.message; out.replaceChildren(); } };
      i.oninput = run; run();
    } else if (st.tab === 'split') {
      const i = input('split', '10.0.0.0/22'), ta = el('textarea', 'f'), row = el('div', 'nwRow'); ta.rows = 6; ta.value = st.needs; ta.id = 'nw_needs'; ta.translate = false;
      row.append(i); body.append(row, el('p', 'nwHint', 'Un besoin par ligne : un nom puis le nombre de machines. Les plus grands sont placés d\'abord, chacun dans le plus petit bloc qui suffit.'), ta, err, out);
      const run = () => { st.split = i.value; st.needs = ta.value; save(); try { const {ip, p} = parseCIDR(i.value), needs = ta.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)\s*([0-9]+)$/); if (!m) throw new Error('ligne sans nombre : « ' + l + ' »'); return [m[1] || 'réseau', +m[2]]; });
          const r = vlsm(ip, p, needs), t = el('table', 'nwOut'), hr = el('tr'); ['Nom', 'Besoin', 'Réseau', 'Machines', 'Diffusion', 'Libres'].forEach(h => hr.append(el('th', '', h))); t.append(hr);
          const bar = el('div', 'nwBar'), cols = ['#ff4fb0', '#4fc3ff', '#ffd34f', '#9ae06a', '#c8b8f0', '#ffa04f'];
          r.out.forEach((o, k) => { const tr = el('tr'); [o.name, o.need, n2ip(o.net) + '/' + o.p, n2ip(o.first) + ' – ' + n2ip(o.last), n2ip(o.bc), o.hosts - o.need].forEach(v => { const td = el('td', '', String(v)); td.translate = false; tr.append(td); }); t.append(tr);
            const seg = el('i', '', o.name); seg.style.width = o.size / r.total * 100 + '%'; seg.style.background = cols[k % cols.length]; seg.title = o.name + ' : ' + n2ip(o.net) + '/' + o.p; seg.translate = false; bar.append(seg); });
          err.textContent = ''; const used = el('p', 'nwHint'); used.append(el('span', '', 'Utilisé :'), ' ' + r.used + ' / ' + r.total + ' ', el('span', '', 'adresses'), ' (' + Math.round(r.used / r.total * 100) + ' %)'); out.replaceChildren(t, bar, used); }
        catch (e) { err.textContent = e.message; out.replaceChildren(); } };
      i.oninput = ta.oninput = run; run();
    } else if (st.tab === 'v6') {
      const i = input('v6', '2001:db8::1/64'), row = el('div', 'nwRow'); row.append(i); body.append(row, err, out);
      const run = () => { st.v6 = i.value; save(); try { const {groups, pre} = v6expand(i.value), rows = [['Développée', groups.join(':')], ['Compressée', v6compress(groups) + (pre ? '/' + pre : '')], ['Type', v6kind(groups)]];
          if (pre) { const p = +pre, net = groups.join('').split('').map((h, k) => { const bitsLeft = p - k * 4; return bitsLeft >= 4 ? h : bitsLeft <= 0 ? '0' : (parseInt(h, 16) & (0xf << (4 - bitsLeft)) & 0xf).toString(16); }).join('').match(/.{4}/g);
            rows.push(['Réseau', v6compress(net) + '/' + p], ['Adresses', p >= 128 ? '1' : '2^' + (128 - p) + (128 - p <= 64 ? ' = ' + (2n ** BigInt(128 - p)).toLocaleString('fr-FR') : '')]); }
          rows.push(['Nom inverse (DNS)', groups.join('').split('').reverse().join('.') + '.ip6.arpa']); err.textContent = ''; out.replaceChildren(table(rows)); }
        catch (e) { err.textContent = e.message; out.replaceChildren(); } };
      i.oninput = run; run();
    } else if (st.tab === 'url') {
      const i = input('url', 'https://exemple.fr/page?x=1'), row = el('div', 'nwRow'); row.append(i); body.append(row, err, out);
      const run = () => { st.url = i.value; save(); try { const u = new URL(i.value.trim()), rows = [['Protocole', u.protocol.slice(0, -1)], ['Utilisateur', u.username || '—'], ['Hôte', u.hostname], ['Port', u.port || '(' + ({'http:': 80, 'https:': 443, 'ftp:': 21, 'ws:': 80, 'wss:': 443}[u.protocol] ?? '—') + ')'], ['Chemin', decodeURIComponent(u.pathname)], ['Ancre', u.hash ? decodeURIComponent(u.hash.slice(1)) : '—']];
          if (/xn--/.test(u.hostname)) rows.splice(3, 0, ['Hôte (punycode)', u.hostname]);
          const params = [...u.searchParams]; if (params.length) { const t = el('table', 'nwOut'); params.forEach(([k, v]) => { const tr = el('tr'), a = el('th', '', k), b = el('td', '', v); a.translate = b.translate = false; tr.append(a, b); t.append(tr); }); rows.push(['Paramètres', t]); }
          rows.push(['Origine', u.origin], ['Encodée', u.href]); err.textContent = ''; out.replaceChildren(table(rows)); }
        catch { err.textContent = 'adresse web invalide (il faut le protocole, par exemple https://)'; out.replaceChildren(); } };
      i.oninput = run; run();
    } else {
      const i = input('ref', 'Chercher : 443, ssh, 404…'), row = el('div', 'nwRow'), box = el('div', 'nwScroll'); row.append(i); body.append(row, box);
      const run = () => { const q = i.value.trim().toLowerCase(), ok = (...a) => !q || a.some(x => String(x).toLowerCase().includes(q));
        const t1 = el('table', 'nwOut'), t2 = el('table', 'nwOut'); t1.append(el('tr')); t1.firstChild.append(el('th', '', 'Port'), el('th', '', 'Protocole'), el('th', '', 'Usage'));
        PORTS.filter(p => ok(...p)).forEach(([n, pr, u]) => { const tr = el('tr'); tr.append(el('td', '', String(n)), el('td', '', pr), el('td', '', u)); t1.append(tr); });
        t2.append(el('tr')); t2.firstChild.append(el('th', '', 'Code'), el('th', '', 'Sens'));
        HTTP.filter(h => ok(...h)).forEach(([c, s]) => { const tr = el('tr'), td = el('td', '', String(c)); td.style.color = c < 300 ? '#6ae06a' : c < 400 ? '#4fc3ff' : c < 500 ? '#ffd34f' : '#ff4fb0'; tr.append(td, el('td', '', s)); t2.append(tr); });
        box.replaceChildren(el('span', 'label', 'Ports'), t1, el('span', 'label', 'Codes HTTP'), t2); };
      i.oninput = run; run();
    }
  }
  drawTabs(); build();
}
