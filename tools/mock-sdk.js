/* Локальная имитация SDK Яндекс Игр — ТОЛЬКО для разработки (в архив не попадает).
 * Параметры URL: ?lang=en|ru|tr, ?auth=1 (авторизован), ?rv=close (закрывать видео досрочно), ?adfail=1, ?nopay=1, ?fastads=1
 */
(function () {
  var qs = new URLSearchParams(location.search);
  var log = (window.__mockLog = []);
  function L(type, data) { log.push({ t: Date.now(), type: type, data: data }); try { console.log('[mock-sdk]', type, data === undefined ? '' : JSON.stringify(data)); } catch (e) {} panel(); }
  var state = { ready: false, gameplay: false, banner: false, lastAd: 0 };
  var handlers = {};
  function emit(ev) { (handlers[ev] || []).forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  var CLOUD_KEY = 'mock_cloud_' + (qs.get('auth') === '1' || sessionStorage.getItem('mock_auth') ? 'user' : 'guest');
  var authorized = qs.get('auth') === '1' || !!sessionStorage.getItem('mock_auth');

  // ---------- Панель отладки ----------
  var box;
  function panel() {
    if (!document.body) return;
    if (!box) {
      box = document.createElement('div');
      box.id = 'mock-panel';
      box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;font:11px/1.25 monospace;background:rgba(0,0,0,.6);color:#fff;padding:3px 6px;border-radius:6px;pointer-events:none;max-width:60vw';
      document.body.appendChild(box);
    }
    box.innerHTML = 'mock SDK · ready:<b style="color:' + (state.ready ? '#5f5' : '#f5f') + '">' + (state.ready ? 'yes' : 'no') + '</b> · gameplay:<b style="color:' + (state.gameplay ? '#5f5' : '#f55') + '">' + (state.gameplay ? 'ON' : 'off') + '</b>' + (state.banner ? ' · banner' : '');
  }

  // ---------- Реклама ----------
  function overlay(text, buttons) {
    var o = document.createElement('div');
    o.className = 'mock-ad';
    o.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(10,10,20,.92);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:600 20px sans-serif';
    o.innerHTML = '<div>' + text + '</div>';
    (buttons || []).forEach(function (b) {
      var el = document.createElement('button');
      el.textContent = b.label; el.className = b.cls || '';
      el.style.cssText = 'font:600 16px sans-serif;padding:10px 18px;border-radius:10px;border:0;cursor:pointer';
      el.onclick = function () { b.fn(o); };
      o.appendChild(el);
    });
    document.body.appendChild(o);
    return o;
  }
  var adTime = qs.get('fastads') ? 300 : 1500;
  var adv = {
    showFullscreenAdv: function (opts) {
      var cb = (opts && opts.callbacks) || {};
      var now = Date.now();
      if (qs.get('adfail')) { setTimeout(function () { cb.onError && cb.onError(new Error('mock fail')); }, 50); return; }
      if (now - state.lastAd < 60000 && !qs.get('fastads')) {
        L('fullscreen:skipped(frequency)');
        setTimeout(function () { cb.onClose && cb.onClose(false); }, 30);
        return;
      }
      state.lastAd = now;
      L('fullscreen:open');
      emit('game_api_pause');
      cb.onOpen && cb.onOpen();
      var o = overlay('Реклама (тест) — полноэкранная');
      setTimeout(function () { o.remove(); L('fullscreen:close'); emit('game_api_resume'); cb.onClose && cb.onClose(true); }, adTime);
    },
    showRewardedVideo: function (opts) {
      var cb = (opts && opts.callbacks) || {};
      if (qs.get('adfail')) { setTimeout(function () { cb.onError && cb.onError(new Error('mock fail')); }, 50); return; }
      L('rewarded:open');
      emit('game_api_pause');
      cb.onOpen && cb.onOpen();
      var close = qs.get('rv') === 'close';
      var o = overlay('Видео за награду (тест)', [
        { label: 'Досмотреть', cls: 'mock-rv-ok', fn: function (el) { el.remove(); cb.onRewarded && cb.onRewarded(); L('rewarded:rewarded'); finish(); } },
        { label: 'Закрыть', cls: 'mock-rv-close', fn: function (el) { el.remove(); finish(); } },
      ]);
      var done = false;
      function finish() { if (done) return; done = true; L('rewarded:close'); emit('game_api_resume'); cb.onClose && cb.onClose(); }
      setTimeout(function () { if (!done && o.parentNode) { o.remove(); if (!close) { cb.onRewarded && cb.onRewarded(); L('rewarded:rewarded'); } finish(); } }, adTime);
    },
    showBannerAdv: function () { state.banner = true; L('banner:show'); return Promise.resolve({ stickyAdvIsShowing: true }); },
    hideBannerAdv: function () { state.banner = false; L('banner:hide'); return Promise.resolve({ stickyAdvIsShowing: false }); },
    getBannerAdvStatus: function () { return Promise.resolve({ stickyAdvIsShowing: state.banner }); },
  };

  // ---------- Игрок ----------
  function makePlayer() {
    return {
      getMode: function () { return authorized ? '' : 'lite'; },
      isAuthorized: function () { return authorized; },
      getName: function () { return authorized ? 'Тестовый игрок' : ''; },
      getUniqueID: function () { return authorized ? 'mock-user-1' : 'mock-guest'; },
      getPhoto: function () { return ''; },
      getPayingStatus: function () { return 'unknown'; },
      getData: function () { try { return Promise.resolve(JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}')); } catch (e) { return Promise.resolve({}); } },
      setData: function (d, flush) {
        var s = JSON.stringify(d);
        if (s.length > 200 * 1024) return Promise.reject(new Error('too big'));
        localStorage.setItem(CLOUD_KEY, s);
        L('player:setData', { bytes: s.length, flush: !!flush });
        return Promise.resolve(true);
      },
    };
  }

  // ---------- Покупки ----------
  var yanIcon = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fc3f1d"/><text x="12" y="16.5" font-size="13" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">¥</text></svg>');
  function product(id, title, desc, price) {
    return {
      id: id, title: title, description: desc, imageURI: '', price: price + ' TST', priceValue: String(price), priceCurrencyCode: 'TST',
      getPriceCurrencyImage: function () { return yanIcon; },
    };
  }
  var catalog = [
    product('noads', 'Без рекламы', 'Навсегда', 99),
    product('coins500', '500 монет', 'Немного монет', 29),
    product('coins1500', '1500 монет', 'Мешок монет', 79),
    product('coins5000', '5000 монет', 'Сундук монет', 199),
  ];
  var PKEY = 'mock_purchases';
  function getP() { try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { return []; } }
  function setP(a) { localStorage.setItem(PKEY, JSON.stringify(a)); }
  var payments = {
    getCatalog: function () { return Promise.resolve(catalog); },
    getPurchases: function () { return Promise.resolve(getP()); },
    purchase: function (o) {
      return new Promise(function (resolve, reject) {
        L('payments:purchase:open', o);
        emit('game_api_pause');
        overlay('Покупка (тест): ' + o.id, [
          { label: 'Оплатить', cls: 'mock-pay-ok', fn: function (el) { el.remove(); var p = { productID: o.id, purchaseToken: 'tok_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), developerPayload: o.developerPayload || '' }; var a = getP(); a.push(p); setP(a); L('payments:purchase:ok', p); emit('game_api_resume'); resolve(p); } },
          { label: 'Отмена', cls: 'mock-pay-cancel', fn: function (el) { el.remove(); L('payments:purchase:cancel'); emit('game_api_resume'); reject(new Error('cancelled')); } },
        ]);
      });
    },
    consumePurchase: function (token) {
      setP(getP().filter(function (p) { return p.purchaseToken !== token; }));
      L('payments:consume', token);
      return Promise.resolve();
    },
  };

  // ---------- Лидерборд ----------
  var leaderboards = {
    getDescription: function (name) { return Promise.resolve({ name: name, title: { ru: 'Рекорды' } }); },
    setScore: function (name, score) { localStorage.setItem('mock_lb_' + name, String(score)); L('lb:setScore', { name: name, score: score }); return Promise.resolve(); },
    getEntries: function (name) {
      var mine = Number(localStorage.getItem('mock_lb_' + name) || 0);
      var list = [12840, 9900, 7420, 5100, 3300].map(function (s, i) {
        return { rank: i + 1, score: s, player: { publicName: ['Мурка', 'Барсик', 'Пушок', 'Снежок', 'Рыжик'][i], uniqueID: 'u' + i, getAvatarSrc: function () { return ''; } } };
      });
      if (authorized && mine) { list.push({ rank: 42, score: mine, player: { publicName: 'Тестовый игрок', uniqueID: 'mock-user-1', getAvatarSrc: function () { return ''; } } }); }
      return Promise.resolve({ leaderboard: { name: name }, ranges: [], userRank: authorized ? 42 : 0, entries: list });
    },
  };

  var ysdk = {
    environment: { app: { id: 'local-mock' }, i18n: { lang: qs.get('lang') || 'ru', tld: 'ru' }, payload: qs.get('payload') || null },
    deviceInfo: { type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop', isMobile: function () { return this.type === 'mobile'; }, isDesktop: function () { return this.type === 'desktop'; } },
    EVENTS: { ACCOUNT_SELECTION_DIALOG_CLOSED: 'ACCOUNT_SELECTION_DIALOG_CLOSED' },
    features: {
      LoadingAPI: { ready: function () { if (state.ready) L('LoadingAPI.ready:DUPLICATE'); state.ready = true; L('LoadingAPI.ready'); } },
      GameplayAPI: {
        start: function () { if (state.gameplay) L('GameplayAPI.start:DUPLICATE'); state.gameplay = true; L('GameplayAPI.start'); },
        stop: function () { if (!state.gameplay) L('GameplayAPI.stop:DUPLICATE'); state.gameplay = false; L('GameplayAPI.stop'); },
      },
    },
    on: function (ev, f) { (handlers[ev] = handlers[ev] || []).push(f); },
    off: function (ev, f) { handlers[ev] = (handlers[ev] || []).filter(function (x) { return x !== f; }); },
    serverTime: function () { return Date.now() + Number(qs.get('dayshift') || 0) * 86400000; },
    isAvailableMethod: function () { return Promise.resolve(true); },
    adv: adv,
    getPlayer: function () { return Promise.resolve(makePlayer()); },
    auth: { openAuthDialog: function () { authorized = true; sessionStorage.setItem('mock_auth', '1'); CLOUD_KEY = 'mock_cloud_user'; L('auth:login'); return Promise.resolve(); } },
    getPayments: function () { return qs.get('nopay') ? Promise.reject(new Error('payments unavailable')) : Promise.resolve(payments); },
    leaderboards: leaderboards,
    getStorage: function () { return Promise.resolve(localStorage); },
  };

  document.addEventListener('visibilitychange', function () { emit(document.hidden ? 'game_api_pause' : 'game_api_resume'); });
  window.YaGames = { init: function () { L('init'); return new Promise(function (r) { setTimeout(function () { r(ysdk); }, 120); }); } };
  window.__mockState = state;
  window.__mockEmit = emit;
  document.addEventListener('DOMContentLoaded', panel);
})();
