'use strict';
/* Preferenze di lettura: tema, dimensione e spaziatura del testo, carattere, animazioni, scene degli esperimenti.
   Nulla è conservato nel browser. Le scelte valgono per la pagina aperta e compaiono nell'indirizzo, nel
   parametro «lettura»: l'indirizzo può essere salvato fra i segnalibri e ripropone le medesime scelte.
   In assenza di una scelta valgono le impostazioni del sistema per il contrasto elevato e il movimento ridotto. */
(() => {
  const E = SL.E;
  const VOCI = [
    ['tema', 'Tema', [['scuro', 'Scuro'], ['chiaro', 'Chiaro'], ['contrasto', 'Alto contrasto']]],
    ['testo', 'Dimensione del testo', [['normale', 'Normale'], ['grande', 'Grande'], ['maggiore', 'Molto grande']]],
    ['spazio', 'Spaziatura del testo', [['normale', 'Normale'], ['ampia', 'Ampia']]],
    ['carattere', 'Carattere', [['normale', 'Normale'], ['leggibile', 'Ad alta leggibilità']]],
    ['moto', 'Animazioni', [['attive', 'Attive'], ['ferme', 'Ferme']]],
    ['scene', 'Scene degli esperimenti', [['grafiche', 'Grafiche'], ['testuali', 'Testuali']]]
  ];
  const sistema = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const base = () => ({
    tema: sistema('(prefers-contrast: more)') ? 'contrasto' : 'scuro', testo: 'normale', spazio: 'normale',
    carattere: 'normale', moto: sistema('(prefers-reduced-motion: reduce)') ? 'ferme' : 'attive', scene: 'grafiche'
  });
  // Ogni valore compare in una sola voce, quindi l'indirizzo elenca soltanto i valori.
  const voceDi = (v) => VOCI.find((x) => x[2].some((o) => o[0] === v));
  const leggi = () => {
    const s = base();
    let q = '';
    try { q = new URLSearchParams(location.search).get('lettura') || ''; } catch (e) { q = ''; }
    q.split('.').slice(0, VOCI.length).forEach((v) => { const x = voceDi(v); if (x) s[x[0]] = v; });
    return s;
  };
  let scelte = leggi();

  const applica = () => {
    const r = document.documentElement;
    VOCI.forEach(([k]) => { r.dataset[k] = scelte[k]; });
    document.dispatchEvent(new CustomEvent('sl-lettura', { detail: Object.assign({}, scelte) }));
  };
  const scrivi = () => {
    const b = base(), t = VOCI.map(([k]) => (scelte[k] !== b[k] ? scelte[k] : null)).filter(Boolean);
    try { history.replaceState(history.state, '', location.pathname + (t.length ? '?lettura=' + t.join('.') : '') + location.hash); } catch (e) { /* l'indirizzo resta invariato */ }
  };
  applica();

  // Pannello nella testata, aperto e chiuso dal pulsante «Lettura».
  const nav = document.querySelector('.testa nav'), testa = document.querySelector('.testa');
  if (!nav || !testa) return;
  const bottone = document.createElement('button');
  bottone.type = 'button'; bottone.className = 'lettura-bottone'; bottone.textContent = 'Lettura';
  bottone.setAttribute('aria-expanded', 'false'); bottone.setAttribute('aria-controls', 'lettura');
  nav.appendChild(bottone);
  const pannello = document.createElement('section');
  pannello.id = 'lettura'; pannello.className = 'lettura'; pannello.hidden = true;
  pannello.setAttribute('aria-label', 'Preferenze di lettura');
  pannello.innerHTML = '<div class="in"><p class="nota">Le scelte valgono per la pagina aperta e compaiono nell’indirizzo, che può essere salvato fra i segnalibri. Il sito non registra alcun dato.</p><div class="gruppi">' +
    VOCI.map(([k, eti, opz]) => '<fieldset><legend>' + E(eti) + '</legend>' + opz.map(([v, t]) =>
      '<label><input type="radio" name="lettura-' + k + '" value="' + v + '">' + E(t) + '</label>').join('') + '</fieldset>').join('') +
    '</div><div class="riga-bottoni"><button type="button" class="bottone" data-l="base">Impostazioni iniziali</button><button type="button" class="bottone" data-l="chiudi">Chiusura del pannello</button></div></div>';
  testa.appendChild(pannello);

  const segna = () => VOCI.forEach(([k]) => pannello.querySelectorAll('input[name="lettura-' + k + '"]').forEach((i) => { i.checked = i.value === scelte[k]; }));
  const apri = (si) => { pannello.hidden = !si; bottone.setAttribute('aria-expanded', String(si)); if (si) segna(); };
  bottone.addEventListener('click', () => apri(pannello.hidden));
  pannello.addEventListener('change', (ev) => {
    const i = ev.target, k = i.name && i.name.replace('lettura-', '');
    if (!i.checked || !VOCI.some((x) => x[0] === k) || !voceDi(i.value)) return;
    scelte[k] = i.value; applica(); scrivi();
  });
  pannello.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-l]'); if (!b) return;
    if (b.dataset.l === 'base') { scelte = base(); applica(); scrivi(); segna(); }
    else { apri(false); bottone.focus(); }
  });
  pannello.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { apri(false); bottone.focus(); } });
})();
