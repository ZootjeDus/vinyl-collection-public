/* Vinyl collection browser - no build step, no dependencies. */
(function () {
  'use strict';

  var DATA = window.COLLECTION_DATA || { items: [] };
  var ALL = DATA.items || [];
  var PAGE = 150;
  var state = {
    q: '',
    kind: [],
    genre: [],
    decade: [],
    rating: 0,
    exclusive: 'all',
    price: 'all',
    sort: 'artist',
    view: 'list',
    shown: PAGE
  };

  var filtered = [];
  var els = {};

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function text(v) { return v === null || v === undefined ? '' : String(v); }

  function esc(v) {
    return text(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function stars(n) { return n ? '\u2605'.repeat(n) : ''; }

  var collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

  /* ---------- search index ---------- */

  ALL.forEach(function (it) {
    it._hay = [it.artist, it.title, it.label, it.catalog, it.format, it.year,
      it.genre, it.kind, it.country]
      .join(' ').toLowerCase();
  });

  /* ---------- filtering ---------- */

  function matches(it) {
    if (state.q && it._hay.indexOf(state.q) === -1) return false;
    if (state.kind.length && state.kind.indexOf(it.kind) === -1) return false;
    if (state.genre.length && state.genre.indexOf(it.genre) === -1) return false;
    if (state.decade.length && state.decade.indexOf(String(it.decade)) === -1) return false;
    if (state.rating && (it.rating || 0) < state.rating) return false;
    return true;
  }

  var sorters = {
    artist: function (a, b) { return collator.compare(a.sortName, b.sortName) || collator.compare(a.title, b.title); },
    'artist-desc': function (a, b) { return -collator.compare(a.sortName, b.sortName); },
    title: function (a, b) { return collator.compare(a.title, b.title); },
    'year-asc': function (a, b) { return (a.year || 9999) - (b.year || 9999); },
    'year-desc': function (a, b) { return (b.year || 0) - (a.year || 0); },
    rating: function (a, b) { return (b.rating || 0) - (a.rating || 0) || collator.compare(a.sortName, b.sortName); },
    label: function (a, b) { return collator.compare(a.label, b.label); }
  };

  function apply() {
    filtered = ALL.filter(matches).sort(sorters[state.sort] || sorters.artist);
    state.shown = PAGE;
    render();
    renderChips();
  }

  /* ---------- rendering ---------- */

  function rowHtml(it, i) {
    return '<tr data-i="' + i + '">' +
      '<td class="artist">' + esc(it.artist) + '</td>' +
      '<td class="title">' + esc(it.title) +
      '</td>' +
      '<td class="dim">' + esc(it.label) + '</td>' +
      '<td class="dim">' + esc(it.kind) + (it.size ? ' ' + esc(it.size) : '') + '</td>' +
      '<td class="dim">' + esc(it.genre) + '</td>' +
      '<td class="num">' + esc(it.year) + '</td>' +
      '<td class="num stars">' + stars(it.rating) + '</td>' +
      '<td class="dim">' + esc(it.country) + '</td>' +
      '</tr>';
  }

  function cardHtml(it, i) {
    var art = it.thumb || it.cover;
    return '<div class="card" data-i="' + i + '">' +
      '<div class="art">' +
      (art ? '<img loading="lazy" src="' + esc(art) + '" alt="">' : '\u266a') +
      '</div>' +
      '<div class="ca">' + esc(it.artist) + '</div>' +
      '<div class="ct">' + esc(it.title) + '</div>' +
      '<div class="cy">' + esc(it.year) + (it.size ? ' &middot; ' + esc(it.size) : '') + '</div>' +
      '</div>';
  }

  function render() {
    var slice = filtered.slice(0, state.shown);
    var html;

    if (!filtered.length) {
      html = '<div class="empty">Nothing matches these filters.</div>';
    } else if (state.view === 'grid') {
      html = '<div class="grid">' + slice.map(cardHtml).join('') + '</div>';
    } else {
      html = '<table class="list"><thead><tr>' +
        '<th>Artist</th><th>Title</th><th>Label</th><th>Type</th><th>Genre</th>' +
        '<th>Year</th><th>Rating</th><th>Country</th></tr></thead><tbody>' +
        slice.map(rowHtml).join('') + '</tbody></table>';
    }

    els.results.innerHTML = html;
    els.count.textContent = filtered.length.toLocaleString('nl-NL') + ' of ' +
      ALL.length.toLocaleString('nl-NL') + ' records' +
      (state.shown < filtered.length ? ' \u2014 showing first ' + state.shown : '');
  }

  function loadMore() {
    if (state.shown >= filtered.length) return;
    state.shown += PAGE;
    render();
  }

  /* ---------- filter chips ---------- */

  var facets = [
    { key: 'kind', el: 'f-kind', get: function (it) { return it.kind; } },
    { key: 'genre', el: 'f-genre', get: function (it) { return it.genre; } },
    { key: 'decade', el: 'f-decade', get: function (it) { return it.decade ? String(it.decade) : null; } },
  ];

  function renderChips() {
    facets.forEach(function (f) {
      // Count against everything except this facet's own selection, so counts stay useful.
      var saved = state[f.key];
      state[f.key] = [];
      var pool = ALL.filter(matches);
      state[f.key] = saved;

      var counts = {};
      pool.forEach(function (it) {
        var v = f.get(it);
        if (v !== null && v !== undefined && v !== '') counts[v] = (counts[v] || 0) + 1;
      });

      var keys = Object.keys(counts).sort(function (a, b) {
        if (f.key === 'decade') return Number(a) - Number(b);
        return counts[b] - counts[a] || collator.compare(a, b);
      });

      $(f.el).innerHTML = keys.map(function (k) {
        var on = saved.indexOf(k) !== -1;
        var lbl = f.key === 'decade' ? k + 's' : k;
        return '<button class="chip' + (on ? ' on' : '') + '" data-facet="' + f.key +
          '" data-val="' + esc(k) + '">' + esc(lbl) + '<span class="n">' + counts[k] + '</span></button>';
      }).join('');

      // Hide facets that have nothing to offer.
      $(f.el).parentElement.hidden = keys.length < 2 && !saved.length;
    });

    var active = facets.reduce(function (n, f) { return n + state[f.key].length; }, 0);
    els.activeFilters.textContent = active ? active + ' filter' + (active > 1 ? 's' : '') + ' active' : '';
  }

  /* ---------- detail panel ---------- */

  function row(label, value) {
    return value ? '<dt>' + esc(label) + '</dt><dd>' + value + '</dd>' : '';
  }

  function openDetail(it) {
    var art = it.cover || it.thumb;
    var html = '<h3>' + esc(it.title) + '</h3>' +
      '<p class="d-artist">' + esc(it.artist) + '</p>' +
      (art ? '<img class="d-art" src="' + esc(art) + '" alt="">' : '') +
      '<dl>' +
      row('Year', esc(it.year)) +
      row('Label', esc(it.label)) +
      row('Catalogue #', esc(it.catalog)) +
      row('Format', esc(it.format)) +
      row('Genre', esc(it.genre)) +
      row('Discogs genres', it.genres ? esc([].concat(it.genres).join(', ')) : '') +
      row('Styles', it.styles ? esc([].concat(it.styles).join(', ')) : '') +
      row('Country', esc(it.country)) +
      row('Rating', it.rating ? '<span class="stars">' + stars(it.rating) + '</span>' : '') +
      '</dl>';

    if (it.id) {
      html += '<p><a href="https://www.discogs.com/release/' + encodeURIComponent(it.id) +
        '" target="_blank" rel="noopener noreferrer">View on Discogs \u2197</a></p>';
    }

    $('detail-body').innerHTML = html;
    els.detail.hidden = false;
    els.detail.setAttribute('aria-hidden', 'false');
  }

  function closeDetail() {
    els.detail.hidden = true;
    els.detail.setAttribute('aria-hidden', 'true');
  }

  /* ---------- CSV export ---------- */

  function exportCsv() {
    var cols = ['artist', 'title', 'label', 'catalog', 'format', 'year', 'rating',
      'genre', 'kind', 'id'];
    var lines = [cols.join(',')];
    filtered.forEach(function (it) {
      lines.push(cols.map(function (c) {
        var v = text(it[c]);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vinyl-selection.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- wiring ---------- */

  function init() {
    els.results = $('results');
    els.count = $('result-count');
    els.activeFilters = $('active-filters');
    els.detail = $('detail');

    $('subtitle').textContent = ALL.length.toLocaleString('nl-NL') + ' records';

    var debounce;
    $('search').addEventListener('input', function (e) {
      var v = e.target.value.trim().toLowerCase();
      $('clear-search').hidden = !v;
      clearTimeout(debounce);
      debounce = setTimeout(function () { state.q = v; apply(); }, 150);
    });

    $('clear-search').addEventListener('click', function () {
      $('search').value = '';
      $('clear-search').hidden = true;
      state.q = '';
      apply();
    });

    $('sort').addEventListener('change', function (e) { state.sort = e.target.value; apply(); });
    $('f-rating').addEventListener('change', function (e) { state.rating = Number(e.target.value); apply(); });
    $('export-csv').addEventListener('click', exportCsv);

    $('reset-filters').addEventListener('click', function () {
      facets.forEach(function (f) { state[f.key] = []; });
      state.rating = 0;
      $('f-rating').value = '0';
      apply();
    });

    $('filters').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var list = state[chip.dataset.facet];
      var i = list.indexOf(chip.dataset.val);
      if (i === -1) { list.push(chip.dataset.val); } else { list.splice(i, 1); }
      apply();
    });

    document.querySelectorAll('.view-toggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.view-toggle button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.view = btn.dataset.view;
        render();
      });
    });

    els.results.addEventListener('click', function (e) {
      var target = e.target.closest('[data-i]');
      if (target) openDetail(filtered[Number(target.dataset.i)]);
    });

    els.results.addEventListener('scroll', function () {
      if (els.results.scrollTop + els.results.clientHeight > els.results.scrollHeight - 400) loadMore();
    });

    $('detail-close').addEventListener('click', closeDetail);
    els.detail.addEventListener('click', function (e) { if (e.target === els.detail) closeDetail(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

    apply();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
