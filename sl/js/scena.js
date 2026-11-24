'use strict';
/* Palco dichiarativo. Ogni fotogramma è un elenco di elementi con un identificativo stabile:
   gli elementi che restano fra un passo e l'altro cambiano posizione e stato con una transizione. */
SL.scena = (ospite, misura) => {
  const W = misura.w, H = misura.h, E = SL.E;
  ospite.classList.add('scalato');
  ospite.innerHTML = '<div class="piano-fisso palco" style="width:' + W + 'px;height:' + H + 'px"><svg class="linee" width="' + W + '" height="' + H + '" aria-hidden="true"></svg></div>';
  const palco = ospite.firstElementChild, svg = palco.firstElementChild;
  const nodi = new Map(), linee = new Map();
  ospite.insertAdjacentHTML('afterend', '<p class="nota avviso-scorri">La scena è più larga dello schermo: può essere scorsa in orizzontale, oppure visualizzata con il dispositivo ruotato.</p>');
  // Il disegno è nascosto ai lettori di schermo, che ricevono la descrizione testuale costruita a ogni passo.
  // La medesima descrizione diventa visibile con la preferenza «Scene degli esperimenti: testuali».
  palco.setAttribute('aria-hidden', 'true');
  ospite.classList.add('con-testo');
  const testo = document.createElement('div');
  testo.className = 'scena-testo';
  ospite.nextElementSibling.insertAdjacentElement('afterend', testo);
  const ferma = SL.scala(ospite, W, H, 0.62);

  const corpo = (e) => {
    switch (e.t) {
      case 'box': {
        const testi = (e.et != null ? '<span class="et">' + E(e.et) + '</span>' : '') + (e.txt != null ? '<span class="va">' + E(e.txt) + '</span>' : '');
        return (e.sim ? SL.sim(e.sim, e.simL || 34) : '') + (e.riga ? '<div>' + testi + '</div>' : testi);
      }
      case 'cella': return (e.so != null ? '<span class="so">' + E(e.so) + '</span>' : '') + E(e.txt == null ? '' : e.txt) + (e.gi != null ? '<span class="gi">' + E(e.gi) + '</span>' : '');
      case 'pacco': case 'nota': return E(e.txt == null ? '' : e.txt);
      case 'sim': return SL.sim(e.sim, 64);
      case 'zona': return e.et != null ? '<span class="et">' + E(e.et) + '</span>' : '';
      default: return '';
    }
  };
  const px = (v) => (v == null ? '' : v + 'px');

  function mostra(els) {
    const visti = new Set();
    for (const e of els) {
      if (!e) continue;
      visti.add(e.id);
      if (e.t === 'testo') continue;
      if (e.t === 'linea') {
        let l = linee.get(e.id);
        if (!l) { l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(l); linee.set(e.id, l); }
        l.setAttribute('x1', e.x1); l.setAttribute('y1', e.y1); l.setAttribute('x2', e.x2); l.setAttribute('y2', e.y2);
        l.setAttribute('class', (e.st ? 'st-' + e.st : '') + (e.tratto ? ' tratto' : ''));
        continue;
      }
      let n = nodi.get(e.id), nuovo = false;
      if (!n) { n = document.createElement('div'); nuovo = true; nodi.set(e.id, n); }
      const classe = 'el el-' + e.t + (e.st ? ' st-' + e.st : '') + (e.cls ? ' ' + e.cls : '') + (e.riga ? ' riga' : '') + (e.piccola ? ' piccola' : '');
      n.className = classe + (nuovo ? ' entra' : '');
      n.style.left = px(e.x); n.style.top = px(e.y); n.style.width = px(e.w); n.style.height = px(e.h);
      n.style.zIndex = e.z == null ? '' : e.z;
      if (e.t === 'barra') {
        if (nuovo) n.innerHTML = '<i></i>';
        n.firstElementChild.style.width = Math.max(0, Math.min(100, Math.round((e.v || 0) * 100))) + '%';
      } else {
        const firma = corpo(e);
        if (n._firma !== firma) { n.innerHTML = firma; n._firma = firma; }
      }
      if (nuovo) { palco.appendChild(n); requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('entra'))); }
    }
    const descr = SL.descrivi(els);
    if (testo._firma !== descr) { testo.innerHTML = descr; testo._firma = descr; }
    for (const [id, n] of nodi) if (!visti.has(id)) { nodi.delete(id); n.classList.add('entra'); setTimeout(() => n.remove(), 360); }
    for (const [id, l] of linee) if (!visti.has(id)) { linee.delete(id); l.remove(); }
    // Sugli schermi stretti la scena scorre: a ogni passo si porta in vista l'elemento su cui cade l'attenzione.
    if (ospite.classList.contains('scorre')) {
      const a = els.find((e) => e && e.t !== 'linea' && e.t !== 'zona' && e.st === 'att' && e.x != null) || els.find((e) => e && e.t === 'pacco');
      if (a) { const k = palco.getBoundingClientRect().width / W; ospite.scrollTo({ left: Math.max(0, (a.x + (a.w || 60) / 2) * k - ospite.clientWidth / 2), behavior: 'smooth' }); }
    }
  }
  return { mostra, smonta: () => { ferma(); testo.remove(); } };
};

/* Descrizione testuale di un fotogramma. Le celle allineate formano righe: ogni riga riceve l'etichetta
   posta alla sua sinistra, e ogni cella l'intestazione di colonna posta sopra la griglia. Gli altri elementi
   seguono l'ordine di lettura, dall'alto verso il basso e da sinistra a destra; le zone raccolgono gli
   elementi che contengono. Gli stati sono espressi a parole, poiché il colore non basta. */
