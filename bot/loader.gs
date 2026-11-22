// 🌱 Пан Врожайчик — завантажувач. Увесь код бота живе в GitHub: Crystallord/farm → bot/farm_reminder_bot.gs.
// Цей файл бере його звідти (кешує на 15 хв) і запускає. Новий код у GitHub починає працювати сам,
// без копіювання й без «Нова версія»; /update у приватному чаті з ботом — щоб одразу.
const BOT_SRC = 'https://raw.githubusercontent.com/Crystallord/farm/main/bot/farm_reminder_bot.gs';
const BOT_KEY = 'botsrc', BOT_TTL = 900, BOT_PART = 40000;
let BOT_RUN = null;
function botSource_() {
  const c = CacheService.getScriptCache(), n = +c.get(BOT_KEY + '_n');
  if (n) {
    const keys = []; for (let i = 0; i < n; i++) keys.push(BOT_KEY + '_' + i);
    const got = c.getAll(keys);
    if (Object.keys(got).length === n) return keys.map(function (k) { return got[k]; }).join('');
  }
  const r = UrlFetchApp.fetch(BOT_SRC + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('GitHub: ' + r.getResponseCode());
  const src = r.getContentText(), parts = {}, N = Math.ceil(src.length / BOT_PART);
  for (let i = 0; i < N; i++) parts[BOT_KEY + '_' + i] = src.slice(i * BOT_PART, (i + 1) * BOT_PART);
  parts[BOT_KEY + '_n'] = String(N);
  c.putAll(parts, BOT_TTL);
  return src;
}
function bot_(name) {
  if (!BOT_RUN) BOT_RUN = new Function(botSource_() + '\n;return function (n) { return eval(n); };')();
  return BOT_RUN(name);
}
function doPost(e) { return bot_('doPost')(e); }
function doGet(e) { return bot_('doGet')(e); }
function fire_beds(e) { bot_('fire_beds')(e); }
function fire_plots(e) { bot_('fire_plots')(e); }
function fire_slot(e) { bot_('fire_slot')(e); }
function fire_daily(e) { bot_('fire_daily')(e); }
function fire_evening(e) { bot_('fire_evening')(e); }
function fire_nag(e) { bot_('fire_nag')(e); }
function fire_warn(e) { bot_('fire_warn')(e); }
function poll() { bot_('poll')(); }
function setup() { bot_('setup')(); }
function setupPolling() { bot_('setupPolling')(); }
function migrate() { bot_('migrate')(); }
function reloadBot() { CacheService.getScriptCache().remove(BOT_KEY + '_n'); Logger.log('Наступний запуск візьме свіжий код із GitHub'); }
