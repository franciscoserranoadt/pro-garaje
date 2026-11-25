/* Pro Garaje — mantenimiento del coche, avisos y repostajes.
   Todos los datos se guardan en el propio móvil (Android.save + localStorage). */
(function () {
  'use strict';

  var A = window.Android || null;
  var DAY = 86400000;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ICONOS = ['🔍', '🛡️', '🛢️', '🛞', '🔋', '🧰', '🌬️', '🛑', '⚙️', '💧', '❄️', '🧾', '🔧', '🚿', '💡', '🪪', '🅿️', '📄'];

  /* ---------- Plantillas de mantenimientos ---------- */
  var PLANTILLAS = [
    { name: 'Filtro de aire', icon: '🌬️', everyKm: 30000, everyMonths: 24 },
    { name: 'Filtro de habitáculo', icon: '🌬️', everyKm: 15000, everyMonths: 12 },
    { name: 'Filtro de gasoil', icon: '⚙️', everyKm: 30000, everyMonths: 24 },
    { name: 'Pastillas de freno', icon: '🛑', everyKm: 40000, everyMonths: 0 },
    { name: 'Líquido de frenos', icon: '💧', everyKm: 0, everyMonths: 24 },
    { name: 'Batería', icon: '🔋', everyKm: 0, everyMonths: 48 },
    { name: 'Correa / distribución', icon: '⚙️', everyKm: 120000, everyMonths: 72 },
    { name: 'Revisión general', icon: '🧰', everyKm: 30000, everyMonths: 24 },
    { name: 'Aire acondicionado', icon: '❄️', everyKm: 0, everyMonths: 24 },
    { name: 'Presión neumáticos', icon: '🛞', everyKm: 0, everyMonths: 1 },
    { name: 'Impuesto circulación', icon: '🧾', everyKm: 0, everyMonths: 12, fixed: true },
    { name: 'Escobillas', icon: '🚿', everyKm: 0, everyMonths: 12 }
  ];

  function nuevo() {
    return {
      v: 1,
      car: { brand: 'Nissan', model: 'Qashqai J11', year: 2018, plate: '', fuel: 'Diésel', tank: 55, regDate: '', km: 0, kmDate: '' },
      items: [
        { id: 'itv', kind: 'itv', name: 'ITV', icon: '🔍', fixed: true, everyMonths: 24, everyKm: 0, dueDate: '', lastDate: '', lastKm: null, on: true, x: { estacion: '', tel: '' } },
        { id: 'seguro', kind: 'seguro', name: 'Seguro', icon: '🛡️', fixed: true, everyMonths: 12, everyKm: 0, dueDate: '', lastDate: '', lastKm: null, on: true, x: { compania: '', poliza: '', precio: '', tel: '' } },
        { id: 'aceite', kind: 'aceite', name: 'Aceite y filtro', icon: '🛢️', everyMonths: 12, everyKm: 15000, dueDate: '', lastDate: '', lastKm: null, on: true, x: { tipo: '' } },
        { id: 'neumaticos', kind: 'neumaticos', name: 'Neumáticos', icon: '🛞', everyMonths: 60, everyKm: 40000, dueDate: '', lastDate: '', lastKm: null, on: true, x: { medida: '', marca: '' } }
      ],
      services: [],
      fuel: [],
      set: { days: '30,7,1', hour: 9 }
    };
  }

  /* ---------- Guardar / cargar ---------- */
  var D;
  function cargar() {
    var txt = '';
    try { txt = A ? A.load() : ''; } catch (e) {}
    if (!txt) { try { txt = localStorage.getItem('progaraje') || ''; } catch (e) {} }
    try { D = txt ? JSON.parse(txt) : nuevo(); } catch (e) { D = nuevo(); }
    var base = nuevo();
    D.car = Object.assign(base.car, D.car || {});
    D.set = Object.assign(base.set, D.set || {});
    D.items = D.items || base.items;
    D.services = D.services || [];
    D.fuel = D.fuel || [];
  }
  function guardar() {
    var txt = JSON.stringify(D);
    try { if (A) A.save(txt); } catch (e) {}
    try { localStorage.setItem('progaraje', txt); } catch (e) {}
    enviarAvisos();
  }

  /* ---------- Utilidades ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function hoyISO() { var d = new Date(); return iso(d); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fecha(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hoy0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addMeses(s, m) { var d = fecha(s); if (!d) return ''; var dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + m); var max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, max)); return iso(d); }
  function fmtF(s) { var d = fecha(s); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—'; }
  function fmtFc(s) { var d = fecha(s); return d ? d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() : '—'; }
  function num(v) { if (v === null || v === undefined) return NaN; return parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); }
  // Formato español con punto de miles siempre (2.594 km, 1.492,77 €)
  function fmt(v, d) {
    if (!isFinite(v)) return '—';
    var neg = v < 0, t = Math.abs(v).toFixed(d), p = t.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + p[0] + (p[1] ? ',' + p[1] : '');
  }
  function n0(v) { return fmt(Math.round(v), 0); }
  function n1(v) { return fmt(v, 1); }
  function n2(v) { return fmt(v, 2); }
  function n3(v) { return fmt(v, 3); }
  function eur(v) { return isFinite(v) ? n2(v) + ' €' : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plural(n, a, b) { return n + ' ' + (Math.abs(n) === 1 ? a : b); }

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------- Kilómetros ---------- */
  // Lecturas conocidas: km del coche, repostajes y visitas al taller.
  function lecturas() {
    var l = [];
    if (D.car.km > 0) l.push({ d: D.car.kmDate || hoyISO(), km: +D.car.km });
    D.fuel.forEach(function (f) { if (f.km > 0) l.push({ d: f.date, km: +f.km }); });
    D.services.forEach(function (s) { if (s.km > 0) l.push({ d: s.date, km: +s.km }); });
    l.sort(function (a, b) { return a.km - b.km; });
    return l;
  }
  function kmDia() {
    var l = lecturas();
    if (l.length >= 2) {
      var a = l[0], b = l[l.length - 1];
      var dias = (fecha(b.d) - fecha(a.d)) / DAY;
      if (dias >= 14 && b.km > a.km) return (b.km - a.km) / dias;
    }
    return 40; // ≈ 14.600 km al año mientras no haya datos suficientes
  }
  function ultimaLectura() { var l = lecturas(); return l.length ? l[l.length - 1] : null; }
  function kmHoy() {
    var u = ultimaLectura(); if (!u) return 0;
    var dias = Math.max(0, (hoy0() - fecha(u.d)) / DAY);
    return Math.round(u.km + kmDia() * dias);
  }

  /* ---------- Estado de cada mantenimiento ---------- */
  function intervaloITV() {
    var y = +D.car.year || 0, reg = fecha(D.car.regDate);
    var edad = reg ? (hoy0() - reg) / (365.25 * DAY) : (y ? new Date().getFullYear() - y : 0);
    return edad >= 10 ? 12 : 24; // Turismos: cada 2 años hasta los 10 años, luego cada año
  }
  function estado(it) {
    var r = { dueDate: '', dueKm: null, days: null, kmLeft: null, estDate: '', st: 'unset', pct: 0, txt: 'Sin datos', due: 0 };
    var hoy = hoy0();
    if (it.dueDate) r.dueDate = it.dueDate;
    else if (it.lastDate && it.everyMonths > 0) r.dueDate = addMeses(it.lastDate, it.everyMonths);
    if (it.everyKm > 0 && it.lastKm !== null && it.lastKm !== '' && isFinite(+it.lastKm)) r.dueKm = +it.lastKm + +it.everyKm;
    var best = Infinity;
    if (r.dueDate) {
      r.days = Math.round((fecha(r.dueDate) - hoy) / DAY);
      best = fecha(r.dueDate).getTime();
      if (it.lastDate && fecha(it.lastDate) < fecha(r.dueDate)) {
        r.pct = Math.min(1, Math.max(0, (hoy - fecha(it.lastDate)) / (fecha(r.dueDate) - fecha(it.lastDate))));
      } else r.pct = r.days <= 0 ? 1 : Math.max(0.05, 1 - r.days / 365);
    }
    if (r.dueKm !== null) {
      var kh = kmHoy();
      r.kmLeft = r.dueKm - kh;
      var est = hoy.getTime() + Math.round(r.kmLeft / kmDia()) * DAY;
      r.estDate = iso(new Date(est));
      var pk = Math.min(1, Math.max(0, (kh - it.lastKm) / it.everyKm));
      if (est < best) best = est;
      r.pct = Math.max(r.pct, pk);
    }
    if (best === Infinity) return r;
    r.due = best;
    var late = (r.days !== null && r.days < 0) || (r.kmLeft !== null && r.kmLeft < 0);
    var soon = (r.days !== null && r.days <= 30) || (r.kmLeft !== null && r.kmLeft <= 1000);
    r.st = late ? 'late' : soon ? 'soon' : 'ok';
    // Texto del chip: lo que llegue antes
    var porKm = r.kmLeft !== null && (r.days === null || fecha(r.estDate) < fecha(r.dueDate));
    if (porKm) r.txt = r.kmLeft < 0 ? 'Pasado ' + n0(-r.kmLeft) + ' km' : '≈ ' + n0(r.kmLeft) + ' km';
    else if (r.days < 0) r.txt = 'Vencido hace ' + plural(-r.days, 'día', 'días');
    else if (r.days === 0) r.txt = 'Hoy';
    else if (r.days === 1) r.txt = 'Mañana';
    else if (r.days < 60) r.txt = 'Faltan ' + r.days + ' días';
    else r.txt = 'Faltan ' + Math.round(r.days / 30.4) + ' meses';
    return r;
  }
  function descr(it, e) {
    var p = [];
    if (e.dueDate) p.push((it.fixed ? 'Vence ' : 'Toca ') + fmtF(e.dueDate));
    if (e.dueKm !== null) p.push('a los ' + n0(e.dueKm) + ' km');
    if (!p.length) return it.fixed ? 'Toca para poner la fecha' : 'Toca para poner el último cambio';
    return p.join(' · ');
  }
  function ordenados() {
    return D.items.slice().sort(function (a, b) {
      var ea = estado(a), eb = estado(b);
      if (!a.on !== !b.on) return a.on ? -1 : 1;
      if (!ea.due !== !eb.due) return ea.due ? -1 : 1;
      return (ea.due || 0) - (eb.due || 0);
    });
  }

  /* ---------- Avisos al sistema (notificaciones) ---------- */
  function enviarAvisos() {
    if (!A || !A.setReminders) return;
    var list = [];
    D.items.forEach(function (it) {
      if (!it.on) return;
      var e = estado(it); if (!e.due) return;
      var body = descr(it, e);
      if (e.kmLeft !== null) body += e.kmLeft >= 0 ? ' (te quedan ≈ ' + n0(e.kmLeft) + ' km)' : ' (te has pasado ' + n0(-e.kmLeft) + ' km)';
      list.push({ id: it.id, title: it.icon + ' ' + it.name, body: body, due: e.due });
    });
    try { A.setReminders(JSON.stringify(list), D.set.days, +D.set.hour || 9); } catch (e) {}
  }

  /* ---------- Repostajes: consumo real ---------- */
  function repostajesCalc() {
    var f = D.fuel.slice().sort(function (a, b) { return a.km - b.km || (a.date < b.date ? -1 : 1); });
    var lastFull = -1;
    f.forEach(function (r, i) {
      r._c = null; r._km = null;
      if (i > 0) r._km = r.km - f[i - 1].km;
      if (r.full) {
        if (lastFull >= 0) {
          var lit = 0;
          for (var k = lastFull + 1; k <= i; k++) lit += +f[k].liters || 0;
          var km = r.km - f[lastFull].km;
          if (km > 20 && lit > 0) { r._c = lit / km * 100; r._kmTramo = km; r._litTramo = lit; }
        }
        lastFull = i;
      }
    });
    return f;
  }
  function consumoMedio() {
    var lit = 0, km = 0;
    repostajesCalc().forEach(function (r) { if (r._c) { lit += r._litTramo; km += r._kmTramo; } });
    return km > 0 ? lit / km * 100 : NaN;
  }
  function eurPorLitroMedio() {
    var t = 0, l = 0; D.fuel.slice(-10).forEach(function (r) { t += +r.total || 0; l += +r.liters || 0; });
    return l ? t / l : NaN;
  }

  /* ---------- Gastos por mes ---------- */
  function mesKey(s) { return s ? s.slice(0, 7) : ''; }
  function gastosMes(k) {
    var g = { fuel: 0, taller: 0, litros: 0, n: 0 };
    D.fuel.forEach(function (r) { if (mesKey(r.date) === k) { g.fuel += +r.total || 0; g.litros += +r.liters || 0; g.n++; } });
    D.services.forEach(function (s) { if (mesKey(s.date) === k) g.taller += +s.cost || 0; });
    g.total = g.fuel + g.taller;
    return g;
  }
  function ultimosMeses(n) {
    var out = [], d = new Date(); d.setDate(1);
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      var k = x.getFullYear() + '-' + pad(x.getMonth() + 1);
      var g = gastosMes(k); g.k = k; g.lbl = MESES[x.getMonth()]; g.y = x.getFullYear();
      out.push(g);
    }
    return out;
  }

  /* =================================================================
     PANTALLAS
     ================================================================= */
  var tab = 'inicio';
  var TITULOS = { inicio: 'Inicio', mant: 'Taller y avisos', fuel: 'Repostajes', gastos: 'Gastos y consumo', ajustes: 'Ajustes' };

  function irA(t) {
    tab = t;
    $$('#nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'v-' + t); });
    $('#ttl').textContent = TITULOS[t];
    pintar();
    $('#main').scrollTop = 0;
  }

  function pintar() {
    var c = D.car;
    $('#sub').textContent = [c.brand, c.model, c.plate].filter(Boolean).join(' · ');
    if (tab === 'inicio') pInicio();
    if (tab === 'mant') pMant();
    if (tab === 'fuel') pFuel();
    if (tab === 'gastos') pGastos();
    if (tab === 'ajustes') pAjustes();
  }

  function itemHTML(it) {
    var e = estado(it);
    var cls = it.on ? 'st-' + e.st : 'st-off';
    return '<div class="item ' + cls + '" data-item="' + it.id + '">' +
      '<div class="ic">' + it.icon + '</div><div class="bd">' +
      '<div class="nm"><span>' + esc(it.name) + '</span><span class="chip">' + (it.on ? e.txt : 'Sin aviso') + '</span></div>' +
      '<div class="ds">' + esc(descr(it, e)) + '</div>' +
      (e.due ? '<div class="bar"><i style="width:' + Math.round(Math.max(4, e.pct * 100)) + '%"></i></div>' : '') +
      '</div></div>';
  }

  function pInicio() {
    var c = D.car, kh = kmHoy(), u = ultimaLectura();
    var mes = gastosMes(hoyISO().slice(0, 7));
    var cm = consumoMedio();
    var urg = ordenados().filter(function (it) { return it.on; });
    var malos = urg.filter(function (it) { var s = estado(it).st; return s === 'late' || s === 'soon'; }).length;
    var h = '<div class="cols"><div>' +
      '<div class="card car"><div class="name">' + esc(c.brand + ' ' + c.model) + '</div>' +
      (c.plate ? '<span class="plate">' + esc(c.plate) + '</span>' : '<button class="link" data-act="coche">+ Añadir matrícula</button>') +
      '<div class="km">' + (kh ? n0(kh) + ' <small>km' + (u && u.d !== hoyISO() ? ' (aprox.)' : '') + '</small>' : '<small>Pon los km del coche</small>') + '</div>' +
      '<button class="btn ghost" style="margin-top:8px" data-act="km">🔢 Actualizar km</button></div>' +
      '<div class="quick"><button class="btn pri" data-act="repostar">⛽ Repostar</button><button class="btn" data-act="taller">🔧 Taller</button></div>' +
      '<div class="grid2" style="margin-bottom:12px">' +
      '<div class="stat"><div class="l">Gasto en ' + MESES_L[new Date().getMonth()] + '</div><div class="v">' + eur(mes.total) + '</div></div>' +
      '<div class="stat"><div class="l">Consumo real</div><div class="v">' + (isFinite(cm) ? n1(cm) + ' <small>L/100</small>' : '—') + '</div></div>' +
      '</div></div><div>' +
      '<div class="card"><h3><span>Próximos avisos' + (malos ? ' · <b style="color:var(--amber)">' + malos + ' pendiente' + (malos > 1 ? 's' : '') + '</b>' : '') + '</span>' +
      '<button class="link" data-tab="mant">Ver todo</button></h3>' +
      urg.slice(0, 5).map(itemHTML).join('') + '</div></div></div>';
    $('#v-inicio').innerHTML = h;
  }

  function pMant() {
    var h = '<div class="cols"><div>' + ordenados().map(itemHTML).join('') +
      '<button class="btn ghost full" data-act="nuevoItem">＋ Añadir otro mantenimiento</button>' +
      '</div><div><div class="card"><h3><span>Historial del taller</span><button class="link" data-act="taller">＋ Añadir</button></h3>';
    var s = D.services.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!s.length) h += '<div class="empty"><div class="e">🧰</div>Aquí verás cada ITV, cambio de aceite, neumáticos… con lo que costó.</div>';
    s.forEach(function (x) {
      var it = D.items.filter(function (i) { return i.id === x.itemId; })[0];
      var d = fecha(x.date);
      h += '<div class="row" data-serv="' + x.id + '"><div class="dt"><b>' + d.getDate() + '</b><span>' + MESES[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2) + '</span></div>' +
        '<div class="bd"><div>' + (it ? it.icon + ' ' + esc(it.name) : '🔧 ' + esc(x.name || 'Taller')) + '</div>' +
        '<div class="small muted">' + [x.km ? n0(x.km) + ' km' : '', esc(x.place || ''), esc(x.note || '')].filter(Boolean).join(' · ') + '</div></div>' +
        '<div class="r"><b>' + (x.cost ? eur(+x.cost) : '') + '</b></div></div>';
    });
    $('#v-mant').innerHTML = h + '</div></div></div>';
  }

  function pFuel() {
    var f = repostajesCalc().slice().reverse();
    var cm = consumoMedio(), pl = eurPorLitroMedio();
    var h = '<button class="btn pri full" style="padding:15px;margin-bottom:12px;font-size:16px" data-act="repostar">⛽ Añadir repostaje</button>' +
      '<div class="grid3" style="margin-bottom:6px">' +
      '<div class="stat"><div class="l">Consumo</div><div class="v">' + (isFinite(cm) ? n1(cm) : '—') + ' <small>L/100</small></div></div>' +
      '<div class="stat"><div class="l">Precio medio</div><div class="v">' + (isFinite(pl) ? n3(pl) : '—') + ' <small>€/L</small></div></div>' +
      '<div class="stat"><div class="l">€ cada 100 km</div><div class="v">' + (isFinite(cm) && isFinite(pl) ? n2(cm * pl) : '—') + '</div></div></div>';
    if (!f.length) {
      h += '<div class="card empty"><div class="e">⛽</div>Apunta cada repostaje con los km del cuentakilómetros.<br>' +
        'Para calcular el <b>consumo real</b> hacen falta dos repostajes con el <b>depósito lleno</b>.</div>';
    }
    var mesAnt = '';
    f.forEach(function (r) {
      var k = mesKey(r.date);
      if (k !== mesAnt) {
        if (mesAnt) h += '</div>';
        var g = gastosMes(k), d = fecha(r.date);
        h += '<div class="month-h"><span>' + MESES_L[d.getMonth()] + ' ' + d.getFullYear() + '</span><span>' + eur(g.fuel) + ' · ' + n1(g.litros) + ' L</span></div><div class="card" style="padding:4px 12px">';
        mesAnt = k;
      }
      var d2 = fecha(r.date);
      h += '<div class="row" data-fuel="' + r.id + '"><div class="dt"><b>' + d2.getDate() + '</b><span>' + MESES[d2.getMonth()] + '</span></div>' +
        '<div class="bd"><div>' + n2(+r.liters) + ' L · ' + n3(+r.price) + ' €/L' + (r.full ? '' : '<span class="tag">parcial</span>') + '</div>' +
        '<div class="small muted">' + n0(r.km) + ' km' + (r._km ? ' (+' + n0(r._km) + ')' : '') + (r.station ? ' · ' + esc(r.station) : '') + '</div></div>' +
        '<div class="r"><b>' + eur(+r.total) + '</b><div class="small cons">' + (r._c ? n1(r._c) + ' L/100' : '') + '</div></div></div>';
    });
    if (mesAnt) h += '</div>';
    $('#v-fuel').innerHTML = h;
  }

  function barras(meses) {
    var W = 360, H = 190, pl = 34, pb = 22, pt = 14;
    var max = Math.max.apply(null, meses.map(function (m) { return m.total; }).concat([10]));
    var paso = max > 600 ? 200 : max > 300 ? 100 : max > 120 ? 50 : 20;
    max = Math.ceil(max / paso) * paso;
    var bw = (W - pl - 6) / meses.length;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    for (var v = 0; v <= max; v += paso) {
      var y = H - pb - (v / max) * (H - pb - pt);
      s += '<line x1="' + pl + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#24314F" stroke-width="1"/>' +
        '<text x="' + (pl - 5) + '" y="' + (y + 3.5) + '" fill="#8A97B0" font-size="10" text-anchor="end">' + v + '</text>';
    }
    meses.forEach(function (m, i) {
      var x = pl + 4 + i * bw, w = bw - 6;
      var hf = m.fuel / max * (H - pb - pt), ht = m.taller / max * (H - pb - pt);
      var y0 = H - pb;
      if (hf > 0) s += '<rect x="' + x + '" y="' + (y0 - hf) + '" width="' + w + '" height="' + hf + '" rx="3" fill="#3EE7FF"/>';
      if (ht > 0) s += '<rect x="' + x + '" y="' + (y0 - hf - ht - (hf ? 1.5 : 0)) + '" width="' + w + '" height="' + ht + '" rx="3" fill="#FFB547"/>';
      s += '<text x="' + (x + w / 2) + '" y="' + (H - 7) + '" fill="' + (i === meses.length - 1 ? '#E8EEF9' : '#8A97B0') + '" font-size="10" text-anchor="middle">' + m.lbl + '</text>';
    });
    return s + '</svg>';
  }

  function lineaConsumo() {
    var pts = repostajesCalc().filter(function (r) { return r._c; }).slice(-15);
    if (pts.length < 2) return '<div class="empty small">Con 3 repostajes a depósito lleno verás aquí cómo cambia tu consumo.</div>';
    var W = 360, H = 170, pl = 34, pb = 20, pt = 14;
    var vs = pts.map(function (p) { return p._c; });
    var mn = Math.floor(Math.min.apply(null, vs) - 0.5), mx = Math.ceil(Math.max.apply(null, vs) + 0.5);
    var X = function (i) { return pl + 6 + i * (W - pl - 14) / (pts.length - 1); };
    var Y = function (v) { return H - pb - (v - mn) / (mx - mn) * (H - pb - pt); };
    var s = '<svg class="chart" style="height:170px" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    for (var v = mn; v <= mx; v++) s += '<line x1="' + pl + '" x2="' + W + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#24314F"/><text x="' + (pl - 5) + '" y="' + (Y(v) + 3.5) + '" fill="#8A97B0" font-size="10" text-anchor="end">' + v + '</text>';
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p._c).toFixed(1); }).join(' ');
    s += '<path d="' + d + ' L' + X(pts.length - 1) + ',' + (H - pb) + ' L' + X(0) + ',' + (H - pb) + ' Z" fill="rgba(62,231,255,.12)"/>';
    s += '<path d="' + d + '" fill="none" stroke="#3EE7FF" stroke-width="2.5" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) {
      s += '<circle cx="' + X(i) + '" cy="' + Y(p._c) + '" r="3.5" fill="#0B1220" stroke="#3EE7FF" stroke-width="2"/>';
      if (i === 0 || i === pts.length - 1 || i % 3 === 0) { var dd = fecha(p.date); s += '<text x="' + X(i) + '" y="' + (H - 5) + '" fill="#8A97B0" font-size="9.5" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '">' + dd.getDate() + ' ' + MESES[dd.getMonth()] + '</text>'; }
    });
    return s + '</svg>';
  }

  function pGastos() {
    var m = ultimosMeses(12), act = m[m.length - 1], ant = m[m.length - 2];
    var conDatos = m.filter(function (x) { return x.total > 0; });
    var media = conDatos.length ? conDatos.reduce(function (a, x) { return a + x.total; }, 0) / conDatos.length : NaN;
    var año = new Date().getFullYear(), tA = { fuel: 0, taller: 0 };
    D.fuel.forEach(function (r) { if (r.date.slice(0, 4) == año) tA.fuel += +r.total || 0; });
    D.services.forEach(function (s) { if (s.date.slice(0, 4) == año) tA.taller += +s.cost || 0; });
    var cm = consumoMedio(), kd = kmDia();
    var h = '<div class="cols"><div>' +
      '<div class="grid2" style="margin-bottom:12px">' +
      '<div class="stat"><div class="l">Este mes</div><div class="v">' + eur(act.total) + '</div><div class="small muted">⛽ ' + eur(act.fuel) + ' · 🔧 ' + eur(act.taller) + '</div></div>' +
      '<div class="stat"><div class="l">Mes pasado</div><div class="v">' + eur(ant.total) + '</div><div class="small muted">⛽ ' + eur(ant.fuel) + ' · 🔧 ' + eur(ant.taller) + '</div></div>' +
      '<div class="stat"><div class="l">Media al mes</div><div class="v">' + eur(media) + '</div></div>' +
      '<div class="stat"><div class="l">Total ' + año + '</div><div class="v">' + eur(tA.fuel + tA.taller) + '</div></div></div>' +
      '<div class="card"><h3><span>Gasto de los últimos 12 meses (€)</span></h3>' + barras(m) +
      '<div class="legend"><span><i style="background:#3EE7FF"></i>Combustible</span><span><i style="background:#FFB547"></i>Taller, ITV, seguro…</span></div></div>' +
      '</div><div>' +
      '<div class="card"><h3><span>Consumo real (L/100 km)</span><b style="color:var(--a1)">' + (isFinite(cm) ? n1(cm) : '') + '</b></h3>' + lineaConsumo() + '</div>' +
      '<div class="grid2">' +
      '<div class="stat"><div class="l">Km al mes</div><div class="v">≈ ' + n0(kd * 30.4) + '</div></div>' +
      '<div class="stat"><div class="l">Km al año</div><div class="v">≈ ' + n0(kd * 365) + '</div></div></div>' +
      '</div></div>';
    $('#v-gastos').innerHTML = h;
  }

  function pAjustes() {
    var c = D.car, s = D.set, dias = s.days.split(',');
    var ver = '';
    try { ver = A ? A.version() : 'web'; } catch (e) {}
    var notifOn = true;
    try { notifOn = A ? A.notificationsOn() : true; } catch (e) {}
    var h = '<div class="cols"><div>' +
      '<div class="card"><h3><span>🚗 Mi coche</span><button class="link" data-act="coche">Editar</button></h3>' +
      fila('Coche', esc(c.brand + ' ' + c.model)) + fila('Año', esc(c.year || '—')) + fila('Matrícula', esc(c.plate || '—')) +
      fila('Combustible', esc(c.fuel)) + fila('Depósito', (c.tank || '—') + ' L') + fila('Matriculado', fmtF(c.regDate)) + '</div>' +
      '<div class="card"><h3><span>🔔 Avisos</span></h3>' +
      (notifOn ? '' : '<div class="set-row" style="color:var(--red)"><span>Las notificaciones están desactivadas</span><button class="btn red" data-act="permNotif">Activar</button></div>') +
      '<div class="small muted" style="margin:2px 2px 8px">Avisarme estos días antes de que venza algo:</div>' +
      '<div class="chips" id="chDias">' + [60, 30, 15, 7, 3, 1].map(function (d) { return '<button data-d="' + d + '" class="' + (dias.indexOf(String(d)) >= 0 ? 'on' : '') + '">' + d + ' día' + (d > 1 ? 's' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="set-row" style="margin-top:6px"><span>Hora del aviso</span><select id="selHora" class="btn" style="padding:8px 12px">' +
      [7, 8, 9, 10, 12, 14, 17, 19, 21].map(function (h) { return '<option value="' + h + '"' + (+s.hour === h ? ' selected' : '') + '>' + pad(h) + ':00</option>'; }).join('') + '</select></div>' +
      '<div class="small muted" style="margin:4px 2px 10px">El mismo día y, si se pasa, cada 3 días hasta que lo marques como hecho.</div>' +
      '<button class="btn full" data-act="probar">🔔 Probar un aviso</button>' +
      '<div class="small muted" style="margin:10px 2px 0">En Xiaomi, para que los avisos lleguen con la app cerrada: mantén pulsado el icono de Pro Garaje → <b>Información de la app</b> → <b>Ahorro de batería</b> → <b>Sin restricciones</b>, y activa <b>Inicio automático</b>.</div></div>' +
      '</div><div>' +
      '<div class="card"><h3><span>💾 Copia de seguridad</span></h3>' +
      '<div class="small muted" style="margin:0 2px 10px">Tus datos se guardan solo en este móvil. Haz una copia de vez en cuando (se guarda en la carpeta <b>Descargas</b>) y súbela a Drive o mándatela por WhatsApp.</div>' +
      '<div class="grid2"><button class="btn" data-act="exportar">📤 Guardar copia</button><button class="btn" data-act="importar">📥 Restaurar</button></div></div>' +
      '<div class="card"><h3><span>ℹ️ La app</span></h3>' + fila('Versión', 'v' + esc(ver)) +
      '<button class="btn full" style="margin-top:8px" data-act="update">🔄 Buscar actualización</button></div>' +
      '</div></div>';
    $('#v-ajustes').innerHTML = h;
    $$('#chDias button').forEach(function (b) {
      b.onclick = function () {
        b.classList.toggle('on');
        D.set.days = $$('#chDias button.on').map(function (x) { return x.dataset.d; }).join(',') || '1';
        guardar();
      };
    });
    $('#selHora').onchange = function () { D.set.hour = +this.value; guardar(); toast('Avisos a las ' + pad(D.set.hour) + ':00'); };
  }
  function fila(a, b) { return '<div class="set-row"><span class="muted">' + a + '</span><span>' + b + '</span></div>'; }

  /* =================================================================
     VENTANAS (formularios)
     ================================================================= */
  function abrir(html) {
    $('#sheet').innerHTML = html;
    $('#modal').classList.remove('hide');
    $('#sheet').scrollTop = 0;
    var x = $('#sheet .x'); if (x) x.onclick = cerrar;
  }
  function cerrar() { $('#modal').classList.add('hide'); $('#sheet').innerHTML = ''; }
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') cerrar(); });

  function campo(id, label, val, type, extra) {
    type = type || 'text';
    var im = type === 'num' ? ' inputmode="decimal"' : '';
    return '<div class="f"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type === 'num' ? 'text' : type) + '"' + im +
      ' value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>';
  }
  function interruptor(id, label, on) {
    return '<label class="sw"><span>' + label + '</span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="t"></span></label>';
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }

  /* ----- Kilómetros ----- */
  function fKm() {
    abrir('<h2>🔢 Kilómetros del coche<button class="x">✕</button></h2>' +
      campo('fKm', 'Lo que marca el cuentakilómetros ahora', kmHoy() || '', 'num') +
      '<div class="btns"><button class="btn pri" id="ok">Guardar</button></div>');
    $('#fKm').focus();
    $('#ok').onclick = function () {
      var k = num(val('fKm'));
      if (!(k > 0)) return toast('Escribe los kilómetros');
      D.car.km = Math.round(k); D.car.kmDate = hoyISO(); guardar(); cerrar(); pintar(); toast('Kilómetros guardados');
    };
  }

  /* ----- Coche ----- */
  function fCoche() {
    var c = D.car;
    abrir('<h2>🚗 Mi coche<button class="x">✕</button></h2><div class="grid2">' +
      campo('cB', 'Marca', c.brand) + campo('cM', 'Modelo', c.model) +
      campo('cY', 'Año', c.year, 'num') + campo('cP', 'Matrícula', c.plate, 'text', ' style="text-transform:uppercase"') +
      '<div class="f"><label>Combustible</label><select id="cF">' + ['Diésel', 'Gasolina', 'Híbrido', 'GLP', 'Eléctrico'].map(function (x) { return '<option' + (x === c.fuel ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      campo('cT', 'Depósito (litros)', c.tank, 'num') + '</div>' +
      campo('cR', 'Fecha de matriculación (para calcular la ITV)', c.regDate, 'date') +
      '<div class="btns"><button class="btn pri" id="ok">Guardar</button></div>');
    $('#ok').onclick = function () {
      c.brand = val('cB'); c.model = val('cM'); c.year = parseInt(val('cY'), 10) || ''; c.plate = val('cP').toUpperCase();
      c.fuel = val('cF'); c.tank = num(val('cT')) || ''; c.regDate = val('cR');
      var itv = D.items.filter(function (i) { return i.kind === 'itv'; })[0];
      if (itv) itv.everyMonths = intervaloITV();
      guardar(); cerrar(); pintar(); toast('Datos del coche guardados');
    };
  }

  /* ----- Repostaje ----- */
  function fRepostaje(id) {
    var r = id ? D.fuel.filter(function (x) { return x.id === id; })[0] : null;
    var last = D.fuel.slice().sort(function (a, b) { return b.km - a.km; })[0];
    r = r || { date: hoyISO(), km: '', liters: '', price: last ? last.price : '', total: '', full: true, station: last ? last.station : '' };
    abrir('<h2>⛽ ' + (id ? 'Editar repostaje' : 'Nuevo repostaje') + '<button class="x">✕</button></h2>' +
      '<div class="grid2">' + campo('rD', 'Fecha', r.date, 'date') + campo('rK', 'Km del cuentakilómetros', r.km, 'num', ' placeholder="' + (kmHoy() ? '≈ ' + kmHoy() : '') + '"') + '</div>' +
      '<div class="grid3">' + campo('rL', 'Litros', r.liters, 'num') + campo('rP', '€ / litro', r.price, 'num') + campo('rT', 'Total €', r.total, 'num') + '</div>' +
      '<div class="hint small muted" style="margin:-4px 3px 8px">Rellena dos de los tres y el otro se calcula solo.</div>' +
      interruptor('rF', 'Depósito lleno <span class="small muted">(necesario para el consumo real)</span>', r.full) +
      campo('rS', 'Gasolinera (opcional)', r.station) +
      '<div class="btns">' + (id ? '<button class="btn red" id="del">Borrar</button>' : '') + '<button class="btn pri" id="ok">Guardar</button></div>');
    var calc = function (src) {
      var L = num(val('rL')), P = num(val('rP')), T = num(val('rT'));
      if (src !== 'rT' && L > 0 && P > 0) $('#rT').value = n2(L * P).replace(/\./g, '');
      else if (src === 'rT' && T > 0 && P > 0) $('#rL').value = n2(T / P).replace(/\./g, '');
      else if (src === 'rT' && T > 0 && L > 0) $('#rP').value = n3(T / L).replace(/\./g, '');
    };
    ['rL', 'rP', 'rT'].forEach(function (k) { $('#' + k).addEventListener('input', function () { calc(k); }); });
    if (id) $('#del').onclick = function () {
      if (!confirm('¿Borrar este repostaje?')) return;
      D.fuel = D.fuel.filter(function (x) { return x.id !== id; }); guardar(); cerrar(); pintar();
    };
    $('#ok').onclick = function () {
      var L = num(val('rL')), P = num(val('rP')), T = num(val('rT')), K = num(val('rK'));
      if (!(L > 0) && T > 0 && P > 0) L = T / P;
      if (!(T > 0) && L > 0 && P > 0) T = L * P;
      if (!(P > 0) && L > 0 && T > 0) P = T / L;
      if (!(L > 0) || !(T > 0)) return toast('Faltan los litros o el total');
      if (!(K > 0)) return toast('Escribe los km del cuentakilómetros');
      var o = { id: id || uid(), date: val('rD') || hoyISO(), km: Math.round(K), liters: +L.toFixed(2), price: +P.toFixed(3), total: +T.toFixed(2), full: chk('rF'), station: val('rS') };
      if (id) D.fuel = D.fuel.map(function (x) { return x.id === id ? o : x; }); else D.fuel.push(o);
      guardar(); cerrar(); pintar();
      var f = repostajesCalc().filter(function (x) { return x.id === o.id; })[0];
      toast(f && f._c ? 'Guardado · consumo ' + n1(f._c) + ' L/100 km' : 'Repostaje guardado');
    };
  }

  /* ----- Ficha de un mantenimiento ----- */
  function fItem(id) {
    var it = D.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var e = estado(it), x = it.x || {};
    var h = '<h2><span style="font-size:26px">' + it.icon + '</span>' + esc(it.name) + '<button class="x">✕</button></h2>';
    h += '<div class="card" style="background:var(--panel2)">' +
      '<div class="set-row"><span class="muted">Estado</span><span class="st-' + e.st + '"><span class="chip">' + e.txt + '</span></span></div>' +
      (e.dueDate ? fila(it.fixed ? 'Vence' : 'Toca por fecha', fmtFc(e.dueDate)) : '') +
      (e.dueKm !== null ? fila('Toca por km', n0(e.dueKm) + ' km (≈ ' + fmtFc(e.estDate) + ')') : '') +
      (it.lastDate ? fila('Último', fmtFc(it.lastDate) + (it.lastKm ? ' · ' + n0(it.lastKm) + ' km' : '')) : '') +
      (it.kind === 'seguro' && x.compania ? fila('Compañía', esc(x.compania)) : '') +
      (it.kind === 'seguro' && x.precio ? fila('Precio', eur(num(x.precio))) : '') +
      (it.kind === 'neumaticos' && x.medida ? fila('Medida', esc(x.medida)) : '') +
      '</div>';
    if (x.tel) h += '<button class="btn full" style="margin-bottom:10px" data-dial="' + esc(x.tel) + '">📞 Llamar ' + (it.kind === 'seguro' ? 'a asistencia' : '') + ' ' + esc(x.tel) + '</button>';
    h += '<div class="btns" style="margin-top:0"><button class="btn pri" id="hecho">✅ ' + (it.kind === 'seguro' ? 'Renovado' : it.kind === 'itv' ? 'ITV pasada' : 'Hecho') + '</button><button class="btn" id="edit">✏️ Ajustar</button></div>';
    abrir(h);
    $('#hecho').onclick = function () { fHecho(id); };
    $('#edit').onclick = function () { fEditItem(id); };
  }

  /* ----- Marcar como hecho (y apuntarlo en el historial) ----- */
  function fHecho(id) {
    var it = D.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var x = it.x || {};
    var meses = it.kind === 'itv' ? intervaloITV() : it.everyMonths;
    var sugerida = it.fixed && meses ? addMeses(hoyISO(), meses) : '';
    // ITV pasada hasta 30 días antes de su fecha: la siguiente cuenta desde la fecha original
    if (it.kind === 'itv' && it.dueDate) {
      var dd = (fecha(it.dueDate) - hoy0()) / DAY;
      if (dd >= 0 && dd <= 30) sugerida = addMeses(it.dueDate, meses);
    }
    // Seguro: la renovación cuenta desde el vencimiento anterior, no desde hoy
    if (it.kind === 'seguro' && it.dueDate) sugerida = addMeses(it.dueDate, 12);
    var h = '<h2>✅ ' + esc(it.name) + '<button class="x">✕</button></h2>' +
      '<div class="grid2">' + campo('hD', 'Fecha', hoyISO(), 'date') + campo('hK', 'Km', kmHoy() || '', 'num') + '</div>' +
      (it.fixed ? campo('hN', it.kind === 'seguro' ? 'Nuevo vencimiento' : 'Próxima ' + it.name, sugerida, 'date') : '') +
      '<div class="grid2">' + campo('hC', 'Lo que ha costado (€)', it.kind === 'seguro' ? (x.precio || '') : '', 'num') + campo('hP', it.kind === 'seguro' ? 'Compañía' : 'Taller / sitio', it.kind === 'seguro' ? (x.compania || '') : (it.kind === 'itv' ? x.estacion || '' : '')) + '</div>' +
      campo('hO', 'Nota (opcional)', '', 'text', ' placeholder="' + (it.kind === 'aceite' ? 'Ej. 5W30 + filtro' : it.kind === 'neumaticos' ? 'Ej. 4 Michelin delanteros y traseros' : '') + '"') +
      '<div class="btns"><button class="btn pri" id="ok">Guardar</button></div>';
    abrir(h);
    $('#ok').onclick = function () {
      var d = val('hD') || hoyISO(), k = num(val('hK')), c = num(val('hC'));
      D.services.push({ id: uid(), itemId: it.id, date: d, km: k > 0 ? Math.round(k) : null, cost: c > 0 ? +c.toFixed(2) : 0, place: val('hP'), note: val('hO') });
      it.lastDate = d; if (k > 0) it.lastKm = Math.round(k);
      if (it.fixed) it.dueDate = val('hN') || (meses ? addMeses(d, meses) : '');
      else it.dueDate = '';
      if (it.kind === 'seguro') { it.x.compania = val('hP') || x.compania; if (c > 0) it.x.precio = String(c); }
      if (it.kind === 'itv' && val('hP')) it.x.estacion = val('hP');
      guardar(); cerrar(); pintar(); toast('Apuntado en el historial');
    };
  }

  /* ----- Ajustar intervalos y datos ----- */
  function fEditItem(id) {
    var it = id ? D.items.filter(function (x) { return x.id === id; })[0] : null;
    var nuevoIt = !it;
    it = it || { id: uid(), kind: 'otro', name: '', icon: '🔧', everyMonths: 12, everyKm: 0, dueDate: '', lastDate: '', lastKm: null, on: true, x: {} };
    var x = it.x || {};
    var h = '<h2>' + (nuevoIt ? '＋ Nuevo mantenimiento' : '✏️ ' + esc(it.name)) + '<button class="x">✕</button></h2>';
    if (!it.kind || it.kind === 'otro') {
      h += campo('eN', 'Nombre', it.name) + '<div class="f"><label>Icono</label><div class="icons" id="eI">' +
        ICONOS.map(function (i) { return '<button data-i="' + i + '" class="' + (i === it.icon ? 'on' : '') + '">' + i + '</button>'; }).join('') + '</div></div>';
    }
    if (it.fixed) {
      h += campo('eV', it.kind === 'seguro' ? 'Fecha de vencimiento de la póliza' : it.kind === 'itv' ? 'Fecha de la próxima ITV (mírala en la pegatina)' : 'Próximo vencimiento', it.dueDate || estado(it).dueDate, 'date');
    } else {
      h += '<div class="grid2">' + campo('eLD', 'Último cambio (fecha)', it.lastDate, 'date') + campo('eLK', 'Último cambio (km)', it.lastKm, 'num') + '</div>';
    }
    h += '<div class="grid2">' + campo('eM', 'Cada cuántos meses', it.everyMonths || '', 'num', ' placeholder="0 = no"') +
      (it.fixed ? '' : campo('eK', 'Cada cuántos km', it.everyKm || '', 'num', ' placeholder="0 = no"')) + '</div>';
    if (it.kind === 'itv') h += '<div class="hint small muted" style="margin:-6px 3px 10px">Turismos: primera a los 4 años, cada 2 años hasta los 10, después cada año. Se ajusta sola con la fecha de matriculación.</div>' + campo('eS', 'Estación ITV habitual', x.estacion) + campo('eT', 'Teléfono para pedir cita', x.tel, 'tel');
    if (it.kind === 'seguro') h += '<div class="grid2">' + campo('eC', 'Compañía', x.compania) + campo('eP', 'Precio anual (€)', x.precio, 'num') + '</div>' + campo('eO', 'Nº de póliza', x.poliza) + campo('eT', 'Teléfono de asistencia en carretera', x.tel, 'tel');
    if (it.kind === 'aceite') h += campo('eA', 'Tipo de aceite', x.tipo, 'text', ' placeholder="Ej. 5W30 C3"');
    if (it.kind === 'neumaticos') h += '<div class="grid2">' + campo('eMd', 'Medida', x.medida, 'text', ' placeholder="Ej. 215/60 R17"') + campo('eMa', 'Marca / modelo', x.marca) + '</div>';
    h += interruptor('eOn', 'Avisarme', it.on);
    h += '<div class="btns">' + (!nuevoIt && it.kind === 'otro' ? '<button class="btn red" id="del">Borrar</button>' : '') + '<button class="btn pri" id="ok">Guardar</button></div>';
    abrir(h);
    $$('#eI button').forEach(function (b) { b.onclick = function () { $$('#eI button').forEach(function (z) { z.classList.remove('on'); }); b.classList.add('on'); }; });
    if ($('#del')) $('#del').onclick = function () {
      if (!confirm('¿Borrar «' + it.name + '»? El historial se mantiene.')) return;
      D.items = D.items.filter(function (z) { return z.id !== it.id; }); guardar(); cerrar(); pintar();
    };
    $('#ok').onclick = function () {
      if ($('#eN')) { it.name = val('eN'); if (!it.name) return toast('Ponle un nombre'); }
      var ic = $('#eI button.on'); if (ic) it.icon = ic.dataset.i;
      it.everyMonths = parseInt(val('eM'), 10) || 0;
      if ($('#eK')) it.everyKm = Math.round(num(val('eK'))) || 0;
      if (it.fixed) { it.dueDate = val('eV'); }
      else { it.lastDate = val('eLD'); var lk = num(val('eLK')); it.lastKm = lk >= 0 ? Math.round(lk) : null; it.dueDate = ''; }
      it.x = it.x || {};
      if (it.kind === 'itv') { it.x.estacion = val('eS'); it.x.tel = val('eT'); }
      if (it.kind === 'seguro') { it.x.compania = val('eC'); it.x.precio = val('eP'); it.x.poliza = val('eO'); it.x.tel = val('eT'); }
      if (it.kind === 'aceite') it.x.tipo = val('eA');
      if (it.kind === 'neumaticos') { it.x.medida = val('eMd'); it.x.marca = val('eMa'); }
      it.on = chk('eOn');
      if (nuevoIt) D.items.push(it);
      guardar(); cerrar(); pintar(); toast('Guardado');
    };
  }

  function fNuevoItem() {
    abrir('<h2>＋ Añadir mantenimiento<button class="x">✕</button></h2><div class="tpl">' +
      PLANTILLAS.map(function (p, i) { return '<button data-tpl="' + i + '">' + p.icon + ' ' + p.name + '</button>'; }).join('') +
      '<button data-tpl="-1">✏️ Otro (a mi manera)</button></div>');
    $$('[data-tpl]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.tpl;
        if (i < 0) return fEditItem(null);
        var p = PLANTILLAS[i];
        var it = { id: uid(), kind: 'otro', name: p.name, icon: p.icon, everyMonths: p.everyMonths, everyKm: p.everyKm, fixed: !!p.fixed, dueDate: '', lastDate: '', lastKm: null, on: true, x: {} };
        D.items.push(it); guardar(); fEditItem(it.id);
      };
    });
  }

  /* ----- Apunte de taller suelto ----- */
  function fTaller(sid) {
    var s = sid ? D.services.filter(function (x) { return x.id === sid; })[0] : null;
    if (!sid) {
      // Primero elegir qué se ha hecho
      abrir('<h2>🔧 ¿Qué le has hecho?<button class="x">✕</button></h2><div class="tpl">' +
        D.items.map(function (it) { return '<button data-h="' + it.id + '">' + it.icon + ' ' + esc(it.name) + '</button>'; }).join('') +
        '<button data-h="">🧾 Otro gasto (avería, lavado…)</button></div>');
      $$('[data-h]').forEach(function (b) { b.onclick = function () { b.dataset.h ? fHecho(b.dataset.h) : fTaller('nuevo'); }; });
      return;
    }
    s = s || { id: uid(), itemId: '', name: '', date: hoyISO(), km: kmHoy() || '', cost: '', place: '', note: '' };
    var it = D.items.filter(function (i) { return i.id === s.itemId; })[0];
    abrir('<h2>🧾 ' + (it ? esc(it.name) : 'Gasto de taller') + '<button class="x">✕</button></h2>' +
      (it ? '' : campo('sN', 'Qué ha sido', s.name, 'text', ' placeholder="Ej. Cambio de bombillas, avería, lavado"')) +
      '<div class="grid2">' + campo('sD', 'Fecha', s.date, 'date') + campo('sK', 'Km', s.km, 'num') + campo('sC', 'Coste (€)', s.cost, 'num') + campo('sP', 'Taller / sitio', s.place) + '</div>' +
      campo('sO', 'Nota', s.note) +
      '<div class="btns">' + (sid !== 'nuevo' ? '<button class="btn red" id="del">Borrar</button>' : '') + '<button class="btn pri" id="ok">Guardar</button></div>');
    if ($('#del')) $('#del').onclick = function () {
      if (!confirm('¿Borrar este apunte?')) return;
      D.services = D.services.filter(function (x) { return x.id !== s.id; }); guardar(); cerrar(); pintar();
    };
    $('#ok').onclick = function () {
      if ($('#sN')) s.name = val('sN') || 'Taller';
      s.date = val('sD') || hoyISO(); var k = num(val('sK')); s.km = k > 0 ? Math.round(k) : null;
      var c = num(val('sC')); s.cost = c > 0 ? +c.toFixed(2) : 0; s.place = val('sP'); s.note = val('sO');
      if (sid === 'nuevo') D.services.push(s);
      guardar(); cerrar(); pintar(); toast('Guardado');
    };
  }

  /* ----- Copia de seguridad ----- */
  function exportar() {
    var txt = JSON.stringify(D, null, 1), name = 'ProGaraje-copia-' + hoyISO() + '.json';
    if (A && A.exportBackup) {
      var ok = false; try { ok = A.exportBackup(name, txt); } catch (e) {}
      toast(ok ? 'Copia guardada en Descargas: ' + name : 'No se pudo guardar la copia');
    } else {
      var a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(txt); a.download = name; a.click();
    }
  }

  /* =================================================================
     EVENTOS
     ================================================================= */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-act],[data-item],[data-fuel],[data-serv],[data-dial]');
    if (!t) return;
    if (t.dataset.tab) return irA(t.dataset.tab);
    if (t.dataset.item) return fItem(t.dataset.item);
    if (t.dataset.fuel) return fRepostaje(t.dataset.fuel);
    if (t.dataset.dial) { if (A) A.dial(t.dataset.dial); return; }
    if (t.dataset.serv) {
      var s = D.services.filter(function (x) { return x.id === t.dataset.serv; })[0];
      return fTaller(s ? s.id : null);
    }
    switch (t.dataset.act) {
      case 'repostar': return fRepostaje(null);
      case 'taller': return fTaller(null);
      case 'km': return fKm();
      case 'coche': return fCoche();
      case 'nuevoItem': return fNuevoItem();
      case 'probar': if (A) A.testNotification(); else toast('Solo en el móvil'); return;
      case 'permNotif': if (A) A.openNotificationSettings(); return;
      case 'exportar': return exportar();
      case 'importar': if (A) A.importBackup(); return;
      case 'update': if (A) A.checkUpdate(); return;
    }
  });

  /* ---------- API para Android ---------- */
  window.PG = {
    toast: toast,
    back: function () {
      if (!$('#modal').classList.contains('hide')) { cerrar(); return true; }
      if (tab !== 'inicio') { irA('inicio'); return true; }
      return false;
    },
    onResume: function () { pintar(); enviarAvisos(); },
    onImport: function (txt) {
      try {
        var o = JSON.parse(txt);
        if (!o || !o.car || !o.items) throw 0;
        if (!confirm('¿Restaurar esta copia? Se sustituirán los datos actuales (' + (o.fuel || []).length + ' repostajes, ' + (o.services || []).length + ' apuntes de taller).')) return;
        D = o; guardar(); cargar(); pintar(); toast('Copia restaurada');
      } catch (e) { toast('Ese archivo no es una copia de Pro Garaje'); }
    }
  };

  function reloj() {
    var d = new Date(); $('#clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  cargar();
  var itv0 = D.items.filter(function (i) { return i.kind === 'itv'; })[0];
  if (itv0 && D.car.regDate) itv0.everyMonths = intervaloITV();
  reloj(); setInterval(reloj, 15000);
  irA('inicio');
  enviarAvisos();
})();