SL.descrivi = (els) => {
  // Un elemento con «desc: false» è soltanto grafico: la sua informazione è data da una frase «testo» della scena.
  els = (els || []).filter((e) => e && e.desc !== false);
  const E = SL.E || ((s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';')), STATI = { att: 'in evidenza', err: 'segnalato', off: 'attenuato' };
  const TINTE = { rosso: 'rosso', giallo: 'giallo', verde: 'verde', blu: 'blu', nero: 'nero', bianco: 'bianco' };
  const pulito = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/^[·\s]+$/, '');
  const testoDi = (e) => {
    let t = '';
    if (e.t === 'box') t = [pulito(e.et), pulito(e.txt)].filter(Boolean).join(': ');
    else if (e.t === 'cella') {
      const ti = /tinta-(\w+)/.exec(e.cls || ''), v = pulito(e.txt) || (ti && TINTE[ti[1]]) || '', so = pulito(e.so), gi = pulito(e.gi);
      t = (so && v ? so + ': ' : so) + v + (gi ? (v || so ? ' (' + gi + ')' : gi) : '');
    }
    else if (e.t === 'nota' || e.t === 'pacco' || e.t === 'testo') t = pulito(e.txt);
    else if (e.t === 'barra') t = 'riempimento ' + Math.round(Math.max(0, Math.min(1, e.v || 0)) * 100) + ' %';
    else if (e.t === 'zona') t = pulito(e.et);
    return t;
  };
  const stato = (e) => (e.st && STATI[e.st] ? ' (' + STATI[e.st] + ')' : '');
  // Misure: le note non dichiarano larghezza e altezza, che sono stimate dalla lunghezza del testo.
  const geo = (e) => { const w = e.w != null ? e.w : Math.max(8, testoDi(e).length * 8), h = e.h != null ? e.h : 18; return { x: e.x || 0, y: e.y || 0, w, h, cx: (e.x || 0) + w / 2, cy: (e.y || 0) + h / 2 }; };
  const frasi = (els || []).filter((e) => e && e.t === 'testo' && testoDi(e)).map((e) => '<p>' + E(testoDi(e)) + '</p>').join('');
  const tutti = (els || []).filter((e) => e && e.t !== 'linea' && e.t !== 'cursore' && e.t !== 'sim' && e.t !== 'testo' && testoDi(e));
  const usati = new Set();
  const maiuscola0 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const voci = [];
  // Titolo di sezione: nota tutta in maiuscolo con almeno una parola di quattro lettere, perché le sigle brevi
  // (RAX, ALU, ZF) sono nomi di oggetti e non titoli.
  // Il titolo può avere un sottotitolo dopo « · » («PRONTI · in coda»): conta il primo segmento.
  // Le parole con cifre («p6», «x2») sono nomi propri del disegno, e non contano.
  const maiuscola = (e) => { const s = testoDi(e).split(' · ')[0].split(/\s+/).filter((w) => !/\d/.test(w)).join(' '); return e.t === 'nota' && /\p{Lu}{4}/u.test(s) && s === s.toUpperCase(); };
  // Assi numerati: almeno tre note numeriche sulla medesima fascia, con l'eventuale nome a sinistra (CICLO, ITERAZIONE).
  // L'asse diventa una sola voce, e ogni cella sottostante riceve il valore della tacca più vicina.
  const fasce = [];
  tutti.filter((e) => e.t === 'nota').forEach((e) => { const g = geo(e), f = fasce.find((x) => Math.abs(x.cy - g.cy) < 6); if (f) f.l.push(e); else fasce.push({ cy: g.cy, l: [e] }); });
  const assi = [];
  fasce.forEach((f) => {
    const num = f.l.filter((e) => /^-?\d+$/.test(testoDi(e))).sort((a, b) => geo(a).x - geo(b).x);
    if (num.length < 3) return;
    const x0 = geo(num[0]).x, pre = f.l.filter((e) => num.indexOf(e) < 0 && geo(e).x < x0).sort((a, b) => geo(b).x - geo(a).x)[0];
    const tacche = num.map((e) => ({ v: testoDi(e), cx: geo(e).cx })), passo = (tacche[tacche.length - 1].cx - tacche[0].cx) / (tacche.length - 1) || 40;
    num.forEach((e) => usati.add(e)); if (pre) usati.add(pre);
    const vv = tacche.map((x) => Number(x.v)), d = vv[1] - vv[0], regolare = vv.every((v, k) => !k || v - vv[k - 1] === d);
    const nome = pre ? testoDi(pre) : '';
    // Retta dei minimi quadrati fra posizione e valore delle tacche, per leggere sull'asse l'estensione delle barre.
    // Il centro di una tacca è stimato con 7 px per cifra, la larghezza del carattere monospaziato delle scale.
    const px = num.map((e) => geo(e).x + testoDi(e).length * 3.5);
    const n = px.length, sx = px.reduce((t, x) => t + x, 0), sy = vv.reduce((t, v) => t + v, 0), sxx = px.reduce((t, x) => t + x * x, 0), sxy = px.reduce((t, x, k) => t + x * vv[k], 0);
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), q = (sy - m * sx) / n, ris = Math.abs(d) <= 100 ? (d % 5 === 0 ? 5 : 1) : Math.abs(d) / 100;
    // Su scale ampie la lettura è approssimata alla centesima parte del passo, e lo dichiara; la lettura «fine»
    // di un istante, per le celle puntiformi, usa l'unità.
    assi.push({ cy: f.cy, tacche, passo, nome: nome.toLowerCase(), leggi: regolare ? (x, fine) => { const r0 = fine && Math.abs(d) <= 100 ? 1 : ris, v = Math.round((q + m * x) / r0) * r0; return (Math.abs(d) > 100 && v !== vv[0] ? 'circa ' : '') + SL.num(v); } : null });
    voci.push({ x: pre ? geo(pre).x : x0, y: f.cy, html: E((nome ? nome + ': ' : 'scala ') + (regolare ? 'da ' + vv[0] + ' a ' + vv[vv.length - 1] + (d !== 1 ? ', ogni ' + d : '') : tacche.map((x) => x.v).join(', '))) });
  });
  const tacca = (g) => {
    const a = assi.filter((x) => x.cy < g.cy).sort((p, q) => q.cy - p.cy)[0];
    if (!a) return '';
    const k = a.tacche.find((x) => Math.abs(x.cx - g.cx) <= a.passo / 2);
    return k ? (a.nome ? a.nome + ' ' : '') + k.v : '';
  };
  // Etichetta di riga: l'elemento testuale più vicino a sinistra, sulla medesima fascia. Un riquadro largo vale
  // come etichetta soltanto se è accostato alla prima cella e ha la medesima altezza e la medesima fascia.
  const etichetta = (r, x0) => {
    const accostato = (g) => x0 - (g.x + g.w) <= 60 && Math.abs(g.cy - r.cy) <= 4 && Math.abs(g.h - r.h) <= 6;
    // Una nota in maiuscolo («RAID 0») vale come etichetta soltanto se è vicina alla prima cella.
    const eti = tutti.filter((e) => !usati.has(e) && e.t !== 'cella' && e.t !== 'zona' && (() => { const g = geo(e); return (!maiuscola(e) || x0 - (g.x + g.w) <= 80) && (e.t === 'nota' || (g.w <= 140 && x0 - (g.x + g.w) <= 160) || accostato(g)) && Math.abs(g.cy - r.cy) < Math.max(12, r.h / 2 + 4) && g.x < x0; })()).sort((a, b) => geo(b).x - geo(a).x)[0];
    if (eti) usati.add(eti);
    return eti;
  };
  const sotto = (e, c) => { const g = geo(e); return g.cx >= c.g.x - 2 && g.cx <= c.g.x + c.g.w + 2; };
  const inFila = (l) => { const f = []; l.forEach((c) => { const r = f.find((x) => Math.abs(x.cy - c.g.cy) < Math.max(8, c.g.h / 2)); if (r) r.celle.push(c); else f.push({ cy: c.g.cy, h: c.g.h, celle: [c] }); }); f.forEach((r) => r.celle.sort((p, q) => p.g.x - q.g.x)); return f.sort((p, q) => p.cy - q.cy); };
  // Una fila con un ampio intervallo fra due celle consecutive (oltre 60 px, oltre una volta e mezza la larghezza
  // mediana e oltre il doppio dell'intervallo mediano) contiene due disegni affiancati, e diventa due righe; sotto un asse numerico gli intervalli sono posizioni.
  const dividi = (f) => {
    const out = [];
    f.forEach((r) => {
      const larghe = r.celle.map((c) => c.g.w).sort((p, q) => p - q), med = larghe[Math.floor(larghe.length / 2)];
      const vuoti = r.celle.slice(1).map((c, i) => c.g.x - (r.celle[i].g.x + r.celle[i].g.w)).sort((p, q) => p - q), medV = vuoti.length ? vuoti[Math.floor(vuoti.length / 2)] : 0;
      if (r.celle.some((c) => tacca(c.g))) { out.push(r); return; }
      let cur = { cy: r.cy, h: r.h, celle: [r.celle[0]] };
      for (let i = 1; i < r.celle.length; i++) {
        const a = r.celle[i - 1].g, b = r.celle[i].g;
        // Ciascuna parte deve contenere almeno due celle: celle isolate e distanti restano nella fila (riporti, segni).
        // Due celle in zone diverse appartengono a disegni diversi; così pure due sole celle molto distanti.
        const zonaDi = (g) => (els || []).filter((z) => z && z.t === 'zona' && g.cx >= z.x && g.cx <= z.x + z.w && g.cy >= z.y && g.cy <= z.y + z.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
        const confine = zonaDi(a) !== zonaDi(b) || (r.celle.length === 2 && b.x - (a.x + a.w) > Math.max(200, 4 * med));
        if (confine || (b.x - (a.x + a.w) > Math.max(60, 1.5 * med, 2 * medV) && cur.celle.length >= 2 && r.celle.length - i >= 2)) { out.push(cur); cur = { cy: r.cy, h: r.h, celle: [] }; }
        cur.celle.push(r.celle[i]);
      }
      out.push(cur);
    });
    return out.sort((p, q) => p.cy - q.cy || p.celle[0].g.x - q.celle[0].g.x);
  };
  // Tabelle: una fila di note sopra una fila di celle, o di riquadri privi di etichetta, con una nota per ciascun
  // elemento, fa da intestazione di colonna; le file contigue sottostanti, allineate alle note, sono le righe.
  // Con intestazioni in minuscolo occorrono almeno due righe, perché una sola fila somiglia a una didascalia.
  const inTabella = new Set(), tabelle = [];
  // Una fila che contiene celle esclude i riquadri, che vi fanno da etichetta; una fila di soli riquadri vale come fila di celle.
  const elementi = dividi(inFila((els || []).filter((e) => e && !usati.has(e) && (e.t === 'cella' || (e.t === 'box' && !pulito(e.et) && testoDi(e)))).map((e) => ({ e, g: geo(e) }))));
  elementi.forEach((r) => { if (r.celle.some((c) => c.e.t === 'cella')) r.celle = r.celle.filter((c) => c.e.t === 'cella'); });
  elementi.forEach((r, k) => {
    if (r.preso || r.celle.length < 2 || !r.celle.some((c) => testoDi(c.e))) return;
    const alto = r.cy - r.h / 2;
    const fascia0 = tutti.filter((e) => e.t === 'nota' && !usati.has(e) && (() => { const g = geo(e); return g.cy < alto && g.cy > alto - 44; })());
    let capi = fascia0.filter((e) => r.celle.some((c) => sotto(e, c))).sort((p, q) => geo(p).x - geo(q).x), dalSo = false;
    // In alternativa, le etichette interne delle celle della prima riga («A», «B», «Y» di una tabella di verità),
    // se la riga seguente, allineata, ne è priva.
    // Le file affiancate (medesima fascia) o senza sovrapposizione orizzontale non fanno parte della colonna.
    const xa = r.celle[0].g.x, xb = r.celle[r.celle.length - 1].g.x + r.celle[r.celle.length - 1].g.w;
    const estranea = (q, u) => Math.abs(q.cy - u.cy) < 2 || q.celle[q.celle.length - 1].g.x + q.celle[q.celle.length - 1].g.w < xa || q.celle[0].g.x > xb;
    const q1 = elementi.slice(k + 1).find((q) => !estranea(q, r));
    if (capi.length !== r.celle.length && r.celle.every((c) => pulito(c.e.so)) && new Set(r.celle.map((c) => pulito(c.e.so))).size === r.celle.length && q1 && !q1.preso && q1.celle.length === r.celle.length && q1.celle.every((c, i) => !pulito(c.e.so) && Math.abs(c.g.cx - r.celle[i].g.cx) <= 4)) {
      capi = r.celle.map((c) => ({ t: 'nota', txt: pulito(c.e.so), x: c.g.x, y: c.g.y - 20, w: c.g.w, h: 18 })); dalSo = true;
    }
    if (capi.length !== r.celle.length || !r.celle.every((c, i) => sotto(capi[i], c) && capi.filter((e) => sotto(e, c)).length === 1)) return;
    const membri = [r];
    for (let j = k + 1; j < elementi.length; j++) {
      const q = elementi[j], u = membri[membri.length - 1];
      if (estranea(q, u)) continue;
      if (q.preso || q.cy - q.h / 2 - (u.cy + u.h / 2) > Math.max(24, u.h)) break;
      if (q.celle.length !== capi.length || !q.celle.every((c, i) => sotto(capi[i], c))) break;
      membri.push(q);
    }
    if (!capi.every(maiuscola) && membri.length < 2) return;
    capi.forEach((e) => usati.add(e));
    membri.forEach((m) => { m.preso = true; m.celle.forEach((c) => { usati.add(c.e); inTabella.add(c.e); }); });
    membri.forEach((m) => { m.eti = etichetta(m, m.celle[0].g.x); });
    // Etichette di riga sporadiche sono coincidenze di allineamento: la colonna delle etichette richiede almeno metà delle righe.
    if (membri.filter((m) => m.eti).length * 2 < membri.length) membri.forEach((m) => { if (m.eti) { usati.delete(m.eti); m.eti = null; } });
    const angolo = fascia0.filter((e) => !usati.has(e) && geo(e).x < geo(capi[0]).x && Math.abs(geo(e).cy - geo(capi[0]).cy) < 6)[0];
    if (angolo) usati.add(angolo);
    // Colonne di note: un'altra nota della fila di intestazione, sopra note allineate nelle righe, aggiunge una colonna.
    const extra = [];
    fascia0.filter((h) => !usati.has(h) && geo(h).x > geo(capi[capi.length - 1]).x).sort((p, q) => geo(p).x - geo(q).x).forEach((h) => {
      const hx = geo(h).x;
      const col = membri.map((m) => tutti.filter((e) => e.t === 'nota' && !usati.has(e) && Math.abs(geo(e).x - hx) <= 6 && Math.abs(geo(e).cy - m.cy) < Math.max(12, m.h / 2 + 4))[0] || null);
      if (col.filter(Boolean).length * 2 < membri.length) return;
      usati.add(h); col.forEach((e) => { if (e) usati.add(e); });
      extra.push({ h, col });
    });
    tabelle.push({ capi, membri, angolo, extra, dalSo });
  });
  // Righe di celle. Le celle prive di testo entrano nella riga quando questa contiene almeno una cella con testo.
  const NOMI = { att: ['in evidenza', 'in evidenza'], err: ['segnalata', 'segnalate'], off: ['attenuata', 'attenuate'], on: ['attiva', 'attive'], zero: ['spenta', 'spente'] };
  const conteggio = (l) => { const conta = {}; l.forEach((c) => { const k = NOMI[c.e.st] ? c.e.st : ''; conta[k] = (conta[k] || 0) + 1; }); return ['att', 'err', 'on', 'off', 'zero'].filter((k) => conta[k]).map((k) => conta[k] + ' ' + NOMI[k][conta[k] === 1 ? 0 : 1]); };
  const righe = dividi(inFila((els || []).filter((e) => e && e.t === 'cella' && !usati.has(e)).map((e) => ({ e, g: geo(e) }))));
  righe.forEach((r) => { r.griglia = r.celle.some((c) => testoDi(c.e)) && (r.celle.length >= 2 || r.celle.some((c) => tacca(c.g))); });
  righe.filter((r) => r.griglia).forEach((r) => {
    r.celle.forEach((c) => usati.add(c.e));
    r.eti = etichetta(r, r.celle[0].g.x); r.x = r.eti ? geo(r.eti).x : r.celle[0].g.x;
  });
  // Intestazioni di colonna: note in una fascia di 44 px sopra la riga più alta di ciascun blocco di righe.
  const griglia = righe.filter((r) => r.griglia);
  const intest = [];
  if (griglia.length) {
    const alto = Math.min.apply(null, griglia.map((r) => r.cy - r.h / 2));
    const fascia0 = tutti.filter((e) => e.t === 'nota' && !usati.has(e) && (() => { const g = geo(e); return g.cy < alto && g.cy > alto - 44; })());
    const cand = fascia0.filter((e) => !usati.has(e) && !maiuscola(e));
    const colonne = cand.filter((e) => griglia.some((r) => r.celle.some((c) => sotto(e, c))));
    if (colonne.length >= 2) {
      colonne.forEach((e) => { usati.add(e); intest.push({ e, g: geo(e) }); });
      const fascia = intest.map((i) => i.g.cy).sort((p, q) => p - q)[Math.floor(intest.length / 2)];
      const prefisso = cand.filter((e) => !usati.has(e) && geo(e).x < Math.min.apply(null, intest.map((i) => i.g.x))).sort((a, b) => geo(b).x - geo(a).x)[0];
      if (prefisso) { usati.add(prefisso); intest.prefisso = testoDi(prefisso).toLowerCase(); }
      // Le altre note della fila di intestazione indicano colonne vuote: non aggiungono informazione.
      cand.forEach((e) => { if (Math.abs(geo(e).cy - fascia) < 6) usati.add(e); });
    }
  }
  const colonnaDi = (c) => { const i = intest.find((x) => x.g.cx >= c.g.x - 2 && x.g.cx <= c.g.x + c.g.w + 2); return i ? (intest.prefisso ? intest.prefisso + ' ' : '') + testoDi(i.e) : tacca(c.g); };
  // In una riga, tre o più celle consecutive con il medesimo stato non ripetono lo stato: una frase in coda
  // nomina gli intervalli, così l'inizio e la fine restano espliciti. Le celle vuote consecutive diventano un conteggio.
  // Il nome di una cella è, per l'intera riga, l'etichetta sovrastante, l'indice, la colonna o la posizione ordinale.
  const PLURALI = { att: 'in evidenza', err: 'segnalate', off: 'attenuate' };
  const riga = (celle) => {
    const pezzi = [], code = {}; let i = 0;
    const modo = celle.every((c) => pulito(c.e.so)) ? 'so' : celle.every((c) => pulito(c.e.gi)) ? 'gi' : celle.every((c) => colonnaDi(c)) ? 'col' : 'ord';
    const nome = (k) => (modo === 'so' ? pulito(celle[k].e.so) : modo === 'gi' ? pulito(celle[k].e.gi) : modo === 'col' ? colonnaDi(celle[k]) : (k + 1) + 'ª');
    const intervallo = (p, q) => (p === q ? nome(p) : modo === 'ord' ? 'dalla ' + nome(p) + ' alla ' + nome(q) : 'da ' + nome(p) + ' a ' + nome(q));
    const marca = (c) => (c.marche ? ' (' + c.marche.join(', ') + ')' : '');
    while (i < celle.length) {
      if (!testoDi(celle[i].e)) {
        let j = i; while (j + 1 < celle.length && !testoDi(celle[j + 1].e)) j++;
        const l = celle.slice(i, j + 1), col = colonnaDi(celle[i]), st = NOMI[celle[i].e.st];
        pezzi.push(l.length === 1 ? E((col ? col + ': ' : '') + 'vuota' + (st ? ', ' + st[0] : '') + marca(celle[i])) : E(l.length + ' celle vuote' + (conteggio(l).length ? ': ' + conteggio(l).join(', ') : '')));
        i = j + 1; continue;
      }
      let j = i; const s = celle[i].e.st;
      while (j + 1 < celle.length && testoDi(celle[j + 1].e) && celle[j + 1].e.st === s) j++;
      const testi = celle.slice(i, j + 1).map((c) => { const col = colonnaDi(c); return E((col ? col + ': ' : '') + testoDi(c.e) + marca(c)); });
      if (j - i >= 2 && PLURALI[s] && i === 0 && j === celle.length - 1) pezzi.push(testi.join('; ') + ' (tutte ' + PLURALI[s] + ')');
      else if (j - i >= 2 && PLURALI[s]) { pezzi.push(testi.join('; ')); (code[s] = code[s] || []).push(intervallo(i, j)); }
      else celle.slice(i, j + 1).forEach((c, k) => pezzi.push(testi[k] + stato(c.e)));
      i = j + 1;
    }
    const coda = ['att', 'err', 'off'].filter((k) => code[k]).map((k) => PLURALI[k] + ' ' + E(code[k].join(', ')));
    return pezzi.join('; ') + (coda.length ? '. ' + maiuscola0(coda.join('; ')) : '');
  };
  // Segni puntuali: una nota che inizia con una freccia, sotto o sopra una cella, si riferisce a quella cella.
  griglia.forEach((r) => {
    tutti.filter((e) => e.t === 'nota' && !usati.has(e) && /^[↑↓]/.test(testoDi(e))).forEach((e) => {
      const g = geo(e), c = r.celle.find((x) => g.x >= x.g.x - 4 && g.x <= x.g.x + x.g.w);
      const d = g.cy > r.cy ? g.cy - (r.cy + r.h / 2) : r.cy - r.h / 2 - g.cy;
      if (c && d >= 0 && d <= (g.cy > r.cy ? 30 : 44)) { usati.add(e); (c.marche = c.marche || []).push(testoDi(e) + (STATI[e.st] ? ', ' + STATI[e.st] : '')); }
    });
  });
  // Etichette di campo: note allineate al bordo sinistro di una cella, entro 44 px sopra la riga o 30 px sotto,
  // tutte dal medesimo lato; ciascuna nomina le celle fino all'etichetta successiva. Una nota vale per la riga più vicina.
  const scarto = (g, r) => (g.cy < r.cy - r.h / 2 + 2 ? r.cy - r.h / 2 - g.cy : g.cy > r.cy + r.h / 2 - 2 ? g.cy - r.cy - r.h / 2 : -1);
  const allineata = (g, r) => r.celle.some((c) => Math.abs(c.g.x - g.x) <= 4);
  // Distanza ammessa: fino a 44 px sopra la riga, fino a 30 px sotto; una riga sottostante prevale su una sovrastante.
  const peso = (g, r) => { const d = scarto(g, r); return d < 0 || !allineata(g, r) || d > (g.cy < r.cy ? 44 : 30) ? Infinity : d + (g.cy < r.cy ? 0 : 1000); };
  const vicina = (g, r) => { const p = peso(g, r); return p < Infinity && !griglia.some((q) => q !== r && peso(g, q) < p); };
  griglia.forEach((r) => {
    let campi = tutti.filter((e) => e.t === 'nota' && !usati.has(e) && vicina(geo(e), r)).sort((a, b) => geo(a).x - geo(b).x);
    // Un titolo in maiuscolo fra etichette in minuscolo intesta la riga, e non è un campo.
    if (!campi.every(maiuscola)) campi = campi.filter((e) => !maiuscola(e));
    const su = campi.filter((e) => geo(e).cy < r.cy), giu = campi.filter((e) => geo(e).cy > r.cy);
    campi = su.length >= giu.length ? su : giu;
    if (campi.length < 2) return;
    const idx = (e) => r.celle.findIndex((c) => Math.abs(c.g.x - geo(e).x) <= 4);
    r.campi = campi.map((e, k) => { usati.add(e); const da = idx(e); return { e, da, a: Math.max(da, k + 1 < campi.length ? idx(campi[k + 1]) - 1 : r.celle.length - 1) }; });
  });
  // Celle larghe sopra celle strette («byte 0» sopra otto bit): la riga stretta è letta per gruppi, ciascuno
  // nominato dalla cella larga che lo sovrasta, e la riga larga non è ripetuta.
  griglia.forEach((r) => {
    if (r.campi || r.celle.length < 4) return;
    const R = griglia.find((q) => q !== r && q.cy < r.cy && (() => { const d = r.cy - r.h / 2 - (q.cy + q.h / 2); return d >= -2 && d <= 30; })());
    if (!R || R.campi || R.sopra || r.celle.length < 2 * R.celle.length) return;
    const dentro = (c, C) => c.g.cx >= C.g.x - 2 && c.g.cx <= C.g.x + C.g.w + 2;
    if (!r.celle.every((c) => R.celle.some((C) => dentro(c, C))) || !R.celle.every((C) => r.celle.filter((c) => dentro(c, C)).length >= 2)) return;
    r.campi = R.celle.map((C) => { const l = r.celle.map((c, i) => (dentro(c, C) ? i : -1)).filter((i) => i >= 0); return { cella: C, da: l[0], a: l[l.length - 1] }; });
    R.sopra = true;
  });
  // Una riga con campi è letta campo per campo.
  const corpoRiga = (r) => {
    if (!r.campi) return riga(r.celle);
    const pezzi = r.campi[0].da > 0 ? [riga(r.celle.slice(0, r.campi[0].da))] : [];
    r.campi.forEach((f) => pezzi.push(E(testoDi(f.e || f.cella.e)) + stato(f.e || f.cella.e) + ': ' + riga(r.celle.slice(f.da, f.a + 1))));
    return pezzi.join('. ');
  };
  // Ogni tabella diventa una tabella HTML, con le intestazioni di colonna e, se presenti, le etichette di riga.
  tabelle.forEach((t) => {
    const conEti = t.membri.some((r) => r.eti);
    const testa = (conEti ? (t.angolo ? '<th scope="col">' + E(testoDi(t.angolo)) + '</th>' : '<td></td>') : '') + t.capi.concat(t.extra.map((x) => x.h)).map((e) => '<th scope="col">' + E(testoDi(e)) + stato(e) + '</th>').join('');
    const corpo = t.membri.map((r, k) => '<tr>' + (conEti ? (r.eti ? '<th scope="row">' + E(testoDi(r.eti)) + stato(r.eti) + '</th>' : '<td></td>') : '') + r.celle.map((c) => '<td>' + (E(t.dalSo ? testoDi(Object.assign({}, c.e, { so: '' })) : testoDi(c.e)) || '—') + stato(c.e) + '</td>').join('') + t.extra.map((x) => '<td>' + (x.col[k] ? E(testoDi(x.col[k])) + stato(x.col[k]) : '—') + '</td>').join('') + '</tr>').join('');
    const x0 = Math.min.apply(null, t.membri.map((r) => (r.eti ? geo(r.eti).x : r.celle[0].g.x)).concat([geo(t.capi[0]).x]));
    voci.push({ x: x0, y: geo(t.capi[0]).cy, html: 'tabella di ' + t.membri.length + (t.membri.length === 1 ? ' riga' : ' righe') + '<table><thead><tr>' + testa + '</tr></thead><tbody>' + corpo + '</tbody></table>' });
  });
  // Le etichette di riga sono separate dalle celle da una lineetta, perché spesso contengono già i due punti.
  griglia.filter((r) => !r.sopra).forEach((r) => voci.push({ x: r.x, y: r.cy, html: (r.eti ? E(testoDi(r.eti)) + stato(r.eti) + ' — ' : '') + corpoRiga(r) }));
  // Barre: con un asse numerico sovrastante, l'estensione della parte piena si legge in unità dell'asse. Le barre
  // di una medesima fascia formano una voce, nominata dall'etichetta a sinistra; una nota appena sopra una barra,
  // allineata al suo inizio, ne nomina il tratto.
  const fileBarre = [];
  tutti.filter((e) => e.t === 'barra' && !usati.has(e)).map((e) => ({ e, g: geo(e) })).forEach((c) => { const r = fileBarre.find((x) => Math.abs(x.cy - c.g.cy) < Math.max(8, c.g.h / 2)); if (r) r.celle.push(c); else fileBarre.push({ cy: c.g.cy, h: c.g.h, celle: [c] }); });
  fileBarre.forEach((r) => {
    r.celle.sort((p, q) => p.g.x - q.g.x);
    r.celle.forEach((c) => usati.add(c.e));
    const parti = r.celle.map((c) => {
      const g = c.g, v = Math.max(0, Math.min(1, c.e.v || 0)), a = assi.filter((x) => x.cy < g.cy && x.leggi).sort((p, q) => q.cy - p.cy)[0];
      const su = tutti.filter((e) => e.t === 'nota' && !usati.has(e) && (() => { const h = geo(e); return Math.abs(h.x - g.x) <= 6 && g.y - h.cy > 0 && g.y - h.cy < 26 && !fileBarre.some((f) => f.celle.some((b) => b !== c && Math.abs(h.x - b.g.x) <= 6 && h.cy - (b.g.y + b.g.h) > 0 && h.cy - (b.g.y + b.g.h) < 26)); })())[0];
      if (su) usati.add(su);
      const t = a ? (v < 0.005 ? 'vuota' : 'da ' + a.leggi(g.x) + ' a ' + a.leggi(g.x + g.w * v)) : testoDi(c.e);
      return (su ? E(testoDi(su)) + stato(su) + ': ' : '') + E(t) + stato(c.e);
    });
    const eti = etichetta(r, r.celle[0].g.x);
    voci.push({ x: eti ? geo(eti).x : r.celle[0].g.x, y: r.cy, html: (eti ? E(testoDi(eti)) + stato(eti) + ' — ' : '') + parti.join('; ') });
  });
  // Celle prive di testo: una riga di segni visivi diventa il conteggio delle celle per stato; sotto un asse numerico,
  // fino a dodici celle sono elencate con la loro posizione sull'asse.
  const fileMute = inFila((els || []).filter((e) => e && e.t === 'cella' && !testoDi(e) && !usati.has(e)).map((e) => ({ e, g: geo(e) })));
  fileMute.filter((r) => r.celle.length >= 2).forEach((r) => {
    const x0 = r.celle[0].g.x, a = assi.filter((x) => x.cy < r.cy && x.leggi).sort((p, q) => q.cy - p.cy)[0];
    const eti = tutti.filter((e) => !usati.has(e) && e.t !== 'zona' && (() => { const g = geo(e); return Math.abs(g.cy - r.cy) < Math.max(12, r.h / 2 + 4) && g.x < x0; })()).sort((p, q) => geo(q).x - geo(p).x)[0];
    if (eti) usati.add(eti);
    const parti = conteggio(r.celle);
    const pos = a && r.celle.length <= 12 ? '; sulla scala: ' + r.celle.map((c) => a.leggi(c.g.cx, true) + (NOMI[c.e.st] ? ' ' + NOMI[c.e.st][0] : '')).join('; ') : '';
    voci.push({ x: eti ? geo(eti).x : x0, y: r.cy, html: E((eti ? testoDi(eti) + ' — ' : '') + r.celle.length + ' celle' + (parti.length ? ', ' + parti.join(', ') : '') + pos) });
  });
  // Titoli di sezione: note scritte in maiuscolo, che nei disegni del sito intestano un gruppo di elementi.
  const titoli = tutti.filter((e) => !usati.has(e) && maiuscola(e)).map((e) => ({ e, g: geo(e), dentro: [] }));
  titoli.forEach((e) => usati.add(e.e));
  // Elementi singoli e zone.
  const zone = tutti.filter((e) => e.t === 'zona' && !usati.has(e)).map((e) => ({ e, g: geo(e), dentro: [] })).sort((a, b) => a.g.w * a.g.h - b.g.w * b.g.h);
  tutti.filter((e) => e.t !== 'zona' && !usati.has(e)).forEach((e) => { const g = geo(e); voci.push({ x: g.x, y: g.cy, html: E(testoDi(e)) + stato(e) }); });
  const ordina = (l) => l.sort((a, b) => (Math.abs(a.y - b.y) < 16 ? a.x - b.x : a.y - b.y));
  const elenco = (l) => '<ul>' + ordina(l).map((v) => '<li>' + v.html + '</li>').join('') + '</ul>';
  let libere = [];
  ordina(voci).forEach((v) => { const z = zone.find((q) => v.x >= q.g.x - 2 && v.x <= q.g.x + q.g.w && v.y >= q.g.y - 2 && v.y <= q.g.y + q.g.h); if (z) z.dentro.push(v); else libere.push(v); });
  zone.forEach((z) => libere.push({ x: z.g.x, y: z.g.y, html: E(testoDi(z.e)) + stato(z.e) + (z.dentro.length ? elenco(z.dentro) : '') }));
  // Ogni titolo raccoglie gli elementi sotto di sé, fino al titolo successivo nella medesima colonna.
  titoli.forEach((h) => {
    const destra = titoli.filter((k) => k !== h && Math.abs(k.g.cy - h.g.cy) < 12 && k.g.x > h.g.x).map((k) => k.g.x);
    h.x0 = h.g.x - 6; h.x1 = destra.length ? Math.min.apply(null, destra) - 6 : Infinity;
  });
  titoli.forEach((h) => {
    const sotto = titoli.filter((k) => k !== h && k.g.y > h.g.y + 4 && k.g.x >= h.x0 && k.g.x < h.x1).map((k) => k.g.y);
    h.y1 = sotto.length ? Math.min.apply(null, sotto) : Infinity;
  });
  libere = libere.filter((v) => { const h = titoli.find((k) => v.x >= k.x0 && v.x < k.x1 && v.y > k.g.y && v.y < k.y1); if (h) { h.dentro.push(v); return false; } return true; });
  titoli.forEach((h) => libere.push({ x: h.g.x, y: h.g.cy, html: E(testoDi(h.e)) + stato(h.e) + (h.dentro.length ? elenco(h.dentro) : '') }));
  // Collegamenti: i segmenti che si toccano formano un tracciato; ogni tracciato collega gli elementi dei quali tocca
  // il bordo con un estremo. Le linee non hanno verso, quindi la descrizione nomina gli elementi collegati.
  const segmenti = (els || []).filter((e) => e && e.t === 'linea');
  if (segmenti.length) {
    const capo = segmenti.map((_, k) => k), radice = (k) => (capo[k] === k ? k : (capo[k] = radice(capo[k])));
    const tocca = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3;
    const estremi = segmenti.map((l) => [[l.x1, l.y1], [l.x2, l.y2]]);
    // Un estremo che cade su un altro segmento (una diramazione) unisce i due tracciati.
    const suSegmento = (p, l) => { const dx = l.x2 - l.x1, dy = l.y2 - l.y1, q = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - l.x1) * dx + (p[1] - l.y1) * dy) / q)); return Math.hypot(p[0] - l.x1 - t * dx, p[1] - l.y1 - t * dy) <= 2; };
    segmenti.forEach((l, i) => segmenti.forEach((m, j) => { if (j > i && (estremi[i].some((a) => estremi[j].some((b) => tocca(a, b))) || estremi[i].some((a) => suSegmento(a, m)) || estremi[j].some((b) => suSegmento(b, l)))) capo[radice(j)] = radice(i); }));
    const bersagli = (els || []).filter((e) => e && e.t !== 'linea' && e.t !== 'cursore' && e.t !== 'testo' && e.t !== 'zona' && e.t !== 'barra' && (testoDi(e) || e.t === 'sim'));
    const distanza = (p, e) => { const g = geo(e); return Math.hypot(Math.max(g.x - p[0], 0, p[0] - g.x - g.w), Math.max(g.y - p[1], 0, p[1] - g.y - g.h)); };
    const tracciati = {};
    estremi.forEach((ee, k) => ee.forEach((p) => {
      const vicino = bersagli.map((e) => [e, distanza(p, e)]).filter((x) => x[1] <= 14).sort((a, b) => a[1] - b[1])[0];
      if (vicino) { const r = radice(k); (tracciati[r] = tracciati[r] || []).indexOf(vicino[0]) < 0 && tracciati[r].push(vicino[0]); }
    }));
    const nomeDi = (e) => (e.t === 'sim' ? 'simbolo ' + (e.sim || '') : testoDi(e));
    // Un tracciato fra soli segni brevi (cifre, singole lettere) indica un passaggio già descritto dai valori.
    const legami = Object.keys(tracciati).map((k) => tracciati[k]).filter((l) => l.length >= 2 && l.some((e) => nomeDi(e).length > 2)).map((l) => {
      const n = l.map((e) => E(nomeDi(e)));
      return { x: 0, y: 1e9, html: (n.length === 2 ? n[0] + ' — ' + n[1] : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1]) };
    });
    if (legami.length) libere.push({ x: 0, y: 1e9, html: 'collegamenti tracciati nel disegno' + '<ul>' + legami.map((v) => '<li>' + v.html + '</li>').join('') + '</ul>' });
  }
  if (!libere.length && !frasi) return '';
  return '<p class="tt">Descrizione testuale della scena</p>' + frasi + (libere.length ? elenco(libere) : '');
};

