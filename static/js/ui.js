/* Day/night toggle and the phone menu. */
(function () {
  /* ---- day/night: every click visibly flips ----
   *
   * A click always flips to the opposite of what's on screen. If that opposite
   * matches the system setting, the stored override is cleared instead of
   * saved, so flipping back to match your device quietly returns you to auto.
   * The clock never picks the theme: the reader's own setting does.
   *
   * There are two copies of the button (header, and inside the phone menu);
   * both are kept in step. Each is named for what it will do ("Switch to
   * night"), and the menu copy shows those words too.
   */
  var KEY = 'mm-theme';
  var toggles = Array.prototype.slice.call(document.querySelectorAll('[data-theme-toggle]'));
  if (toggles.length) {
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    var system = function () { return mq && mq.matches ? 'dark' : 'light'; };
    var stored = function () {
      try {
        var v = localStorage.getItem(KEY);
        return (v === 'light' || v === 'dark') ? v : null;
      } catch (e) { return null; }
    };
    var effective = function () { return stored() || system(); };

    var sync = function () {
      var label = effective() === 'dark' ? 'Switch to day' : 'Switch to night';
      toggles.forEach(function (b) {
        b.setAttribute('aria-label', label);
        var text = b.querySelector('[data-theme-label]');
        if (text) text.textContent = label;
      });
    };

    var set = function (mode) {
      var auto = mode === system();
      if (auto) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      try {
        if (auto) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch (e) {}
      sync();
    };

    sync();
    toggles.forEach(function (b) {
      b.addEventListener('click', function () {
        set(effective() === 'dark' ? 'light' : 'dark');
      });
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', sync);
  }

  /* ---- phone menu ----
   *
   * Opens the navigation full screen under the header. Escape, a second tap,
   * following a link, or widening the window past the breakpoint all close it,
   * and focus goes back to the button so keyboard users don't get lost.
   */
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.getElementById('site-nav');
  var head = document.querySelector('.site-head');
  if (toggle && nav) {
    var body = document.body;
    var wide = window.matchMedia ? window.matchMedia('(min-width: 48rem)') : null;

    var open = function () {
      if (head) document.documentElement.style.setProperty('--head-h', head.getBoundingClientRect().bottom + 'px');
      body.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      var first = nav.querySelector('a');
      if (first) first.focus();
    };
    var close = function (refocus) {
      body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (refocus) toggle.focus();
    };

    toggle.addEventListener('click', function () {
      if (body.classList.contains('nav-open')) close(true); else open();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('nav-open')) close(true);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close(false);
    });
    if (wide && wide.addEventListener) {
      wide.addEventListener('change', function (e) { if (e.matches) close(false); });
    }
  }

  /* ---- course drawer (episode pages) ----
   *
   * It's a <details>, open in the HTML so it works with scripts off. On a
   * phone it starts closed, a one-line "Lesson 5 · Cloud Hands" with the stalk
   * on its side. On a wide screen it's the sidebar: held open, summary hidden.
   */
  var drawer = document.querySelector('[data-course-drawer]');
  if (drawer && window.matchMedia) {
    var desk = window.matchMedia('(min-width: 64rem)');
    var fit = function () { drawer.open = desk.matches; };
    fit();
    if (desk.addEventListener) desk.addEventListener('change', fit);
  }

  /* ---- streaming video where the browser can't play it itself ----
   *
   * Micro.blog turns an uploaded video into a streaming playlist (.m3u8).
   * Safari, iPhones, Android and Chrome/Edge 142+ play those natively; desktop
   * Firefox and older Chrome need hls.js to play the same playlist.
   *
   * Micro.blog's "Video streaming" plug-in (installed automatically with a
   * first video upload) also does this, but starts downloading every video,
   * the hero loop included, the moment the page opens. So the theme does it
   * instead, and lets the plug-in stand by:
   *   - this script runs before the plug-in's, and takes each playlist this
   *     browser can't play (the address moves to data-stream), so the plug-in
   *     finds nothing to do;
   *   - if the plug-in's hls.js is on the page, that copy is used; if not,
   *     the theme's own (js/vendor/hls.light.min.js, Apache-2.0, LICENSE
   *     beside it), fetched only by browsers that need it, only on a page
   *     that has such a video.
   *
   * Until the reader presses play, only the playlist's short table of
   * contents is read; the video itself waits, as preload="metadata" would.
   * capLevelToPlayerSize keeps a small player from fetching 1080p.
   */
  var HLS_TYPE = 'application/vnd.apple.mpegurl';
  var HLS_JS = 'vendor/hls.light.min.js?v=1.7.3';
  var uiScript = document.currentScript || document.querySelector('script[src*="ui.js"]');
  var canStream = !!(window.MediaSource || window.ManagedMediaSource) && typeof Promise === 'function';

  // where a <video> gets its source: itself, or its first <source>
  var sourceEl = function (video) {
    return video.hasAttribute('src') ? video : video.querySelector('source[src]');
  };
  var needsHls = function (video) {
    var el = sourceEl(video);
    if (!el) return false;
    var isPlaylist = /\.m3u8(\?|#|$)/i.test(el.getAttribute('src')) || /mpegurl/i.test(el.getAttribute('type') || '');
    return isPlaylist && !video.canPlayType(HLS_TYPE);
  };
  var claim = function (video) {
    var el = sourceEl(video);
    video.setAttribute('data-stream', el.getAttribute('src'));
    el.removeAttribute('src');
  };

  var hlsLib = null;
  var loadHls = function () {
    if (!hlsLib) hlsLib = new Promise(function (resolve, reject) {
      // wait for the page's other deferred scripts, so a plug-in's copy is there
      // to find. (A deferred script runs while readyState is already
      // "interactive", so only "complete" means they've all run.)
      var looked = false;
      var find = function () {
        if (looked) return;
        looked = true;
        if (window.Hls) { resolve(window.Hls); return; }
        var s = document.createElement('script');
        s.src = new URL(HLS_JS, uiScript ? uiScript.src : location.href).href;
        s.onload = function () { if (window.Hls) resolve(window.Hls); else reject(new Error('hls.js')); };
        s.onerror = function () { reject(new Error('hls.js')); };
        document.head.appendChild(s);
      };
      if (document.readyState === 'complete') find();
      else {
        document.addEventListener('DOMContentLoaded', find);
        window.addEventListener('load', find);
      }
    });
    return hlsLib;
  };

  // hls.js on a claimed <video>, once; resolves when attached, rejects if it can't be
  var stream = function (video) {
    if (!video.mmStream) video.mmStream = loadHls().then(function (Hls) {
      if (!Hls.isSupported()) throw new Error('hls.js unsupported');
      var hls = new Hls({ autoStartLoad: false, capLevelToPlayerSize: true });
      var parsed = false, wanted = false, recovered = false;
      var go = function () { if (parsed && wanted) hls.startLoad(); };
      hls.on(Hls.Events.MANIFEST_PARSED, function () { parsed = true; go(); });
      hls.on(Hls.Events.ERROR, function (e, data) {
        // one try at getting past a decoding hiccup; network retries are hls.js's own
        if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
        }
      });
      video.addEventListener('play', function () { if (!wanted) { wanted = true; go(); } });
      hls.loadSource(video.getAttribute('data-stream'));
      hls.attachMedia(video);
      return hls;
    });
    return video.mmStream;
  };

  if (canStream) {
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      if (!needsHls(v)) return;
      claim(v);
      // lesson videos get ready now; the hero only if and when it plays (below)
      if (!v.hasAttribute('data-hero-video')) stream(v).catch(function () {});
    });
  }

  /* ---- home hero loop ----
   *
   * The <video> has no autoplay attribute. It starts here, and only when
   *   - the reader hasn't asked their device for less motion,
   *   - their phone isn't saving data (Data Saver, or a 2G connection), and
   *   - they didn't pause it on an earlier visit.
   * Otherwise the poster still shows and the video never downloads.
   *
   * The pause/play button (WCAG 2.2.2) appears whenever there's a video, so
   * a reader who got the still can choose to play it. A pause is remembered
   * on this device ("mm-hero"); pressing play again forgets it.
   */
  var hero = document.querySelector('[data-hero-video]');
  // A streaming playlist (.m3u8, what Micro.blog makes of an uploaded video)
  // plays natively or through hls.js (above). If this browser can play the
  // source neither way, the still is all there is: no download, and no play
  // button that would do nothing.
  var heroSource = hero && hero.querySelector('source');
  var heroType = heroSource && heroSource.getAttribute('type');
  var heroHls = !!hero && hero.hasAttribute('data-stream');   // claimed above
  if (hero && !heroHls && (needsHls(hero) || heroType && !hero.canPlayType(heroType))) hero = null;
  if (hero) {
    var HKEY = 'mm-hero';
    var heroBtn = document.querySelector('[data-hero-toggle]');
    var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var thrifty = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
    var heroPlaying = false;

    var pausedBefore = function () {
      try { return localStorage.getItem(HKEY) === 'paused'; } catch (e) { return false; }
    };
    var remember = function (paused) {
      try {
        if (paused) localStorage.setItem(HKEY, 'paused');
        else localStorage.removeItem(HKEY);
      } catch (e) {}
    };
    var syncHero = function () {
      hero.classList.toggle('is-playing', heroPlaying);
      if (!heroBtn) return;
      heroBtn.setAttribute('aria-label', heroPlaying ? 'Pause the background video' : 'Play the background video');
      heroBtn.classList.toggle('is-paused', !heroPlaying);
    };
    var playHero = function () {
      hero.preload = 'auto';
      var started = function () { heroPlaying = true; syncHero(); };
      var stopped = function () { heroPlaying = false; syncHero(); };
      var play = function () {
        var p = hero.play();
        if (p && p.then) p.then(started, stopped);
        else started();
      };
      if (!heroHls) { play(); return; }
      // hls.js arrives on the first play; if it can't (blocked, offline), the
      // still stays and the button goes, since it would do nothing
      stream(hero).then(play, function () {
        stopped();
        if (heroBtn) heroBtn.hidden = true;
      });
    };
    var pauseHero = function () {
      hero.pause();
      heroPlaying = false;
      syncHero();
    };

    if (heroBtn) {
      heroBtn.hidden = false;
      heroBtn.addEventListener('click', function () {
        if (heroPlaying) { pauseHero(); remember(true); }
        else { remember(false); playHero(); }
      });
    }

    if (!(calm && calm.matches) && !thrifty && !pausedBefore()) playHero();
    else syncHero();

    if (calm && calm.addEventListener) {
      calm.addEventListener('change', function (e) { if (e.matches) pauseHero(); });
    }
  }

  /* ---- notice band: gone once its Until day has passed ----
   * Hugo only rebuilds when you post, so the build can't be trusted to take a
   * notice down on time. The date is compared in the reader's own time zone.
   */
  var notice = document.querySelector('.notice[data-until]');
  if (notice) {
    var u = notice.getAttribute('data-until').split('-');
    var endOfDay = new Date(+u[0], +u[1] - 1, +u[2], 23, 59, 59);
    if (new Date() > endOfDay) notice.hidden = true;
  }

  /* ---- next class ----
   * The Classes page is read at build time into [{day, h, m, label, where, i}].
   * Here, in the reader's browser, the soonest upcoming one is picked. Every
   * "Class times" link that carries the data becomes "Next class · …", and on
   * the Classes page itself that class is marked.
   */
  var nextOf = function (list) {
    var now = new Date();
    var best = null;
    list.forEach(function (c) {
      var at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), c.h, c.m, 0);
      at.setDate(at.getDate() + ((c.day - now.getDay() + 7) % 7));
      if (at <= now) at.setDate(at.getDate() + 7);
      if (!best || at < best.at) best = { at: at, c: c };
    });
    return best;
  };
  var parse = function (el, attr) {
    try { return JSON.parse(el.getAttribute(attr)) || []; } catch (e) { return []; }
  };

  Array.prototype.forEach.call(document.querySelectorAll('[data-next-class]'), function (link) {
    var best = nextOf(parse(link, 'data-next-class'));
    if (!best) return;
    var today = new Date();
    var days = Math.round((new Date(best.at.getFullYear(), best.at.getMonth(), best.at.getDate()) -
      new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
    var when = days === 0 ? 'Today, ' + best.c.label.replace(/^\S+\s+/, '') :
               days === 1 ? 'Tomorrow, ' + best.c.label.replace(/^\S+\s+/, '') : best.c.label;
    link.textContent = 'Next class · ' + when + ' · ' + best.c.where;
  });

  var classesPage = document.querySelector('[data-classes]');
  if (classesPage) {
    var best = nextOf(parse(classesPage, 'data-classes'));
    var items = classesPage.querySelectorAll('.entry-body li');
    if (best && items[best.c.i]) {
      items[best.c.i].classList.add('is-next');
      var tag = document.createElement('span');
      tag.className = 'next-tag';
      tag.textContent = 'Next';
      items[best.c.i].insertBefore(tag, items[best.c.i].firstChild);
    }
  }

  /* ---- video tabs (episodes) ----
   * When a post has two or more videos, each under its own heading, the
   * videos become tabs labelled by those headings. Text under a video's
   * heading stays in that tab; a heading with no video after it (say "Key
   * points") ends the tabs, so the write-up sits below them. Without scripts
   * it's simply the headings and videos in order.
   *
   * Follows the WAI-ARIA tabs pattern: arrow keys, Home/End, roving tabindex.
   * A link to #up-to-here (or any tab's heading) opens that tab.
   */
  var isVideo = function (el) {
    return el && (el.matches('iframe, video') || !!el.querySelector('iframe, video'));
  };
  Array.prototype.forEach.call(document.querySelectorAll('.episode-body'), function (body, bi) {
    var kids = Array.prototype.slice.call(body.children);
    var groups = [];
    var open = false;   // collecting into the current tab
    var done = false;   // a heading without a video ended the tabs
    kids.forEach(function (el, k) {
      if (done) return;
      var isHead = /^H[23]$/.test(el.tagName);
      if (isHead && isVideo(kids[k + 1])) {
        groups.push({ head: el, els: [] });
        open = true;
      } else if (isHead) {
        if (groups.length) done = true;
      } else if (open) {
        groups[groups.length - 1].els.push(el);
      }
    });
    if (groups.length < 2) return;

    var wrap = document.createElement('div');
    wrap.className = 'video-tabs';
    var list = document.createElement('div');
    list.className = 'video-tablist';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Video segments');
    body.insertBefore(wrap, groups[0].head);
    wrap.appendChild(list);

    var tabs = groups.map(function (g, n) {
      var id = g.head.id || ('segment-' + bi + '-' + n);
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'video-tab';
      tab.id = 'tab-' + id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'panel-' + id);
      tab.setAttribute('data-tinylytics-event', 'lesson.tab');
      tab.setAttribute('data-tinylytics-event-value', g.head.textContent.trim());
      tab.textContent = g.head.textContent.trim();
      list.appendChild(tab);

      var panel = document.createElement('div');
      panel.className = 'video-panel';
      panel.id = 'panel-' + id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      g.head.classList.add('visually-hidden');
      panel.appendChild(g.head);
      g.els.forEach(function (el) { panel.appendChild(el); });
      wrap.appendChild(panel);
      return { tab: tab, panel: panel, id: id };
    });

    var select = function (n, focus) {
      tabs.forEach(function (t, k) {
        var on = k === n;
        t.tab.setAttribute('aria-selected', String(on));
        t.tab.tabIndex = on ? 0 : -1;
        t.panel.hidden = !on;
        if (!on) {
          // stop a playing <video>; an iframe player is reset by reloading it
          Array.prototype.forEach.call(t.panel.querySelectorAll('video'), function (v) { v.pause(); });
        }
      });
      if (focus) tabs[n].tab.focus();
    };
    tabs.forEach(function (t, n) {
      t.tab.addEventListener('click', function () { select(n, false); });
      t.tab.addEventListener('keydown', function (e) {
        var to = null;
        if (e.key === 'ArrowRight') to = (n + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') to = (n - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = tabs.length - 1;
        if (to !== null) { e.preventDefault(); select(to, true); }
      });
    });

    var fromHash = function () {
      var h = decodeURIComponent((location.hash || '').slice(1));
      for (var k = 0; k < tabs.length; k++) {
        if (tabs[k].id === h) { select(k, false); wrap.scrollIntoView(); return true; }
      }
      return false;
    };
    if (!fromHash()) select(0, false);
    window.addEventListener('hashchange', fromHash);
  });

  /* ---- paint-in ----
   * <head> sets html.paint-ready only when motion is welcome. Each brush
   * stroke ([data-paint]) is painted once, the first time it's mostly in
   * view, and never again. Bamboo lines get their place in the sequence
   * (--i) so the stalk is laid down top to bottom.
   */
  if (document.documentElement.classList.contains('paint-ready') && 'IntersectionObserver' in window) {
    window.mmPainting = true;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bamboo] .bamboo-line'), function (li) {
      var i = Array.prototype.indexOf.call(li.parentNode.children, li);
      li.style.setProperty('--i', i);
    });
    var painter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-painted');
          painter.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.2 });
    Array.prototype.forEach.call(document.querySelectorAll('[data-paint]'), function (el) {
      painter.observe(el);
    });
  }

  /* ---- print buttons (cue cards) ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-print]'), function (b) {
    b.addEventListener('click', function () { window.print(); });
  });

  /* ---- progress: leaves on the bamboo, opt-in, this browser only ----
   *
   * Stored under one key, and only after the reader taps "Keep my progress":
   *   mm-progress = { v: 1, courses: { "/yang-8": ["/2026/08/24/opening.html", …] } }
   * The key existing IS the opt-in.
   *
   * "No thanks" stores only that answer (mm-progress-off = "1"), so the
   * question doesn't come back; a quiet "Keep track of my progress" link
   * stays for a change of mind. "Forget my progress" removes both keys, back
   * to never having been asked.
   *
   * Leaves are drawn on every stalk on the page: the sidebar, the phone
   * drawer's sideways stalk, and the course page. When every line of an
   * outline is filmed and practiced, that course's seal stamp appears.
   */
  var PKEY = 'mm-progress';
  var loadProgress = function () {
    try {
      var v = JSON.parse(localStorage.getItem(PKEY));
      return v && v.courses ? v : null;
    } catch (e) { return null; }
  };
  var saveProgress = function (p) {
    try { localStorage.setItem(PKEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  };
  var OFFKEY = 'mm-progress-off';
  var declined = function () {
    try { return localStorage.getItem(OFFKEY) === '1'; } catch (e) { return false; }
  };
  var setDeclined = function (on) {
    try {
      if (on) localStorage.setItem(OFFKEY, '1');
      else localStorage.removeItem(OFFKEY);
    } catch (e) {}
  };

  var drawProgress = function () {
    var p = loadProgress();
    var done = {};
    if (p) Object.keys(p.courses).forEach(function (c) {
      (p.courses[c] || []).forEach(function (path) { done[path] = true; });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-lesson]'), function (el) {
      if (el.hasAttribute('data-practice')) return;
      var on = !!done[el.getAttribute('data-lesson')];
      el.classList.toggle('is-practiced', on);
      if (el.classList.contains('bamboo-line')) {
        var label = el.querySelector('.bamboo-label');
        var tag = label && label.querySelector('.bamboo-practiced');
        if (on && label && !tag) {
          tag = document.createElement('span');
          tag.className = 'bamboo-status bamboo-practiced';
          tag.textContent = 'Practiced';
          label.appendChild(tag);
        } else if (!on && tag) {
          tag.parentNode.removeChild(tag);
        }
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-course-complete]'), function (stamp) {
      var stalk = document.querySelector('[data-bamboo][data-course="' + stamp.getAttribute('data-course') + '"]');
      var lines = stalk ? stalk.querySelectorAll('.bamboo-line') : [];
      var complete = lines.length > 0 && Array.prototype.every.call(lines, function (l) {
        return l.classList.contains('is-filmed') && l.classList.contains('is-practiced');
      });
      stamp.hidden = !complete;
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-practice-forget]'), function (f) {
      f.hidden = !p;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-practice-optin]'), function (f) {
      f.hidden = !!p || !declined();
    });
  };

  Array.prototype.forEach.call(document.querySelectorAll('[data-practice-forget] button'), function (b) {
    b.addEventListener('click', function () {
      if (!window.confirm('Forget your progress? Your leaves are only kept in this browser, so this can’t be undone.')) return;
      try { localStorage.removeItem(PKEY); } catch (e) {}
      setDeclined(false);
      drawProgress();
      syncPractice();
    });
  });

  // a change of mind after "No thanks": progress on, leaves from the next tap
  Array.prototype.forEach.call(document.querySelectorAll('[data-practice-optin] button'), function (b) {
    b.addEventListener('click', function () {
      setDeclined(false);
      saveProgress(loadProgress() || { v: 1, courses: {} });
      drawProgress();
      syncPractice();
      var status = document.querySelector('[data-practice-status]');
      if (status) status.textContent = 'Progress is on. Tap I practiced this to grow a leaf.';
      var btn = document.querySelector('[data-practice-btn]');
      if (btn) btn.focus();
    });
  });

  var practice = document.querySelector('[data-practice]');
  var syncPractice = function () {};
  if (practice) {
    var pBtn = practice.querySelector('[data-practice-btn]');
    var pAsk = practice.querySelector('[data-practice-ask]');
    var pStatus = practice.querySelector('[data-practice-status]');
    var pCount = practice.querySelector('[data-practice-count]');
    var kudos = practice.querySelector('.tinylytics_kudos');
    var course = practice.getAttribute('data-course');
    var lesson = practice.getAttribute('data-lesson');

    var isPracticed = function () {
      var p = loadProgress();
      return !!(p && p.courses[course] && p.courses[course].indexOf(lesson) > -1);
    };
    var setPracticed = function (on) {
      var p = loadProgress() || { v: 1, courses: {} };
      var list = (p.courses[course] || []).filter(function (x) { return x !== lesson; });
      if (on) list.push(lesson);
      p.courses[course] = list;
      saveProgress(p);
      drawProgress();
    };
    var sendKudos = function () {
      // Tinylytics disables its button and adds .did_select once counted
      if (kudos && !kudos.disabled && !kudos.classList.contains('did_select')) kudos.click();
    };

    syncPractice = function () {
      var opted = !!loadProgress();
      var on = opted && isPracticed();
      pBtn.textContent = on ? 'Practiced' : 'I practiced this';
      if (opted) pBtn.setAttribute('aria-pressed', String(on));
      else pBtn.removeAttribute('aria-pressed');
    };

    pBtn.addEventListener('click', function () {
      sendKudos();
      if (loadProgress()) {
        var on = !isPracticed();
        setPracticed(on);
        pStatus.textContent = on ? 'A leaf grew on your bamboo.' : 'Leaf taken back.';
      } else if (declined()) {
        // they said no thanks: just the count, no question
        pStatus.textContent = '';
      } else {
        pStatus.textContent = '';
        pAsk.hidden = false;
        pAsk.querySelector('[data-practice-keep]').focus();
      }
      syncPractice();
    });
    pAsk.querySelector('[data-practice-keep]').addEventListener('click', function () {
      pAsk.hidden = true;
      setDeclined(false);
      if (saveProgress(loadProgress() || { v: 1, courses: {} })) {
        setPracticed(true);
        pStatus.textContent = 'A leaf grew on your bamboo.';
      } else {
        pStatus.textContent = 'This browser won’t let the site save anything, so progress can’t be kept here.';
      }
      syncPractice();
      pBtn.focus();
    });
    pAsk.querySelector('[data-practice-no]').addEventListener('click', function () {
      pAsk.hidden = true;
      setDeclined(true);
      pStatus.textContent = '';
      drawProgress();
      pBtn.focus();
    });

    // the public count: whatever number Tinylytics writes into its button
    if (kudos && pCount && window.MutationObserver) {
      var showCount = function () {
        var n = parseInt((kudos.textContent || '').replace(/[^0-9]/g, ''), 10);
        if (n > 0) {
          pCount.textContent = n + (n === 1 ? ' person practiced this' : ' people practiced this');
          pCount.hidden = false;
        }
      };
      new MutationObserver(showCount).observe(kudos, { childList: true, characterData: true, subtree: true });
      showCount();
    }

    syncPractice();
  }

  drawProgress();
})();