/* Scrittura dei numeri grandi: gruppi di tre cifre separati da uno spazio che non va a capo. */
SL.num = (v) => (Math.abs(v) < 10000 ? String(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'));

/* Piccoli costruttori di elementi, per scrivere i fotogrammi in modo leggibile. */
SL.el = {
  box: (id, x, y, w, h, et, txt, st, extra) => Object.assign({ id, t: 'box', x, y, w, h, et, txt, st }, extra),
  cella: (id, x, y, w, h, txt, st, extra) => Object.assign({ id, t: 'cella', x, y, w, h, txt, st }, extra),
  pacco: (id, x, y, txt, st, extra) => Object.assign({ id, t: 'pacco', x, y, h: 30, txt, st }, extra),
  nota: (id, x, y, txt, cls, st, extra) => Object.assign({ id, t: 'nota', x, y, txt, cls, st }, extra),
  sim: (id, x, y, lato, sim, st) => ({ id, t: 'sim', x, y, w: lato, h: lato, sim, st }),
  linea: (id, x1, y1, x2, y2, st, tratto) => ({ id, t: 'linea', x1, y1, x2, y2, st, tratto }),
  barra: (id, x, y, w, h, v) => ({ id, t: 'barra', x, y, w, h, v }),
  cursore: (id, x, y, w) => ({ id, t: 'cursore', x, y, w }),
  zona: (id, x, y, w, h, et, st) => ({ id, t: 'zona', x, y, w, h, et, st }),
  // Frase per la sola descrizione testuale: non è disegnata, e precede le voci ricavate dal disegno.
  testo: (id, txt) => ({ id, t: 'testo', txt })
};
