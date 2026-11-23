/**
 * ArcheRage farm bot (NA) for a family Telegram group, on Google Apps Script (free, no server).
 *
 * Everything is done with buttons. /menu in the group opens the menu; the owner changes settings with buttons
 * in a private chat (⚙️ Налаштування). Commands exist only for the start: /menu, /go, /iam <ім'я>.
 *
 * Two land timers, each with its own reminder and buttons
 *  - 🌱 Грядки: says what to plant this time (Narcissus/Clover 30 min, Corn 1 h, Cactus/Turmeric 3 h by turns).
 *  - 🪱 Компостери (1 h 30 min) or 📦 Бандли (2 h 50 min).
 *  "✅ Зібрано!" credits the reward to the person; the timer counts from that moment.
 *  "⏳ Зараз не можу" keeps the buttons, so someone else can harvest now; otherwise it reminds again later.
 *  Every reminder shows each person's daily norm (harvests a day, set per person in the settings).
 * Daily checklist at dayStart (calendar, vigor, farmhands on 3 characters).
 * Evening summary at dayEnd: today and this week per person, and how much money each can get now.
 * Money: "💸 Отримати мої гроші" sets the person's balance to 0 and tells the owner privately whom to pay.
 * 📈 Статистика: a table per day of the week (or per week of the month) for each person and the farm in total.
 * Farm bank: bankPct % of every harvest goes to the bank; the reward people see is the rest (the bank is not shown
 *   to them, only to the owner in the settings). The bank pays for race prizes.
 * 🏁 Races: on a random morning the bot starts a race of 2-4 days, then 1-2 days of break. Most harvests wins.
 *   The prize is secret until the winner opens it: 1-3 ice creams, a paid day off, or 10-30% of the bank.
 * 🔥 Streaks and 💎 crystals: norm done -> the streak grows and pays crystals (5, 6, 7, 8, then 10 a day); two hours
 *   before the end of the day the bot warns whoever's streak is at risk. 🛒 Магазин: freezes and chores for crystals,
 *   unlocked by the streak length.
 * 💼 Investments: new plots are bought with UAH from the balances; their harvests pay invWage% to whoever harvests
 *   and the rest to the owners by shares (founder land keeps 85/15 with the 🐷 piggy bank).
 * 🏅 Досягнення: badges for harvests, streaks, earnings, land, races, the shop (no money or crystals for them).
 * Telegram features used in the group: personal (ephemeral) messages for inventory/shop/achievements/investments/
 *   questions, colored and disabled buttons, a rich evening summary with folding blocks, tags under names (the bot
 *   needs the admin right "manage tags"), reactions, a quiz. Ideas for the private chat with Марія: see FUTURE at the end.
 * 🐾 Pets: a quest (animal care + Daru form), food for crystals, levels, clothes; from level 3 the Helper adds a % of a
 *   composter/bundle harvest done in Daru form, never more than that character's Daru costume gives (⚙️ → 🐾).
 * ❓ Питання: answers for the kids about every mechanic, numbers taken from the settings.
 * 🎒 Інвентар: each person's prizes, used with a button (ice cream -> the owner is asked to buy it; day off ->
 *   today's norm is done and a day's pay goes to the balance; money -> to the balance).
 *
 * Setup (once, ~10 minutes)
 *  1. Telegram: @BotFather -> /newbot -> copy the token.
 *  2. script.google.com -> New project -> paste this file. Project Settings: Time zone (GMT+02:00) Kyiv.
 *     Script properties: BOT_TOKEN = <token>, SECRET = <any random word>.
 *  3. Deploy -> New deployment -> Web app. Execute as: Me. Who has access: Anyone.
 *     Copy the Web app URL into script property WEBAPP_URL. Run setup() once and allow the permissions.
 *     Check with checkWebhook(): pending_update_count 0 and no last_error_message.
 *     After any code change: Deploy -> Manage deployments -> edit -> Version: New version, then run setup().
 *  4. Private chat with the bot: /start. Add the bot to the family group, send /bind there.
 *     Each person sends /iam <name> in the group. In the morning: /go.
 */

// ---------------------------------------------------------------- settings (changed with buttons, see settingsPanel)
const DEFAULTS = {
  bedCrop: 'tc',       // what grows in the seedbeds (see CROPS)
  bundles: 70,         // seed bundles planted in place of composters (one bundle per composter spot)
  bundleCrop: 'clover',// which bundle (see BUNDLES)
  bedTimer: 0,         // minutes between seedbed reminders; 0 = growth time of the crop
  plotTimer: 0,        // minutes between composter/bundle reminders; 0 = growth time
  snooze: 20,          // minutes for "Зараз не можу"
  dayStart: 10,        // reminders from 10:00 (the daily checklist comes then) ...
  dayEnd: 22,          // ... to 22:00 (the evening summary comes then); quiet at night
  norm: 40,            // fallback norm in UAH; a person's norm = share % of what the farm can give a day (farmMax)
  share: 20,           // share % of a new person
  overPct: 4, overMax: 10, // over the norm: +1 💎 for every overPct % of farmMax (≈10 UAH now), at most overMax 💎 a day
  dailyReward: 0,      // was UAH for the daily checklist; dailies pay crystals now (TASKS.daily)
  plots8: 11,          // how many plots of each size the farm owns (what fits on each: see PLOTS)
  plots16: 12,
  plots24: 2,
  plots28: 1,          // 28×28 lent by the guild: composters only
  neutral: 50,         // composters on neutral land between our plots: how many survive on average (others can steal them)
  nbundles: 0,         // bundles on neutral land (same crop as on the plots)
  uahPer1000: 16,      // UAH for 1000 gold
  nagAfter: 10,        // minutes without any reaction to a reminder before the bot starts to nag (0 = never)
  nagEvery: 1,         // minutes between nag messages
  together: 20,        // seedbeds and composters/bundles due within this many minutes come as one reminder (0 = never)
  bankPct: 15,         // % of every harvest that goes to the farm bank (0-20); people see the rest as their reward
  shopDaily: 3,        // 🛒 how many of the unlocked items are on sale each day (they rotate)
  shopRise: 30,        // 🛒 +% to an item's price for each time this person bought it this week
  gemUah: 0.5,         // 💱 one crystal is worth this many UAH when exchanged (inventory)
  harvestGem: 1,       // 💎 for every harvest (any crop, any land)
  icePrice: 30,        // UAH the bank pays for one ice cream prize
  races: true,         // the bot starts races by itself
  invWage: 50,         // investor plots: % of a harvest to whoever harvests, the rest to the owners
  iplots: [],          // investor plots (see the investments section)
  taskGems: { daily: 5, dog: 1, quest: 5, neutral: 5, event: 5, restock: 10, flower: 3, alt: 50, gift: 1, nui: 1 },
  wowFirst: 30, wowRepeat: 20, // 🐉 WoW Forever: a dungeon the first time / again
  wowMaxLvl: 35,                // show dungeons that start at this level or lower // 💎 for the tasks in "Заробити кристали" (see TASKS)
  earlyHour: 12,       // 🌅 season: harvests before this hour give +1 💎
  raceMin: 2, raceMax: 4,  // a race lasts this many days (random in the range)
  restMin: 1, restMax: 2,  // days of break between races (random in the range)
  pet: { cap: 10, food: 1, feed: 25, pack: 10, packN: 12, cloth: 25, decay: 5, tickH: 6, min: 50, run: 5, anyChar: true }, // 🐾 pets: max Helper %, 💎 per meal / clothing item, satiety −% every 3 h, Helper works from this satiety %, −% satiety after a harvest in Daru; anyChar: don't ask which character, any harvest in Daru gets the find (the per-character costume check is kept, just off)
  chars: [{ name: 'Oleksa', pct: 14, daru: true }, { name: 'Tetan', pct: 0, daru: true }, { name: 'Maria', pct: 0, daru: true }], // game characters: Daru costume Farming Gain %, has the Daru Transformation skill
};
const CROPS = {
  narcissus: { label: 'Narcissus', min: 30, plan: ['Narcissus'] },
  clover: { label: 'Clover', min: 30, plan: ['Clover'] },
  corn: { label: 'Corn', min: 60, plan: ['Corn'] },
  mr: { label: 'Mint / Rosemary', min: 90, plan: ['Mint', 'Rosemary'] }, // Grand: sold raw, only Rare is worth refining
  tc: { label: 'Cactus / Turmeric', min: 120, plan: ['Turmeric', 'Cactus'],
    refine: { Turmeric: 'Ground Spices', Cactus: 'Dried Flowers' } },
};
const COMPOSTER_MIN = 90; // a composter is ready in 1.5 h
// Seed bundles: 10 seeds + 5 Bait Worm (the 5th comes back) -> 24 crops; min = how long it really grows on our land.
const BUNDLES = {
  clover: { label: 'Clover', min: 90, crops: ['Clover'] },
  narcissus: { label: 'Narcissus', min: 170, crops: ['Narcissus'] },
  rose: { label: 'Rose', min: 170, crops: ['Rose'] },
  corn: { label: 'Corn', min: 180, crops: ['Corn'] },
};
// What fits on one plot (houses: 16×16 and 24×24 with a house) and what it costs to buy, in gold.
const PLOTS = {
  plots8:  { label: '8×8', beds: 0, bundles: 4, comps: 4, price: 0 },
  plots16: { label: '16×16 з будинком', beds: 2, bundles: 4, comps: 6, price: 30000 },
  plots24: { label: '24×24 з будинком', beds: 3, bundles: 20, comps: 30, price: 70000 },
  plots28: { label: '28×28 гільдії', beds: 0, bundles: 0, comps: 65, price: 0 }, // not ours: no value in the farm price
};
// Market prices in gold per item, NA, average of the 3-day and 14-day price (scan 19.11.2026). Update now and then.
const PRICES = {
  date: '19.11.2026',
  Narcissus: 0.1291, Rose: 0.1222, Clover: 0.1251, Corn: 0.1331, Mint: 0.3799, Rosemary: 0.261,
  'Ground Spices': 0.0609, 'Dried Flowers': 0.0612, 'Bait Worm': 0.0787,
};
const COSTS = { basicSeed: 0.0375, grandSeed: 0.045, rareSeed: 0.09, composter: 0.12, badge: 0.0124 }; // gold; badge = Vocation Badge
const AH_KEEP = 0.95; // the auction house keeps 5%
// One harvest of one unit: gold after costs, and labor. Seedbed: 50 seeds -> 140 crops (Cactus/Turmeric x4.5 refined).
function bedHarvest(cfg) {
  if (cfg.bedCrop === 'tc') {
    const refined = (PRICES['Ground Spices'] + PRICES['Dried Flowers']) / 2;
    return { gold: 630 * refined * AH_KEEP - 50 * COSTS.rareSeed + 36 * COSTS.badge, labor: 132 };
  }
  if (cfg.bedCrop === 'mr') { // Grand, sold raw; the two crops take turns, so the average price
    return { gold: 140 * (PRICES.Mint + PRICES.Rosemary) / 2 * AH_KEEP - 50 * COSTS.grandSeed + 12 * COSTS.badge, labor: 60 };
  }
  const price = PRICES[bedCrop(cfg).label];
  return { gold: 140 * price * AH_KEEP - 50 * COSTS.basicSeed + 12 * COSTS.badge, labor: 30 };
}
function bundleHarvest(cfg) { // one bundle: 24 crops, 10 seeds + 4 Bait Worm (the 5th comes back), 12 badges
  const B = bundleCrop(cfg), crop = B.crops.reduce(function (a, n) { return a + PRICES[n]; }, 0) / B.crops.length;
  return { gold: 24 * crop * AH_KEEP - 10 * COSTS.basicSeed - 4 * PRICES['Bait Worm'] + 12 * COSTS.badge, labor: 7 };
}
function composterHarvest() { return { gold: 50 * PRICES['Bait Worm'] * AH_KEEP - COSTS.composter, labor: 9 }; } // 50 Bait Worm

// Nag messages: one at random every nagEvery minutes until someone presses "Я ТУТ!". {name} = someone behind on the norm.
const NAGS = [
  '🐔 Курочки вже голодні! Хто піде на ферму?',
  '🌱 Грядки плачуть: «Нас забули!» 😢',
  '🪱 Черв\'ячки зібрали збори й вимагають, щоб їх нарешті забрали!',
  '🚜 Трактор завівся сам. Він натякає…',
  '🐮 Корова питає: «Мууу, а де фермери?»',
  '⏰ Тік-так! Врожай не чекатиме вічно!',
  '🥕 Морквина вже сама вилізла з грядки й стукає у вікно!',
  '💰 Гроші лежать на грядці. Просто лежать. Чекають на тебе.',
  '🦗 Цвіркуни вже співають пісню «Ніхто не прийшов»…',
  '🌵 Кактус образився. Колюче образився.',
  '🐝 Бджілки доповідають: фермерів не виявлено!',
  '📣 Увага-увага! Розшукуються фермери! Винагорода — гривні!',
  '🐷 Свинка вже намалювала плакат «ЗБЕРІТЬ НАС!»',
  '🌻 Соняшник повернувся до чату й чекає.',
  '🍄 Тут уже гриби почали рости від очікування!',
  '🐌 Навіть равлик зібрав би швидше! 🐌💨',
  '🎺 Ту-ру-ру! Фермерський оркестр кличе на роботу!',
  '🦊 Лисичка вже придивляється до врожаю… Поспіши!',
  '🧺 Кошик для врожаю порожній і сумний.',
  '🐸 Жабка квакає: «Ква-ква, де фермери?»',
  '🏆 Хто перший натисне — той сьогодні найкращий фермер!',
  '🦄 Навіть єдиноріг прилетів допомагати. А ти де?',
  '🐓 Півень кукурікає вже вдесяте! КУ-КУ-РІ-КУ!',
  '🤖 Біп-буп. Фермер-бот засмучений. Біп.',
  '🚀 Врожай готовий до запуску! Потрібен пілот-фермер!',
  '🐶 Песик приніс тапочки й чекає, поки ти збереш врожай!',
  '📣 {name}, ферма кличе! Чуєш? ФЕРМА. КЛИЧЕ.',
  '🥺 {name}, грядки дивляться на тебе отакими очима: 🥺',
  '🎁 {name}, там гроші за збір! Справжні гривні!',
  '🐢 {name}, навіть черепаха вже двічі збігала на ферму!',
];
const NAG_BUTTON = { inline_keyboard: [[{ text: '🙋 Я ТУТ! ЗАРАЗ ЗРОБЛЮ!', callback_data: 'here', style: 'primary' }]] };
const DAILY = [
  '📅 Забрати нагороду в календарі',
  '🫘 Забрати боб (Vigor) з ринку (клавіша N)',
  '🐃 Закласти автоматичну ферму (буйволами)',
  '🛍 Перевірити магазин Манашторму',
  '⚡ Витратити зелену енергію на переробку (якщо за ніч набралась)',
];
const CHARACTERS = 3;
// male names that end like female ones, for "зібрав / зібрала"
const MALE_A = ['микола', 'ілля', 'сава', 'кузьма', 'лука', 'фома', 'нікіта', 'савва'];

function bedCrop(cfg) { return CROPS[cfg.bedCrop] || CROPS.tc; }
function bundleCrop(cfg) { return BUNDLES[cfg.bundleCrop] || BUNDLES.clover; }
// What grows on the plots: composters, bundles or both. They are harvested together, when the slower one is ready.
function plotType(cfg) {
  const f = farmCalc(cfg), B = bundleCrop(cfg), hasB = f.bundles > 0, hasC = f.comps + f.neutral > 0;
  const todoC = 'зберіть черв\'яків і закладіть компостери', todoB = 'зберіть і посадіть бандли ' + B.label;
  const cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  if (hasB && hasC) return { label: 'Компостери й бандли', icon: '🪱📦', min: Math.max(COMPOSTER_MIN, B.min), todo: cap(todoC) + '; ' + todoB };
  if (hasB) return { label: 'Бандли ' + B.label, icon: '📦', min: B.min, todo: cap(todoB) };
  return { label: 'Компостери', icon: '🪱', min: COMPOSTER_MIN, todo: cap(todoC) };
}
// the two land timers: everything that differs between them
const KINDS = {
  beds: {
    title: function (c) { return '🌱 Грядки'; },
    cycle: function (c) { return c.bedTimer > 0 ? c.bedTimer : bedCrop(c).min; },
    full: function (c) { return toUah(farmCalc(c).oneBeds, c); },     // the real value of one harvest
    reward: function (c) { return money(payOf(KINDS.beds.full(c), c) + investFull(c, 'beds') * c.invWage / 100); }, // founder land minus the bank + the wage part of investor plots
    todo: function (c, k) {
      const p = bedCrop(c).plan, plant = p[(k - 1) % p.length], ref = bedCrop(c).refine && bedCrop(c).refine[plant];
      return 'Зберіть і посадіть: ' + plant + (ref ? ' (потім переробити в ' + ref + ')' : '');
    },
  },
  plots: {
    title: function (c) { return plotType(c).icon + ' ' + plotType(c).label; },
    cycle: function (c) { return c.plotTimer > 0 ? c.plotTimer : plotType(c).min; },
    full: function (c) { return toUah(farmCalc(c).onePlots, c); },
    reward: function (c) { return money(payOf(KINDS.plots.full(c), c) + investFull(c, 'plots') * c.invWage / 100); },
    todo: function (c) { return plotType(c).todo; },
  },
};

// ---------------------------------------------------------------- Ukrainian words
function plural(n, forms) { // forms for 1, 2-4, 5+
  if (n % 1) return forms[1];
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  return b === 1 ? forms[0] : b >= 2 && b <= 4 ? forms[1] : forms[2];
}
function times(n) { return n + ' ' + plural(n, ['раз', 'рази', 'разів']); }
function uahWords(n) { return b(money(n) + ' ' + plural(money(n), ['гривню', 'гривні', 'гривень'])); }
function minutesWords(n) { return n + ' ' + plural(n, ['хвилину', 'хвилини', 'хвилин']); }
function dur(min) { const h = Math.floor(min / 60), m = min % 60; return (h ? h + ' год' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' хв' : ''); }
function money(uah) { return Math.round(uah * 100) / 100; }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function b(t) { return '<b>' + esc(t) + '</b>'; }  // money is bold in every message
function grn(n) { return b(money(n) + ' грн'); }
// A received message back to HTML, keeping its bold parts, so an edit can append to it without losing them.
function toHtml(msg) {
  const text = msg.text || '', marks = (msg.entities || []).filter(function (e) { return e.type === 'bold'; });
  let out = '', pos = 0;
  marks.sort(function (x, y) { return x.offset - y.offset; }).forEach(function (e) {
    if (e.offset < pos) return;
    out += esc(text.slice(pos, e.offset)) + '<b>' + esc(text.substr(e.offset, e.length)) + '</b>';
    pos = e.offset + e.length;
  });
  return out + esc(text.slice(pos));
}
function isFemale(name) { const n = String(name).toLowerCase().trim(); return /[ая]$/.test(n) && MALE_A.indexOf(n) < 0; }
function verb(p, male, female) { return p && p.female ? female : male; }

// ---------------------------------------------------------------- storage
function props() { return PropertiesService.getScriptProperties(); }
// Script Properties hold at most 9 KB per value, so the state is stored in pieces: STATE_N = count, STATE_0…
function readState() {
  const all = props().getProperties(), n = +(all.STATE_N || 0);
  if (!n) return all.STATE || '';
  let s = ''; for (let i = 0; i < n; i++) s += all['STATE_' + i] || '';
  return s;
}
function loadState() {
  const s = readState();
  const st = s ? JSON.parse(s) : {};
  st.cfg = Object.assign({}, DEFAULTS, st.cfg || {});
  if (!st.cfg.mig16 && st.cfg.plots16 === 10) st.cfg.plots16 = 12; // bought 2 more 16×16 on 9.11
  st.cfg.mig16 = true;
  if (st.cfg.taskGems.daily === undefined) st.cfg.taskGems = Object.assign({ daily: 5 }, st.cfg.taskGems); // dailies moved to crystals
  if (st.cfg.taskGems.dog === undefined) st.cfg.taskGems = Object.assign({}, st.cfg.taskGems, { dog: 1 });
  st.cfg.dailyReward = 0; // dailies pay crystals now, not hryvnias
  st.stats = st.stats || {};      // 'd:YYYY-MM-DD' / 'w:<monday>' / 'm:YYYY-MM' -> { uid: { n, uah } }
  st.count = st.count || {};      // 'YYYY-MM-DD' -> { beds: n, plots: n } harvests of each kind today
  st.timers = st.timers || {};    // kind -> { id, due }
  st.payouts = st.payouts || [];  // last payouts: { uid, uah, at }
  st.balance = st.balance || {};  // uid -> UAH ready to get
  st.people = st.people || {};    // uid -> { name, female, norm }
  st.bank = st.bank || 0;         // UAH in the farm bank (pays for race prizes)
  st.trades = st.trades || [];     // 🔁 deals between people (see TRADE)
  st.inv = st.inv || {};          // uid -> { ice, vac: [UAH...], cash, gift: [hidden prizes] }
  st.vacation = st.vacation || {};// 'YYYY-MM-DD' -> { uid: true } people on a paid day off
  st.streak = st.streak || {};    // uid -> { n, last, best } days in a row with the norm done
  st.normLog = st.normLog || {};  // 'YYYY-MM-DD' -> { uid: 1 done / 0 not / 2 frozen }
  st.ach = st.ach || {};          // uid -> { achievement id: 'YYYY-MM-DD' }
  st.raceWins = st.raceWins || {};// uid -> races won
  st.gemLog = st.gemLog || {};    // 'YYYY-MM-DD' -> { uid: { bonus: 💎 over the norm, tasks: { id: 💎 } } }
  st.cfg.taskGems = Object.assign({}, DEFAULTS.taskGems, st.cfg.taskGems || {});
  st.cfg.pet = Object.assign({}, DEFAULTS.pet, st.cfg.pet || {});
  st.cfg.chars = (st.cfg.chars || DEFAULTS.chars).map(function (c) { return Object.assign({}, c); });
  st.pets = st.pets || {};          // uid -> pet (see PETS)
  if (st.offer) { st.offerSeq = (st.offerSeq || 0) + 1; st.offers = (st.offers || []).concat([Object.assign({ id: 'o' + st.offerSeq }, st.offer)]); if (st.msgs && st.msgs.offer) { st.msgs['offer:o' + st.offerSeq] = st.msgs.offer; delete st.msgs.offer; } delete st.offer; }
  st.offers = st.offers || [];      // open fundraisings for new investor plots (several at once)
  if (!st.cfg.normUah) { // 17.11: the norm was harvests a day; now it is UAH a day, set from each person's usual day
    Object.keys(st.people).forEach(function (id) {
      const days = Object.keys(st.stats).filter(function (k) { return /^d:/.test(k); }).sort().slice(-7)
        .map(function (k) { const r = st.stats[k][id]; return r ? r.g || r.uah : 0; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
      const med = days.length ? days[Math.floor((days.length - 1) / 2)] : 0;
      st.people[id].norm = med ? Math.max(20, Math.round(med * 0.9 / 5) * 5) : 40;
    });
    st.cfg.norm = 40; st.cfg.normUah = true;
  }
  if (!st.cfg.daruAll) { st.cfg.chars.forEach(function (c) { c.daru = true; }); st.cfg.daruAll = true; } // 17.11: everyone has Daru
  if (!st.petEco2) { Object.assign(st.cfg.pet, { food: 1, feed: 25, pack: 10, packN: 12, decay: 5, tickH: 6, run: 5 }); st.petEco2 = true; } // 21.11: cheaper food, slower hunger
  if (!st.petFix10) { // pets named before "found hungry" (17.11): never fed yet -> they come out of the bushes hungry too
    Object.keys(st.pets).forEach(function (id) { const pet = st.pets[id]; if (pet.stage === 'ok' && !pet.meals) { pet.fed = Math.min(pet.fed, 10); pet.fedAt = Date.now(); } });
    st.petFix10 = true;
  }
  Object.keys(st.people).forEach(function (id) { // the norm follows the land: share % of the farm's daily maximum
    const p = st.people[id];
    if (p.share === undefined) p.share = String(id) === String(st.owner) ? 50 : st.cfg.share;
    p.norm = normFor(st.cfg, p.share);
  });
  if (st.names) {                 // v5 kept only names
    Object.keys(st.names).forEach(function (id) {
      st.people[id] = st.people[id] || { name: st.names[id], female: isFemale(st.names[id]), norm: st.cfg.norm };
    });
    delete st.names;
  }
  return st;
}
// 📒 what changed today per person, for the stats and the daily contests: crystals in / out, pet XP, money put into
// fundraisings. Taken as the difference since the last save, so every way of earning or spending counts by itself.
function dayTrack(st) {
  if (!st.people) return;
  const day = dayKey(Date.now(), st.cfg || DEFAULTS), snap = st.trackSnap = st.trackSnap || {}, log = st.dayLog = st.dayLog || {};
  Object.keys(st.people).forEach(function (u) {
    const x = (st.inv || {})[u], pet = (st.pets || {})[u];
    const now = { g: x ? +x.gems || 0 : 0, xp: pet && pet.xp || 0, iv: (st.offers || []).reduce(function (a, o) { return a + (o.pledges[u] || 0); }, 0) };
    const was = snap[u];
    if (was) {
      const r = (log[day] = log[day] || {})[u] = log[day][u] || { gin: 0, gout: 0, xp: 0, inv: 0 };
      const dg = money(now.g - was.g); if (dg > 0) r.gin = money(r.gin + dg); else if (dg < 0) r.gout = money(r.gout - dg);
      if (now.xp > was.xp) r.xp += now.xp - was.xp;
      if (now.iv > was.iv + 0.004) r.inv = money(r.inv + now.iv - was.iv);
    }
    snap[u] = now;
  });
  Object.keys(log).sort().slice(0, -35).forEach(function (k) { delete log[k]; });
}
function dayAdd(st, u, k, n) {
  const day = dayKey(Date.now(), st.cfg), log = st.dayLog = st.dayLog || {}, d = log[day] = log[day] || {};
  const r = d[u] = d[u] || { gin: 0, gout: 0, xp: 0, inv: 0 }; r[k] = money((r[k] || 0) + n);
}
// ---------------------------------------------------------------- 🏆 daily contests
// Every day two: one about earning, one about spending (rotating). Settled with the evening summary; prizes wait in the app.
// Prizes ≈ 10–12 💎 of value a win (Maria earns ~50–70 💎 a day): small enough not to inflate the shop.
const CONTESTS = {
  earn: [
    { id: 'gin', icon: '💎', label: 'Хто заробить більше кристалів', unit: '💎' },
    { id: 'tasks', icon: '📋', label: 'Хто виконає більше завдань', unit: 'завд.' },
    { id: 'xp', icon: '🐾', label: 'Чий улюбленець набере більше досвіду', unit: 'XP' },
    { id: 'ach', icon: '🏅', label: 'Хто отримає більше досягнень', unit: 'шт' },
  ],
  spend: [
    { id: 'style', icon: '🎨', label: 'Хто витратить більше 💎 на стиль', unit: '💎' },
    { id: 'shop', icon: '🛍️', label: 'Хто витратить більше 💎 у крамниці', unit: '💎' },
  ],
};
const PRIZES = {
  earn: [{ t: 'gem', n: 12 }, { t: 'food', n: 10 }, { t: 'aura', days: 3 }],
  spend: [{ t: 'cash', pct: 30, max: 15 }, { t: 'aura', days: 3 }],
};
function dayIdx(day) { return Math.floor(Date.parse(day + 'T12:00:00Z') / 86400000); }
function contestsOf(day) {
  const i = dayIdx(day);
  return ['earn', 'spend'].map(function (k) { const c = CONTESTS[k][i % CONTESTS[k].length], pz = PRIZES[k][i % PRIZES[k].length]; return Object.assign({ type: k, prize: pz }, c); });
}
function cPrizeText(pz, val) {
  if (pz.t === 'gem') return '+' + pz.n + ' 💎';
  if (pz.t === 'food') return '🍖 ' + pz.n + ' кормів';
  if (pz.t === 'aura') return '✨ Аура на ' + pz.days + ' дні';
  if (pz.t === 'cash') return '💸 кешбек ' + pz.pct + '%' + (val !== undefined ? ' (+' + Math.min(pz.max, Math.round(val * pz.pct / 100)) + ' 💎)' : ' (до ' + pz.max + ' 💎)');
  if (pz.t === 'crown') return '👑 Корона на ' + pz.days + ' днів';
  if (pz.t === 'ice') return '🍦 морозиво';
  return '';
}
function contestVal(st, cid, u, day) { // ⚡ turbo: what is done after buying it counts ×1.5
  const v = contestRaw(st, cid, u, day), t = ((st.boosts || {})[u] || {}).turbo;
  return t && t.day === day && t.base[cid] !== undefined ? money(t.base[cid] + (v - t.base[cid]) * 1.5) : v;
}
// ⚡ boosts: not crystals for crystals — each gives something else. st.boosts[uid] = { turbo: { day, base }, easy: { day, uah }, petxp: { until } }
const BOOSTS = {
  turbo: { icon: '⚡', label: 'Турбо змагання', price: 20, desc: 'усе, що зробиш далі сьогодні, рахується ×1,5 у змаганнях дня' },
  easy: { icon: '🛡', label: 'Легка норма', price: 25, desc: 'сьогоднішня норма менша на 1 збір' },
  petxp: { icon: '🐾', label: 'Бонус улюбленцю', price: 15, desc: '+30% досвіду улюбленцю на 24 години' },
};
function boostState(st, id, now) {
  const b = (st.boosts || {})[id] || {}, day = dayKey(now, st.cfg), easyUah = money(Math.max(rewardNow(st, 'beds'), rewardNow(st, 'plots')));
  return Object.keys(BOOSTS).map(function (k) {
    const B = BOOSTS[k], on = k === 'petxp' ? (b.petxp && b.petxp.until > now ? b.petxp.until : 0) : (b[k] && b[k].day === day ? nextHour(0) : 0);
    return { key: k, icon: B.icon, label: B.label, price: B.price, desc: k === 'easy' ? 'сьогоднішня норма менша на 1 збір (−' + easyUah + ' ₴)' : B.desc, until: on, canBuy: k === 'petxp' || !on };
  });
}
function buyBoost(st, user, k, q) {
  const id = String(user.id), B = BOOSTS[k], now = Date.now(), day = dayKey(now, st.cfg);
  if (!B) { q.out.push('Такого немає'); return; }
  st.boosts = st.boosts || {}; const b = st.boosts[id] = st.boosts[id] || {};
  if (k !== 'petxp' && b[k] && b[k].day === day) { q.out.push('Сьогодні вже діє 👌'); return; }
  if (k === 'petxp' && !petOk(petOf(st, id))) { q.out.push('Улюбленця ще немає'); return; }
  const x = inv(st, id); if (x.gems < B.price) { q.out.push('Не вистачає ' + money(B.price - x.gems) + ' 💎'); return; }
  const before = doneToday(st, id, now), p = st.people[id];
  x.gems = money(x.gems - B.price); dayAdd(st, id, 'shop', B.price);
  if (k === 'turbo') { const base = {}; contestsOf(day).forEach(function (c) { base[c.id] = contestRaw(st, c.id, id, day); }); b.turbo = { day: day, base: base }; }
  if (k === 'easy') b.easy = { day: day, uah: money(Math.max(rewardNow(st, 'beds'), rewardNow(st, 'plots'))) };
  if (k === 'petxp') b.petxp = { until: Math.max(now, (b.petxp || {}).until || 0) + 86400000 };
  q.out.push(B.icon + ' ' + B.label + ' увімкнено!');
  if (k === 'easy' && p && before < p.norm && doneToday(st, id, now) >= p.norm) { const line = streakNow(st, id, now); q.out.push('🎯 Норму виконано!'); if (st.group) sayK(st, 'easy:' + id, '🛡 ' + esc(p.name) + ': норму виконано з легкою нормою!' + line); }
}
function contestRaw(st, cid, u, day) {
  const r = ((st.dayLog || {})[day] || {})[u] || {};
  if (cid === 'gin') return money(r.gin || 0);
  if (cid === 'xp') return r.xp || 0;
  if (cid === 'style') return money(r.style || 0);
  if (cid === 'shop') return money(r.shop || 0);
  if (cid === 'ach') { const a = st.ach[u] || {}; return Object.keys(a).filter(function (k) { return a[k] === day; }).length; }
  if (cid === 'tasks') { const n = (((st.gemLog || {})[day] || {})[u] || {}).n || {};
    return Object.keys(n).reduce(function (a, k) { return a + n[k]; }, 0) + (st.pend || []).filter(function (x) { return String(x.uid) === String(u) && x.day === day; }).length; }
  return 0;
}
function settleContests(st, at) {
  const day = dayKey(at, st.cfg); st.contestDone = st.contestDone || {};
  if (st.contestDone[day]) return '';
  st.contestDone[day] = 1; Object.keys(st.contestDone).sort().slice(0, -10).forEach(function (k) { delete st.contestDone[k]; });
  const wk = weekKey(day), lines = [];
  st.prizes = st.prizes || []; st.cwins = st.cwins || {}; st.cwins[wk] = st.cwins[wk] || {};
  contestsOf(day).forEach(function (c) {
    const vals = Object.keys(st.people).map(function (u) { return { u: u, v: contestVal(st, c.id, u, day) }; }), max = Math.max.apply(null, vals.map(function (x) { return x.v; }).concat([0]));
    if (max <= 0) { lines.push(c.icon + ' ' + c.label + ': ніхто не взяв участь 😴'); return; }
    vals.filter(function (x) { return x.v === max; }).forEach(function (x) {
      const pz = Object.assign({}, c.prize); if (pz.t === 'cash') { pz.t = 'gem'; pz.n = Math.max(1, Math.min(c.prize.max, Math.round(x.v * c.prize.pct / 100))); }
      st.prizeSeq = (st.prizeSeq || 0) + 1;
      st.prizes.push({ id: 'z' + st.prizeSeq, uid: x.u, day: day, icon: c.icon, label: c.label, prize: pz });
      st.cwins[wk][x.u] = (st.cwins[wk][x.u] || 0) + 1;
      lines.push('🏆 ' + c.icon + ' ' + c.label + ': ' + b(nameOf(st, x.u)) + ' (' + x.v + ' ' + c.unit + ') → ' + cPrizeText(pz));
    });
  });
  if (new Date(day + 'T12:00:00Z').getUTCDay() === 0) { // Sunday: the week's champion
    const w = st.cwins[wk], best = Math.max.apply(null, Object.keys(w).map(function (u) { return w[u]; }).concat([0]));
    Object.keys(w).filter(function (u) { return best > 0 && w[u] === best; }).forEach(function (u) {
      [{ t: 'crown', days: 7 }, { t: 'ice', n: 1 }].forEach(function (pz) { st.prizeSeq++; st.prizes.push({ id: 'z' + st.prizeSeq, uid: u, day: day, icon: '👑', label: 'Чемпіон тижня (' + best + ' ' + plural(best, ['перемога', 'перемоги', 'перемог']) + ')', prize: pz }); });
      lines.push('👑 ' + b('Чемпіон тижня: ' + esc(nameOf(st, u))) + ' — ' + best + ' ' + plural(best, ['перемога', 'перемоги', 'перемог']) + '! Корона на 7 днів і 🍦');
    });
    Object.keys(st.cwins).sort().slice(0, -4).forEach(function (k) { delete st.cwins[k]; });
  }
  st.prizes = st.prizes.filter(function (z) { return z.day >= addDays(day, -14); }); // unclaimed for 2 weeks: gone
  return lines.length ? '🏆 ' + b('Змагання дня') + '\n' + lines.join('\n') + '\n🎁 Нагороди — забирай у 📱 застосунку' : '';
}
// ✨ temporary looks: st.temp[uid] = { aura: until }; exclusives (one holder for the whole family): st.excl[key] = { uid, until }
const EXCL = { crown: { icon: '👑', label: 'Корона', price: 100 }, sparkle: { icon: '🌟', label: 'Сяючий фон', price: 60 }, rainbow: { icon: '🌈', label: 'Веселкове ім’я', price: 80 } };
function exclHolder(st, k) { const e = (st.excl || {})[k]; return e && e.until > Date.now() ? e : null; }
function giveExcl(st, u, k, days) {
  const e = exclHolder(st, k); if (e && String(e.uid) !== String(u)) return false;
  st.excl = st.excl || {}; st.excl[k] = { uid: String(u), until: Math.max(Date.now(), e ? e.until : 0) + days * 86400000 }; return true;
}
function claimPrize(st, id, key, q) {
  const list = (st.prizes || []).filter(function (z) { return String(z.uid) === String(id) && (key === 'all' || z.id === key); });
  if (!list.length) { q.out.push('Уже забрано'); return; }
  const x = inv(st, id), got = [];
  list.forEach(function (z) {
    const pz = z.prize;
    if (pz.t === 'gem') x.gems = money(x.gems + pz.n);
    else if (pz.t === 'food') x.food += pz.n;
    else if (pz.t === 'ice') x.ice += pz.n || 1;
    else if (pz.t === 'aura') { st.temp = st.temp || {}; const t = st.temp[id] = st.temp[id] || {}; t.aura = Math.max(Date.now(), t.aura || 0) + pz.days * 86400000; }
    else if (pz.t === 'crown' && !giveExcl(st, id, 'crown', pz.days)) { x.gems = money(x.gems + 15); got.push('корона зайнята — замість неї +15 💎'); return; }
    got.push(cPrizeText(pz));
  });
  st.prizes = st.prizes.filter(function (z) { return list.indexOf(z) < 0; });
  q.out.push('🎁 ' + got.join(' · '));
}
function buyExcl(st, id, k, q) {
  const E = EXCL[k]; if (!E) { q.out.push('Такого немає'); return; }
  const e = exclHolder(st, k);
  if (e && String(e.uid) !== String(id)) { q.out.push('Зараз це в ' + nameOf(st, e.uid) + ' до ' + Utilities.formatDate(new Date(e.until), tz(), 'dd.MM')); return; }
  const x = inv(st, id); if (x.gems < E.price) { q.out.push('Не вистачає ' + money(E.price - x.gems) + ' 💎'); return; }
  x.gems = money(x.gems - E.price); dayAdd(st, id, 'style', E.price); giveExcl(st, id, k, 7);
  q.out.push(E.icon + ' ' + E.label + ' твоя на 7 днів!');
  const pe = st.people[id]; if (pe) sayK(st, 'excl:' + k, E.icon + ' ' + esc(pe.name) + ' ' + verb(pe, 'забрав', 'забрала') + ' ексклюзив «' + E.label + '» на тиждень! Поки що ні в кого іншого такого не буде 😎');
}
function appContest(st, id, now) {
  const day = dayKey(now, st.cfg), wk = weekKey(day), w = (st.cwins || {})[wk] || {};
  return { ends: nextHour(st.cfg.dayEnd), done: !!(st.contestDone || {})[day],
    list: contestsOf(day).map(function (c) { return { type: c.type, icon: c.icon, label: c.label, unit: c.unit, prize: cPrizeText(c.prize),
      board: Object.keys(st.people).map(function (u) { return { id: u, v: contestVal(st, c.id, u, day) }; }).sort(function (a, b) { return b.v - a.v; }) }; }),
    prizes: (st.prizes || []).filter(function (z) { return String(z.uid) === String(id); }).map(function (z) { return { id: z.id, icon: z.icon, label: z.label, text: cPrizeText(z.prize), day: z.day }; }),
    week: Object.keys(st.people).map(function (u) { return { id: u, wins: w[u] || 0 }; }).sort(function (a, b) { return b.wins - a.wins; }) };
}
function saveState(st) {
  dayTrack(st);
  const s = JSON.stringify(st), CH = 2500, out = {}; // 2500 chars ≤ 9 KB even if every char takes 3 bytes
  let n = 0; for (let i = 0; i < s.length; i += CH) out['STATE_' + n++] = s.slice(i, i + CH);
  out.STATE_N = String(n);
  const p = props(), old = +(p.getProperty('STATE_N') || 0);
  p.setProperties(out);
  for (let i = n; i < old; i++) p.deleteProperty('STATE_' + i);
  if (p.getProperty('STATE')) p.deleteProperty('STATE');
}
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function person(st, user) {
  let p = st.people[user.id];
  if (!p) {
    const name = user.first_name || user.username || ('id ' + user.id);
    const share = String(user.id) === String(st.owner) ? 50 : st.cfg.share;
    p = st.people[user.id] = { name: name, female: isFemale(name), share: share, norm: normFor(st.cfg, share) };
  }
  return p;
}
function nameOf(st, id) { return st.people[id] ? st.people[id].name : 'id ' + id; }
// The owner's name as he introduced himself to the bot (/iam), used everywhere instead of "тато"
function ownerName(st) { return st.owner && st.people[st.owner] ? st.people[st.owner].name : 'власник'; }
function ownerVerb(st, m, f) { const p = st.people[st.owner]; return p ? verb(p, m, f) : m; }
// Each person's colour in progress bars: the owner green, then yellow, blue… (changeable in ⚙️ → 👥 Люди)
const COLORS = ['🟩', '🟨', '🟦', '🟪', '🟧', '🟥', '🟫'];
function colorOf(st, id) {
  const p = st.people[id];
  if (p && p.color) return p.color;
  if (String(id) === String(st.owner)) return COLORS[0];
  const others = Object.keys(st.people).filter(function (k) { return String(k) !== String(st.owner); });
  const i = others.indexOf(String(id));
  return COLORS[1 + (i < 0 ? 0 : i) % (COLORS.length - 1)];
}

// ---------------------------------------------------------------- Telegram
function tg(method, payload) {
  const url = 'https://api.telegram.org/bot' + props().getProperty('BOT_TOKEN') + '/' + method;
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  const out = JSON.parse(res.getContentText());
  if (!out.ok) console.error('Telegram ' + method + ' failed: ' + res.getContentText());
  return out;
}
// A message in the group that only one person sees (Bot API 10.2+): inventory, shop, achievements and the like.
// Personal things never go to the group for everyone: if Telegram refuses the ephemeral message, it goes to the
// person's private chat with the bot (works once they pressed Start there).
function ephParams(uid, q) { const e = { receiver_user_id: Number(uid) }; if (q && q.id) e.callback_query_id = q.id; return e; }
function sayTo(st, uid, text, markup, q, key) {
  key = 'view'; // one personal message per person at a time, whatever it is: the new one replaces the old
  dropEph(st, uid, key);
  const p = { chat_id: st.group, text: text, parse_mode: 'HTML', ephemeral_message_parameters: ephParams(uid, q) };
  if (markup) p.reply_markup = markup;
  let r = tg('sendMessage', p);
  if ((!r || !r.ok) && q) { p.ephemeral_message_parameters = ephParams(uid); r = tg('sendMessage', p); }
  if (r && r.ok) return keepEph(st, uid, key, r);
  console.error('ephemeral failed, sending privately to ' + uid);
  return keepEph(st, uid, key, say(uid, text, markup), true);
}
// One message of each kind in the group: a new one deletes the previous one of the same kind (like the menu).
function dropK(st, key) {
  st.msgs = st.msgs || {};
  if (st.msgs[key]) tg('deleteMessage', { chat_id: st.group, message_id: st.msgs[key] });
  delete st.msgs[key];
}
function keepK(st, key, r) { st.msgs = st.msgs || {}; if (r && r.ok && r.result && r.result.message_id) st.msgs[key] = r.result.message_id; return r; }
function sayK(st, key, text, markup) { dropK(st, key); return keepK(st, key, say(st.group, text, markup)); }
// Personal messages: one per person at a time; the older one is deleted.
function dropEph(st, uid, key) {
  st.eph = st.eph || {}; const m = (st.eph[uid] || {})[key];
  if (!m) return;
  if (m.e) tg('deleteEphemeralMessage', { chat_id: st.group, receiver_user_id: Number(uid), ephemeral_message_id: m.e });
  else if (m.p) tg('deleteMessage', { chat_id: uid, message_id: m.p });
  delete st.eph[uid][key];
}
function keepEph(st, uid, key, r, privately) {
  if (!key || !r || !r.ok || !r.result) return r;
  st.eph = st.eph || {}; st.eph[uid] = st.eph[uid] || {};
  st.eph[uid][key] = privately ? { p: r.result.message_id } : { e: r.result.ephemeral_message_id || r.result.message_id };
  return r;
}
function say(chatId, text, markup) {
  const p = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (markup) p.reply_markup = markup;
  return tg('sendMessage', p);
}
function toast(q, text) {
  if (q && q.app) { if (text) q.out.push(String(text).replace(/<[^>]+>/g, '')); return; } // 📱 Mini App: collected and returned as JSON
  tg('answerCallbackQuery', { callback_query_id: q.id, text: String(text).slice(0, 190) });
}
// Button colors (Bot API 9.4): green to take/confirm, red to postpone/cancel, blue to buy/invest/use.
const BUTTON_STYLE = [
  [/^(done|daily:done|task|prize|payout|ivdone|ivsellok|ivtake|icebought|tok|petok|pet:take|pet:dar:)/, 'success'],
  [/^(later|stop|ivcancel|daily:later|faq:home|tno|petno)/, 'danger'],
  [/^(buy|iv:|ivshow|inv:|here|quiz|pet:feed|pet:start|pet:treat|pet:daru)/, 'primary'],
];
function button(text, data) {
  const b = { text: text, callback_data: data };
  BUTTON_STYLE.some(function (x) { if (x[0].test(data)) { b.style = x[1]; return true; } return false; });
  return b;
}
function lockedButton(text) { return { text: text, disabled: {} }; } // Bot API 10.3: shown, does nothing
function kindsOf(kind) { return kind === 'both' ? ['beds', 'plots'] : [kind]; }
function rewardOf(kind, cfg) { return kindsOf(kind).reduce(function (a, k) { return a + KINDS[k].reward(cfg); }, 0); }
// The first seedbed harvest of a day is the night crop (Chili Pepper, slow): it is paid like Cactus/Turmeric,
// whatever grows during the day.
function nightFirst(st, kind, now) { return kind === 'beds' && st.cfg.bedCrop !== 'tc' && !((st.count[dayKey(now || Date.now(), st.cfg)] || {}).beds); }
function hcfg(st, kind, now) { if (st._crop && kind === 'beds') return Object.assign({}, st.cfg, { bedCrop: st._crop }); return nightFirst(st, kind, now) ? Object.assign({}, st.cfg, { bedCrop: 'tc' }) : st.cfg; }
function rewardNow(st, kind) { return money(kindsOf(kind).reduce(function (a, k) { return a + KINDS[k].reward(hcfg(st, k)); }, 0)); }
function harvestButtons(kind, st) {
  const rows = [[button((kind === 'both' ? '✅ Зібрано все! (отримати ' : '✅ Зібрано! (отримати ') + rewardNow(st, kind) + ' грн)', 'done:' + kind)],
                [button('⏳ Зараз не можу (+' + dur(st.cfg.snooze) + ')', 'later:' + kind)]];
  if (allNormsDone(st, Date.now())) rows.push([button('🛑 На сьогодні все', 'stop:' + kind)]);
  return { inline_keyboard: rows };
}
const MONEY_BUTTON = { inline_keyboard: [[button('💸 Отримати мої гроші', 'payout')]] };
// The menu holds what people actually want between reminders: start or pause the day, see what is next,
// get credit for a harvest done before the reminder came, see earnings, get money. Settings live only in the owner's private chat (/menu there).
// The menu is grouped (Hick's law: fewer choices at once = faster decisions, kids especially):
// on top what is done every day, then 3 folders. Folders and everything in them are personal messages,
// so one person browsing does not change the chat for the others; each view has "⬅️" back to its folder.
function menuKeyboard(st) {
  const s = st && st.season, app = appTgLink();
  return { inline_keyboard: (app ? [[{ text: '📱 Відкрити ферму', url: app }]] : []).concat(s ? [[button('🎪 ' + SEASONS[s.type].icon + ' Сезон: ' + SEASONS[s.type].name + ' · день ' + seasonDayN(st) + ' з ' + s.days, 'menu:season')]] : []).concat([
    [button('▶️ Почати день', 'menu:go'), button('⏰ Що далі?', 'menu:next')],
    [button('✅ Я вже зібрав(ла)…', 'menu:early')],
    [button('👤 Я', 'menu:my'), button('🎮 Ігри й нагороди', 'menu:play')],
    [button('🏡 Ферма', 'menu:farmg'), button('❓ Питання', 'menu:faq')],
  ]) };
}
// 📱 Mini App links: the page itself (with this bot's address in ?api=) and a t.me link that opens it from any chat
function appFullUrl() { const u = props().getProperty('APP_URL'), api = props().getProperty('WEBAPP_URL'); return u && api ? u + '?api=' + encodeURIComponent(api) : ''; }
function appTgLink() { const u = props().getProperty('BOT_USERNAME'); return u && props().getProperty('APP_URL') ? 'https://t.me/' + u + '?startapp=farm' : ''; }
const FOLDERS = {
  my: { title: '👤 Я', text: 'Твої гроші, речі й значки.', rows: [
    [['📊 Мій заробіток', 'menu:stats'], ['💸 Отримати гроші', 'payout']],
    [['🎒 Інвентар', 'menu:inv'], ['🏅 Досягнення', 'menu:ach']],
    [['🐾 Улюбленець', 'menu:pet'], ['🔁 Торгівля', 'menu:trade']],
    [['💼 Мої інвестиції', 'menu:myinv']] ] },
  play: { title: '🎮 Ігри й нагороди', text: 'Кристали, магазин, перегони й спільні мрії.', rows: [
    [['💎 Заробити кристали', 'menu:earn']],
    [['🛒 Магазин', 'menu:shop'], ['🏁 Перегони', 'menu:race']],
    [['🤝 Спільні цілі', 'menu:goals']] ] },
  farmg: { title: '🏡 Ферма', text: 'Наша земля, інвестиції, статистика всієї родини і пауза.', rows: [
    [['🏡 Наша ферма', 'menu:farm'], ['📈 Статистика', 'menu:table']],
    [['💼 Інвестиції', 'menu:invest'], ['😴 Пауза до завтра', 'menu:pause']] ] },
};
const FOLDER_OF = { pet: 'my', stats: 'my', payout: 'my', inv: 'my', ach: 'my', trade: 'my', myinv: 'my', invest: 'farmg', earn: 'play', shop: 'play', race: 'play', goals: 'play', farm: 'farmg', table: 'farmg' };
function folderView(f, st, id) {
  const F = FOLDERS[f];
  return { text: f === 'my' && st && id ? myDash(st, String(id)) : F.title + '\n' + F.text, kb: { inline_keyboard: F.rows.map(function (r) { return r.map(function (x) { return button(x[0], x[1]); }); }).concat([[button('✖️ Закрити', 'menu:close')]]) } };
}
// 👤 Я: everything personal at a glance, the buttons below open the details
function myDash(st, id) {
  const now = Date.now(), pe = st.people[id], x = inv(st, id), lines = ['👤 ' + b(nameOf(st, id))];
  lines.push('💰 Баланс: ' + grn(st.balance[id] || 0) + ' · ' + GEM + ' ' + b(x.gems));
  if (pe) {
    const done = doneToday(st, id, now), norm = pe.norm || 0;
    lines.push('🎯 Сьогодні: ' + b(money(done) + ' / ' + norm + ' грн') + ' ' + (norm && done >= norm ? '✅ норму виконано' : sbar(norm ? done / norm : 0)));
  }
  const n = streakOf(st, id, now);
  lines.push('🔥 Стрік: ' + b(n + ' ' + plural(n, ['день', 'дні', 'днів'])));
  const sh = myShares(st, id), w = money((st.invWallet || {})[id] || 0);
  if (sh.length || w) lines.push('🏦 Інвестиції: +' + mon(sh.reduce(function (a, p) { return a + offerDaily(st, p) * shareOf(p, id); }, 0)) + ' грн/міс' + (w ? ' · до виплати ' + grn(w) : ''));
  const pet = petOf(st, id);
  if (pet && petOk(pet)) { petTick(st, pet, now); lines.push(petFace(pet) + ' ' + esc(pet.name) + ' · рівень ' + petLevel(pet) + ' · ситість ' + Math.round(pet.fed) + '%' + (pet.fed < st.cfg.pet.min ? ' 🥺 голодн' + pv(pet, 'ий', 'а') : '')); }
  const items = [];
  if (x.gift.length) items.push('🎁 приз чекає!');
  if (x.ice) items.push('🍦 ' + x.ice);
  if (x.vac.length) items.push('🏖 ' + x.vac.length);
  if (x.cash) items.push('💵 ' + money(x.cash) + ' грн');
  if (x.freeze) items.push('❄️ ' + x.freeze);
  if (x.food) items.push('🍖 ' + x.food);
  Object.keys(x.coupons).forEach(function (k) { const it = shopItem(k); if (it && x.coupons[k]) items.push(it.icon + ' ' + x.coupons[k]); });
  if (items.length) lines.push('🎒 ' + items.join(' · '));
  const tr = (st.trades || []).filter(function (t) { return t.sent && String(t.turn) === id; }).length;
  if (tr) lines.push('🔔 Угоди: ' + b(tr + ' ' + plural(tr, ['чекає', 'чекають', 'чекають'])) + ' твоєї відповіді');
  return lines.join('\n');
}
// "⬅️ <folder>" under a personal view; kind is a menu item or a folder
function withBack(kb, kind) {
  const f = FOLDERS[kind] ? kind : FOLDER_OF[kind];
  if (!f) return kb;
  const rows = ((kb && kb.inline_keyboard) || []).filter(function (r) { return !(r[0] && /^menu:(my|play|farmg|close)$/.test(r[0].callback_data)); });
  return { inline_keyboard: rows.concat([[button('⬅️ ' + FOLDERS[f].title, 'menu:' + f)]]) };
}
// Only one menu in the chat: a new /menu deletes the previous one.
function sendMenu(st) {
  if (st.menuMsg) tg('deleteMessage', { chat_id: st.group, message_id: st.menuMsg });
  const r = say(st.group, '🌾 Меню ферми', menuKeyboard(st));
  st.menuMsg = r && r.result ? r.result.message_id : null;
}
// "Я вже зібрав(ла)…": which harvest to count
function earlyKeyboard(st) {
  return { inline_keyboard: [
    [button('🌱 Грядки (+' + rewardNow(st, 'beds') + ' грн)', 'done:beds')],
    [button(KINDS.plots.title(st.cfg) + ' (+' + KINDS.plots.reward(st.cfg) + ' грн)', 'done:plots')],
    [button('◂ Назад', 'menu:back')],
  ] };
}
function inText(ms) { // "через 1 год 25 хв"
  const min = Math.max(0, Math.round((ms - Date.now()) / 60000));
  return min < 1 ? 'зараз' : 'через ' + dur(min);
}
function nextText(st, now) {
  const t = st.timers, open = st.open || {};
  const at = function (k) {
    if (t[k]) return whenText(t[k].due) + ' (' + inText(t[k].due) + ')';
    return open[k] ? 'готові зараз, чекають на «Зібрано!»' : 'на паузі (▶️ Почати день)';
  };
  return '⏰ Що далі:\n🌱 Грядки: ' + at('beds') + '\n' + KINDS.plots.title(st.cfg) + ': ' + at('plots') +
    '\n🌙 Підсумки дня: ' + (t.evening ? whenText(t.evening.due) + ' (' + inText(t.evening.due) + ')' : '—') +
    (normLine(st, now) ? '\n' + normLine(st, now) : '');
}

// ---------------------------------------------------------------- time helpers
function tz() { return Session.getScriptTimeZone(); }
function hhmm(ms) { return Utilities.formatDate(new Date(ms), tz(), 'HH:mm'); }
// farm day key: the day switches in the middle of the night, so a harvest at 01:00 still counts for the evening
function dayKey(ms, cfg) {
  return Utilities.formatDate(new Date(ms), tz(), 'yyyy-MM-dd'); // calendar days: a new day starts at midnight
}
function weekKey(day) { // Monday of the farm day's week, 'YYYY-MM-DD'
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function shortDate(day) { return +day.slice(8) + '.' + day.slice(5, 7); }
function monthKey(ms) { return Utilities.formatDate(new Date(ms), tz(), 'yyyy-MM'); }
function hourOf(ms) { return +Utilities.formatDate(new Date(ms), tz(), 'H'); }
function inWindow(ms, cfg) { const h = hourOf(ms); return h >= cfg.dayStart && h < cfg.dayEnd; }
function nextActive(ms, cfg) { // first moment >= ms inside the active hours (night -> next dayStart:00)
  if (inWindow(ms, cfg)) return ms;
  let t = Math.ceil(ms / 60000) * 60000;
  for (let i = 0; i < 48 * 60 && !inWindow(t, cfg); i++) t += 60000;
  return t;
}
function nextHour(hour) { // next moment at hour:00
  let t = Math.ceil(Date.now() / 3600000) * 3600000;
  for (let i = 0; i < 48 && hourOf(t) !== hour; i++) t += 3600000;
  return t;
}
function whenText(ms) { // "о 12:30", "завтра о 10:00"
  const fmt = function (d) { return Utilities.formatDate(d, tz(), 'yyyy-MM-dd'); };
  const days = Math.round((new Date(fmt(new Date(ms))) - new Date(fmt(new Date()))) / 864e5);
  return (days <= 0 ? 'о ' : days === 1 ? 'завтра о ' : 'післязавтра о ') + hhmm(ms);
}

// ---------------------------------------------------------------- timers
// st.timers[kind] = { id, due } for 'beds', 'plots', 'daily' (morning checklist) and 'evening' (summary)
function dropTrigger(id) {
  if (!id) return;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getUniqueId() === id) ScriptApp.deleteTrigger(t); });
}
function cancelTimer(st, kind) { const t = st.timers[kind]; if (t) dropTrigger(t.id); delete st.timers[kind]; }
function startTimerAt(st, kind, due) {
  cancelTimer(st, kind);
  const t = ScriptApp.newTrigger('fire_' + kind).timeBased().after(Math.max(60 * 1000, due - Date.now())).create();
  st.timers[kind] = { id: t.getUniqueId(), due: due };
}
function startTimer(st, kind, minutes) { startTimerAt(st, kind, nextActive(Date.now() + minutes * 60 * 1000, st.cfg)); }
function scheduleDayEvents(st) {
  startTimerAt(st, 'daily', nextHour(st.cfg.dayStart));
  startTimerAt(st, 'evening', nextHour(st.cfg.dayEnd));
  startTimerAt(st, 'warn', nextHour(Math.max(st.cfg.dayStart, st.cfg.dayEnd - 2))); // streak at risk
}
function fire(kind, e) {
  withLock(function () {
    const st = loadState();
    dropTrigger(e.triggerUid);
    const t = st.timers[kind];
    if (!t || t.id !== e.triggerUid || !st.group) return;
    delete st.timers[kind];
    if (kind === 'daily') { startTimerAt(st, 'daily', nextHour(st.cfg.dayStart)); saveState(st); postDaily(st); seasonMorning(st); saveState(st); return; }
    if (kind === 'evening') {
      startTimerAt(st, 'evening', nextHour(st.cfg.dayEnd));
      if (!st.timers.warn) startTimerAt(st, 'warn', nextHour(Math.max(st.cfg.dayStart, st.cfg.dayEnd - 2)));
      const at = hourOf(Date.now()) < st.cfg.dayStart ? Date.now() - (hourOf(Date.now()) + 1) * 3600000 : Date.now(); // the summary at 24:00 belongs to the day that just ended
      const streaks = settleStreaks(st, at), divs = payDividends(st, at), contest = settleContests(st, at);
      saveState(st); postEvening(st, streaks, divs); if (contest) sayK(st, 'contest', contest); checkAchAll(st); updateTags(st); maybeFinishRace(st); seasonEvening(st); saveState(st); return;
    }
    if (kind === 'warn') { startTimerAt(st, 'warn', nextHour(Math.max(st.cfg.dayStart, st.cfg.dayEnd - 2))); saveState(st); postStreakWarn(st); saveState(st); return; }
    if (kind === 'nag') { postNag(st); saveState(st); return; }
    if (!inWindow(Date.now(), st.cfg)) { startTimer(st, kind, 0); saveState(st); return; } // night: wait for the morning
    // Together: if the other kind is due within `together` minutes, wait for it and send one reminder for both.
    const other = kind === 'beds' ? 'plots' : 'beds', ot = st.timers[other], wait = ot ? ot.due - Date.now() : Infinity;
    if (st.cfg.together && wait <= 90 * 1000) { cancelTimer(st, other); postBoth(st); saveState(st); return; }
    if (st.cfg.together && wait <= st.cfg.together * 60 * 1000) { startTimerAt(st, kind, ot.due); saveState(st); return; }
    postReminder(st, kind);
    saveState(st);
  });
}
function fire_beds(e) { fire('beds', e); }
function fire_plots(e) { fire('plots', e); }
function fire_slot(e) { fire('plots', e); } // timers created by v3
function fire_daily(e) { fire('daily', e); }
function fire_evening(e) { fire('evening', e); }
function fire_nag(e) { fire('nag', e); }
function fire_warn(e) { fire('warn', e); }

// ---------------------------------------------------------------- norms and stats
function today(st, now) { return st.stats['d:' + dayKey(now, st.cfg)] || {}; }
// The farm's reference day (еталон), the base of norms, plot income and payback: Cactus/Turmeric in the seedbeds,
// 2/3 of the composter spots as Clover bundles and 1/3 as composters (worms), 6 harvests of each a day. It does not
// depend on what is planted today, only on the land: more plots or neutral land -> more pay per harvest -> a bigger norm.
const REF = { bedCrop: 'tc', bundleCrop: 'clover', bundleShare: 2 / 3, runs: 6 };
function refCfg(c) { // the farm's config as in the reference day
  const f = farmCalc(c), nTot = (c.neutral || 0) + (c.nbundles || 0), nb = Math.round(nTot * REF.bundleShare);
  return Object.assign({}, c, { bedCrop: REF.bedCrop, bundleCrop: REF.bundleCrop, bedTimer: 0, plotTimer: 0,
    bundles: Math.round(f.spots * REF.bundleShare), nbundles: nb, neutral: nTot - nb });
}
function farmMax(c) {
  const r = refCfg(c);
  return money(REF.runs * (KINDS.beds.reward(r) + KINDS.plots.reward(r)));
}
function normFor(c, share) { return Math.max(5, Math.round(farmMax(c) * share / 100 / 5) * 5); } // whole fives: easy to remember
function overStep(c) { return normFor(c, c.overPct); }
// what counts for the norm: UAH earned today (harvests and pet finds, before money set aside for goals)
function doneToday(st, id, now) {
  const r = today(st, now)[id], e = ((st.boosts || {})[id] || {}).easy, n = (r ? money(r.g !== undefined ? r.g : r.uah) : 0) + (e && e.day === dayKey(now, st.cfg) ? e.uah : 0); // 🛡 easy norm counts as one harvest
  return onVacation(st, id, now) ? Math.max(n, st.people[id] ? st.people[id].norm : 0) : n;
}
function onVacation(st, id, now) { return !!(st.vacation[dayKey(now, st.cfg)] || {})[id]; }
function allNormsDone(st, now) {
  const ids = Object.keys(st.people);
  return ids.length > 0 && ids.every(function (id) { return doneToday(st, id, now) >= st.people[id].norm; });
}
function normLine(st, now) {
  const ids = Object.keys(st.people);
  if (!ids.length) return '';
  return '🎯 Норма на сьогодні: ' + ids.map(function (id) {
    const n = doneToday(st, id, now), norm = st.people[id].norm;
    return esc(st.people[id].name) + (onVacation(st, id, now) ? ' 🏖' : ' ' + Math.floor(n) + '/' + norm + ' грн' + (n >= norm ? ' 🔥' : ''));
  }).join(', ');
}
function earnedLines(st, bucket) {
  const ids = Object.keys(bucket || {});
  if (!ids.length) return '  поки ніхто не збирав';
  return ids.sort(function (a, b) { return bucket[b].uah - bucket[a].uah; }).map(function (id) {
    const p = st.people[id];
    return '🤑 ' + esc(nameOf(st, id)) + ' ' + verb(p, 'зібрав', 'зібрала') + ' ' + times(bucket[id].n) +
      ', заробивши ' + uahWords(bucket[id].uah);
  }).join('\n');
}
function balanceLines(st) {
  const ids = Object.keys(st.balance).filter(function (id) { return st.balance[id] > 0; });
  if (!ids.length) return '  у всіх 0 грн';
  return ids.sort(function (a, b) { return st.balance[b] - st.balance[a]; }).map(function (id) {
    return '  ' + esc(nameOf(st, id)) + ': ' + grn(st.balance[id]);
  }).join('\n');
}
// Harvest kinds ('beds', 'plots') count as a harvest, feed the bank and score in a race;
// 'daily' (checklist) and 'vacation' (paid day off) only pay.
// 💎 for a harvest: crops that grow an hour or less give half (they are harvested more often)
function harvestGemFor(st, kind, now) {
  const g = st.cfg.harvestGem || 0;
  return KINDS[kind].cycle(hcfg(st, kind, now)) <= 60 ? g / 2 : g;
}
function credit(st, user, kind, uahAmount, now) {
  const day = dayKey(now, st.cfg), harvest = !!KINDS[kind];
  if (harvest) {
    const full = KINDS[kind].full(hcfg(st, kind, now)); // the piggy bank gets its share of founder land only
    st.bank = money(st.bank + Math.max(0, full - payOf(full, st.cfg)));
    const R = st.race;
    if (R && R.active && day >= R.start && day <= R.end) R.scores[user.id] = (R.scores[user.id] || 0) + 1;
    st._early = (st._early || 0) + earlyBonus(st, user.id, now);
    const hg = harvestGemFor(st, kind, now);
    if (hg) { inv(st, user.id).gems += hg; const g0 = gemLog(st, day, user.id); g0.harv = (g0.harv || 0) + hg; st._hgem = (st._hgem || 0) + hg; }
  }
  const cnt = st.count[day] = st.count[day] || {};
  if (harvest) cnt[kind] = (cnt[kind] || 0) + 1;
  if (harvest) { st.grown = st.grown || {}; st.grown[kind] = now + KINDS[kind].cycle(st.cfg) * 60000; } // when it is really ripe (the reminder may wait for the morning)
  Object.keys(st.count).sort().slice(0, -3).forEach(function (k) { delete st.count[k]; });
  const gross = uahAmount, counts = harvest || kind === 'pet'; // counts for the norm
  if (harvest) { const cut = goalsTake(st, String(user.id), uahAmount); uahAmount = money(uahAmount - cut); st._cut = money((st._cut || 0) + cut); }
  st.balance[user.id] = money((st.balance[user.id] || 0) + uahAmount);
  ['d:' + day, 'w:' + weekKey(day), 'm:' + monthKey(now)].forEach(function (key) {
    const b = st.stats[key] = st.stats[key] || {};
    const r = b[user.id] = b[user.id] || { n: 0, uah: 0 };
    if (harvest) r.n += 1;
    if (counts) r.g = money((r.g !== undefined ? r.g : r.uah) + gross);
    r.uah += uahAmount;
  });
  const keys = Object.keys(st.stats).sort(); // keep ~70 days, 12 weeks and 13 months
  [['d', 70], ['w', 12], ['m', 13]].forEach(function (p) {
    const ks = keys.filter(function (k) { return k[0] === p[0]; });
    ks.slice(0, Math.max(0, ks.length - p[1])).forEach(function (k) { delete st.stats[k]; });
  });
  // over the norm: +1 💎 for every full overStep UAH, at most overMax a day (the same for every crop)
  const p = st.people[user.id];
  if (!counts || !p) return 0;
  const c = st.cfg, gl = gemLog(st, day, user.id), done = doneToday(st, user.id, now);
  const due = Math.min(c.overMax, Math.max(0, Math.floor((done - p.norm) / overStep(c) + 1e-9))), add = due - (gl.overN || 0);
  if (add <= 0) return 0;
  gl.overN = due;
  const all = add + gemBoost(st, user.id, add); // 💎 season: +20%
  inv(st, user.id).gems += all;
  gl.bonus += all;
  return all;
}
function gemLog(st, day, id) {
  const d = st.gemLog[day] = st.gemLog[day] || {};
  Object.keys(st.gemLog).sort().slice(0, -7).forEach(function (k) { delete st.gemLog[k]; });
  return d[id] = d[id] || { bonus: 0, tasks: {} };
}
function statsText(st, now) {
  const day = dayKey(now, st.cfg), monday = weekKey(day);
  return '📊 Сьогодні:\n' + earnedLines(st, st.stats['d:' + day]) +
    '\n\n📅 Цей тиждень (з ' + shortDate(monday) + '):\n' + earnedLines(st, st.stats['w:' + monday]) +
    '\n\n💰 Можна отримати:\n' + balanceLines(st);
}

// ---------------------------------------------------------------- messages
// Only the newest reminder of a kind keeps its buttons, so one harvest cannot be counted twice.
function closeReminder(st, kind) {
  st.open = st.open || {};
  if (st.open[kind]) tg('editMessageReplyMarkup', { chat_id: st.group, message_id: st.open[kind], reply_markup: { inline_keyboard: [] } });
  delete st.open[kind];
}
function postReminder(st, kind) {
  const c = st.cfg, K = KINDS[kind], now = Date.now(), k = ((st.count[dayKey(now, c)] || {})[kind] || 0) + 1;
  closeReminder(st, kind);
  const r = sayK(st, 'rem:' + kind, K.title(c) + ' готові! (збір ' + k + ' сьогодні)' +
    '\n👉 ' + K.todo(c, k) +
    '\n💰 Нагорода за збір: ' + grn(K.reward(hcfg(st, kind, now))) + (nightFirst(st, kind, now) ? ' (нічний урожай — як Cactus/Turmeric)' : '') +
    (normLine(st, now) ? '\n' + normLine(st, now) : '') + raceLine(st, now) + (kind === 'plots' ? petRemLine(st) : ''), harvestButtons(kind, st));
  if (r && r.result && r.result.message_id) st.open[kind] = r.result.message_id;
  if (!st.timers.nag) armNag(st, c.nagAfter);
}
// One reminder for both kinds; "Зібрано все!" counts as two harvests (two norms) for the person.
function postBoth(st) {
  const c = st.cfg, now = Date.now(), cnt = st.count[dayKey(now, c)] || {};
  closeReminder(st, 'beds'); closeReminder(st, 'plots');
  const kb = (cnt.beds || 0) + 1, kp = (cnt.plots || 0) + 1;
  const r = sayK(st, 'rem:both', '🧺 Усе готово разом! (🌱 збір ' + kb + ', ' + plotType(c).icon + ' збір ' + kp + ' сьогодні)' +
    '\n👉 🌱 ' + KINDS.beds.todo(c, kb) +
    '\n👉 ' + plotType(c).icon + ' ' + KINDS.plots.todo(c, kp) +
    '\n💰 Нагорода: ' + KINDS.beds.reward(hcfg(st, 'beds', now)) + ' + ' + KINDS.plots.reward(c) + ' = ' + grn(rewardNow(st, 'both')) + (nightFirst(st, 'beds', now) ? ' (грядки: нічний урожай — як Cactus/Turmeric)' : '') +
    (normLine(st, now) ? '\n' + normLine(st, now) : '') + raceLine(st, now) + petRemLine(st), harvestButtons('both', st));
  if (r && r.result && r.result.message_id) { st.open = st.open || {}; st.open.beds = st.open.plots = r.result.message_id; }
  if (!st.timers.nag) armNag(st, c.nagAfter);
}

// ---------------------------------------------------------------- nagging when nobody reacts
// A reminder that stays without any button press for nagAfter minutes starts a nag message every nagEvery minutes,
// until someone presses "Я ТУТ!" (then the bot waits snooze minutes and starts again if still nobody harvested),
// "Зібрано!" or "Зараз не можу". Nag messages are deleted once someone reacts, so the chat stays clean.
function openKinds(st) { return Object.keys(st.open || {}).filter(function (k) { return st.open[k]; }); }
function armNag(st, minutes) {
  if (!st.cfg.nagAfter || !openKinds(st).length) { cancelTimer(st, 'nag'); return; }
  startTimer(st, 'nag', minutes);
}
function clearNags(st) {
  (st.nagMsgs || []).forEach(function (id) { tg('deleteMessage', { chat_id: st.group, message_id: id }); });
  st.nagMsgs = [];
}
function stopNag(st) { cancelTimer(st, 'nag'); clearNags(st); }
function postNag(st) {
  if (!openKinds(st).length || !inWindow(Date.now(), st.cfg)) { clearNags(st); return; }
  const now = Date.now(), behind = Object.keys(st.people).filter(function (id) { return doneToday(st, id, now) < st.people[id].norm; });
  const who = behind.length ? st.people[behind[Math.floor(Math.random() * behind.length)]].name : 'фермере';
  st.nagRecent = st.nagRecent || [];
  let i, tries = 0;
  do { i = Math.floor(Math.random() * NAGS.length); } while (st.nagRecent.indexOf(i) >= 0 && ++tries < 20);
  st.nagRecent = st.nagRecent.concat([i]).slice(-10); // no repeats among the last 10
  let text = esc(NAGS[i]).replace('{name}', b(who)) + '\n(' + openKinds(st).map(function (k) { return KINDS[k].title(st.cfg); }).join(', ') + ' чекають)';
  const risk = atRisk(st, now), late = hourOf(now) >= st.cfg.dayEnd - 2; // in the last 2 hours: tag them
  if (risk.length) text += '\n' + risk.map(function (id) {
    const left = st.people[id].norm - doneToday(st, id, now), n = streakOf(st, id, now);
    return '🔥 ' + (late ? mention(st, id) : b(nameOf(st, id))) + ', на кону стрік ' + n + ' ' + plural(n, ['день', 'дні', 'днів']) + '! Ще ' + Math.ceil(left) + ' грн до норми.';
  }).join('\n');
  clearNags(st); // only the newest nag stays in the chat
  const gifs = st.gifs || [];
  if (gifs.length && Math.random() < 0.4) { // sometimes with a GIF or sticker the owner gave the bot
    const g = gifs[Math.floor(Math.random() * gifs.length)];
    const r0 = g.type === 'sticker' ? tg('sendSticker', { chat_id: st.group, sticker: g.id }) : null;
    if (r0 && r0.result) st.nagMsgs.push(r0.result.message_id);
    if (g.type === 'animation') {
      const r1 = tg('sendAnimation', { chat_id: st.group, animation: g.id, caption: text, parse_mode: 'HTML', reply_markup: NAG_BUTTON });
      if (r1 && r1.result) st.nagMsgs.push(r1.result.message_id);
      startTimer(st, 'nag', st.cfg.nagEvery);
      return;
    }
  }
  const r = say(st.group, text, NAG_BUTTON);
  if (r && r.result) st.nagMsgs.push(r.result.message_id);
  st.nagMsgs = st.nagMsgs.slice(-80);
  startTimer(st, 'nag', st.cfg.nagEvery);
}
function postDaily(st) {
  sayK(st, 'daily', '☀️ Щоденні справи на кожному персонажі:\n' + DAILY.join('\n') +
    '\n\n' + GEM + ' Зробив(ла) все на одному персонажі — +' + st.cfg.taskGems.daily + ' ' + GEM + '. Натискай за кожного!' + petMorningLine(st),
    { inline_keyboard: [[button('☀️ Зроблено на 1 персонажі · +' + st.cfg.taskGems.daily + ' ' + GEM, 'task:daily:me')],
      [button('⏳ Пізніше (+1 год)', 'daily:later')], [button('▶️ Почати день: нагадування про землю', 'menu:go')]] });
}
function postEvening(st, streaks, divs) {
  const now = Date.now(), day = dayKey(now, st.cfg), monday = weekKey(day), cnt = st.count[day] || {};
  const week = st.stats['w:' + monday] || {}, weekTotal = Object.keys(week).reduce(function (a, id) { return a + week[id].uah; }, 0);
  const ids = Object.keys(st.people);
  const norms = ids.map(function (id) {
    const n = doneToday(st, id, now), norm = st.people[id].norm;
    return esc(st.people[id].name) + (onVacation(st, id, now) ? ' 🏖' : n >= norm ? ' 🔥' : ' ' + Math.floor(n) + '/' + norm + ' грн');
  }).join(', ');
  const anyMoney = Object.keys(st.balance).some(function (id) { return st.balance[id] > 0; });
  const head = '🌙 Підсумки дня\n' +
    '🌱 Грядки: ' + times(cnt.beds || 0) + ' · ' + plotType(st.cfg).icon + ' ' + plotType(st.cfg).label + ': ' + times(cnt.plots || 0) + '\n' +
    earnedLines(st, st.stats['d:' + day]) + (ids.length ? '\n🎯 Норма: ' + norms : '') + raceLine(st, now) + seasonLine(st) + goalLine(st);
  // the long parts fold away in the rich version (tap to open); the plain version shows everything
  const blocks = [];
  if (divs && divs.length) blocks.push(['💼 Дохід власників', divs.join('\n')]);
  if (streaks && streaks.length) blocks.push(['🔥 Стріки й кристали', streaks.join('\n') + '\n🛒 Витратити кристали: Магазин у /menu']);
  blocks.push(['📅 Тиждень з ' + shortDate(monday) + ': ' + money(weekTotal) + ' грн', earnedLines(st, week)]);
  const tail = '💰 Можна отримати:\n' + balanceLines(st) + (anyMoney ? '\nХочете гроші? Натисніть кнопку, бот сам побачить, хто натиснув 👇' : '') +
    '\n\nНа добраніч! Завтра о ' + st.cfg.dayStart + ':00 щоденні справи.';
  const P = function (t) { return t.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<p>' + l + '</p>'; }).join(''); };
  const html = P(head) + blocks.map(function (x) { return '<details><summary>' + esc(x[0]) + '</summary>' + P(x[1]) + '</details>'; }).join('') + P(tail);
  const text = head + blocks.map(function (x) { return '\n\n' + b(x[0]) + '\n' + x[1]; }).join('') + '\n\n' + tail;
  dropK(st, 'evening'); keepK(st, 'evening', sendView(st.group, { html: html, text: text }, anyMoney ? MONEY_BUTTON : null));
}
// A person gets everything they earned so far: the balance becomes 0 and the owner gets a private message.
function payout(st, user, now) {
  const p = person(st, user), amount = money(st.balance[user.id] || 0);
  if (amount <= 0) return '💰 ' + esc(p.name) + ', поки немає що отримати: ' + grn(0) + '.';
  st.balance[user.id] = 0;
  st.payouts.push({ uid: user.id, uah: amount, at: now });
  st.payouts = st.payouts.slice(-50);
  if (String(user.id) === String(st.owner)) return '💸 ' + esc(p.name) + ' ' + verb(p, 'забрав', 'забрала') + ' собі ' + grn(amount) + '.';
  if (st.owner) say(st.owner, '💸 Скинь гроші: ' + esc(p.name) + ' — ' + grn(amount) + ' (запит о ' + hhmm(now) + ')');
  return '💸 ' + esc(p.name) + ' отримує ' + grn(amount) + '. ' +
    esc(st.people[st.owner] ? st.people[st.owner].name : 'Власник') + ' скине найближчим часом.';
}

// ---------------------------------------------------------------- what the farm owns and earns
// Everything follows from the plots the farm owns (settings) and the prices: one harvest of all seedbeds and of all
// composters/bundles in gold, how many harvests fit in a day, and what the plots cost. Rewards are the real value.
function farmCalc(c) {
  let beds = 0, spots = 0, value = 0;
  Object.keys(PLOTS).forEach(function (k) {
    const P = PLOTS[k], n = c[k] || 0;
    beds += P.beds * n; spots += P.comps * n; value += P.price * n;
  });
  const bundles = Math.min(c.bundles || 0, spots), comps = spots - bundles; // a bundle takes a composter's spot
  const neutral = c.neutral || 0, nb = c.nbundles || 0; // neutral land: composters and bundles, harvested together with the plots
  const oneBeds = beds * bedHarvest(c).gold;
  const onePlots = (comps + neutral) * composterHarvest().gold + (bundles + nb) * bundleHarvest(c).gold;
  const f = { beds: beds, spots: spots, comps: comps, bundles: bundles + nb, pbundles: bundles, nbundles: nb, neutral: neutral, value: value, oneBeds: oneBeds, onePlots: onePlots };
  const window = (c.dayEnd - c.dayStart) * 60;
  const plotMin = c.plotTimer > 0 ? c.plotTimer : (bundles + nb > 0 && comps + neutral > 0 ? Math.max(COMPOSTER_MIN, bundleCrop(c).min) : bundles + nb > 0 ? bundleCrop(c).min : COMPOSTER_MIN);
  f.nBeds = Math.max(1, Math.floor(window / KINDS.beds.cycle(c)));
  f.nPlots = Math.max(1, Math.floor(window / plotMin));
  f.day = f.nBeds * oneBeds + f.nPlots * onePlots;
  return f;
}
function toUah(gold, c) { return Math.max(0, Math.round(gold * c.uahPer1000 / 1000)); }
function payOf(fullUah, c) { return Math.round(fullUah * (100 - (c.bankPct || 0)) / 100); }
function farmText(st) {
  const c = st.cfg, f = farmCalc(c);
  const uah = function (gold) { return b(payOf(toUah(gold, c), c).toLocaleString('uk-UA') + ' грн'); }; // without the bank share
  const lines = Object.keys(PLOTS).filter(function (k) { return c[k] > 0; }).map(function (k) { return '  ' + PLOTS[k].label + ': ' + c[k] + ' шт'; });
  const plotName = plotType(c).label.toLowerCase();
  if (f.nbundles) lines.push('  Нейтральна земля: ' + f.nbundles + ' ' + plural(f.nbundles, ['бандл', 'бандли', 'бандлів']));
  if (f.neutral) lines.push('  Нейтральна земля: ~' + f.neutral + ' ' + plural(f.neutral, ['компостер', 'компостери', 'компостерів']) + ' (у середньому, бо крадуть)');
  return '🏡 Наша ферма\n' + lines.join('\n') +
    '\nРосте: ' + f.beds + ' ' + plural(f.beds, ['грядка', 'грядки', 'грядок']) + ' (' + bedCrop(c).label + '), ' +
    (f.comps + f.neutral) + ' ' + plural(f.comps + f.neutral, ['компостер', 'компостери', 'компостерів']) +
    (f.bundles ? ' і ' + f.bundles + ' ' + plural(f.bundles, ['бандл', 'бандли', 'бандлів']) + ' ' + bundleCrop(c).label : '') +
    '\n\n🌾 Один збір: грядки ' + uah(f.oneBeds) + ', ' + plotName + ' ' + uah(f.onePlots) +
    '\n📅 Якщо все зібрати за день (грядки ' + times(f.nBeds) + ', ' + plotName + ' ' + times(f.nPlots) + '): ' + uah(f.day) +
    '\n🗓 На місяць (30 днів): ' + uah(f.day * 30) +
    '\n\n💎 Вартість ферми: ' + b(toUah(f.value, c).toLocaleString('uk-UA') + ' грн');
}

// ---------------------------------------------------------------- statistics table (📈 Статистика)
// One message the buttons edit: a week (a row per day) or a month (a row per week). Telegram shows <pre> in a
// monospace font, so the columns line up on a phone. Under the table, a bar per row for the farm total.
const WD = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
function addDays(day, n) { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekday(day) { return WD[new Date(day + 'T00:00:00Z').getUTCDay()]; }
function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function pad(t, n, left) { t = String(t); while (t.length < n) t = left ? ' ' + t : t + ' '; return t; }
function bucketSum(bucket) { return Object.keys(bucket || {}).reduce(function (a, id) { return a + bucket[id].uah; }, 0); }
// rows: [{ label, bucket, mark }] -> numbers per person and total, the best row, totals per person
function statData(st, rows) {
  const ids = Object.keys(st.people);
  const cells = rows.map(function (r) { return ids.map(function (id) { return r.bucket && r.bucket[id] ? Math.round(r.bucket[id].uah) : 0; }); });
  const vals = cells.map(function (c) { return c.reduce(function (a, v) { return a + v; }, 0); });
  const tot = ids.map(function (id, i) { return cells.reduce(function (a, c) { return a + c[i]; }, 0); });
  const sum = tot.reduce(function (a, v) { return a + v; }, 0), max = Math.max.apply(null, vals.concat([0]));
  return { ids: ids, cells: cells, vals: vals, tot: tot, sum: sum, best: max > 0 ? vals.indexOf(max) : -1 };
}
// The leaders under the table: 🥇 Марія — 473 грн · 52%
function leaders(st, d) {
  return d.ids.map(function (id, i) { return { id: id, v: d.tot[i] }; }).sort(function (a, b) { return b.v - a.v; })
    .map(function (x, i) { return (['🥇', '🥈', '🥉'][i] || '▫️') + ' ' + esc(nameOf(st, x.id)) + ' — ' + grn(x.v) + (d.sum ? ' · ' + Math.round(x.v / d.sum * 100) + '%' : ''); });
}
// A stats view in two forms: a native Telegram table (rich message, Bot API 10.1+) and plain text for the fallback.
function statView(st, title, lead, rows, totalLabel, notes) {
  const d = statData(st, rows), names = d.ids.map(function (id) { return nameOf(st, id); });
  const label = function (r, i) { return r.label + (i === d.best ? ' 🏆' : '') + (r.mark ? ' ' + r.mark : ''); };
  const td = function (v, bold) { return '<td align="right">' + (bold ? '<b>' + v + '</b>' : v) + '</td>'; };
  const html = '<h3>' + esc(title) + '</h3><p>' + lead(d) + '</p>' +
    '<table bordered striped><tr><th>' + esc(rows.unit) + '</th>' + names.map(function (n) { return '<th>' + esc(n) + '</th>'; }).join('') + '<th>Разом</th></tr>' +
    rows.map(function (r, i) { return '<tr><td>' + esc(label(r, i)) + '</td>' + d.cells[i].map(function (v, j) { const m = r.marks && r.marks[d.ids[j]]; return td(v + (m ? ' ' + m : '')); }).join('') + td(d.vals[i], i === d.best) + '</tr>'; }).join('') +
    '<tr><td><b>' + esc(totalLabel) + '</b></td>' + d.tot.map(function (v) { return td(v, true); }).join('') + td(d.sum, true) + '</tr></table>' +
    leaders(st, d).map(function (l) { return '<p>' + l + '</p>'; }).join('') + notes(d).map(function (n) { return '<p>' + n + '</p>'; }).join('');
  // fallback: a monospace table for clients or servers without rich messages
  const w = names.map(function (n) { return Math.max(5, Math.min(7, n.length)); }), lw = 9;
  const asc = { '🔥': '+', '💔': '-', '❄️': '*' };
  const line = function (l, vs, t, r) { return pad(l, lw) + vs.map(function (v, i) { const m = r && r.marks && asc[r.marks[d.ids[i]]]; return pad(v + (m || ' '), w[i] + 1, true); }).join('') + pad(t, 6, true); };
  const pre = [pad(rows.unit, lw) + names.map(function (n, i) { return pad(n.slice(0, w[i]), w[i] + 1, true); }).join('') + ' Разом']
    .concat(rows.map(function (r, i) { return line(r.label + (i === d.best ? '!' : ''), d.cells[i], d.vals[i], r); }))
    .concat([line(totalLabel, d.tot, d.sum)]);
  const text = b(title) + '\n' + lead(d) + '\n<pre>' + esc(pre.join('\n')) + '</pre>' + leaders(st, d).join('\n') +
    notes(d).map(function (n) { return '\n' + n; }).join('');
  return { html: html, text: text };
}
function weekView(st, monday) {
  const todayKey = dayKey(Date.now(), st.cfg), days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(monday, i); });
  const sunday = days[6];
  const title = '📈 ' + (+monday.slice(8)) + (monday.slice(5, 7) === sunday.slice(5, 7) ? '' : ' ' + MONTHS[+monday.slice(5, 7) - 1]) +
    '–' + (+sunday.slice(8)) + ' ' + MONTHS[+sunday.slice(5, 7) - 1];
  const rows = days.filter(function (d) { return d <= todayKey; }).map(function (d) {
    const log = st.normLog[d] || {}, marks = {};
    Object.keys(st.people).forEach(function (id) {
      if (d === todayKey && log[id] === undefined) marks[id] = doneToday(st, id, Date.now()) >= st.people[id].norm ? '🔥' : ''; // not settled yet
      else marks[id] = log[id] === 1 ? '🔥' : log[id] === 2 ? '❄️' : log[id] === 0 ? '💔' : '';
    });
    return { label: weekday(d) + ' ' + (+d.slice(8)), bucket: st.stats['d:' + d], mark: d === todayKey ? '⏳' : '', marks: marks };
  });
  rows.unit = 'День';
  if (!rows.some(function (r) { return r.bucket; })) return { html: '<h3>' + esc(title) + '</h3><p>За цей тиждень даних немає.</p>', text: b(title) + '\nЗа цей тиждень даних немає.' };
  const done = rows.filter(function (r) { return !r.mark; });
  const doneSum = done.reduce(function (a, r) { return a + Math.round(bucketSum(r.bucket)); }, 0);
  const prev = st.stats['w:' + addDays(monday, -7)];
  return statView(st, title, function (d) { return grn(d.sum) + ' заробили всі разом за тиждень'; }, rows, 'Разом', function (d) {
    const out = [];
    if (done.length) {
      let trend = '';
      if (prev && bucketSum(prev) > 0) { const pct = Math.round((doneSum / done.length) / (bucketSum(prev) / 7) * 100 - 100); trend = ' · ' + (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% до минулого тижня'; }
      out.push('📊 У середньому ' + grn(Math.round(doneSum / done.length)) + ' на день' + trend);
    }
    if (d.best >= 0) out.push('🏆 Найкращий день: ' + esc(rows[d.best].label) + ', ' + grn(d.vals[d.best]));
    out.push(streakLine(st, Date.now()));
    out.push('🔥 норму виконано · 💔 без норми, стрік обірвався · ❄️ врятувала заморозка');
    return out;
  });
}
function monthView(st, month) {
  const title = '📈 ' + MONTHS_NOM[+month.slice(5) - 1] + ' ' + month.slice(0, 4);
  const weeks = Object.keys(st.stats).filter(function (k) { return k.slice(0, 2) === 'w:' && k.slice(2, 9) === month; }).sort();
  if (!weeks.length) return { html: '<h3>' + esc(title) + '</h3><p>За цей місяць даних немає.</p>', text: b(title) + '\nЗа цей місяць даних немає.' };
  const cur = weekKey(dayKey(Date.now(), st.cfg));
  const rows = weeks.map(function (k) { const m = k.slice(2); return { label: (+m.slice(8)) + '–' + (+addDays(m, 6).slice(8)), bucket: st.stats[k], mark: m === cur ? '⏳' : '' }; });
  rows.unit = 'Тиждень';
  const m = st.stats['m:' + month];
  return statView(st, title, function (d) { return grn(m ? Math.round(bucketSum(m)) : d.sum) + ' заробили всі разом за місяць (з 1-го числа)'; }, rows, 'Разом',
    function (d) { return d.best >= 0 ? ['🏆 Найкращий тиждень: ' + esc(rows[d.best].label) + ', ' + grn(d.vals[d.best])] : []; });
}
// Rich message first; if Telegram refuses it, the same numbers as plain text.
function sendView(chat, v, markup) {
  const r = tg('sendRichMessage', { chat_id: chat, rich_message: { html: v.html }, reply_markup: markup });
  return r && r.ok ? r : say(chat, v.text, markup);
}
function sendViewTo(st, uid, v, markup, q, key) {
  key = 'view';
  dropEph(st, uid, key);
  let r = tg('sendRichMessage', { chat_id: st.group, rich_message: { html: v.html }, reply_markup: markup, ephemeral_message_parameters: ephParams(uid, q) });
  if (!r || !r.ok) r = tg('sendRichMessage', { chat_id: st.group, rich_message: { html: v.html }, reply_markup: markup, ephemeral_message_parameters: ephParams(uid) });
  return r && r.ok ? keepEph(st, uid, key, r) : sayTo(st, uid, v.text, markup, q, key);
}
function editViewEph(chat, uid, eid, v, markup) {
  const p = { chat_id: chat, receiver_user_id: Number(uid), ephemeral_message_id: eid, reply_markup: markup };
  const r = tg('editEphemeralMessageText', Object.assign({ rich_message: { html: v.html } }, p));
  if (!r || !r.ok) tg('editEphemeralMessageText', Object.assign({ text: v.text, parse_mode: 'HTML' }, p));
}
function editView(chat, mid, v, markup) {
  const r = tg('editMessageText', { chat_id: chat, message_id: mid, rich_message: { html: v.html }, reply_markup: markup });
  if (!r || !r.ok) tg('editMessageText', { chat_id: chat, message_id: mid, text: v.text, parse_mode: 'HTML', reply_markup: markup });
}
function weekKeyboard() { return withBack(_weekKeyboard.apply(null, arguments), 'farmg'); }
function _weekKeyboard(st, monday) {
  const prev = addDays(monday, -7), next = addDays(monday, 7), now = weekKey(dayKey(Date.now(), st.cfg));
  const has = function (w) { return !!st.stats['w:' + w]; };
  return { inline_keyboard: [[
    has(prev) ? button('◀️ ' + (+prev.slice(8)) + '–' + (+addDays(prev, 6).slice(8)), 'tab:w:' + prev) : button('·', 'noop'),
    button('📅 Місяць', 'tab:m:' + monday.slice(0, 7)),
    next <= now ? button('▶️', 'tab:w:' + next) : button('·', 'noop')]] };
}
function monthKeyboard() { return withBack(_monthKeyboard.apply(null, arguments), 'farmg'); }
function _monthKeyboard(st, month) {
  const d = new Date(month + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7);
  d.setUTCMonth(d.getUTCMonth() + 2); const next = d.toISOString().slice(0, 7);
  const cur = dayKey(Date.now(), st.cfg).slice(0, 7);
  return { inline_keyboard: [[
    st.stats['m:' + prev] ? button('◀️ ' + MONTHS_NOM[+prev.slice(5) - 1], 'tab:m:' + prev) : button('·', 'noop'),
    button('📅 Тиждень', 'tab:w:' + weekKey(dayKey(Date.now(), st.cfg))),
    next <= cur ? button('▶️ ' + MONTHS_NOM[+next.slice(5) - 1], 'tab:m:' + next) : button('·', 'noop')]] };
}

// ---------------------------------------------------------------- races (🏁) and prizes
// st.race = { active, start, end, scores: { uid: harvests } }; st.raceNext = the day the next race may start.
// A race starts on a morning (after the daily checklist) and ends with the evening summary of its last day.
const DAY_NAMES = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
function raceDayN(st, now) { const R = st.race; return Math.round((new Date(dayKey(now, st.cfg)) - new Date(R.start)) / 864e5) + 1; }
function raceLen(R) { return Math.round((new Date(R.end) - new Date(R.start)) / 864e5) + 1; }
function standings(st) {
  const sc = st.race.scores, ids = Object.keys(st.people);
  return ids.map(function (id) { return { id: id, n: sc[id] || 0 }; }).sort(function (a, b) { return b.n - a.n; });
}
function raceLine(st, now) {
  const R = st.race;
  if (!R || !R.active || dayKey(now, st.cfg) < R.start) return '';
  const s = standings(st);
  return '\n🏁 Перегони, день ' + raceDayN(st, now) + ' з ' + raceLen(R) + ': ' + s.map(function (x, i) {
    const t = esc(nameOf(st, x.id)) + ' ' + x.n; return i === 0 && x.n > 0 ? b(nameOf(st, x.id) + ' ' + x.n) : t;
  }).join(' · ');
}
function startRace(st, now) {
  const day = dayKey(now, st.cfg), len = rnd(st.cfg.raceMin, st.cfg.raceMax);
  st.race = { active: true, start: day, end: addDays(day, len - 1), scores: {} };
  const end = st.race.end;
  sayK(st, 'race', '🏁 ' + b('ПЕРЕГОНИ!') + ' 🏁\n\n' + len + ' ' + plural(len, ['день', 'дні', 'днів']) + ', фініш: ' +
    DAY_NAMES[new Date(end + 'T00:00:00Z').getUTCDay()] + ' ' + shortDate(end) + ' о ' + st.cfg.dayEnd + ':00.\n' +
    'Хто більше разів збере врожай, отримає ' + b('🎁 таємний приз') + '.\nЩо всередині, дізнаєтесь лише в кінці 😏\n' +
    '«Зібрано все!» на спільному нагадуванні = 2 збори.\n\nНа старт… увага… ЗБИРАЙ! 🚜');
}
function maybeStartRace(st) {
  return; // races are a 🎪 season now (the owner starts them)
  if (!st.cfg.races || !st.group || (st.race && st.race.active)) return;
  const day = dayKey(Date.now(), st.cfg);
  if (!st.raceNext) { st.raceNext = addDays(day, Math.max(1, rnd(st.cfg.restMin, st.cfg.restMax))); return; }
  if (day >= st.raceNext) startRace(st, Date.now());
}
function raceStatus(st, now) {
  const R = st.race;
  if (!R || !R.active) return '🏁 Зараз перегонів немає. Перегони — це 🎪 сезон: коли він почнеться, бот скаже!';
  return '🏁 ' + b('Перегони') + ', день ' + raceDayN(st, now) + ' з ' + raceLen(R) + ', фініш ' + DAY_NAMES[new Date(R.end + 'T00:00:00Z').getUTCDay()] + ' ' + shortDate(R.end) + ' о ' + st.cfg.dayEnd + ':00\n' +
    standings(st).map(function (x, i) { return (['🥇', '🥈', '🥉'][i] || '▫️') + ' ' + esc(nameOf(st, x.id)) + ' — ' + b(x.n) + ' ' + plural(x.n, ['збір', 'збори', 'зборів']); }).join('\n') +
    '\n🎁 Приз — таємниця до фінішу.';
}
// What one day off pays: the person's norm × the average reward of one harvest.
function dayPay(st, id) {
  const c = st.cfg, p = st.people[id];
  return Math.round(p ? p.norm : c.norm); // the norm is UAH a day
}
// A random prize the bank can pay for; its value leaves the bank at once.
function drawPrize(st, id) {
  const ice = st.cfg.icePrice, vac = dayPay(st, id), opts = [];
  if (st.bank >= ice) opts.push('ice');
  if (st.bank >= vac) opts.push('vac');
  if (st.bank >= 20) opts.push('cash');
  const kind = opts.length ? opts[Math.floor(Math.random() * opts.length)] : 'ice';
  if (kind === 'ice') { const n = Math.max(1, Math.min(rnd(1, 3), Math.floor(st.bank / ice))); st.bank = money(Math.max(0, st.bank - n * ice)); return { type: 'ice', n: n }; }
  if (kind === 'vac') { st.bank = money(st.bank - vac); return { type: 'vac', uah: vac }; }
  const cash = Math.max(1, Math.round(st.bank * rnd(10, 30) / 100)); st.bank = money(st.bank - cash); return { type: 'cash', uah: cash };
}
function prizeText(g) {
  if (g.type === 'ice') return '🍦 ' + b(g.n + ' ' + plural(g.n, ['МОРОЗИВО', 'МОРОЗИВА', 'МОРОЗИВ']) + '!');
  if (g.type === 'vac') return '🏖 ' + b('ОПЛАЧУВАНА ВІДПУСТКА!') + '\nОдин день без роботи з повною зарплатою (' + grn(g.uah) + ').';
  return '💰 ' + b('ГРОШОВИЙ ПРИЗ: ' + money(g.uah) + ' грн!');
}
function inv(st, id) {
  const x = st.inv[id] = st.inv[id] || {};
  x.ice = x.ice || 0; x.vac = x.vac || []; x.cash = x.cash || 0; x.gift = x.gift || [];
  x.gems = x.gems || 0; x.freeze = x.freeze || 0; x.coupons = x.coupons || {}; x.food = x.food || 0;
  return x;
}
function maybeFinishRace(st) {
  const R = st.race;
  if (!R || !R.active || dayKey(Date.now(), st.cfg) < R.end) return;
  const s = standings(st), top = s.length ? s[0].n : 0;
  const winners = top > 0 ? s.filter(function (x) { return x.n === top; }) : [];
  if (seasonOn(st, 'race')) { st.season.winners = winners.map(function (x) { return String(x.id); }); st.season.board = s; }
  winners.forEach(function (x) { inv(st, x.id).gift.push(drawPrize(st, x.id)); st.raceWins[x.id] = (st.raceWins[x.id] || 0) + 1; checkAch(st, x.id); });
  st.race = { active: false, lastEnd: R.end };
  st.raceNext = addDays(R.end, 1 + rnd(st.cfg.restMin, st.cfg.restMax)); // days of break
  const text = '🏆 ' + b('Перегони закінчено!') + '\n\n' + s.map(function (x, i) {
    return (['🥇', '🥈', '🥉'][i] || '▫️') + ' ' + esc(nameOf(st, x.id)) + ' — ' + (i === 0 ? b(x.n) : x.n) + ' ' + plural(x.n, ['збір', 'збори', 'зборів']);
  }).join('\n') + '\n\n' + (winners.length ? winners.map(function (x) { return esc(nameOf(st, x.id)); }).join(' і ') +
    (winners.length > 1 ? ', вас чекають призи 🎁' : ', тебе чекає приз 🎁') : 'Ніхто нічого не зібрав, призу немає 🤷');
  sayK(st, 'raceEnd', text, winners.length ? { inline_keyboard: [[button('🎁 Відкрити приз', 'prize:open')]] } : null);
}
// The winner opens a hidden prize (from the race message or the inventory); the message shows it to everyone.
function openPrizes(st, user, q, old, edit) {
  const x = inv(st, user.id);
  if (!x.gift.length) { toast(q, 'Тут немає призу для тебе 😉'); return; }
  const p = person(st, user), lines = x.gift.map(prizeText);
  x.gift.forEach(function (g) { if (g.type === 'ice') x.ice += g.n; else if (g.type === 'vac') x.vac.push(g.uah); else x.cash = money(x.cash + g.uah); });
  x.gift = [];
  toast(q, '🎁');
  const waiting = Object.keys(st.inv).some(function (id) { return st.inv[id].gift && st.inv[id].gift.length; });
  const fromRace = /^🏆/.test(q.message.text || '');
  const reveal = '\n\n🎁 ' + esc(p.name) + ' відкриває приз…\n' + lines.join('\n') + '\nВже в 🎒 Інвентарі.';
  if (fromRace) edit(old + reveal, waiting ? { inline_keyboard: [[button('🎁 Відкрити приз', 'prize:open')]] } : null);
  else { sayK(st, 'prize', '🎁 ' + esc(p.name) + ' ' + verb(p, 'відкрив', 'відкрила') + ' приз…\n' + lines.join('\n')); edit(invText(st, user.id), invKeyboard(st, user.id)); }
}
function invText(st, id) {
  const x = inv(st, id), p = st.people[id], name = p ? p.name : nameOf(st, id);
  const items = [];
  if (x.gift.length) items.push('🎁 Невідкритий приз × ' + x.gift.length);
  if (x.ice) items.push('🍦 Морозиво × ' + x.ice);
  if (x.vac.length) items.push('🏖 Оплачувана відпустка × ' + x.vac.length + ' (день = ' + grn(x.vac[0]) + ')');
  if (x.cash) items.push('💰 Грошовий приз: ' + grn(x.cash));
  if (x.freeze) items.push('❄️ Заморозка стріку × ' + x.freeze + ' (спрацює сама)');
  if (x.food) items.push('🍖 Корм для улюбленця × ' + x.food);
  Object.keys(x.coupons).forEach(function (k) { const it = shopItem(k); if (it) items.push(it.icon + ' ' + it.label + ' × ' + x.coupons[k]); });
  const n = streakOf(st, id, Date.now());
  return '🎒 ' + b('Інвентар: ' + name) + '\n' + GEM + ' Кристали: ' + b(x.gems) + ' · 🔥 Стрік: ' + b(n + ' ' + plural(n, ['день', 'дні', 'днів'])) +
    '\n\n' + (items.join('\n') || 'Поки порожньо. Вигравай перегони 🏁 і купуй у 🛒 Магазині');
}
function invKeyboard() { return withBack(_invKeyboard.apply(null, arguments), 'my'); }
function _invKeyboard(st, id) {
  const x = inv(st, id), rows = [];
  if (x.gift.length) rows.push([button('🎁 Відкрити приз', 'prize:open')]);
  if (x.ice) rows.push([button('🍦 Хочу морозиво!', 'inv:ice:' + id)]);
  if (x.vac.length) rows.push([button('🏖 Хочу у відпустку (сьогодні)', 'inv:vac:' + id)]);
  if (x.cash) rows.push([button('💰 Забрати ' + money(x.cash) + ' грн', 'inv:cash:' + id)]);
  Object.keys(x.coupons).forEach(function (k) { const it = shopItem(k); if (it) rows.push([button('🎟 Використати: ' + it.icon + ' ' + it.label, 'inv:cpn_' + k + ':' + id)]); });
  if (x.gems > 0) rows.push([button('💱 Обміняти ' + GEM + ' на гривні', 'gemx:menu')]);
  rows.push([button('🛒 Магазин', 'menu:shop')]);
  return rows.length ? { inline_keyboard: rows } : null;
}
function useItem(st, user, what, owner, q, edit) {
  if (String(owner) !== String(user.id)) { toast(q, 'Це не твій інвентар. Відкрий свій: 🎒 у /menu'); return; }
  const x = inv(st, user.id), p = person(st, user), now = Date.now();
  if (what.indexOf('cpn_') === 0) { useCoupon(st, user, what.slice(4), q); edit(invText(st, user.id), invKeyboard(st, user.id)); return; }
  if (what === 'ice' && x.ice > 0) {
    x.ice -= 1; toast(q, '🍦');
    if (String(user.id) === String(st.owner)) sayK(st, 'ice', '🍦 ' + esc(p.name) + ' пригощається призовим морозивом! 😋');
    else {
      sayK(st, 'ice', '🍦 ' + esc(p.name) + ' хоче морозиво! ' + esc(nameOf(st, st.owner)) + ', з тебе одне 😋');
      if (st.owner) say(st.owner, '🍦 Купи морозиво, це приз для: ' + esc(p.name) + ' (1 шт).', { inline_keyboard: [[button('✅ Купив', 'icebought:' + user.id)]] });
    }
  } else if (what === 'vac' && x.vac.length) {
    if (onVacation(st, user.id, now)) { toast(q, 'Ти вже сьогодні у відпустці 😎'); return; }
    const uah = x.vac.shift(), day = dayKey(now, st.cfg);
    st.vacation[day] = st.vacation[day] || {}; st.vacation[day][user.id] = true;
    Object.keys(st.vacation).sort().slice(0, -7).forEach(function (k) { delete st.vacation[k]; });
    credit(st, user, 'vacation', uah, now);
    toast(q, '🏖 +' + uah + ' грн');
    sayK(st, 'vac', '🏖 ' + esc(p.name) + ' сьогодні у відпустці!\nНорма зарахована, +' + grn(uah) + '. Кличі ' + verb(p, 'його', 'її') + ' сьогодні не чіпають 😎');
  } else if (what === 'cash' && x.cash > 0) {
    const uah = x.cash; x.cash = 0; st.balance[user.id] = money((st.balance[user.id] || 0) + uah);
    toast(q, '+' + uah + ' грн');
    sayK(st, 'cash', '💰 +' + grn(uah) + ' до балансу ' + esc(p.name) + '. Отримати: 💸 у /menu.');
  } else { toast(q, 'Цього вже немає'); }
  edit(invText(st, user.id), invKeyboard(st, user.id));
}
function range(lo, hi) { return (lo === hi ? lo : lo + '–' + hi) + ' ' + plural(hi, ['день', 'дні', 'днів']); }
function raceSettingsText(st) {
  const c = st.cfg, R = st.race;
  return PAGES.race + '\n🏦 У банку: ' + grn(st.bank) + '\nУ банк іде ' + b(c.bankPct + '%') + ' з кожного збору (людям видно лише свою частину)' +
    '\n🎁 «Розділити банк» — усе, що в банку, ділиться порівну між усіма (' + Object.keys(st.people).length + ' осіб) і йде на баланс.' +
    '\n🍦 Морозиво коштує банку: ' + grn(c.icePrice) + '\n🏖 Відпустка: денна норма людини в гривнях' +
    '\n💰 Грошовий приз: 10–30% банку' +
    '\n🏁 Перегони: ' + b(c.races ? 'увімкнені' : 'вимкнені') +
    '\n  тривають ' + b(range(c.raceMin, c.raceMax)) + ', відпочинок між ними ' + b(range(c.restMin, c.restMax)) + ' (випадково в цих межах)' +
    (R && R.active ? ', зараз ідуть до ' + shortDate(R.end) : st.raceNext && c.races ? ', наступні можуть початися з ' + shortDate(st.raceNext) : '');
}

// ---------------------------------------------------------------- streaks (🔥), crystals (💎) and the shop (🛒)
// Every evening each person's day is checked: norm done -> the streak grows and pays crystals (day 1: 5, 2: 6, 3: 7,
// 4: 8, from day 5: 10). Norm not done -> a ❄️ freeze (bought in the shop) saves the streak, otherwise it starts again.
// Two hours before the end of the day the bot warns everyone whose streak is at risk.
// st.streak[uid] = { n, last: 'YYYY-MM-DD', best }; st.normLog['YYYY-MM-DD'][uid] = 1 done / 0 not / 2 frozen
const GEM = '💎';
function gemsFor(n) { return n >= 5 ? 10 : 4 + n; }
// Price in crystals (≈ days of saving: ~20 💎 a day are free after the pet). kid: only for the children (not the owner).
// Each person's shop is sorted by price and opens one item per day of streak: 1st day the cheapest, 2nd the next ...
const SHOP = [
  { id: 'freeze', icon: '❄️', label: 'Заморозка стріку', price: 20, hint: 'рятує стрік, якщо день без норми (спрацьовує сама)' },
  { id: 'food', icon: '🍲', label: 'Насипати мені їсти увесь день', price: 25 },
  { id: 'dishes', icon: '🍽', label: 'Мий за мною посуд увесь день', price: 25 },
  { id: 'dogday', icon: '🐕', label: 'Приберай за собакою замість мене увесь день', price: 30, kid: true },
  { id: 'dogwash', icon: '🛁', label: 'Помий за мене собаку 1 раз', price: 30, kid: true },
  { id: 'game', icon: '🎮', label: 'Пограти зі мною в будь-яку гру 1 годину', price: 35 },
  { id: 'lesson', icon: '📚', label: 'Зроби за мене один урок', price: 40, kid: true },
  { id: 'massage', icon: '💆', label: 'Масаж (мінімум 10 хвилин)', price: 45 },
  { id: 'watch', icon: '🎬', label: 'Я вибираю, що дивимось разом (до 30 хв)', price: 30 },
  { id: 'clean', icon: '🧹', label: 'Пропилососити та помити квартиру за мене 1 раз', price: 80, kid: true },
];
function shopFor(st, id) { // this person's items, the day of streak each one opens on
  const kid = String(id) !== String(st.owner);
  const pr = st.cfg.shopPrices || {};
  return SHOP.filter(function (it) { return kid || !it.kid; })
    .map(function (it, i) { return Object.assign({}, it, { price: pr[it.id] || it.price, ord: i }); })
    .sort(function (a, b) { return a.price - b.price || a.ord - b.ord; }) // cheapest first: one more opens each streak day
    .map(function (it, i) { const k = shopBought(st, id, it.id); return Object.assign(it, { need: i + 1, base: it.price, times: k, price: Math.round(it.price * Math.pow(1 + st.cfg.shopRise / 100, k)) }); });
}
function shopBought(st, id, itemId) { // purchases of this item this week (the price grows with each)
  const w = weekKey(dayKey(Date.now(), st.cfg)), b = ((st.shopWeek || {})[id] || {});
  return b.w === w ? (b[itemId] || 0) : 0;
}
function shopToday(st, id) { // the unlocked items on sale today: a window of cfg.shopDaily that moves every day
  const n = streakOf(st, id, Date.now()), open = shopFor(st, id).filter(function (it) { return n >= it.need; }), k = st.cfg.shopDaily;
  if (open.length <= k) return open.map(function (it) { return it.id; });
  const d = Math.floor(new Date(dayKey(Date.now(), st.cfg) + 'T00:00:00Z').getTime() / 86400000), start = (d * k) % open.length, ids = [];
  for (let i = 0; i < k; i++) ids.push(open[(start + i) % open.length].id);
  return ids;
}
// the streak level of an item as a keycap: 1️⃣ 3️⃣ 5️⃣ 7️⃣ 🔟 1️⃣2️⃣
function lvl(n) { return n === 10 ? '🔟' : String(n).split('').map(function (d) { return d + '\uFE0F\u20E3'; }).join(''); }
const TASKS = [ // extra ways to earn crystals: as many times as done (many characters, many dailies); the owner approves each in private
  { id: 'daily', icon: '☀️', label: 'Щоденні справи', per: 'за персонажа', list: true },
  { id: 'restock', icon: '📦', label: 'Поповнити запаси ферми', per: 'за раз' },
  { id: 'flower', icon: '🌸', label: 'Купити буйволів за квіточки', per: 'за всіх персонажів', note: 'валюта «квітка»; одне натискання за всіх персонажів' },
  { id: 'alt', icon: '🧑‍🌾', label: 'Прокачати альта й поставити пугало', per: 'за альта' },
  { id: 'dog', icon: '🐕', label: 'Закласти собачку', per: 'за раз', note: 'чікен або буйволи' },
  { id: 'gift', icon: '🎁', label: 'Забрати подарунок', per: 'за персонажа' },
  { id: 'nui', icon: '🕯', label: 'Зробити квести Нуі', per: 'за персонажа' },
  { id: 'quest', icon: '📜', label: 'Пройти щоденний квест', per: 'за квест' },
  { id: 'neutral', icon: '🪱', label: 'Розставити компостери на нейтральній землі', per: 'за раз' },
  { id: 'event', icon: '🎉', label: 'Пройти івент розробників', per: 'за івент' },
];
const GAMES = { ar: '⚔️ ArcheRage', wow: '🐉 WoW' };
// WoW Forever dungeons by recommended level (zockify.com/forever/dungeons, 22.11.2026); ★ = new in Forever
const WOW_DUNGEONS = [
  ['rfc', 'Ragefire Chasm', '13-18'], ['hot', 'Hall of Thanes ★', '13-18'], ['rol', 'Ruins of Lordaeron ★', '15-20'], ['wc', 'Wailing Caverns', '17-25'],
  ['dm', 'The Deadmines', '18-23'], ['bfd', 'Blackfathom Deeps', '20-30'], ['sfk', 'Shadowfang Keep', '22-30'], ['stk', 'The Stockade', '22-30'],
  ['exc', 'Excavation Site ★', '24-29'], ['smg', 'SM: Graveyard', '26-36'], ['dal', 'City of Dalaran ★', '28-33'], ['gno', 'Gnomeregan', '29-38'],
  ['sml', 'SM: Library', '29-39'], ['rfk', 'Razorfen Kraul', '30-40'], ['sma', 'SM: Armory', '32-42'], ['smc', 'SM: Cathedral', '35-45'],
  ['drc', 'The Drowned City ★', '35-40'], ['rfd', 'Razorfen Downs', '40-50'], ['krs', "Krol'dok Stronghold ★", '40-55'], ['ulda', 'Uldaman', '42-52'],
  ['zf', "Zul'Farrak", '44-54'], ['mara', 'Maraudon', '46-55'], ['alc', 'Alcaz Prison ★', '48-53'], ['st', "Temple of Atal'Hakkar", '52-58'],
  ['brd', 'Blackrock Depths', '52-60'], ['dima', 'Dire Maul', '54-60'], ['bmh', 'Blackmaw Hold ★', '55-60'], ['lbrs', 'Lower Blackrock Spire', '55-60'],
  ['ubrs', 'Upper Blackrock Spire', '56-60'], ['scholo', 'Scholomance', '58-60'], ['strat', 'Stratholme', '58-60'], ['shap', "Shaper's Terrace ★", '58-60'],
];
const WOW_HORDE = ['rfc']; // we play Alliance: Ragefire Chasm is inside Orgrimmar
function wowList(st) { return WOW_DUNGEONS.filter(function (d) { return WOW_HORDE.indexOf(d[0]) < 0 && +d[2].split('-')[0] <= st.cfg.wowMaxLvl; }); }
function wowDone(st, uid, d) { return ((st.wowDone || {})[uid] || {})[d] || 0; }
function wowGems(st, uid, d) { return wowDone(st, uid, d) ? st.cfg.wowRepeat : st.cfg.wowFirst; }
function taskDef(id) { // a crystal task, or a WoW dungeon ('wd_<id>')
  if (String(id).indexOf('wd_') === 0) { const d = WOW_DUNGEONS.filter(function (x) { return x[0] === id.slice(3); })[0]; return d ? { id: id, game: 'wow', icon: '🏰', label: 'WoW: ' + d[1], per: 'за данж' } : null; }
  return TASKS.filter(function (y) { return y.id === id; })[0] || null;
}
function gameOf(t) { return t.game || 'ar'; }
function earnPickText(st, id) { return GEM + ' ' + b('Заробити кристали') + ' · ' + esc(nameOf(st, id)) + ': ' + b(inv(st, id).gems) + ' ' + GEM + '\n\nДе граємо?'; }
function earnPickKeyboard(st, id) { return withBack({ inline_keyboard: [Object.keys(GAMES).map(function (g) { return button(GAMES[g], 'earng:' + g); })] }, 'play'); }
function earnText(st, id, game) {
  game = game || (st.earnGame || {})[id] || 'ar';
  if (game === 'wow') return earnWowText(st, id);
  const day = dayKey(Date.now(), st.cfg), g = (st.gemLog[day] || {})[id] || { tasks: {}, bonus: 0, n: {} }, p = st.people[id];
  const n = g.n || {}, wait = (st.pend || []).filter(function (x) { return String(x.uid) === String(id); }).length;
  const tasks = TASKS.filter(function (t) { return gameOf(t) === 'ar'; }).sort(function (a, b) { return st.cfg.taskGems[b.id] - st.cfg.taskGems[a.id]; }); // the biggest reward first
  return GEM + ' ' + b('Заробити кристали · ArcheRage') + ' · ' + esc(nameOf(st, id)) + ': ' + b(inv(st, id).gems) + ' ' + GEM +
    (wait ? '\n⏳ Чекає підтвердження: ' + b(wait) : '') + '\n━━━━━━━━━━━━━━━━━━━━' +
    tasks.map(function (t) {
      return '\n\n' + t.icon + ' ' + b(t.label) + '  ' + b('+' + st.cfg.taskGems[t.id] + ' ' + GEM) + ' ' + t.per + (n[t.id] ? ' · сьогодні ×' + n[t.id] : '') +
        (t.note ? '\n      ' + t.note : '') + (t.list ? '\n' + DAILY.map(function (x) { return '      ' + x; }).join('\n') : '');
    }).join('') +
    '\n━━━━━━━━━━━━━━━━━━━━' +
    '\n🔥 ' + b('Норма щодня') + ' — за стрік 5–10 ' + GEM +
    '\n🚜 ' + b('Понад норму') + (p ? ' (' + p.norm + ' грн)' : '') + ' — +1 ' + GEM + ' за кожні ' + overStep(st.cfg) + ' грн, до ' + st.cfg.overMax + ' на день' + (g.bonus ? ' · сьогодні вже +' + g.bonus + ' ' + GEM : '') +
    '\n\nЗробив(ла) — натисни кнопку нижче. На кількох персонажах — натискай за кожного. ' + esc(ownerName(st)) + ' підтверджує, і кристали твої 👍';
}
function earnWowText(st, id) {
  const day = dayKey(Date.now(), st.cfg), g = (st.gemLog[day] || {})[id] || { n: {} }, n = g.n || {}, wait = (st.pend || []).filter(function (x) { return String(x.uid) === String(id); }).length;
  return GEM + ' ' + b('Заробити кристали · WoW') + ' · ' + esc(nameOf(st, id)) + ': ' + b(inv(st, id).gems) + ' ' + GEM +
    (wait ? '\n⏳ Чекає підтвердження: ' + b(wait) : '') + '\n━━━━━━━━━━━━━━━━━━━━' +
    '\n🏰 ' + b('Данжі WoW Forever') + '\n🆕 Перше проходження: ' + b('+' + st.cfg.wowFirst + ' ' + GEM) + ' · 🔁 повторне: ' + b('+' + st.cfg.wowRepeat + ' ' + GEM) +
    '\nПройдено різних: ' + b(wowList(st).filter(function (d) { return wowDone(st, id, d[0]); }).length + ' з ' + wowList(st).length) + ' · Альянс, до ' + st.cfg.wowMaxLvl + ' рівня' + '\n\n' +
    wowList(st).map(function (d) { const k = wowDone(st, id, d[0]); return (k ? '✅' : '▫️') + ' ' + esc(d[1]) + ' · ' + d[2] + (k > 1 ? ' ×' + k : '') + (n['wd_' + d[0]] ? ' · сьогодні ×' + n['wd_' + d[0]] : ''); }).join('\n') +
    '\n━━━━━━━━━━━━━━━━━━━━\n★ — нові в Forever. Пройшов(ла) — натисни данж нижче. ' + esc(ownerName(st)) + ' підтверджує, і кристали твої 👍';
}
function earnKeyboard() { return withBack(_earnKeyboard.apply(null, arguments), 'play'); }
function _earnKeyboard(st, id, game) {
  game = game || (st.earnGame || {})[id] || 'ar';
  if (game === 'wow') {
    const r = [], bs = wowList(st).map(function (d) { return button((wowDone(st, id, d[0]) ? '🔁 ' : '🆕 ') + d[1].replace(' ★', '') + ' +' + wowGems(st, id, d[0]), 'task:wd_' + d[0] + ':' + id); });
    for (let i = 0; i < bs.length; i += 2) r.push(bs.slice(i, i + 2));
    r.push([button(GAMES.ar, 'earng:ar'), button('🛒 Магазин', 'menu:shop')]);
    return { inline_keyboard: r };
  }
  const rows = TASKS.filter(function (t) { return gameOf(t) === game; }).sort(function (a, b) { return st.cfg.taskGems[b.id] - st.cfg.taskGems[a.id]; })
    .map(function (t) { return [button('✅ ' + t.icon + ' ' + t.label + ' · +' + st.cfg.taskGems[t.id] + ' ' + GEM, 'task:' + t.id + ':' + id)]; });
  rows.push([button(game === 'wow' ? GAMES.ar : GAMES.wow, 'earng:' + (game === 'wow' ? 'ar' : 'wow')), button('🛒 Магазин', 'menu:shop')]);
  return { inline_keyboard: rows };
}
// Approved: crystals go to the person and count for the day the task was done.
function grantTask(st, x) {
  const t = taskDef(x.task); if (!t) return null;
  if (t.game === 'wow') x.gems = wowGems(st, x.uid, x.task.slice(3)); // first time or again: decided when approved
  const g = gemLog(st, x.day, x.uid), gems = x.gems;
  g.tasks[x.task] = (g.tasks[x.task] || 0) + gems; g.n = g.n || {}; g.n[x.task] = (g.n[x.task] || 0) + 1;
  x.gems = gems + gemBoost(st, x.uid, gems); // 💎 season: +20%
  inv(st, x.uid).gems += x.gems;
  if (t.game === 'wow') { st.wowDone = st.wowDone || {}; st.wowDone[x.uid] = st.wowDone[x.uid] || {}; st.wowDone[x.uid][x.task.slice(3)] = wowDone(st, x.uid, x.task.slice(3)) + 1; }
  return t;
}
function doTask(st, user, taskId, owner, q, edit) {
  if (owner === 'me') { owner = String(user.id); edit = function () {}; } // from the morning message in the group
  if (String(owner) !== String(user.id)) { toast(q, 'Це завдання іншої людини. Відкрий свої: 💎 у /menu'); return; }
  const t = taskDef(taskId), p = person(st, user);
  if (!t) { toast(q, 'Такого завдання немає'); return; }
  const x = { id: (st.pendSeq = (st.pendSeq || 0) + 1), uid: String(user.id), task: taskId, gems: t.game === 'wow' ? wowGems(st, String(user.id), taskId.slice(3)) : st.cfg.taskGems[taskId], day: dayKey(Date.now(), st.cfg), at: Date.now() };
  if (String(user.id) === String(st.owner)) { // the owner approves himself
    grantTask(st, x); toast(q, '+' + x.gems + ' ' + GEM);
    sayK(st, 'task', GEM + ' ' + esc(p.name) + ' ' + verb(p, 'виконав', 'виконала') + ': ' + t.icon + ' ' + b(t.label) + ' · +' + x.gems + ' ' + GEM);
  } else {
    st.pend = (st.pend || []).concat([x]);
    toast(q, '⏳ Надіслано на підтвердження: ' + t.icon + ' +' + x.gems + ' ' + GEM);
    postPending(st);
  }
  edit(earnText(st, user.id, t.game || 'ar'), earnKeyboard(st, user.id, t.game || 'ar'));
}
// The owner's private chat: one panel with everything waiting for approval (the old one is deleted).
function pendingText(st) {
  const list = st.pend || [];
  if (!list.length) return GEM + ' Усі завдання перевірено ✅';
  return GEM + ' ' + b('На підтвердження: ' + list.length) + '\n\n' + list.slice(0, 15).map(function (x, i) {
    const t = taskDef(x.task) || { icon: '?', label: x.task };
    return (i + 1) + '. ' + esc(nameOf(st, x.uid)) + ' — ' + t.icon + ' ' + esc(t.label) + ' · +' + x.gems + ' ' + GEM + ' (' + hhmm(x.at) + ')';
  }).join('\n') + (list.length > 15 ? '\n…і ще ' + (list.length - 15) : '');
}
function pendingKeyboard(st) {
  const list = st.pend || [];
  if (!list.length) return null;
  const rows = list.slice(0, 15).map(function (x, i) {
    const t = taskDef(x.task) || { icon: '?' };
    return [button('✅ ' + (i + 1) + '. ' + nameOf(st, x.uid) + ' ' + t.icon, 'tok:' + x.id), button('❌ ' + (i + 1), 'tno:' + x.id)];
  });
  if (list.length > 1) rows.push([button('✅ Підтвердити всі (' + list.length + ')', 'tok:all'), button('❌ Відхилити всі', 'tno:all')]);
  return { inline_keyboard: rows };
}
function postPending(st) {
  if (!st.owner) return;
  if (st.pendMsg) tg('deleteMessage', { chat_id: st.owner, message_id: st.pendMsg });
  const r = say(st.owner, pendingText(st), pendingKeyboard(st));
  st.pendMsg = r && r.result ? r.result.message_id : null;
}
// tok:<id>|all approves, tno:<id>|all rejects; the group gets one short summary, a rejected person a personal note.
function decideTasks(st, ok, which, q, edit) {
  const list = st.pend || [], pick = list.filter(function (x) { return which === 'all' || String(x.id) === String(which); });
  if (!pick.length) { toast(q, 'Вже вирішено'); edit(pendingText(st), pendingKeyboard(st)); return; }
  st.pend = list.filter(function (x) { return pick.indexOf(x) < 0; });
  const per = {};
  pick.forEach(function (x) {
    if (ok && grantTask(st, x)) { per[x.uid] = per[x.uid] || { gems: 0, n: 0 }; per[x.uid].gems += x.gems; per[x.uid].n++; }
  });
  if (ok && st.group) sayK(st, 'task', Object.keys(per).map(function (id) {
    const p = st.people[id] || { name: nameOf(st, id) };
    return GEM + ' ' + esc(p.name) + ': ' + verb(p, 'підтверджено', 'підтверджено') + ' ' + per[id].n + ' ' + plural(per[id].n, ['завдання', 'завдання', 'завдань']) + ' · +' + per[id].gems + ' ' + GEM + wallet(inv(st, id));
  }).join('\n'));
  if (!ok && st.group) {
    const ids = {}; pick.forEach(function (x) { ids[x.uid] = (ids[x.uid] || 0) + 1; });
    Object.keys(ids).forEach(function (id) { sayTo(st, id, '❌ ' + esc(ownerName(st)) + ' не ' + ownerVerb(st, 'підтвердив', 'підтвердила') + ' ' + ids[id] + ' ' + plural(ids[id], ['завдання', 'завдання', 'завдань']) + '. Якщо це помилка — напиши в чат 🙂', null, null, 'taskNo'); });
  }
  if (ok) refreshSeason(st);
  toast(q, ok ? '✅ Зараховано: ' + pick.length : '❌ Відхилено: ' + pick.length);
  edit(pendingText(st), pendingKeyboard(st));
}
function shopItem(id) { return SHOP.filter(function (x) { return x.id === id; })[0]; }
function streakOf(st, id, now) { // the streak as it stands today (a missed yesterday already broke it)
  const s = st.streak[id];
  if (!s) return 0;
  const today = dayKey(now, st.cfg);
  return s.last === today || s.last === addDays(today, -1) ? s.n : 0;
}
function mention(st, id) { return '<a href="tg://user?id=' + id + '">' + esc(nameOf(st, id)) + '</a>'; }
// The moment the norm is reached, the day counts for the streak (crystals right away). Returns a line or ''.
function streakNow(st, id, now) {
  id = String(id);
  const day = dayKey(now, st.cfg), p = st.people[id];
  if (!p || doneToday(st, id, now) < p.norm) return '';
  const s = st.streak[id] = st.streak[id] || { n: 0, last: '', best: 0 }, x = inv(st, id);
  if (s.last === day) return '';
  const cont = s.last === addDays(day, -1);
  s.n = cont ? s.n + 1 : 1; s.last = day; s.best = Math.max(s.best || 0, s.n);
  const g = gemsFor(s.n) + gemBoost(st, id, gemsFor(s.n)); x.gems += g; s.gems = g;
  st.normLog[day] = st.normLog[day] || {}; st.normLog[day][id] = 1;
  return '\n🔥 ' + esc(p.name) + ': стрік ' + b(s.n + ' ' + plural(s.n, ['день', 'дні', 'днів'])) + ' підряд! +' + g + ' ' + GEM;
}
// Catch-up: someone reached the norm but the day was not counted yet (e.g. before an update) — count it now.
function catchUpStreaks(st, now) {
  if (!st.group || !st.people) return false;
  const lines = Object.keys(st.people).map(function (id) { return streakNow(st, id, now); }).filter(String);
  if (lines.length) sayK(st, 'streakNow', lines.join('').replace(/^\n/, ''));
  return lines.length > 0;
}
// Evening: settle today for everyone; returns lines for the summary.
function settleStreaks(st, now) {
  const day = dayKey(now, st.cfg), out = [];
  st.normLog[day] = st.normLog[day] || {};
  Object.keys(st.people).forEach(function (id) {
    const s = st.streak[id] = st.streak[id] || { n: 0, last: '', best: 0 }, x = inv(st, id), name = esc(nameOf(st, id));
    if (s.last === day) { // counted already during the day, when the norm was reached
      if (st.normLog[day][id] === 1) out.push('🔥 ' + name + ': ' + b(s.n + ' ' + plural(s.n, ['день', 'дні', 'днів'])) + ' підряд · +' + (s.gems || gemsFor(s.n)) + ' ' + GEM + extraGems(st, day, id) + wallet(x));
      return;
    }
    const cont = s.last === addDays(day, -1), done = doneToday(st, id, now) >= st.people[id].norm;
    if (done) {
      s.n = cont ? s.n + 1 : 1; s.last = day; s.best = Math.max(s.best || 0, s.n);
      const g = gemsFor(s.n) + gemBoost(st, id, gemsFor(s.n)); x.gems += g; s.gems = g; st.normLog[day][id] = 1;
      out.push('🔥 ' + name + ': ' + b(s.n + ' ' + plural(s.n, ['день', 'дні', 'днів'])) + ' підряд · +' + g + ' ' + GEM + extraGems(st, day, id) + wallet(x));
    } else if (cont && s.n > 0 && x.freeze > 0) {
      x.freeze -= 1; s.last = day; st.normLog[day][id] = 2; // the streak stays, without crystals
      out.push('❄️ ' + name + ': заморозка врятувала стрік ' + b(s.n + ' ' + plural(s.n, ['день', 'дні', 'днів'])) + ' · +0 ' + GEM + extraGems(st, day, id) + wallet(x));
    } else {
      st.normLog[day][id] = 0;
      out.push(cont && s.n > 0 ? '💔 ' + name + ': стрік ' + s.n + ' ' + plural(s.n, ['день', 'дні', 'днів']) + ' обнулився · +0 ' + GEM + extraGems(st, day, id) + wallet(x) + '\n    Завтра починаємо знову!'
        : '▫️ ' + name + ': норму не виконано, стріку немає · +0 ' + GEM + extraGems(st, day, id) + wallet(x));
      s.n = 0; s.last = day;
    }
  });
  Object.keys(st.normLog).sort().slice(0, -70).forEach(function (k) { delete st.normLog[k]; });
  return out;
}
const STREAK_WARN = [
  '🔥 {name}, твій стрік {streak} під загрозою! Ще {left} до норми, і він живе.',
  '😱 {name}! {streak} підряд… і все може згоріти сьогодні. Лишилось {left}.',
  '🦉 {name}, я не злюся. Я просто розчарований. Стрік {streak}, а норми ще нема ({left}).',
  '⏰ {name}, до кінця дня 2 години. {left} — і стрік {streak} в безпеці.',
  '💎 {name}, кристали самі себе не зароблять! Ще {left} до норми.',
  '🥺 {name}, стрік {streak} дуже хоче жити. Допоможи йому: {left}.',
  '🚨 Тривога! Стрік {name} ({streak}) ось-ось обнулиться. Потрібно ще {left}.',
  '🐔 Кури питають, де {name}. Стрік {streak} чекає ще {left}.',
  '🏃 {name}, ривок! {left} — і завтра стрік стане ще довшим.',
  '🔥 {name}, вогник стріку згасає… Підкинь дров: {left}.',
  '😤 {name}, {streak} не для того збирались, щоб згоріти через лінь! Ще {left}.',
  '🌱 {name}, ферма в тебе вірить. {left} до норми, стрік {streak}.',
  '🎯 {name}, лишилось зовсім трохи: {left}. Не дай стріку {streak} піти.',
  '🦉 {name}… Ти ж не хочеш почати з нуля? Ще {left}.',
  '💪 {name}, ти вже зробив(ла) стільки днів поспіль ({streak}). Сьогодні ще {left}!',
];
function extraGems(st, day, id) {
  const g = (st.gemLog[day] || {})[id];
  if (!g) return '';
  const t = Object.keys(g.tasks).reduce(function (a, k) { return a + g.tasks[k]; }, 0), parts = [];
  if (g.harv) parts.push('+' + g.harv + ' за збори');
  if (g.bonus) parts.push('+' + g.bonus + ' понад норму');
  if (t) parts.push('+' + t + ' за завдання');
  return parts.length ? ' · ' + parts.join(', ') + ' ' + GEM : '';
}
function wallet(x) { return ' (всього ' + x.gems + ' ' + GEM + (x.freeze ? ', ❄️ ' + x.freeze : '') + ')'; }
function streakWarnText(st, id, now) {
  const left = st.people[id].norm - doneToday(st, id, now), n = streakOf(st, id, now);
  const t = STREAK_WARN[Math.floor(Math.random() * STREAK_WARN.length)];
  return t.replace('{name}', mention(st, id)).replace('{streak}', b(n + ' ' + plural(n, ['день', 'дні', 'днів'])))
    .replace('{left}', b(Math.ceil(left) + ' грн')).replace('зробив(ла)', st.people[id].female ? 'зробила' : 'зробив');
}
function atRisk(st, now) {
  return Object.keys(st.people).filter(function (id) {
    return streakOf(st, id, now) > 0 && doneToday(st, id, now) < st.people[id].norm && !(st.streak[id] && st.streak[id].last === dayKey(now, st.cfg));
  });
}
function postStreakWarn(st) {
  const now = Date.now(), ids = atRisk(st, now);
  ids.forEach(function (id) {
    const x = inv(st, id);
    sayK(st, 'warn:' + id, streakWarnText(st, id, now) + (x.freeze ? '\n(❄️ Є заморозка, вона врятує, але кристалів за день не буде.)' : ''));
  });
}
function streakLine(st, now) {
  const ids = Object.keys(st.people);
  return ids.length ? '🔥 Стрік: ' + ids.map(function (id) { const n = streakOf(st, id, now); return esc(nameOf(st, id)) + ' ' + n; }).join(' · ') : '';
}
function shopText(st, id) {
  const now = Date.now(), n = streakOf(st, id, now), x = inv(st, id), today = shopToday(st, id);
  const hidden = shopFor(st, id).filter(function (it) { return n >= it.need && today.indexOf(it.id) < 0; }).length;
  return '🛒 ' + b('Магазин') + '\n' + esc(nameOf(st, id)) + ': ' + GEM + ' ' + b(x.gems) + ' · 🔥 стрік ' + b(n) +
    (seasonOn(st, 'gems') ? '\n💎 Кристальний сезон: −' + SEASON_BOOST + '% на все!' : '') + '\nЦифра зліва — з якого дня стріку відкривається товар. Щодня в продажу ' + st.cfg.shopDaily + ' з відкритих — завтра інші. Купуєш те саме за тиждень ще раз — дорожче на ' + st.cfg.shopRise + '% (з понеділка ціни знову звичайні).\n\n' + shopFor(st, id).filter(function (it) { return n < it.need || today.indexOf(it.id) >= 0; }).map(function (it) {
      const open = n >= it.need;
      // a locked item's name is never sent (a spoiler could be tapped open): only a blurred-looking placeholder
      return lvl(it.need) + ' ' + (open ? it.label : '🔒 ' + '▒'.repeat(Math.min(14, 6 + Math.round(it.label.length / 6)))) + ' — ' + (priceOf(st, it) < it.price ? '<s>' + it.price + '</s> ' + b(priceOf(st, it)) : it.price) + ' ' + GEM + (open && it.times ? ' · ' + (it.times + 1) + '-й раз цього тижня (було ' + it.base + ')' : '') +
        (open ? '' : ' · ще ' + (it.need - n) + ' ' + plural(it.need - n, ['день', 'дні', 'днів'])) + (it.hint && open ? '\n    ' + it.hint : '');
    }).join('\n') + (hidden ? '\n🌙 Ще ' + hidden + ' ' + plural(hidden, ['товар', 'товари', 'товарів']) + ' відпочивають — з\'являться в інші дні' : '') + foodShopText(st, id);
}
function foodShopText(st, id) {
  const P = st.cfg.pet, x = inv(st, id);
  return '\n\n🍖 ' + b('Корм для улюбленця') + ' — ' + priceOf(st, { price: P.food }) + ' ' + GEM + ' за штуку' + (x.food ? ' · у тебе ' + x.food : '') +
    (seasonOn(st, 'gems') ? '\n💎 Сезонна пропозиція: ' + b(P.packN + ' корму за ' + P.pack + ' ' + GEM) : '\n💎 У кристальний сезон — набір ' + P.packN + ' за ' + P.pack + ' ' + GEM);
}
function buyFood(st, user, what, q, edit) {
  const P = st.cfg.pet, x = inv(st, user.id), p = person(st, user), pack = what === 'pack';
  if (pack && !seasonOn(st, 'gems')) { toast(q, 'Набір буває лише в 💎 кристальний сезон'); return; }
  const price = pack ? P.pack : priceOf(st, { price: P.food }), n = pack ? P.packN : 1;
  if (x.gems < price) { toast(q, 'Не вистачає ' + (price - x.gems) + ' ' + GEM); return; }
  x.gems -= price; x.food += n; dayAdd(st, String(user.id), 'shop', price);
  toast(q, '🍖 +' + n + ' корму');
  if (pack) sayK(st, 'buy', '🛒 ' + esc(p.name) + ' ' + verb(p, 'купив', 'купила') + ' 🍖 ' + b(n + ' корму') + ' за ' + price + ' ' + GEM + ' (сезонна пропозиція 💎)');
  edit(shopText(st, user.id), shopKeyboard(st, user.id));
}
function shopKeyboard() { return withBack(_shopKeyboard.apply(null, arguments), 'play'); }
function _shopKeyboard(st, id) {
  const n = streakOf(st, id, Date.now());
  const today = shopToday(st, id);
  return { inline_keyboard: shopFor(st, id).filter(function (it) { return n < it.need || today.indexOf(it.id) >= 0; }).map(function (it) { // locked ones stay visible, but only show the level and the price
    return [n >= it.need ? button(lvl(it.need) + ' ' + it.label + ' · ' + priceOf(st, it) + ' ' + GEM + (priceOf(st, it) < it.price ? ' (−' + SEASON_BOOST + '%)' : it.times ? ' ↑' : ''), 'buy:' + it.id + ':' + id)
      : lockedButton('🔒 ' + lvl(it.need) + ' · ' + priceOf(st, it) + ' ' + GEM + ' · від ' + it.need + ' 🔥')];
  }).concat([[button('🍖 Корм × 1 · ' + priceOf(st, { price: st.cfg.pet.food }) + ' ' + GEM, 'food:one')].concat(seasonOn(st, 'gems') ? [button('🍖 × ' + st.cfg.pet.packN + ' · ' + st.cfg.pet.pack + ' ' + GEM + ' 💎', 'food:pack')] : [])]) };
}
function buy(st, user, itemId, owner, q, edit) {
  if (String(owner) !== String(user.id)) { toast(q, 'Це магазин іншої людини. Відкрий свій: 🛒 у /menu'); return; }
  const it = shopFor(st, user.id).filter(function (x) { return x.id === itemId; })[0], x = inv(st, user.id), n = streakOf(st, user.id, Date.now()), p = person(st, user);
  if (!it) { toast(q, 'Такого товару немає'); return; }
  if (n < it.need) { toast(q, '🔒 Відкриється на ' + it.need + '-й день стріку (зараз ' + n + ')'); return; }
  if (shopToday(st, user.id).indexOf(it.id) < 0) { toast(q, '🌙 Сьогодні цього товару немає — завтра будуть інші'); edit(shopText(st, user.id), shopKeyboard(st, user.id)); return; }
  const price = priceOf(st, it);
  if (x.gems < price) { toast(q, 'Не вистачає ' + (price - x.gems) + ' ' + GEM); return; }
  x.gems -= price; x.bought = (x.bought || 0) + 1; dayAdd(st, String(user.id), 'shop', price);
  const w = weekKey(dayKey(Date.now(), st.cfg)); st.shopWeek = st.shopWeek || {};
  if (!st.shopWeek[user.id] || st.shopWeek[user.id].w !== w) st.shopWeek[user.id] = { w: w };
  st.shopWeek[user.id][it.id] = (st.shopWeek[user.id][it.id] || 0) + 1;
  if (it.id === 'freeze') x.freeze += 1; else x.coupons[it.id] = (x.coupons[it.id] || 0) + 1;
  toast(q, '✅ Куплено');
  sayK(st, 'buy', '🛒 ' + esc(p.name) + ' ' + verb(p, 'купив', 'купила') + ': ' + it.icon + ' ' + b(it.label) + ' за ' + price + ' ' + GEM + (price < it.price ? ' (сезонна знижка 💎)' : ''));
  edit(shopText(st, user.id), shopKeyboard(st, user.id));
  checkAch(st, String(user.id));
}
function useCoupon(st, user, itemId, q) {
  const it = shopItem(itemId), x = inv(st, user.id), p = person(st, user);
  if (!it || !x.coupons[itemId]) { toast(q, 'Цього вже немає'); return false; }
  x.coupons[itemId] -= 1; if (!x.coupons[itemId]) delete x.coupons[itemId];
  toast(q, it.icon);
  sayK(st, 'coupon', '🎟 ' + mention(st, user.id) + ' ' + verb(p, 'використав', 'використала') + ' купон: ' + it.icon + ' ' + b(it.label) + '!\n' +
    (String(user.id) === String(st.owner) ? 'Хтось сьогодні працює замість власника ферми 😎' : mention(st, st.owner) + ', це тепер твоя справа 😄'));
  return true;
}

// ================================================================ 🎪 SEASONS
// The owner picks a season of 3–4 days in his private chat; a rest day follows. On a rest day evening the bot asks
// what's next; no answer = one more rest day. During a season one pinned card shows its progress, every related
// action gets a season line, milestones (25/50/75/100%) are celebrated, and the finale hands out season badges.
// Investments, money goals and achievements run all the time; a season only adds bonuses and attention.
const SEASONS = {
  race: { icon: '🏁', name: 'Перегони' },
  team: { icon: '🤝', name: 'Командний' },
  gems: { icon: '💎', name: 'Кристальний' },
  early: { icon: '🌅', name: 'Рання пташка' },
  invest: { icon: '🏡', name: 'Інвестиційний' },
};
const SEASON_BOOST = 20, SEASON_INV_GEMS = 3;
function seasonWhat(st, type) {
  return { race: 'Хто більше разів збере врожай — отримає 🎁 таємний приз!',
    team: 'Разом досягаємо спільної цілі! Дійдемо до 100% за сезон — усі учасники отримають сезонний значок.',
    gems: '+' + SEASON_BOOST + '% до всіх кристалів і −' + SEASON_BOOST + '% цін у 🛒 магазині! Заробляй кристали щодня — отримаєш значок.',
    early: '+1 💎 за кожен збір до ' + st.cfg.earlyHour + ':00! Роби ранній збір щодня — отримаєш значок.',
    invest: '+' + SEASON_INV_GEMS + ' 💎 за внесок у ділянку — раз на день кожному! Вкладай щодня — отримаєш значок.' }[type];
}
function seasonOn(st, type) { return st.season && (!type || st.season.type === type) ? st.season : null; }
function sp(st, id) { const s = st.season; s.p = s.p || {}; return s.p[id] = s.p[id] || { days: {}, gems: 0, early: 0, inv: {}, invGems: 0 }; }
function seasonDays(s) { const out = []; for (let d = s.start; d <= s.end; d = addDays(d, 1)) out.push(d); return out; }
function seasonDayN(st) { const s = st.season; return seasonDays(s).indexOf(dayKey(Date.now(), st.cfg)) + 1 || 1; }
function sach(st, id, type) { return ((st.sach || {})[id] || {})[type] || 0; }
// 💎 season: +20% (rounded) to crystals earned; also marks the day as "earned crystals"
function gemBoost(st, id, n) {
  if (!seasonOn(st, 'gems') || n <= 0) return 0;
  const x = sp(st, String(id)), extra = Math.round(n * SEASON_BOOST / 100);
  x.days[dayKey(Date.now(), st.cfg)] = 1; x.gems += n + extra;
  return extra;
}
function priceOf(st, it) { return seasonOn(st, 'gems') ? Math.max(1, Math.round(it.price * (100 - SEASON_BOOST) / 100)) : it.price; }
// 🌅 season: +1 💎 for a harvest before cfg.earlyHour
function earlyBonus(st, id, now) {
  if (!seasonOn(st, 'early') || hourOf(now) >= st.cfg.earlyHour) return 0;
  const x = sp(st, String(id)); x.early++; x.days[dayKey(now, st.cfg)] = 1;
  inv(st, id).gems += 1;
  return 1;
}
// 🏡 season: +3 💎 for the first pledge of the day; taken back if the pledge is withdrawn before the purchase
function investBonus(st, id) {
  if (!seasonOn(st, 'invest')) return 0;
  const x = sp(st, String(id)), day = dayKey(Date.now(), st.cfg);
  if (x.inv[day]) return 0;
  x.inv[day] = 1; x.invGems += SEASON_INV_GEMS; inv(st, id).gems += SEASON_INV_GEMS;
  return SEASON_INV_GEMS;
}
function investBonusBack(st, id) {
  if (!seasonOn(st, 'invest')) return 0;
  const x = sp(st, String(id)), g = x.invGems, w = inv(st, id);
  w.gems = Math.max(0, w.gems - g); x.invGems = 0; x.inv = {};
  return g;
}
function dayDots(st, x) {
  const today = dayKey(Date.now(), st.cfg), fin = st.season.final;
  return seasonDays(st.season).map(function (d) { return d > today ? '⬜' : x.days[d] || x.inv[d] ? '✅' : d < today || fin ? '❌' : '⏳'; }).join('');
}
function seasonPct(st) { // progress of the season's shared target, for milestones; null when there is none
  const s = st.season;
  if (s.type === 'team') { const g = goalById(st, s.goalId); if (!g) return s.won ? 1 : null; return Math.min(1, (g.price ? g.fund : g.n) / (g.price || g.count)); }
  if (s.type === 'invest' && st.offers.length) { const t = st.offers.reduce(function (a, o) { return [a[0] + Math.min(offerSum(o), o.price), a[1] + o.price]; }, [0, 0]); return Math.min(1, t[0] / t[1]); }
  return null;
}
function seasonCard(st) {
  const s = st.season, S = SEASONS[s.type], ids = Object.keys(st.people);
  let body = '';
  if (s.type === 'race') {
    const R = st.race && st.race.active ? standings(st) : s.board || [], top = R.length ? Math.max(1, R[0].n) : 1;
    body = R.map(function (x, i) { return (['🥇', '🥈', '🥉'][i] || '▫️') + ' ' + esc(nameOf(st, x.id)) + ' ' + new Array(Math.max(x.n ? 1 : 0, Math.round(x.n / top * 10)) + 1).join(colorOf(st, x.id)) + ' ' + b(x.n); }).join('\n') || 'Ще ніхто не збирав — будь першим! 🚜';
  } else if (s.type === 'team') {
    const g = goalById(st, s.goalId);
    body = g ? goalCard(st, g) : s.won ? '🎉 Ціль досягнуто!' : 'Ціль скасовано.';
  } else if (s.type === 'invest') {
    body = (st.offers.length ? st.offers.map(function (o) { return '«' + esc(o.name) + '»: ' + offerBar(st, o) + ' ' + b(pct(Math.min(1, offerSum(o) / o.price))); }).join('\n') : '🎉 Ділянку куплено!') +
      '\n' + ids.map(function (id) { const x = sp(st, id); return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' ' + dayDots(st, x) + (x.invGems ? ' · +' + x.invGems + ' ' + GEM : ''); }).join('\n');
  } else {
    body = ids.map(function (id) {
      const x = sp(st, id);
      return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' ' + dayDots(st, x) + ' · ' + (s.type === 'gems' ? b(x.gems + ' ' + GEM) + ' за сезон' : b(x.early) + ' ' + plural(x.early, ['ранній збір', 'ранні збори', 'ранніх зборів']));
    }).join('\n');
  }
  return '🎪 ' + b('СЕЗОН: ' + S.icon + ' ' + S.name) + ' · день ' + seasonDayN(st) + ' з ' + s.days +
    '\n📅 ' + shortDate(s.start) + ' – ' + shortDate(s.end) + ', фініш о ' + st.cfg.dayEnd + ':00\n' + seasonWhat(st, s.type) + '\n\n' + body;
}
function seasonLine(st) {
  const s = st.season; if (!s) return '';
  const S = SEASONS[s.type], p = seasonPct(st);
  if (s.type === 'race') return ''; // raceLine already says it
  return '\n🎪 ' + S.icon + ' ' + S.name + ', день ' + seasonDayN(st) + ' з ' + s.days + (p !== null ? ': ' + pct(p) : '');
}
function refreshSeason(st) {
  const s = st.season; if (!s) return;
  if (s.mid) tg('editMessageText', { chat_id: st.group, message_id: s.mid, text: seasonCard(st), parse_mode: 'HTML' });
  const p = seasonPct(st); if (p === null) return;
  s.ms = s.ms || {};
  const hit = [25, 50, 75, 100].filter(function (m) { return p * 100 + 1e-9 >= m && !s.ms[m]; });
  hit.forEach(function (m) { s.ms[m] = 1; });
  hit.slice(-1).forEach(function (m) { // a big jump celebrates only the highest milestone
    {
      const r = sayK(st, 'season-ms', (m === 100 ? '🎉🎉🎉 ' : '🎉 ') + SEASONS[s.type].icon + ' ' + b(m + '%!') + ' ' +
        ({ 25: 'Чверть шляху позаду, так тримати! 💪', 50: 'Половина! Ми вже на півдорозі! 🔥', 75: 'Три чверті! Зовсім трохи лишилось! 🚀', 100: 'Ми це зробили! 🏆' })[m]);
      react(st.group, r && r.result && r.result.message_id, '🎉');
    }
  });
}
function startSeason(st, type, days, goalId, start) {
  const end = addDays(start, days - 1);
  st.season = { type: type, start: start, end: end, days: days, goalId: goalId || null, p: {}, ms: {} };
  if (type === 'race') st.race = { active: true, start: start, end: end, scores: {} };
  delete st.seasonNext;
  if (!st.group) return;
  const S = SEASONS[type];
  const r = sayK(st, 'season', '🎪🎪🎪 ' + b('НОВИЙ СЕЗОН: ' + S.icon + ' ' + S.name.toUpperCase() + '!') + '\n\n' + seasonCard(st).split('\n').slice(1).join('\n') +
    '\n\n🎖 Хто виконає умову сезону — отримає сезонний значок у 🏅 Досягненнях!');
  st.season.mid = r && r.result ? r.result.message_id : null;
  if (st.season.mid) tg('pinChatMessage', { chat_id: st.group, message_id: st.season.mid, disable_notification: true });
  react(st.group, st.season.mid, '🔥');
  sendMenu(st);
}
function finishSeason(st) {
  const s = st.season; if (!s) return;
  const today = dayKey(Date.now(), st.cfg), ids = Object.keys(st.people), days = seasonDays(s).filter(function (d) { return d <= today; });
  let win = [];
  if (s.type === 'race') win = s.winners || [];
  else if (s.type === 'team') win = s.won ? s.team || [] : [];
  else if (s.type === 'invest') { const last = s.bought || today; win = ids.filter(function (id) { const x = sp(st, id); return days.filter(function (d) { return d <= last; }).every(function (d) { return x.inv[d]; }); }); }
  else win = ids.filter(function (id) { const x = sp(st, id); return days.every(function (d) { return x.days[d]; }); });
  st.sach = st.sach || {};
  win.forEach(function (id) { const m = st.sach[id] = st.sach[id] || {}; m[s.type] = (m[s.type] || 0) + 1; });
  const S = SEASONS[s.type], g = s.type === 'team' && !s.won ? goalById(st, s.goalId) : null;
  s.final = true;
  if (s.mid) tg('unpinChatMessage', { chat_id: st.group, message_id: s.mid });
  sayK(st, 'season', '🏁🎪 ' + b('СЕЗОН ' + S.icon + ' ' + S.name.toUpperCase() + ' ЗАВЕРШЕНО!') + '\n\n' + seasonCard(st).split('\n').slice(3).join('\n') +
    '\n\n' + (win.length ? '🎖 Сезонний значок: ' + win.map(function (id) { return b(esc(nameOf(st, id))) + ' (' + S.icon + ' ×' + sach(st, id, s.type) + ')'; }).join(', ') + ' 🎉'
      : 'Цього разу без значків — наступного сезону вийде! 💪') +
    (g ? '\n🤝 Ціль «' + esc(g.name) + '» не встигли, але вона продовжується у фоні — все відкладене на місці.' : '') +
    '\n\n😌 Завтра день відпочинку, а потім — новий сезон!');
  st.seasonHist = (st.seasonHist || []).concat([{ type: s.type, start: s.start, end: today, win: win }]).slice(-40);
  st.seasonLastEnd = today;
  delete st.season;
  win.forEach(function (id) { checkAch(st, id); });
  sendMenu(st);
}
// Morning: start a planned season. Evening: finish the season on its last day, or ask the owner about tomorrow.
function seasonMorning(st) {
  const n = st.seasonNext, today = dayKey(Date.now(), st.cfg);
  if (!st.season && n && n.start <= today) startSeason(st, n.type, n.days, n.goalId, today);
  else if (st.season) { refreshSeason(st); if (st.menuMsg) tg('editMessageReplyMarkup', { chat_id: st.group, message_id: st.menuMsg, reply_markup: menuKeyboard(st) }); }
}
function seasonEvening(st) {
  const today = dayKey(Date.now(), st.cfg), s = st.season;
  if (s && today >= s.end) { finishSeason(st); return; }
  if (s) { refreshSeason(st); return; }
  if (st.seasonLastEnd === today || st.seasonNext || !st.owner) return;
  st.sPick = {};
  say(st.owner, '🎪 ' + b('Завтра новий сезон?') + '\nОберіть, що буде завтра. Не оберете — завтра ще день відпочинку.', seasonPickKeyboard(st));
}
function seasonPickKeyboard(st) {
  return { inline_keyboard: Object.keys(SEASONS).map(function (t) {
    const S = SEASONS[t];
    if (t === 'invest' && !st.offers.length) return [lockedButton(S.icon + ' ' + S.name + ' — спершу /newplot')];
    if (t === 'team' && !goalList(st).length) return [lockedButton(S.icon + ' ' + S.name + ' — спершу створіть ціль у групі')];
    return [button(S.icon + ' ' + S.name, 'sn:t:' + t)];
  }).concat([[button('😌 Пропустити (відпочинок)', 'sn:skip')]]) };
}
function seasonFitText(st) {
  const k = st.sPick, g = goalById(st, k.goalId);
  if (!g) return '';
  const e = goalEta(st, g, true), fits = goalDone(g) || e.d <= k.days;
  return '\n\n' + goalCard(st, g, true) + pctTable(st, g, true) + '\n\n' + (fits ? '✅ Встигаємо за ' + k.days + ' ' + plural(k.days, ['день', 'дні', 'днів']) + '!'
    : '⚠️ Потрібно ' + etaShort(st, g, true) + ', а сезон ' + k.days + ' ' + plural(k.days, ['день', 'дні', 'днів']) + '. Підніміть % (або змініть бюджет у групі), щоб встигнути.');
}
function onSeasonButton(st, parts, q, edit) {
  const what = parts[1], k = st.sPick = st.sPick || {};
  const go = [[button('▶️ Почати зараз', 'sn:ok:now'), button('📅 З завтра', 'sn:ok:tom')]];
  if (what === 'menu') { st.sPick = {}; toast(q, ''); edit('🎪 ' + b('Який сезон?'), seasonPickKeyboard(st)); return; }
  if (what === 'skip') { st.sPick = {}; toast(q, '😌'); edit('😌 Завтра день відпочинку. Запитаю знову ввечері.'); return; }
  if (what === 'kill') { // cancel without results: no prizes, no badges (bonuses already paid stay)
    const s = st.season, R = st.race;
    if (R && R.active && (!s || s.type === 'race')) { st.race = { active: false, lastEnd: dayKey(Date.now(), st.cfg) }; }
    if (s) {
      if (s.mid) tg('unpinChatMessage', { chat_id: st.group, message_id: s.mid });
      st.seasonHist = (st.seasonHist || []).concat([{ type: s.type, start: s.start, end: dayKey(Date.now(), st.cfg), win: [], cancelled: true }]).slice(-40);
      st.seasonLastEnd = dayKey(Date.now(), st.cfg); delete st.season;
      sayK(st, 'season', '🎪 Сезон ' + SEASONS[s.type].icon + ' ' + SEASONS[s.type].name + ' скасовано. Відпочиваємо 😌' + (s.type === 'team' ? '\n🤝 Ціль продовжується у фоні.' : ''));
    } else if (R && R.active) sayK(st, 'raceEnd', '🏁 Перегони скасовано. Відпочиваємо 😌');
    sendMenu(st); toast(q, 'Скасовано'); edit(settingsText(st, 'season'), settingsKeyboard(st, 'season')); return;
  }
  if (what === 'racefin') {
    if (st.race && st.race.active) { st.race.end = dayKey(Date.now(), st.cfg); maybeFinishRace(st); }
    toast(q, '🏁'); edit(settingsText(st, 'season'), settingsKeyboard(st, 'season')); return;
  }
  if (what === 'unplan') { delete st.seasonNext; toast(q, 'Скасовано'); edit(settingsText(st, 'season'), settingsKeyboard(st, 'season')); return; }
  if (what === 'stop') {
    if (!st.season) { toast(q, 'Сезону немає'); return; }
    if (st.season.type === 'race' && st.race && st.race.active) { st.race.end = dayKey(Date.now(), st.cfg); maybeFinishRace(st); }
    finishSeason(st); toast(q, 'Сезон завершено'); edit(settingsText(st, 'season'), settingsKeyboard(st, 'season')); return;
  }
  if (what === 'h') { st.cfg.earlyHour = Math.max(st.cfg.dayStart + 1, Math.min(st.cfg.dayEnd, st.cfg.earlyHour + +parts[2])); parts = ['sn', 't', 'early']; }
  if (what === 't' || what === 'h') {
    st.sPick = { type: parts[2] }; toast(q, '');
    if (parts[2] === 'early') { edit('🌅 ' + b('Рання пташка') + '\n' + seasonWhat(st, 'early') + '\n\nДо котрої години збір вважається раннім? Зараз: ' + b(st.cfg.earlyHour + ':00') + '\nСкільки днів?',
      { inline_keyboard: [[button('➖ раніше', 'sn:h:-1'), button('🌅 ' + st.cfg.earlyHour + ':00', 'noop'), button('➕ пізніше', 'sn:h:1')], [button('3 дні', 'sn:d:3'), button('4 дні', 'sn:d:4')], [button('⬅️ Інший сезон', 'sn:menu')]] }); return; }
  }
  if (what === 't') { st.sPick = { type: parts[2] }; toast(q, ''); edit(SEASONS[parts[2]].icon + ' ' + b(SEASONS[parts[2]].name) + '\n' + seasonWhat(st, parts[2]) + '\n\nСкільки днів?', { inline_keyboard: [[button('3 дні', 'sn:d:3'), button('4 дні', 'sn:d:4')], [button('⬅️ Інший сезон', 'sn:menu')]] }); return; }
  if (what === 'd') {
    k.days = +parts[2];
    if (k.type === 'team') {
      toast(q, ''); edit('🤝 Яка ціль буде сезонною?', { inline_keyboard: goalList(st).map(function (g) { return [button('🤝 ' + g.name, 'sn:g:' + g.id)]; }).concat([[button('⬅️ Інший сезон', 'sn:menu')]]) }); return;
    }
    toast(q, ''); edit(SEASONS[k.type].icon + ' ' + b(SEASONS[k.type].name) + ', ' + k.days + ' дні.\nКоли починаємо?', { inline_keyboard: go.concat([[button('⬅️ Інший сезон', 'sn:menu')]]) }); return;
  }
  if (what === 'g' || what === 'p') {
    if (what === 'g') k.goalId = parts[2];
    const g = goalById(st, k.goalId);
    if (!g) { toast(q, 'Цієї цілі вже немає'); return; }
    if (what === 'p') {
      const n = Math.max(1, Math.min(GOAL_MAX_CUT, g.pct + +parts[2]));
      if (Object.keys(g.parts).some(function (id) { return gIn(g, id) && cutOf(st, id, g) + n > GOAL_MAX_CUT; })) { toast(q, 'Хтось уже відкладає багато в інших цілях'); return; }
      g.pct = n; refreshGoal(st, g); toast(q, n + '% → ' + etaShort(st, g, true));
    } else toast(q, '');
    edit('🤝 ' + b('Командний сезон') + ', ' + k.days + ' дні' + seasonFitText(st),
      { inline_keyboard: (g.price ? [[button('➖5%', 'sn:p:-5'), button('➖1%', 'sn:p:-1'), button('➕1%', 'sn:p:1'), button('➕5%', 'sn:p:5')]] : []).concat(go).concat([[button('⬅️ Інший сезон', 'sn:menu')]]) });
    return;
  }
  if (what === 'ok') {
    if (!k.type || !k.days) { toast(q, 'Оберіть сезон'); return; }
    if (st.season || (st.race && st.race.active)) { toast(q, 'Зараз уже йдуть ' + (st.season ? 'сезон' : 'перегони') + '. Спершу завершіть у ⚙️ → 🎪 Сезони'); return; }
    const today = dayKey(Date.now(), st.cfg);
    if (parts[2] === 'now') { startSeason(st, k.type, k.days, k.goalId, today); toast(q, '🎪 Почали!'); edit('🎪 Сезон ' + SEASONS[k.type].icon + ' ' + SEASONS[k.type].name + ' почався в сімейному чаті!'); }
    else { st.seasonNext = { type: k.type, days: k.days, goalId: k.goalId || null, start: addDays(today, 1) }; toast(q, '📅'); edit('📅 Завтра зранку почнеться сезон ' + SEASONS[k.type].icon + ' ' + b(SEASONS[k.type].name) + ' (' + k.days + ' дні).'); }
    st.sPick = {}; return;
  }
}
function seasonSettingsText(st) {
  const s = st.season, n = st.seasonNext;
  const oldRace = st.race && st.race.active && !s;
  return '🎪 ' + b('Сезони') + '\n' + (oldRace ? '🏁 Зараз ідуть перегони (запущені ще до сезонів), фініш ' + shortDate(st.race.end) + '.' : s ? 'Зараз: ' + SEASONS[s.type].icon + ' ' + SEASONS[s.type].name + ', день ' + seasonDayN(st) + ' з ' + s.days : n ? 'Заплановано на ' + shortDate(n.start) + ': ' + SEASONS[n.type].icon + ' ' + SEASONS[n.type].name : 'Зараз відпочинок 😌') +
    '\n\nСезон 3–4 дні, потім день відпочинку. Увечері дня відпочинку я питаю, що буде завтра; не оберете — ще день відпочинку.' +
    (seasonOn(st, 'early') ? '\n🌅 Бонус за збори до ' + b(st.cfg.earlyHour + ':00') : '') +
    '\n\nМинулі: ' + ((st.seasonHist || []).slice(-6).map(function (h) { return SEASONS[h.type].icon; }).join(' ') || '—');
}

// ---------------------------------------------------------------- 💼 investments: land bought with the family's money
// Founder land (cfg.plots8/16/24/28, neutral) stays as it was: 85% to whoever harvests, 15% to the piggy bank.
// Investor plots (cfg.iplots) are bought with UAH from the bot balances: each harvest of such a plot pays
// invWage% to whoever harvests, the rest goes to its owners by their shares (the owner's share too), no piggy bank.
// cfg.iplots = [{ id, name, type: 'plots16', price (UAH), since: 'YYYY-MM-DD', shares: { uid: UAH }, got: { uid: UAH },
//                 days: { 'YYYY-MM-DD': { uid: UAH } } }];  st.offers = open fundraisings for new plots (several at once)
const TAX_CERTS = { plots8: 0, plots16: 90, plots24: 0 }; // tax certificates per week
const CERT_GOLD = 1.14;                                   // NA price of a tax certificate (scan 19.11.2026)
const INV_MIN = 20, SELL_AFTER = 14;                      // minimum stake (UAH), days before a stake can be sold back
function iplotGold(c, p) { // gold one harvest of this plot gives: { beds, plots }
  const P = PLOTS[p.type], ratio = REF.bundleShare; // investor plots: bundles and composters as in the reference day
  const spot = (1 - ratio) * composterHarvest().gold + ratio * bundleHarvest(c).gold;
  return { beds: P.beds * bedHarvest(c).gold, plots: P.comps * spot };
}
function investFull(c, kind) { // UAH value of one harvest on all investor plots
  return (c.iplots || []).reduce(function (a, p) { return a + iplotGold(c, p)[kind]; }, 0) * c.uahPer1000 / 1000;
}
function iplotTaxDay(c, p) { return (TAX_CERTS[p.type] || 0) * CERT_GOLD / 7 * c.uahPer1000 / 1000; }
function shareOf(p, id) { return p.shares[id] ? p.shares[id] / p.price : 0; }
function pct(x) { return Math.round(x * 100) + '%'; }
function plotLabel(p) { return '«' + esc(p.name) + '» ' + typeLabel(p.type).replace(' з будинком', ''); }

// Evening: pay the owners for today's harvests; returns lines for the summary.
// What a plot has already earned its owners today (the same sum the evening will pay): to watch it grow during the day.
function divSoFar(st, p, now) {
  const c = st.cfg, day = dayKey(now, c), cnt = st.count[day] || {}, g = iplotGold(c, p);
  const gross = ((cnt.beds || 0) * g.beds + (cnt.plots || 0) * g.plots) * c.uahPer1000 / 1000 * (100 - c.invWage) / 100;
  return { beds: cnt.beds || 0, plots: cnt.plots || 0, gross: money(gross), net: Math.max(0, gross - iplotTaxDay(c, p)), tax: iplotTaxDay(c, p) };
}
function payDividends(st, now) {
  const c = st.cfg, day = dayKey(now, c), cnt = st.count[day] || {}, out = [];
  (c.iplots || []).forEach(function (p) {
    if (p.since > day || (p.days && p.days[day])) return; // bought later today's evening, or already paid
    const g = iplotGold(c, p);
    const gross = ((cnt.beds || 0) * g.beds + (cnt.plots || 0) * g.plots) * c.uahPer1000 / 1000 * (100 - c.invWage) / 100;
    const net = Math.max(0, gross - iplotTaxDay(c, p));
    p.days = p.days || {}; p.got = p.got || {};
    const today = p.days[day] = {};
    Object.keys(p.shares).forEach(function (id) {
      const amt = money(net * shareOf(p, id));
      today[id] = amt; p.got[id] = money((p.got[id] || 0) + amt);
      st.invWallet = st.invWallet || {}; // land income piles up in 💼 Мої інвестиції until the person takes it (👤 Мій портфель)
      st.invWallet[id] = money((st.invWallet[id] || 0) + amt);
    });
    Object.keys(p.days).sort().slice(0, -14).forEach(function (k) { delete p.days[k]; });
    out.push('🏡 ' + plotLabel(p) + ': сьогодні ' + (cnt.plots || 0) + ' ' + plural(cnt.plots || 0, ['збір', 'збори', 'зборів']) + ' компостерів і бандлів, ' +
      (cnt.beds || 0) + ' ' + plural(cnt.beds || 0, ['збір', 'збори', 'зборів']) + ' грядок' +
      (gross > 0 && net === 0 ? '\n   Податок ділянки з\'їв увесь дохід 😕' : ''));
    Object.keys(p.shares).forEach(function (id) {
      out.push('   ' + (String(id) === String(st.owner) ? '🏡 ' : '🌱 ') + esc(nameOf(st, id)) + ': ' + b('+' + today[id] + ' грн') + ' (' + pct(shareOf(p, id)) + ')' +
        ' · у 💼 накопичено ' + money((st.invWallet || {})[id] || 0) + ' грн');
    });
  });
  return out;
}

// ---- 🤝 shared goals. Anyone creates one from the menu (🤝 Спільні цілі): a name, a budget (or free: a number of
// harvests), the % to set aside, who it is for, who joins. Invited people confirm first. While a money goal is open,
// pct % of every harvest reward of each confirmed participant goes into its fund, so at 100% the money really exists
// (it was earned and set aside; it never reached the balances). Cancelling gives everyone back what they put in.
const GOAL_IDEAS = ['🍦 Морозиво всім', '🍕 Піца', '🧱 LEGO', '🎬 Кіно вдома', '🎲 Вечір настолок', '🏕 Похід', '🎁 Подарунок мамі', '🍰 Тортик'];
const GOAL_PRICES = [20, 50, 100, 200, 300, 500, 1000], GOAL_PCTS = [5, 10, 15, 20, 25, 30], GOAL_COUNTS = [10, 20, 40, 60, 100], GOAL_MAX_CUT = 50;
function goalList(st) {
  if (st.goal) { // the first version had one owner goal: carry it over
    const g = st.goal, parts = {};
    Object.keys(st.people).forEach(function (id) { const x = (g.by || {})[id] || { n: 0, uah: 0 }; parts[id] = { s: 'ok', n: x.n, uah: x.uah }; });
    st.goals2 = [{ id: 1, name: g.name, price: g.price, count: g.count, pct: st.cfg.goalCutNow || 10, by: String(st.owner), for: 'all', parts: parts, fund: g.fund, n: g.n, mid: g.mid, at: g.at }];
    st.goalSeq = 1; delete st.goal; delete st.cfg.goalCutNow;
  }
  return st.goals2 = st.goals2 || [];
}
function goalById(st, id) { return goalList(st).filter(function (g) { return String(g.id) === String(id); })[0]; }
function gIn(g, id) { return !!g.parts[id] && g.parts[id].s === 'ok'; }
function goalLeft(g) { return g.price ? Math.max(0, money(g.price - g.fund)) : Math.max(0, g.count - g.n); }
function goalDone(g) { return g.price ? g.fund >= g.price - 0.005 : g.n >= g.count; }
function goalForText(st, g) {
  if (g.for === 'all') return 'для всієї сім\'ї 👨‍👩‍👧';
  if (g.for.indexOf('p:') === 0) return g.for.slice(2) === String(g.by) ? 'для себе' : 'для ' + esc(nameOf(st, g.for.slice(2))) + ' 🎁';
  return 'для ' + esc(g.for.slice(2)) + ' 🎁';
}
function cutOf(st, id, except) { // % a person already sets aside in money goals
  return goalList(st).reduce(function (a, g) { return a + (g !== except && g.price && gIn(g, id) ? g.pct : 0); }, 0);
}
function goalAvg(st) { const c = st.cfg; return (KINDS.beds.reward(c) + KINDS.plots.reward(c)) / 2; }
// { h: harvests together, d: days if everyone in it does the full norm }
function goalEta(st, g, withWaiting) {
  const ids = Object.keys(g.parts).filter(function (id) { return g.parts[id].s === 'ok' || (withWaiting && g.parts[id].s === 'wait'); });
  const norms = ids.reduce(function (a, id) { return a + (st.people[id] ? st.people[id].norm : st.cfg.norm); }, 0);
  const per = g.price ? goalAvg(st) * g.pct / 100 : 1;
  if (per <= 0 || !norms) return { h: 0, d: 0 };
  const h = Math.ceil(goalLeft(g) / per - 1e-9);
  return { h: h, d: Math.ceil(h / Math.max(1, norms / goalAvg(st))) }; // norms are UAH a day -> harvests a day
}
function etaText(st, g, withWaiting) {
  const e = goalEta(st, g, withWaiting);
  return '≈ ' + b(e.h + ' ' + plural(e.h, ['збір', 'збори', 'зборів'])) + ' · ≈ ' + b(e.d + ' ' + plural(e.d, ['день', 'дні', 'днів'])) + ', якщо всі в цілі робитимуть норму';
}
// How long it takes at different % — shown when choosing or changing the %
function pctTable(st, g, withWaiting) {
  if (!g.price) return '';
  const opts = [5, 10, 15, 20, 25, 30]; if (opts.indexOf(g.pct) < 0) opts.push(g.pct);
  return '\n\n⏱ ' + b('Скільки чекати:') + '\n' + opts.sort(function (a, c) { return a - c; }).map(function (p) {
    const e = goalEta(st, Object.assign({}, g, { pct: p }), withWaiting);
    const t = p + '% — ' + e.d + ' ' + plural(e.d, ['день', 'дні', 'днів']) + ' (' + e.h + ' ' + plural(e.h, ['збір', 'збори', 'зборів']) + ')';
    return p === g.pct ? '👉 ' + b(t) : '      ' + t;
  }).join('\n');
}
function etaShort(st, g, withWaiting) { const e = goalEta(st, g, withWaiting); return '≈ ' + e.d + ' ' + plural(e.d, ['день', 'дні', 'днів']) + ' (' + e.h + ' ' + plural(e.h, ['збір', 'збори', 'зборів']) + ')'; }
function goalCard(st, g, withWaiting) {
  const ok = Object.keys(g.parts).filter(function (id) { return gIn(g, id); });
  const wait = Object.keys(g.parts).filter(function (id) { return g.parts[id].s === 'wait'; });
  const vals = {}; ok.forEach(function (id) { vals[id] = g.price ? g.parts[id].uah : g.parts[id].n; });
  const total = g.price || g.count, sum = g.price ? g.fund : g.n;
  return '🤝 ' + b(esc(g.name)) + '\n👤 ' + verb(st.people[g.by], 'Придумав', 'Придумала') + ': ' + esc(nameOf(st, g.by)) + ' · ' + goalForText(st, g) +
    (g.price ? '\n💰 Бюджет: ' + b(g.price + ' грн') + ' · відкладаємо ' + b(g.pct + '%') + ' з кожного збору' : '\n🆓 Безкоштовна: ' + b(g.count + ' ' + plural(g.count, ['збір', 'збори', 'зборів'])) + ' разом') +
    '\n\n' + shareBar(st, vals, total) + ' ' + b(pct(Math.min(1, sum / total))) +
    (ok.length ? '\n' + ok.map(function (id) { const x = g.parts[id]; return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' — ' + x.n + ' ' + plural(x.n, ['збір', 'збори', 'зборів']) + (g.price ? ' · ' + money(x.uah) + ' грн' : ''); }).join('\n') : '') +
    (wait.length ? (g.id ? '\n⏳ Чекаємо відповіді: ' : '\n👥 Покличемо після створення: ') + wait.map(function (id) { return esc(nameOf(st, id)); }).join(', ') : '') +
    (g.price ? '\n\n🐷 Вже відкладено: ' + b(money(g.fund) + ' / ' + g.price + ' грн') : '\n\n🚜 Разом зібрали: ' + b(g.n + ' з ' + g.count)) +
    (goalDone(g) ? '' : '\n⬜ Ще ' + etaText(st, g, withWaiting));
}
function goalKeyboard(st, g) {
  const wait = Object.keys(g.parts).some(function (id) { return g.parts[id].s === 'wait'; });
  return wait ? { inline_keyboard: [[button('✅ Беру участь', 'gj:' + g.id + ':1'), button('🙅 Не цього разу', 'gj:' + g.id + ':0')]] } : null;
}
function refreshGoal(st, g) {
  if (g.mid) tg('editMessageText', { chat_id: st.group, message_id: g.mid, text: goalCard(st, g), parse_mode: 'HTML', reply_markup: goalKeyboard(st, g) || { inline_keyboard: [] } });
}
function goalLine(st) {
  return goalList(st).map(function (g) {
    const total = g.price || g.count, sum = g.price ? g.fund : g.n, h = goalEta(st, g).h;
    return '\n🤝 ' + esc(g.name) + ': ' + pct(Math.min(1, sum / total)) + ' · ще ≈ ' + h + ' ' + plural(h, ['збір', 'збори', 'зборів']);
  }).join('');
}
function gstat(st, id) { st.gstat = st.gstat || {}; return st.gstat[id] = st.gstat[id] || { done: 0, saved: 0, dreams: 0, gifts: 0 }; }
// A harvest of a participant: money goals take their % of the reward, free goals count it. Returns what was set aside.
function goalsTake(st, id, wage) {
  let total = 0;
  goalList(st).slice().forEach(function (g) {
    if (!gIn(g, id) || goalDone(g)) return;
    const x = g.parts[id];
    if (g.price) { const cut = money(wage * g.pct / 100); g.fund = money(g.fund + cut); x.uah = money(x.uah + cut); total += cut; gstat(st, id).saved = money(gstat(st, id).saved + cut); }
    g.n++; x.n++;
    if (goalDone(g)) finishGoal(st, g); else refreshGoal(st, g);
  });
  return money(total);
}
function finishGoal(st, g) {
  const ok = Object.keys(g.parts).filter(function (id) { return gIn(g, id); });
  if (seasonOn(st, 'team') && String(st.season.goalId) === String(g.id)) { st.season.won = true; st.season.team = ok; }
  const vals = {}; ok.forEach(function (id) { vals[id] = g.price ? g.parts[id].uah : g.parts[id].n; });
  if (g.mid) tg('editMessageReplyMarkup', { chat_id: st.group, message_id: g.mid, reply_markup: { inline_keyboard: [] } });
  sayK(st, 'goal:' + g.id, '🎉🎉🎉 ' + b('Ціль досягнуто!') + '\n\n🤝 ' + b(esc(g.name)) + ' — ' + goalForText(st, g) + '\n' + shareBar(st, vals, g.price || g.count) + ' 100%' +
    (g.price ? '\n💰 Ми разом відклали ' + b(g.price + ' грн') : '\n🚜 ' + g.n + ' ' + plural(g.n, ['збір', 'збори', 'зборів']) + ' разом') +
    '\n\nДякуємо:\n' + ok.sort(function (a, c) { return g.parts[c].n - g.parts[a].n; }).map(function (id) { return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' — ' + g.parts[id].n + ' ' + plural(g.parts[id].n, ['збір', 'збори', 'зборів']); }).join('\n') +
    '\n\nЦе зробили ми всі разом 💪');
  if (st.owner) say(st.owner, '🎉 Ціль «' + esc(g.name) + '» (' + goalForText(st, g) + ') досягнуто' + (g.price ? ': відкладено ' + money(g.fund) + ' грн з нагород учасників (на баланси не нараховувалось) — час купувати!' : '.'));
  ok.forEach(function (id) { gstat(st, id).done++; });
  gstat(st, g.by).dreams++;
  if (g.for !== 'all' && g.for !== 'p:' + g.by) gstat(st, g.by).gifts++;
  st.goalHist = (st.goalHist || []).concat([{ name: g.name, price: g.price, count: g.count, n: g.n, by: g.by, for: g.for, at: Date.now() }]).slice(-30);
  st.goals2 = goalList(st).filter(function (x) { return x !== g; });
  ok.concat([String(g.by)]).forEach(function (id) { checkAch(st, id); });
}
function cancelGoal(st, g, who) {
  Object.keys(g.parts).forEach(function (id) {
    const x = g.parts[id]; if (!x.uah) return;
    st.balance[id] = money((st.balance[id] || 0) + x.uah); gstat(st, id).saved = Math.max(0, money(gstat(st, id).saved - x.uah));
  });
  st.goals2 = goalList(st).filter(function (x) { return x !== g; });
  if (g.mid) tg('editMessageReplyMarkup', { chat_id: st.group, message_id: g.mid, reply_markup: { inline_keyboard: [] } });
  sayK(st, 'goal:' + g.id, '🤝 Ціль «' + esc(g.name) + '» скасовано (' + esc(nameOf(st, who)) + ').' + (g.fund ? ' Відкладене повернулось кожному на баланс 💰' : ''));
}
// --- the menu view and the creation wizard (personal messages)
function goalsView(st, id) {
  const list = goalList(st);
  const t = '🤝 ' + b('Спільні цілі') + '\n\n' + (list.length ? list.map(function (g) {
    const total = g.price || g.count, sum = g.price ? g.fund : g.n, me = g.parts[id];
    return '• ' + b(esc(g.name)) + ' ' + pct(Math.min(1, sum / total)) + (me ? ' · ' + (me.s === 'ok' ? 'ти в цілі ✅' : me.s === 'wait' ? 'тебе запросили ⏳' : 'без тебе') : '');
  }).join('\n') : 'Поки цілей немає. Придумай першу! ✨') +
    '\n\nЦіль — це мрія, на яку збираємо разом: піца, LEGO, подарунок мамі. Якщо вона коштує гроші, частинка з кожного збору відкладається на неї, і коли смужка заповниться — гроші вже є 🎉';
  const rows = list.map(function (g) {
    const me = g.parts[id];
    return me && me.s === 'wait' ? [button('✅ Беру участь: ' + g.name, 'gj:' + g.id + ':1'), button('🙅', 'gj:' + g.id + ':0')] : [button('👀 ' + g.name, 'gv:' + g.id)];
  });
  rows.push([button('➕ Нова ціль', 'gw:new')]);
  return { text: t, kb: withBack({ inline_keyboard: rows }, 'goals') };
}
function goalView(st, g, id) {
  const boss = String(id) === String(g.by) || String(id) === String(st.owner), rows = [];
  if (boss && g.price) rows.push([button('➖5%', 'gp:' + g.id + ':-5'), button('➖1%', 'gp:' + g.id + ':-1'), button('➕1%', 'gp:' + g.id + ':1'), button('➕5%', 'gp:' + g.id + ':5')]);
  if (boss) rows.push([button('❌ Скасувати ціль', 'gx:' + g.id)]);
  rows.push([button('⬅️ Усі цілі', 'menu:goals')]);
  return { text: goalCard(st, g, true) + (boss ? pctTable(st, g, true) : ''), kb: { inline_keyboard: rows } };
}
function wizGoal(st, id) { // the wizard state as a goal, for the summary and the estimate
  const w = st.wiz[id], parts = {};
  parts[id] = { s: 'ok', n: 0, uah: 0 };
  Object.keys(w.inv || {}).forEach(function (k) { if (w.inv[k]) parts[k] = { s: 'wait', n: 0, uah: 0 }; });
  return { id: 0, name: w.name, price: w.price, count: w.count || 0, pct: w.pct || 0, by: String(id), for: w.for, parts: parts, fund: 0, n: 0 };
}
function wizView(st, id) {
  const w = st.wiz[id], others = Object.keys(st.people).filter(function (k) { return String(k) !== String(id); });
  const cancel = [button('❌ Скасувати', 'gw:cancel')];
  const head = '✨ ' + b('Нова ціль') + (w.name ? ': ' + b(esc(w.name)) : '') + '\n\n';
  if (!w.name) return { text: head + '✏️ Як назвемо ціль? Обери готову або напиши свою в чат так:\n' + b('/n Морозиво всій родині'),
    kb: { inline_keyboard: [0, 3, 6].map(function (i) { return GOAL_IDEAS.slice(i, i + 3).map(function (x, j) { return button(x, 'gw:idea:' + (i + j)); }); }).concat([cancel]) } };
  if (w.price === undefined) return { text: head + '💰 Скільки вона коштує? Обери або напиши точну суму: ' + b('/n 75') + '\nЯкщо це не річ, а подія (похід, вечір настолок) — обери «Безкоштовна».',
    kb: { inline_keyboard: [[button('🆓 Безкоштовна', 'gw:price:0')]].concat([GOAL_PRICES.slice(0, 3), GOAL_PRICES.slice(3, 6), GOAL_PRICES.slice(6)].map(function (r) { return r.map(function (x) { return button(x + ' грн', 'gw:price:' + x); }); })).concat([cancel]) } };
  if (!w.price && !w.count) return { text: head + '🚜 Скільки зборів зробимо разом, щоб її досягти? Або напиши: ' + b('/n 35'), kb: { inline_keyboard: [GOAL_COUNTS.map(function (x) { return button(String(x), 'gw:count:' + x); }), cancel] } };
  if (w.price && !w.pct) return { text: head + '🐷 Яку частину з кожного збору відкладати на ціль?\n10% — це 10 копійок з кожної гривні. Більше відкладаєш — швидше досягнеш, але менше лишається на балансі.',
    kb: { inline_keyboard: [GOAL_PCTS.slice(0, 3).map(function (x) { return button(x + '%', 'gw:pct:' + x); }), GOAL_PCTS.slice(3).map(function (x) { return button(x + '%', 'gw:pct:' + x); }), cancel] } };
  if (!w.for) return { text: head + '🎁 Для кого ця ціль?',
    kb: { inline_keyboard: [[button('🙋 Для себе', 'gw:for:me'), button('👨‍👩‍👧 Для всієї сім\'ї', 'gw:for:all')]]
      .concat(others.map(function (k) { return [button('🎁 Для ' + nameOf(st, k), 'gw:for:' + k)]; }))
      .concat([[button('✏️ Для когось іншого', 'gw:for:other')], cancel]) } };
  if (others.length && !w.invDone) return { text: head + '👥 Кого покличемо в ціль? Вони мають погодитись — і тоді з їхніх зборів теж відкладатиметься.' + (w.price ? '' : '\n(Ціль безкоштовна — нічого не відніматиметься.)'),
    kb: { inline_keyboard: others.map(function (k) { return [button(((w.inv || {})[k] ? '✅ ' : '⬜ ') + nameOf(st, k), 'gw:inv:' + k)]; }).concat([[button('Далі ▶️', 'gw:invdone')], cancel]) } };
  const g = wizGoal(st, id), rows = [];
  if (w.price) {
    rows.push([button('➖5%', 'gw:adj:pct:-5'), button('➖1%', 'gw:adj:pct:-1'), button('➕1%', 'gw:adj:pct:1'), button('➕5%', 'gw:adj:pct:5')]);
    rows.push([button('-100', 'gw:adj:price:-100'), button('-10', 'gw:adj:price:-10'), button('-1', 'gw:adj:price:-1'), button('+1', 'gw:adj:price:1'), button('+10', 'gw:adj:price:10'), button('+100', 'gw:adj:price:100')]);
  } else rows.push([button('-10', 'gw:adj:count:-10'), button('-1', 'gw:adj:count:-1'), button('+1', 'gw:adj:count:1'), button('+10', 'gw:adj:count:10')]);
  rows.push([button('✅ Створити ціль', 'gw:ok')], cancel);
  return { text: head + '📋 Перевір:\n' + goalCard(st, g, true).split('\n').slice(1).join('\n') +
    (Object.keys(g.parts).length > 1 ? '\n(рахуємо так, ніби всі запрошені погодяться)' : '') + pctTable(st, g, true) +
    '\n\n' + (w.price ? '💡 Кнопки міняють % і бюджет у гривнях. Точну суму можна написати: ' + b('/n 137') : '💡 Точну кількість зборів можна написати: ' + b('/n 35')), kb: { inline_keyboard: rows } };
}
function onGoalButton(st, user, parts, q, edit, eph) {
  const id = String(user.id), a = parts[0];
  st.wiz = st.wiz || {}; st.wait = st.wait || {};
  const show = function (v) { edit(v.text, v.kb); };
  if (a === 'gw') {
    const w = st.wiz[id] = st.wiz[id] || {};
    const what = parts[1], v = parts[2];
    if (what === 'new') { st.wiz[id] = {}; st.wait[id] = 'gname'; toast(q, ''); const x = wizView(st, id); if (eph) show(x); else sayTo(st, id, x.text, x.kb, q); return; }
    if (what === 'cancel') { delete st.wiz[id]; delete st.wait[id]; toast(q, 'Скасовано'); show(goalsView(st, id)); return; }
    if (what === 'idea') { w.name = GOAL_IDEAS[+v] || 'Ціль'; delete st.wait[id]; }
    else if (what === 'price') w.price = +v;
    else if (what === 'count') w.count = +v;
    else if (what === 'pct') {
      if (cutOf(st, id) + +v > GOAL_MAX_CUT) { toast(q, 'Забагато: ти вже відкладаєш ' + cutOf(st, id) + '% в інших цілях (максимум ' + GOAL_MAX_CUT + '%)'); return; }
      w.pct = +v;
    } else if (what === 'for') {
      if (v === 'other') { st.wait[id] = 'gfor'; toast(q, ''); edit('✏️ Для кого? Напиши в чат так:\n' + b('/n Мама'), { inline_keyboard: [[button('❌ Скасувати', 'gw:cancel')]] }); return; }
      w.for = v === 'all' ? 'all' : 'p:' + (v === 'me' ? id : v);
    } else if (what === 'inv') { w.inv = w.inv || {}; w.inv[v] = !w.inv[v]; }
    else if (what === 'invdone') w.invDone = true;
    else if (what === 'adj') {
      const d = +parts[3];
      if (v === 'pct') { const n = Math.max(1, Math.min(GOAL_MAX_CUT, w.pct + d)); if (cutOf(st, id) + n > GOAL_MAX_CUT) { toast(q, 'Максимум ' + GOAL_MAX_CUT + '% на всі цілі'); return; } w.pct = n; }
      if (v === 'price') w.price = Math.max(1, w.price + d);
      if (v === 'count') w.count = Math.max(1, w.count + d);
      const g0 = wizGoal(st, id);
      toast(q, (w.price ? w.pct + '% · ' + w.price + ' грн' : w.count + ' зборів') + ' → ' + etaShort(st, g0, true)); show(wizView(st, id)); return;
    } else if (what === 'ok') {
      if (!w.name || !w.for) { toast(q, 'Ще не все заповнено'); return; }
      const g = wizGoal(st, id); g.id = st.goalSeq = (st.goalSeq || 0) + 1; g.at = Date.now();
      goalList(st).push(g); delete st.wiz[id];
      const p = st.people[id];
      const r = sayK(st, 'goal:' + g.id, '🎯 ' + esc(nameOf(st, id)) + ' ' + verb(p, 'придумав', 'придумала') + ' нову ціль!\n\n' + goalCard(st, g, true) +
        (Object.keys(g.parts).length > 1 ? '\n\n' + Object.keys(g.parts).filter(function (k) { return k !== id; }).map(function (k) { return mention(st, k); }).join(', ') + ', ви з нами? 👇' : ''), goalKeyboard(st, g));
      g.mid = r && r.result ? r.result.message_id : null;
      toast(q, '🎉 Ціль створено!'); show(goalsView(st, id));
      Object.keys(g.parts).filter(function (k) { return k !== id; }).forEach(function (k) { // a personal invitation too
        sayTo(st, k, '💌 ' + esc(nameOf(st, id)) + ' ' + verb(p, 'кличе', 'кличе') + ' тебе в ціль!\n\n' + goalCard(st, g, true) +
          (g.price ? '\n\nЯкщо погодишся, з кожного твого збору ' + g.pct + '% відкладатиметься на цю ціль.' : '\n\nЦіль безкоштовна — нічого не відніматиметься, просто збираємо разом.'),
          { inline_keyboard: [[button('✅ Беру участь', 'gj:' + g.id + ':1'), button('🙅 Не цього разу', 'gj:' + g.id + ':0')]] });
      });
      return;
    }
    toast(q, ''); show(wizView(st, id)); return;
  }
  const g = goalById(st, parts[1]);
  if (!g) { toast(q, 'Цієї цілі вже немає'); show(goalsView(st, id)); return; }
  if (a === 'gv') { toast(q, ''); show(goalView(st, g, id)); return; }
  if (a === 'gj') {
    const x = g.parts[id];
    if (!x) { toast(q, 'Тебе не кликали в цю ціль 🙂'); return; }
    if (x.s !== 'wait') { toast(q, x.s === 'ok' ? 'Ти вже в цілі ✅' : 'Ти вже відповів(ла)'); return; }
    if (parts[2] === '1' && g.price && cutOf(st, id) + g.pct > GOAL_MAX_CUT) { toast(q, 'Не можна: разом з іншими цілями вийде більше ' + GOAL_MAX_CUT + '% відкладань'); return; }
    x.s = parts[2] === '1' ? 'ok' : 'no';
    toast(q, x.s === 'ok' ? '🤝 Ти в цілі!' + (g.price ? ' З твоїх зборів відкладатиметься ' + g.pct + '%' : '') : 'Добре, без тебе цього разу');
    refreshGoal(st, g);
    if (eph) show(goalsView(st, id));
    return;
  }
  const boss = id === String(g.by) || id === String(st.owner);
  if (!boss) { toast(q, 'Це може лише той, хто придумав ціль'); return; }
  if (a === 'gp') {
    const n = Math.max(1, Math.min(GOAL_MAX_CUT, g.pct + +parts[2]));
    const over = Object.keys(g.parts).filter(function (k) { return gIn(g, k) && cutOf(st, k, g) + n > GOAL_MAX_CUT; });
    if (over.length) { toast(q, esc(nameOf(st, over[0])) + ' вже відкладає багато в інших цілях'); return; }
    g.pct = n; refreshGoal(st, g);
    const e = goalEta(st, g);
    toast(q, n + '% → тепер ' + etaShort(st, g) + ' при повних нормах'); show(goalView(st, g, id)); return;
  }
  if (a === 'gx') {
    if (parts[2] !== 'ok') { toast(q, ''); edit('❌ Точно скасувати «' + esc(g.name) + '»?' + (g.fund ? '\nВідкладені ' + money(g.fund) + ' грн повернуться кожному на баланс.' : ''), { inline_keyboard: [[button('Так, скасувати', 'gx:' + g.id + ':ok'), button('Ні', 'gv:' + g.id)]] }); return; }
    cancelGoal(st, g, id); toast(q, 'Скасовано'); show(goalsView(st, id)); return;
  }
}
// Text typed in the group while the wizard waits for a name
// "/n LEGO" works always (commands reach the bot even in privacy mode); plain text only if the bot sees all messages.
function onGoalText(st, msg, given) {
  const id = String(msg.from.id); let w = (st.wait || {})[id];
  const wz = st.wiz && st.wiz[id], num = String(given !== undefined ? given : msg.text).trim().replace(',', '.');
  if (!w && wz && wz.name && /^\d+(\.\d+)?$/.test(num)) w = 'gnum'; // an exact budget or number of harvests
  if (!w || !wz) { if (given !== undefined) sayTo(st, id, 'Спершу натисни «🤝 Спільні цілі» → «➕ Нова ціль» 🙂'); return given !== undefined; }
  const t = String(given !== undefined ? given : msg.text).trim().slice(0, 40);
  if (!t) return given !== undefined;
  tg('deleteMessage', { chat_id: st.group, message_id: msg.message_id });
  if (w === 'gnum') {
    const x = parseFloat(t.replace(',', '.'));
    if (!(x > 0)) { sayTo(st, id, 'Напиши число, наприклад /n 75'); return true; }
    if (wz.price === undefined || wz.price > 0) wz.price = money(x); else wz.count = Math.round(x);
  } else if (w === 'gname') st.wiz[id].name = t; else st.wiz[id].for = 't:' + t;
  delete st.wait[id];
  const v = wizView(st, id), e = ((st.eph || {})[id] || {}).view;
  const r = e && e.e ? tg('editEphemeralMessageText', { chat_id: st.group, receiver_user_id: Number(id), ephemeral_message_id: e.e, text: v.text, parse_mode: 'HTML', reply_markup: v.kb }) : null;
  if (!r || !r.ok) sayTo(st, id, v.text, v.kb);
  return true;
}

// ---- fundraising for a new plot: the owner opens it with /newplot 16 575 Сонячна
function offerSum(o) { return Object.keys(o.pledges).reduce(function (a, k) { return a + o.pledges[k]; }, 0); }
function offerInfo(st, o) { // a day of the whole plot if everything is harvested: gold, UAH, who gets what
  const c = st.cfg, r = refCfg(c), g = iplotGold(r, o), P = PLOTS[o.type], f = { nBeds: REF.runs, nPlots: REF.runs };
  const gold = f.nBeds * g.beds + f.nPlots * g.plots, uah = gold * c.uahPer1000 / 1000, tax = iplotTaxDay(c, o);
  return { gold: gold, uah: uah, wage: uah * c.invWage / 100, owners: Math.max(0, uah * (100 - c.invWage) / 100 - tax), tax: tax,
    runs: f.nPlots, perRun: g.plots, spots: P.comps, beds: P.beds, bedRuns: f.nBeds };
}
function offerDaily(st, o) { return offerInfo(st, o).owners; }
function mon(d) { return Math.round(d * 30); } // investments speak in money a month (×30 days); a day only in the details // what the plot pays its owners a day
function offerIncomeText(st, o) {
  const x = offerInfo(st, o), c = st.cfg, d = x.owners;
  return '📈 Власникам ≈ ' + grn(mon(d)) + ' на місяць' + (d > 0 ? ' · окупиться ≈ за ' + b(Math.round(o.price / d) + ' днів') : '') +
    '\n\n<i>Деталі за день (еталон):</i>\nДілянка заробляє ≈ ' + fmtGold(x.gold) + ' = ' + money(x.uah) + ' грн' +
    '\n   (' + x.spots + ' місць: ⅔ бандли Clover, ⅓ компостери × ' + x.runs + ' ' + plural(x.runs, ['збір', 'збори', 'зборів']) + ' по ≈' + fmtGold(x.perRun) + (x.beds ? '; ' + x.beds + ' грядки Cactus/Turmeric × ' + x.bedRuns : '') + ')' +
    '\n   ' + c.invWage + '% — тому, хто збирає: ≈ ' + money(x.wage) + ' грн' +
    '\n   ' + (100 - c.invWage) + '% — власникам: ≈ ' + money(d) + ' грн' + (x.tax > 0 ? ' (мінус податок ' + money(x.tax) + ' грн)' : '');
}
// 10 squares: each person's part in their colour, what is still missing in white. Everyone who put money in
// gets at least one square, so a small part is still visible.
const BAR = 10;
function offerBar(st, o) { return shareBar(st, o.pledges, o.price); }
function shareBar(st, parts, goal) {
  const o = { pledges: parts, price: goal };
  const ids = Object.keys(o.pledges).filter(function (id) { return o.pledges[id] > 0; }), sum = offerSum(o);
  const full = sum >= o.price - 0.005;
  const target = full ? BAR : Math.min(BAR - 1, Math.max(ids.length, Math.round(sum / o.price * BAR)));
  const exact = ids.map(function (id) { return o.pledges[id] / o.price * BAR; });
  const cells = exact.map(function (x) { return Math.max(1, Math.floor(x)); });
  const total = function () { return cells.reduce(function (a, x) { return a + x; }, 0); };
  while (total() < target) { let k = 0; exact.forEach(function (x, i) { if (x - cells[i] > exact[k] - cells[k]) k = i; }); cells[k]++; }
  while (total() > target) { let k = 0; cells.forEach(function (x, i) { if (x - exact[i] > cells[k] - exact[k] && x > 1) k = i; }); if (cells[k] <= 1) break; cells[k]--; }
  return ids.map(function (id, i) { return new Array(cells[i] + 1).join(colorOf(st, id)); }).join('') + new Array(BAR - total() + 1).join('⬜');
}
function offerById(st, oid) { return st.offers.filter(function (o) { return o.id === oid; })[0] || (oid ? null : st.offers[0]) || null; }
function typeLabel(t) { return PLOTS[t].label.replace(' гільдії', ''); }
function offerText(st, o) {
  const sum = offerSum(o), d = offerDaily(st, o), left = money(Math.max(0, o.price - sum));
  const ids = Object.keys(o.pledges).filter(function (id) { return o.pledges[id] > 0; });
  return '🏗 ' + b('Ферма купує нову ділянку!') + '\n\n🏡 ' + typeLabel(o.type) + ' ' + b('«' + o.name + '»') +
    '\n💰 Ціна: ' + grn(o.price) +
    '\n' + offerIncomeText(st, o) +
    '\n\n' + offerBar(st, o) + ' ' + b(pct(Math.min(1, sum / o.price))) +
    (ids.length ? '\n' + ids.map(function (id) { return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' — ' + b(o.pledges[id] + ' грн') + ' (' + pct(o.pledges[id] / o.price) + ') → ≈ ' + mon(d * o.pledges[id] / o.price) + ' грн/міс'; }).join('\n') : '') +
    (left > 0 ? '\n⬜ Ще треба: ' + b(left + ' грн') +
      '\n\nКупимо, коли разом зберемо 100% 🎯 Вкладай зі свого балансу, мінімум ' + INV_MIN + ' грн.'
      : '\n\n🎉 ' + b('Зібрано 100%!') + ' ' + esc(ownerName(st)) + ' купує ділянку в грі. Скоро вона буде наша!');
}
function offerKeyboard(st, o) {
  const k = 'iv:' + o.id + ':';
  if (offerSum(o) >= o.price - 0.005) return { inline_keyboard: [[button('↩️ Забрати мій внесок', k + 'back')]] };
  return { inline_keyboard: [
    [button('💼 Вкласти 20 грн', k + '20'), button('💼 Вкласти 50 грн', k + '50')],
    [button('💼 Вкласти 100 грн', k + '100'), button('💼 Вкласти все', k + 'all')],
    [button('↩️ Забрати мій внесок', k + 'back')]] };
}
// The owner sets plot prices in gold; the family chat shows UAH (cfg.uahPer1000). o.gold is the deal, o.price its UAH.
function gold2uah(st, g) { return money(g * st.cfg.uahPer1000 / 1000); }
function parseGold(s) { // "36000", "36 000", "36k", "36к", "36000g"
  const m = String(s || '').replace(/\s+/g, '').replace(',', '.').match(/^(\d+(?:\.\d+)?)(k|к)?g?$/i);
  return m ? Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)) : 0;
}
function fmtGold(g) { return String(Math.round(g)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + 'g'; }
// A new price for the open fundraising (a discount). If the money already in covers it, the fundraising is complete;
// what is over the price goes back to the owner first, so the children's shares are not cut.
function repriceOffer(st, o, gold) {
  const old = o.price;
  o.gold = gold; o.price = gold2uah(st, gold);
  let over = money(offerSum(o) - o.price);
  const back = {};
  const giveBack = function (id, amt) { amt = money(Math.min(amt, o.pledges[id] || 0)); if (amt <= 0) return 0;
    o.pledges[id] = money(o.pledges[id] - amt); if (o.pledges[id] <= 0.005) delete o.pledges[id];
    st.balance[id] = money((st.balance[id] || 0) + amt); back[id] = money((back[id] || 0) + amt); return amt; };
  if (over > 0.005 && st.owner) over = money(over - giveBack(String(st.owner), over)); // the owner's extra first
  if (over > 0.005) { // still over (the owner put in less than the extra): everyone else gives back in proportion
    const total = offerSum(o);
    Object.keys(o.pledges).forEach(function (id) { giveBack(id, money(over * (o.pledges[id] || 0) / total)); });
  }
  return { old: old, back: back };
}
function openOffer(st, type, price, name, gold) {
  st.offerSeq = (st.offerSeq || 0) + 1;
  const o = { id: 'o' + st.offerSeq, type: type, price: price, name: name, pledges: {}, gold: gold || null };
  st.offers.push(o); showOffer(st, o); return o;
}
function showOffer(st, o) { const r = sayK(st, 'offer:' + o.id, offerText(st, o), offerKeyboard(st, o)); o.mid = r && r.result ? r.result.message_id : null; }
function refreshOffer(st, o) { // one fundraising, or all of them
  (o ? [o] : st.offers).forEach(function (o) {
    if (o.mid) tg('editMessageText', { chat_id: st.group, message_id: o.mid, text: offerText(st, o), parse_mode: 'HTML', reply_markup: offerKeyboard(st, o) });
  });
}
function pledge(st, user, oid, what, q) {
  const o = offerById(st, oid), p = person(st, user);
  if (!o) { toast(q, 'Цей збір уже закрито'); return; }
  const id = String(user.id), mine = o.pledges[id] || 0, bal = st.balance[id] || 0;
  if (what === 'back') {
    if (!mine) { toast(q, 'Ти ще нічого не вклала в цю ділянку'); return; }
    st.balance[id] = money(bal + mine); delete o.pledges[id];
    const lost = investBonusBack(st, id);
    toast(q, '↩️ ' + mine + ' грн повернуто на баланс');
    sayK(st, 'pledge', '↩️ ' + esc(p.name) + ' ' + verb(p, 'забрав', 'забрала') + ' свій внесок (' + mine + ' грн) з ділянки «' + esc(o.name) + '».' +
      (lost ? '\n🏡 Сезонні кристали за внески теж повернулись: −' + lost + ' ' + GEM : ''));
    refreshOffer(st, o); refreshSeason(st); return;
  }
  const left = money(o.price - offerSum(o));
  let amt = what === 'all' ? Math.min(bal, left) : +what;
  amt = money(Math.min(amt, left));
  if (left <= 0) { toast(q, 'Ділянку вже повністю зібрано 🎉'); return; }
  if (amt < Math.min(INV_MIN, left)) { toast(q, 'Мінімум ' + Math.min(INV_MIN, left) + ' грн'); return; }
  if (bal < amt) { toast(q, 'На балансі лише ' + money(bal) + ' грн'); return; }
  st.balance[id] = money(bal - amt); o.pledges[id] = money(mine + amt);
  toast(q, '💼 +' + amt + ' грн');
  if (offerSum(o) >= o.price - 0.005 && st.owner) say(st.owner, '🎉 На «' + esc(o.name) + '» зібрано 100% (' + o.price + ' грн)! Купуйте ділянку в грі й натисніть «✅ Куплено в грі».', settingsKeyboard(st, 'invest'));
  const bonus = investBonus(st, id);
  sayK(st, 'pledge', '💼 ' + esc(p.name) + ' ' + verb(p, 'вклав', 'вклала') + ' ' + b(amt + ' грн') + ' у ділянку «' + esc(o.name) + '»! Тепер це ' + pct(o.pledges[id] / o.price) +
    ' ділянки 🌱\nНа балансі лишилось ' + money(st.balance[id]) + ' грн.' + (bonus ? '\n🏡 Сезонний бонус: +' + bonus + ' ' + GEM + '!' : '') + seasonLine(st));
  refreshOffer(st, o); refreshSeason(st);
}
function closeOffer(st, o, bought) {
  if (!o) return;
  if (o.mid) tg('editMessageReplyMarkup', { chat_id: st.group, message_id: o.mid, reply_markup: { inline_keyboard: [] } });
  st.offers = st.offers.filter(function (x) { return x !== o; });
  if (st.msgs) delete st.msgs['offer:' + o.id]; // the finished card stays in the chat as a record
  if (!bought) {
    Object.keys(o.pledges).forEach(function (id) { st.balance[id] = money((st.balance[id] || 0) + o.pledges[id]); });
    sayK(st, 'offerEnd', '❌ Збір на «' + esc(o.name) + '» скасовано. Усі внески повернуто на баланс.');
    return;
  }
  if (seasonOn(st, 'invest')) st.season.bought = dayKey(Date.now(), st.cfg);
  const shares = Object.assign({}, o.pledges); // bought only at 100%: the shares are exactly what people put in
  const plot = { id: 'p' + Date.now().toString(36), name: o.name, type: o.type, price: o.price, gold: o.gold || null, since: dayKey(Date.now(), st.cfg), shares: shares, got: {}, days: {} };
  st.cfg.iplots = (st.cfg.iplots || []).concat([plot]);
  dropK(st, 'pledge'); sayK(st, 'offerEnd', '🎉 ' + b('«' + plot.name + '» куплена!') + '\n🏡 ' + typeLabel(plot.type) + '\n\nВласники:\n' +
    Object.keys(shares).map(function (id) { return colorOf(st, id) + ' ' + esc(nameOf(st, id)) + ' — ' + pct(shareOf(plot, id)) + ' (' + shares[id] + ' грн)'; }).join('\n') +
    '\n\nЗ сьогоднішнього вечора — перші дивіденди!');
  checkAchAll(st);
}

// ---- 💼 Інвестиції (Ферма → 💼): a short family view, then a personal portfolio and a page per plot or fundraising.
// The numbers are the reference day (REF): what a plot gives its owners a day if every harvest is done.
const LAND_GOALS = [1, 10, 25, 50, 100, 200, 500, 1000, 2000];
// monospace lines without Telegram's "copy" header that <pre> gets: each line its own <code>
function mono(t) { return String(t).split('\n').map(function (l) { return '<code>' + esc(l.replace(/ /g, '\u00a0')) + '</code>'; }).join('\n'); }
function padR(t, n) { t = String(t); return t + ' '.repeat(Math.max(1, n - t.length)); }
function padL(t, n) { t = String(t); return ' '.repeat(Math.max(0, n - t.length)) + t; }
function kpi(rows) { // an aligned table in a monospace block: [label, value]
  const w = rows.reduce(function (a, r) { return Math.max(a, r[0].length); }, 0) + 2, v = rows.reduce(function (a, r) { return Math.max(a, r[1].length); }, 0);
  return '\n' + mono(rows.map(function (r) { return padR(r[0], w) + padL(r[1], v); }).join('\n')) + '\n';
}
function sbar(x) { const n = Math.max(x > 0 ? 1 : 0, Math.min(10, Math.round(x * 10))); return '▰'.repeat(n) + '▱'.repeat(10 - n); }
function num(x) { const v = money(x); return v >= 100 ? String(Math.round(v)) : String(v); }
function plotGold(st, p) { return p.gold || p.price * 1000 / st.cfg.uahPer1000; }
function myShares(st, id) { return (st.cfg.iplots || []).filter(function (p) { return p.shares[id]; }); }
function plotToday(st, p, id) { // { amt, paid } what the share has earned today
  const day = dayKey(Date.now(), st.cfg);
  if ((p.days || {})[day]) return { amt: money(p.days[day][id] || 0), paid: true };
  return { amt: money(divSoFar(st, p, Date.now()).net * shareOf(p, id)), paid: false };
}
function famInvText(st) {
  const list = st.cfg.iplots || [];
  const value = list.reduce(function (a, p) { return a + p.price; }, 0), day = list.reduce(function (a, p) { return a + offerDaily(st, p); }, 0);
  let t = '💼 ' + b('Інвестиції родини');
  if (list.length) t += '\n' + kpi([['Земля в інвестиціях', num(value) + ' грн'], ['Приносить / місяць', '+' + mon(day) + ' грн']]);
  else t += '\n\nПоки немає інвестиційної землі.' + (st.offers.length ? ' Перша вже збирається 👇' : ' Скоро буде! 🏗');
  list.forEach(function (p) {
    t += '\n🏡 ' + b(p.name) + ' · ' + typeLabel(p.type).replace(' з будинком', '') + ' · +' + mon(offerDaily(st, p)) + ' грн/міс' +
      '\n   ' + shareBar(st, p.shares, p.price) +
      '\n   ' + Object.keys(p.shares).map(function (id) { return esc(nameOf(st, id)) + ' ' + pct(shareOf(p, id)); }).join(' · ') + '\n';
  });
  st.offers.forEach(function (o) {
    t += '\n🏗 ' + b(o.name) + ' · ' + typeLabel(o.type).replace(' з будинком', '') + ' · збір ' + pct(Math.min(1, offerSum(o) / o.price)) +
      '\n   ' + offerBar(st, o) +
      '\n   ' + (offerSum(o) >= o.price - 0.005 ? '✅ Зібрано! Скоро купимо' : 'Ще треба ' + num(o.price - offerSum(o)) + ' грн') + ' → +' + mon(offerDaily(st, o)) + ' грн/міс\n';
  });
  return t.replace(/\n+$/, '');
}
function famInvKeyboard(st) {
  const items = (st.cfg.iplots || []).map(function (p) { return button('🏡 ' + p.name + ' ›', 'ivp:' + p.id); })
    .concat(st.offers.map(function (o) { return button('🏗 ' + o.name + ' ›', 'ivo:' + o.id); })), rows = [[button('👤 Мій портфель ›', 'menu:myinv')]];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return withBack({ inline_keyboard: rows }, 'invest');
}
function myInvText(st, id) {
  const mine = myShares(st, id), w = money((st.invWallet || {})[id] || 0);
  const value = mine.reduce(function (a, p) { return a + p.shares[id]; }, 0);
  const day = mine.reduce(function (a, p) { return a + offerDaily(st, p) * shareOf(p, id); }, 0);
  const pl = money(st.offers.reduce(function (a, o) { return a + (o.pledges[id] || 0); }, 0));
  let t = '💼 ' + b('Портфель · ' + nameOf(st, id));
  if (mine.length) {
    const rows = [['Вартість часток', num(value) + ' грн'], ['Дохід / місяць', '+' + mon(day) + ' грн']];
    if (value > 0 && day > 0) rows.push(['Дохідність', Math.round(day * 30 / value * 100) + '% / міс'], ['Окупність', '≈' + Math.round(value / day) + ' ' + plural(Math.round(value / day), ['день', 'дні', 'днів'])]);
    if (pl) rows.push(['Вкладено в збори', num(pl) + ' грн']);
    t += '\n' + kpi(rows) + '🏦 До виплати: ' + grn(w);
  } else {
    t += '\n💰 На балансі: ' + grn(st.balance[id] || 0) + (pl ? ' · 🏗 у зборах: ' + grn(pl) : '') + (w ? '\n🏦 До виплати: ' + grn(w) : '') +
      '\n\nПоки в тебе немає своєї землі. ' + (st.offers.length ? 'Зараз іде збір на нову ділянку — дивись «🏡 Усі інвестиції ферми» 👇' : 'Коли ферма відкриє збір на нову ділянку, вклади частину гривень — і вона щодня заробляє тобі гроші 🌱');
  }
  mine.forEach(function (p) {
    const d = offerDaily(st, p) * shareOf(p, id), td = plotToday(st, p, id), x = divSoFar(st, p, Date.now());
    t += '\n\n🏡 ' + b(p.name) + ' · ' + typeLabel(p.type).replace(' з будинком', '') +
      '\n   ' + sbar(shareOf(p, id)) + '  ' + pct(shareOf(p, id)) +
      '\n   +' + mon(d) + ' грн/міс (' + num(d) + ' на день)' +
      '\n   Сьогодні ' + b('+' + td.amt + ' грн') + (td.paid ? ' (уже в 🏦)' : ' (грядки ' + x.beds + ' з ' + REF.runs + ', бандли ' + x.plots + ' з ' + REF.runs + ')');
  });
  st.offers.filter(function (o) { return o.pledges[id]; }).forEach(function (o) {
    const my = o.pledges[id] || 0;
    t += '\n\n🏗 ' + b(o.name) + ' · ' + typeLabel(o.type).replace(' з будинком', '') + ' — йде збір' +
      '\n   ' + sbar(Math.min(1, offerSum(o) / o.price)) + '  ' + pct(Math.min(1, offerSum(o) / o.price)) + ' зібрано' +
      '\n   ' + (my ? 'Твій внесок ' + my + ' грн → +' + mon(offerDaily(st, o) * my / o.price) + ' грн/міс' : '100 грн → +' + mon(offerDaily(st, o) * 100 / o.price) + ' грн/міс');
  });
  return t;
}
function myInvKeyboard(st, id) {
  const w = money((st.invWallet || {})[id] || 0), rows = [];
  const items = myShares(st, id).map(function (p) { return button('🏡 ' + p.name + ' ›', 'ivp:' + p.id); })
    .concat(st.offers.filter(function (o) { return o.pledges[id]; }).map(function (o) { return button('🏗 ' + o.name + ' ›', 'ivo:' + o.id); }));
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  if (w > 0) rows.push([button('💰 Забрати ' + w + ' грн', 'ivtake:' + id)]);
  rows.push([button('🏡 Усі інвестиції ферми ›', 'menu:invest')]);
  rows.push([button('⬅️ 👤 Я', 'menu:my')]);
  return { inline_keyboard: rows };
}
function plotDetailText(st, p) {
  const c = st.cfg, x = offerInfo(st, p), r = refCfg(c), g = iplotGold(r, p), d = x.owners;
  const ids = Object.keys(p.shares), w = Math.max(5, ids.reduce(function (a, id) { return Math.max(a, nameOf(st, id).length); }, 0) + 1);
  const bedsG = g.beds * REF.runs, plotsG = g.plots * REF.runs;
  const gu = function (gold) { return gold * c.uahPer1000 / 1000; }, gt = (TAX_CERTS[p.type] || 0) * CERT_GOLD / 7;
  const L = function (l, v) { return padR(l, 24) + padL(v, 9); }, line = '─'.repeat(33);
  const day = dayKey(Date.now(), c), week = Object.keys(p.days || {}).sort().slice(-7).reduce(function (a, k) { return a + Object.keys(p.days[k]).reduce(function (s, id) { return s + p.days[k][id]; }, 0); }, 0);
  const got = Object.keys(p.got || {}).reduce(function (a, id) { return a + p.got[id]; }, 0);
  const todayAll = (p.days || {})[day] ? Object.keys(p.days[day]).reduce(function (a, id) { return a + p.days[day][id]; }, 0) : divSoFar(st, p, Date.now()).net;
  return '🏡 ' + b(p.name) + ' · ' + esc(typeLabel(p.type)) +
    '\nКуплена ' + shortDate(p.since) + ' · ' + fmtGold(plotGold(st, p)) + ' = ' + grn(p.price) +
    '\n\n👥 ' + b('Власники') + '\n' + shareBar(st, p.shares, p.price) +
    '\n' + mono(padR('', w) + padL('Частка', 7) + padL('Вартість', 9) + padL('День', 6) + padL('Міс', 5) + '\n' +
      ids.map(function (id) { const s = shareOf(p, id); return padR(nameOf(st, id), w) + padL(pct(s), 7) + padL(num(p.shares[id]), 9) + padL(num(d * s), 6) + padL(Math.round(d * s * 30), 5); }).join('\n')) +
    '\n\n📊 ' + b('Як рахується') + ' (еталонний день)\n' + mono(
      'За день (' + REF.runs + ' зборів), у гривнях:\n' +
      (x.beds ? L(x.beds + ' грядки Cact/Turm', money(gu(bedsG))) + '\n' : '') +
      L(x.spots + ' місць ⅔бандл ⅓комп', money(gu(plotsG))) + '\n' + line + '\n' +
      L('Ділянка за день', money(x.uah)) + '\n' +
      L('− ' + c.invWage + '% тому, хто збирає', '−' + money(x.wage)) + '\n' +
      (x.tax > 0 ? L('− податок за день', '−' + money(x.tax)) + '\n' : '') + line + '\n' +
      L('Власникам за день', money(d)) +
      (x.tax > 0 ? '\n\nПодаток: ' + (TAX_CERTS[p.type] || 0) + ' серт./тиж × ' + CERT_GOLD + 'g = ' + fmtGold(gt * 7) + '/тиж ÷ 7 = ' + fmtGold(gt) + '/день' : '')) +
    '\n\n📆 ' + b('Факт') + '\nСьогодні +' + money(todayAll) + ' · 7 днів +' + money(week) + '\nВсього заробила власникам: ' + grn(got);
}
function plotDetailKeyboard(st, p, id) {
  const rows = [];
  if (p.shares[id] && String(id) !== String(st.owner)) {
    const from = addDays(p.since, SELL_AFTER), ok = dayKey(Date.now(), st.cfg) >= from;
    rows.push([button(ok ? '💸 Продати частку' : '💸 Продати частку (з ' + shortDate(from) + ')', 'ivsell:' + p.id + ':' + id)]);
  }
  rows.push([button('👤 Мій портфель', 'menu:myinv'), button('⬅️ 💼 Інвестиції', 'menu:invest')]);
  return { inline_keyboard: rows };
}
function offerDetailKeyboard(st, o) {
  return { inline_keyboard: offerKeyboard(st, o).inline_keyboard.concat([[button('👤 Мій портфель', 'menu:myinv'), button('⬅️ 💼 Інвестиції', 'menu:invest')]]) };
}
function sellShare(st, user, plotId, owner, confirm, q, edit) {
  if (String(owner) !== String(user.id)) { toast(q, 'Це не твоя частка'); return; }
  const p = (st.cfg.iplots || []).filter(function (x) { return x.id === plotId; })[0], id = String(user.id), pe = person(st, user);
  if (!p || !p.shares[id]) { toast(q, 'Цієї частки вже немає'); return; }
  const from = addDays(p.since, SELL_AFTER);
  if (dayKey(Date.now(), st.cfg) < from) { toast(q, '⏳ Продати можна з ' + shortDate(from) + '. Земля любить терпіння 🌱'); return; }
  const amt = p.shares[id];
  if (!confirm) {
    toast(q, '');
    edit('↩️ Продати свою частку ' + pct(shareOf(p, id)) + ' ділянки «' + esc(p.name) + '»?\n' + esc(nameOf(st, st.owner)) + ' викупить її за ' + grn(amt) + '.\nТоді щоденний дохід з неї припиниться.\nВже отримано: ' + money((p.got || {})[id] || 0) + ' грн — вони лишаються твоїми.',
      { inline_keyboard: [[button('✅ Так, продати', 'ivsellok:' + p.id + ':' + id), button('❌ Ні, хай працює', 'ivinv:' + id)]] });
    return;
  }
  delete p.shares[id]; p.shares[st.owner] = money((p.shares[st.owner] || 0) + amt);
  st.balance[id] = money((st.balance[id] || 0) + amt);
  toast(q, '+' + amt + ' грн');
  sayK(st, 'sell', '↩️ ' + esc(pe.name) + ' ' + verb(pe, 'продав', 'продала') + ' свою частку ділянки «' + esc(p.name) + '» за ' + grn(amt) + '. Гроші вже на балансі.');
  edit(myInvText(st, id), myInvKeyboard(st, id));
}
function landText(st) {
  const c = st.cfg, list = c.iplots || [];
  const founder = Object.keys(PLOTS).filter(function (k) { return c[k] > 0; }).map(function (k) { return c[k] + ' × ' + PLOTS[k].label.replace(' з будинком', ''); });
  if (c.neutral) founder.push('нейтральна');
  return '🗺 ' + b('Наша земля') + '\n\n🏡 ' + b('Засновницька') + ' (власник ' + esc(nameOf(st, st.owner)) + ')\n' + founder.join(' · ') +
    '\nЗ неї: ' + (100 - c.bankPct) + '% тому, хто зібрав · ' + c.bankPct + '% у 🐷 скарбничку' +
    '\n\n🌱 ' + b('Інвесторська') + (list.length ? '\n' + list.map(function (p) { return plotLabel(p); }).join(' · ') + '\nДеталі й частки — у 🏡 Ферма → 💼 Інвестиції.\nЗ неї: ' + c.invWage + '% тому, хто зібрав · ' + (100 - c.invWage) + '% власникам' : '\nПоки немає. Скоро буде! 🏗') +
    '\n\n🐷 У скарбничці: ' + grn(st.bank);
}
function investSettingsText(st) {
  const c = st.cfg, list = st.offers;
  return PAGES.invest + '\nІнвесторські ділянки: ' + b(c.invWage + '%') + ' тому, хто зібрав · ' + b((100 - c.invWage) + '%') + ' власникам (без скарбнички)' +
    '\nПодаток 16×16 (' + TAX_CERTS.plots16 + ' сертифікатів/тиж) віднімається з доходу власників.' +
    '\nМінімальний внесок ' + INV_MIN + ' грн, продати частку можна через ' + SELL_AFTER + ' днів за ціною покупки.' +
    '\n\n' + list.map(function (o, i) {
      return '🏗 ' + (list.length > 1 ? (i + 1) + '. ' : '') + 'Збір «' + esc(o.name) + '», ' + typeLabel(o.type) + ', ' + b(fmtGold(o.gold || o.price * 1000 / c.uahPer1000)) + ' = ' + o.price + ' грн\n' + offerBar(st, o) + ' зібрано ' + money(offerSum(o)) + ' грн · власникам ≈ ' + mon(offerDaily(st, o)) + ' грн/міс' +
        Object.keys(o.pledges).map(function (id) { return '\n   ' + esc(nameOf(st, id)) + ' ' + pct(o.pledges[id] / o.price) + ' → ≈ ' + mon(offerDaily(st, o) * o.pledges[id] / o.price) + ' грн/міс'; }).join('') +
        (offerSum(o) >= o.price - 0.005 ? '\n✅ 100% — можна купувати!' : '\nКупуємо лише коли зберемо 100%.');
    }).join('\n\n') + (list.length ? '\n\n🏷 Інша ціна? /price 30000' + (list.length > 1 ? ' — для кількох зборів з номером: /price 2 30000' : '') + ' (у золоті). Якщо грошей уже вистачає — збір завершиться, а зайве повернеться вам.\n\n' : '') +
    '➕ Відкрити ' + (list.length ? 'ще один збір' : 'збір на нову ділянку') + ' — напишіть мені тут:\n/newplot 16 36000 Сонячна\n(тип 8, 16, 24 або 28 · ціна в золоті, можна 36k · назва як у грі)' +
    ((c.iplots || []).length ? '\n\n' + (c.iplots || []).map(function (p) { const d = offerDaily(st, p); return '• ' + plotLabel(p) + ', з ' + shortDate(p.since) + ', ' + p.price + ' грн · власникам ≈ ' + mon(d) + ' грн/міс: ' +
      Object.keys(p.shares).map(function (id) { return esc(nameOf(st, id)) + ' ' + pct(shareOf(p, id)) + ' → ' + mon(d * shareOf(p, id)); }).join(', '); }).join('\n') : '');
}


// ---------------------------------------------------------------- 🏅 achievements
// Unlocked once and kept forever: st.ach[uid] = { id: 'YYYY-MM-DD' }. No crystals or money for them: just a badge
// and a cheer in the group. Checked in the evening and right after harvests, investments, purchases and races.
// Achievements count from the day they appeared (st.achStart): what was done before is honoured by one badge,
// "З першого дня", not by a pile of badges at once. Totals subtract the values at the start (st.achBase).
function harvestsRaw(st, id) { return Object.keys(st.stats).reduce(function (a, k) { return a + (k[0] === 'm' && st.stats[k][id] ? st.stats[k][id].n : 0); }, 0); }
function earnedRaw(st, id) { return Object.keys(st.stats).reduce(function (a, k) { return a + (k[0] === 'm' && st.stats[k][id] ? st.stats[k][id].uah : 0); }, 0); }
function base(st, id) { return (st.achBase || {})[id] || { n: 0, uah: 0 }; }
// Totals before achievements started = everything minus the days from achStart on (those count for badges).
// The first version took the totals at the first check, which already held the harvest that triggered it.
function setBases(st) {
  st.achBase = {};
  Object.keys(st.people).forEach(function (id) {
    let n = harvestsRaw(st, id), uah = earnedRaw(st, id);
    Object.keys(st.stats).forEach(function (k) {
      if (k[0] === 'd' && k.slice(2) >= st.achStart && st.stats[k][id]) { n -= st.stats[k][id].n; uah -= st.stats[k][id].uah; }
    });
    st.achBase[id] = { n: Math.max(0, n), uah: Math.max(0, uah) };
  });
  st.achBaseFix = true;
}
function harvestsTotal(st, id) { return Math.max(0, harvestsRaw(st, id) - base(st, id).n); }
function earnedTotal(st, id) { return Math.max(0, earnedRaw(st, id) - base(st, id).uah); }
function bestDay(st, id) {
  return Object.keys(st.stats).reduce(function (a, k) { return Math.max(a, k[0] === 'd' && k.slice(2) >= st.achStart && st.stats[k][id] ? st.stats[k][id].n : 0); }, 0);
}
// Once, when achievements first run: remember where everyone starts and give the "from day one" badge.
function startAch(st) {
  if (st.achStart) return;
  st.achStart = dayKey(Date.now(), st.cfg);
  setBases(st);
  Object.keys(st.people).forEach(function (id) { (st.ach[id] = st.ach[id] || {}).first = st.achStart; });
  if (st.group && Object.keys(st.people).length) say(st.group, '🌅 ' + b('Нове: досягнення!') + '\n\nКожен, хто працював на фермі з самого початку, отримує особливий значок 🌅 ' + b('«З першого дня»') +
    '\nБільше його не отримає ніхто й ніколи 🤫\n\n' + Object.keys(st.people).map(function (id) { return '🌅 ' + esc(nameOf(st, id)); }).join('\n') +
    '\n\nРешта значків рахується з сьогодні. Усі досягнення: 🏅 у /menu');
}
function landEarned(st, id) { return (st.cfg.iplots || []).reduce(function (a, p) { return a + ((p.got || {})[id] || 0); }, 0); }
function ownsLand(st, id) { return (st.cfg.iplots || []).some(function (p) { return p.shares[id]; }) ? 1 : 0; }
function bestStreak(st, id) { return (st.streak[id] || {}).best || 0; }
const ACH_GROUPS = [
  { title: '🚜 Збори', color: '🟩', of: harvestsTotal, unit: ['збір', 'збори', 'зборів'], steps: [
    [1, '🌱', 'Перший урожай'], [10, '🧺', 'Десять кошиків'], [50, '🚜', 'Справжня фермерка', 'Справжній фермер'], [100, '🌾', 'Сотня зборів'], [500, '👑', 'Королева ферми', 'Король ферми'] ] },
  { title: '⚡ Рекорд за день', color: '🟩', of: bestDay, unit: ['збір', 'збори', 'зборів'], steps: [
    [6, '⚡', 'Робочий день'], [8, '💪', 'Невтомна', 'Невтомний'], [10, '🚀', 'Ракета'] ] },
  { title: '🔥 Стрік', color: '🟧', of: bestStreak, unit: ['день', 'дні', 'днів'], steps: [
    [3, '🔥', 'Три дні поспіль'], [7, '📅', 'Тиждень без пропусків'], [14, '🌟', 'Два тижні'], [30, '🏆', 'Місяць поспіль'] ] },
  { title: '💰 Заробіток', color: '🟨', of: earnedTotal, unit: ['грн', 'грн', 'грн'], steps: [
    [100, '💵', 'Перша сотня'], [500, '💰', 'П\'ятсот гривень'], [1000, '🤑', 'Тисячниця', 'Тисячник'], [5000, '💎', 'Магнатка', 'Магнат'] ] },
  { title: '🏡 Власність', color: '🟦', of: ownsLand, unit: ['ділянка', 'ділянки', 'ділянок'], steps: [[1, '🏡', 'Власниця землі', 'Власник землі']] },
  { title: '🌱 Заробила земля', color: '🟦', of: landEarned, unit: ['грн', 'грн', 'грн'], steps: [
    [1, '🌱', 'Перша гривня від землі'], [10, '🪙', 'Десять гривень від землі'], [25, '🌳', 'Земля працює'], [50, '🏅', 'П\'ятдесят від землі'], [100, '👑', 'Справжня власниця', 'Справжній власник'], [200, '🏰', 'Землевласниця', 'Землевласник'] ] },
  { title: '🏁 Перегони', color: '🟪', of: function (st, id) { return (st.raceWins || {})[id] || 0; }, unit: ['перемога', 'перемоги', 'перемог'], steps: [
    [1, '🥇', 'Перша перемога'], [3, '🏁', 'Чемпіонка', 'Чемпіон'] ] },
  { title: '🤝 Спільні цілі', color: '🟦', of: function (st, id) { return gstat(st, id).done; }, unit: ['ціль', 'цілі', 'цілей'], steps: [
    [1, '🤝', 'Командна гравчиня', 'Командний гравець'], [3, '🎯', 'Три мрії разом'], [10, '🌈', 'Сила родини'] ] },
  { title: '✨ Мої мрії', color: '🟦', of: function (st, id) { return gstat(st, id).dreams; }, unit: ['ціль', 'цілі', 'цілей'], steps: [
    [1, '✨', 'Мрійниця', 'Мрійник'], [5, '🌠', 'Мрія за мрією'] ] },
  { title: '🎁 Для інших', color: '🟦', of: function (st, id) { return gstat(st, id).gifts; }, unit: ['подарунок', 'подарунки', 'подарунків'], steps: [
    [1, '🎁', 'Подарунок від серця'], [3, '💝', 'Щедре серце'] ] },
  { title: '🐷 Відкладено на цілі', color: '🟦', of: function (st, id) { return gstat(st, id).saved; }, unit: ['грн', 'грн', 'грн'], steps: [
    [10, '🪙', 'Перші 10 грн на мрію'], [50, '🐷', 'Ощадлива', 'Ощадливий'], [200, '💰', 'Справжня скарбничка'], [1000, '🏦', 'Банкірка', 'Банкір'] ] },
  { title: '🏁 Сезони перегонів', color: '🟪', of: function (st, id) { return sach(st, id, 'race'); }, unit: ['сезон', 'сезони', 'сезонів'], steps: [
    [1, '🏁', 'Переможниця сезону', 'Переможець сезону'], [3, '🏆', 'Чемпіонка сезонів', 'Чемпіон сезонів'], [10, '👑', 'Легенда перегонів'] ] },
  { title: '🤝 Командні сезони', color: '🟪', of: function (st, id) { return sach(st, id, 'team'); }, unit: ['сезон', 'сезони', 'сезонів'], steps: [
    [1, '🤝', 'Командний сезон'], [3, '💪', 'Душа команди'], [10, '❤️', 'Серце родини'] ] },
  { title: '💎 Кристальні сезони', color: '🟪', of: function (st, id) { return sach(st, id, 'gems'); }, unit: ['сезон', 'сезони', 'сезонів'], steps: [
    [1, '💎', 'Кристальний сезон'], [3, '💠', 'Кристальна майстриня', 'Кристальний майстер'], [10, '👑', 'Кристальна королева', 'Кристальний король'] ] },
  { title: '🌅 Ранні пташки', color: '🟪', of: function (st, id) { return sach(st, id, 'early'); }, unit: ['сезон', 'сезони', 'сезонів'], steps: [
    [1, '🌅', 'Рання пташка'], [3, '🐓', 'Жайворонок'], [10, '☀️', 'Сонечко ферми'] ] },
  { title: '🏡 Інвестиційні сезони', color: '🟪', of: function (st, id) { return sach(st, id, 'invest'); }, unit: ['сезон', 'сезони', 'сезонів'], steps: [
    [1, '🏡', 'Інвесторка сезону', 'Інвестор сезону'], [3, '📈', 'Справжня інвесторка', 'Справжній інвестор'], [10, '🏰', 'Магнатка землі', 'Магнат землі'] ] },
  { title: '🛒 Магазин', color: '🟪', of: function (st, id) { return inv(st, id).bought || 0; }, unit: ['покупка', 'покупки', 'покупок'], steps: [
    [1, '🛍', 'Перша покупка'], [5, '🛒', 'Постійна клієнтка', 'Постійний клієнт'] ] },
  { title: '🐾 Улюбленець', color: '🟫', of: function (st, id) { return petOk(petOf(st, id)) ? 1 : 0; }, unit: ['друг', 'друзі', 'друзів'], steps: [[1, '🤝', 'Друг тварин']] },
  { title: '🎓 Рівень улюбленця', color: '🟫', of: function (st, id) { const pet = petOf(st, id); return petOk(pet) ? petLevel(pet) : 0; }, unit: ['рівень', 'рівні', 'рівнів'], steps: [
    [3, '🐾', 'Перший помічник'], [5, '📚', 'Вихователька', 'Вихователь'], [10, '🎓', 'Найкращий друг'] ] },
  { title: '🍖 Годування', color: '🟫', of: function (st, id) { const pet = petOf(st, id); return pet && pet.meals || 0; }, unit: ['раз', 'рази', 'разів'], steps: [
    [30, '🍖', 'Дбайлива господиня', 'Дбайливий господар'], [100, '🦴', 'Ситий друг'] ] },
  { title: '🔎 Знахідки', color: '🟫', of: function (st, id) { const pet = petOf(st, id); return pet && pet.finds || 0; }, unit: ['знахідка', 'знахідки', 'знахідок'], steps: [
    [1, '🔎', 'Перша знахідка'], [10, '🐾', 'Нюх як у детектива'], [100, '🏆', 'Сто знахідок'] ] },
  { title: '👗 Одяг улюбленця', color: '🟫', of: function (st, id) { const pet = petOf(st, id); return pet ? PET_SLOTS.filter(function (s) { return ((pet.own || {})[s.id] || []).length; }).length : 0; }, unit: ['вид', 'види', 'видів'], steps: [
    [3, '👗', 'Модниця', 'Модник'] ] },
];
function achName(st, id, s) { const p = st.people[id]; return p && !p.female && s[3] ? s[3] : s[2]; }
// Progress bars. The squares must agree with the numbers next to them, an 8-year-old counts them:
// • goal of up to 10 whole steps (3 days, 6 harvests, 1 plot): one square per step, 2 / 6 -> 🟩🟩⬜⬜⬜⬜
// • bigger goals (50 harvests, 100 грн): 10 squares, a square = a tenth, rounded down;
//   anything above zero shows at least one square, and the bar is full only when the goal is really reached.
// • shares of one sum (a plot being bought): see offerBar, the same 10 squares split by colour.
function ebar(fill, color, cells) { cells = cells || 10; fill = Math.max(0, Math.min(cells, fill)); return new Array(fill + 1).join(color) + new Array(cells - fill + 1).join('⬜'); }
// • the colour shows how far along it is (not the topic): < 25% 🟥, 25–49% 🟧, 50–74% 🟨, 75%+ 🟩
function levelColor(v, goal) { const p = goal > 0 ? v / goal : 0; return p >= 0.75 ? '🟩' : p >= 0.5 ? '🟨' : p >= 0.25 ? '🟧' : '🟥'; }
function pbar(v, goal, color) {
  color = levelColor(v, goal);
  if (goal <= 10 && goal === Math.round(goal)) return ebar(Math.floor(v + 1e-9), color, goal);
  let fill = Math.floor(v / goal * 10 + 1e-9);
  if (v > 0 && fill === 0) fill = 1;
  if (v < goal && fill >= 10) fill = 9;
  return ebar(fill, color, 10);
}
function achId(g, i) { return ACH_GROUPS.indexOf(g) + '.' + i; }
function checkAch(st, id) {
  if (!st.people[id]) return;
  if (!st.achStart) startAch(st); // the first run also hands out "З першого дня"
  if (!st.achBaseFix) setBases(st);
  const mine = st.ach[id] = st.ach[id] || {}, day = dayKey(Date.now(), st.cfg), fresh = [];
  ACH_GROUPS.forEach(function (g) {
    const v = g.of(st, id);
    g.steps.forEach(function (s, i) { const k = achId(g, i); if (!mine[k] && v >= s[0]) { mine[k] = day; fresh.push(s); } });
  });
  if (fresh.length && st.group) {
    const p = st.people[id];
    const m = sayK(st, 'ach:' + id, fresh.map(function (s) { return '🏅 ' + esc(p.name) + ' ' + verb(p, 'отримав', 'отримала') + ' досягнення ' + s[1] + ' ' + b('«' + achName(st, id, s) + '»') + '!'; }).join('\n') +
      '\n💎 Нагорода +' + (st.cfg.achGem || 1) + ' за кожне — забирай у 📱 застосунку (вкладка «Я»)');
    react(st.group, m && m.result && m.result.message_id, '🎉');
  }
}
// A tag under the name in the group (Bot API 9.5; the bot needs the admin right to manage tags):
// the streak, or the latest badge. Up to 16 characters, no emoji.
function updateTags(st) {
  st.tags = st.tags || {};
  Object.keys(st.people).forEach(function (id) {
    const n = streakOf(st, id, Date.now()), mine = st.ach[id] || {};
    let tag = '';
    if (n > 0) tag = 'Стрік ' + n + ' ' + plural(n, ['день', 'дні', 'днів']);
    else {
      let last = null;
      ACH_GROUPS.forEach(function (g) { g.steps.forEach(function (st2, i) { const k = achId(g, i); if (mine[k] && (!last || mine[k] >= last.d)) last = { d: mine[k], s: st2 }; }); });
      if (last) tag = achName(st, id, last.s);
    }
    tag = tag.slice(0, 16);
    if (st.tags[id] === tag) return;
    const r = tg('setChatMemberTag', { chat_id: st.group, user_id: Number(id), tag: tag });
    if (r && r.ok) st.tags[id] = tag;
  });
}
function react(chat, mid, emoji) { if (mid) tg('setMessageReaction', { chat_id: chat, message_id: mid, reaction: [{ type: 'emoji', emoji: emoji }] }); }
function checkAchAll(st) { Object.keys(st.people).forEach(function (id) { checkAch(st, id); }); }
function achText(st, id) {
  const mine = st.ach[id] || {}, p = st.people[id];
  const total = ACH_GROUPS.reduce(function (a, g) { return a + g.steps.length; }, 0) + 1, got = Object.keys(mine).length; // +1: "З першого дня"
  return '🏅 ' + b('Досягнення: ' + nameOf(st, id)) + ' · ' + got + ' з ' + total +
    (mine.first ? '\n🌅 ' + b('З першого дня') + ' · ' + shortDate(mine.first) + ' — особливий значок, більше його не отримає ніхто' : '') + '\n' + ACH_GROUPS.map(function (g) {
    const v = g.of(st, id), shown = Math.round(v * 100) / 100;
    const next = g.steps.filter(function (s, i) { return !mine[achId(g, i)]; })[0]; // only the next locked one: the rest is a surprise
    const lines = g.steps.filter(function (s, i) { return mine[achId(g, i)]; }).map(function (s) { return s[1] + ' ' + b(achName(st, id, s)) + ' · ' + shortDate(mine[achId(g, g.steps.indexOf(s))]); });
    if (next) {
      lines.push('🔒 ' + esc(achName(st, id, next)) + ' — ' + next[0] + ' ' + plural(next[0], g.unit) + '\n' + pbar(v, next[0], g.color) + ' ' + shown + ' / ' + next[0]);
    }
    return '\n' + b(g.title) + '\n' + lines.join('\n');
  }).join('\n');
}

// ---------------------------------------------------------------- ❓ Питання (questions for kids)
// Sections of questions; an answer is a function of (st, id) so the numbers come from the current settings.
// Numbers that never change are written in the text.
const FAQ = [
  { title: '💰 Гроші', items: [
    { q: '💰 Як хробаки в грі приносять справжні гроші?', a: function (st) {
      return 'Чудове запитання! 🤩 Гроші не з\'являються з повітря, хтось має їх заплатити.\n\nНаша ферма вирощує квіти, овочі й хробаків 🌼🌽🪱. Ми продаємо це іншим гравцям за золото 🪙. А потім ' + esc(ownerName(st)) + ' пропонує гравцям купити в нас це золото за справжні гроші 💵.\n\nЗолото допомагає їм ставати сильнішими в грі. Не в усіх є час його заробляти, тому багато хто радо купує готове.';
    } },
    { q: '🪙 Скільки я отримую за один збір?', a: function (st) {
      const c = st.cfg;
      return 'Бот рахує, на скільки золота ти зібрала врожаю 🪙, і перераховує, скільки це в гривнях 🧮.\n\nЗараз за один збір: грядки — ' + grn(KINDS.beds.reward(c)) + ', ' + plotType(c).label.toLowerCase() + ' — ' + grn(KINDS.plots.reward(c)) +
        '. Сума завжди видна в нагадуванні: «Нагорода за збір».\n\nЩо більше в нас землі, то більша нагорода! 🏡⬆️';
    } },
    { q: '🎪 Що таке сезон?', a: function (st) {
      return 'Сезон — це особлива подія на 3–4 дні, як у великих іграх! 🎮 Потім день відпочинку і новий сезон.\n\n' +
        Object.keys(SEASONS).map(function (t) { return SEASONS[t].icon + ' ' + b(SEASONS[t].name) + ' — ' + seasonWhat(st, t); }).join('\n') +
        '\n\nКартка сезону закріплена вгорі чату 📌 Хто виконає умову — отримає сезонний значок у 🏅 Досягненнях!' +
        (st.season ? '\n\nЗараз: ' + SEASONS[st.season.type].icon + ' ' + SEASONS[st.season.type].name + ', день ' + seasonDayN(st) + ' з ' + st.season.days : '');
    } },
    { q: '🤝 Що таке спільна ціль?', a: function (st) {
      return 'Це мрія, на яку збираємо разом: піца 🍕, LEGO 🧱, подарунок мамі 💐 або вечір настолок 🎲\n\n' +
        'Створити ціль може кожен: «🤝 Спільні цілі» → «➕ Нова ціль». Обираєш назву, скільки коштує, яку частину з кожного збору відкладати, для кого вона і кого покликати. Покликані мають погодитись.\n\n' +
        'Якщо ціль коштує гроші, то з кожного збору учасників відкладається обраний відсоток: 10% — це 10 копійок з гривні. Коли смужка заповниться — гроші вже є, ми їх справді заробили! 🎉\n\n' +
        'Передумали? Ціль можна скасувати, і все відкладене повернеться кожному на баланс.' + goalLine(st);
    } },
    { q: '💸 Як забрати свої гроші?', a: function (st) {
      return 'Натисни «💸 Отримати мої гроші», і ' + esc(ownerName(st)) + ' одразу отримає повідомлення та перекаже тобі 📲\n\nПоки не забереш, гроші лежать на балансі й нікуди не зникають 🔒';
    } },
    { q: '🐷 Що таке скарбничка ферми?', a: function (st) {
      const k = st.cfg.bankPct;
      return 'Коли ми збираємо врожай, ферма з кожної гривні відкладає трохи, ' + k + ' ' + plural(k, ['копійку', 'копійки', 'копійок']) + ', у скарбничку 🐷. ' + esc(ownerName(st)) + ' теж відкладає зі своїх!\n\nЗ неї купуються призи за перегони: морозиво 🍦, відпустки 🏖.\nТобто приз — це наші спільні гроші, які отримує найстаранніший 🏆';
    } },
  ] },
  { title: '🌾 Робота на фермі', items: [
    { q: '⏰ Чому бот мені нагадує?', a: function () {
      return 'Рослини й хробаки ростуть певний час ⏳. Бот рахує хвилини і кличе, коли все готово 🔔\n\nХто перший натисне «✅ Зібрано!», той і отримає нагороду 🏃‍♀️💨';
    } },
    { q: '🎯 Що таке норма?', a: function (st, id) {
      const p = st.people[id], n = p ? p.norm : st.cfg.norm;
      return 'Це скільки гривень треба заробити за день. У тебе зараз — ' + b(n + ' грн') + (p ? ': це ' + p.share + '% від звичайного дня нашої ферми (' + farmMax(st.cfg) + ' грн). Більше землі — більша норма і більший заробіток 🏡' : '') + '.\n\nНеважливо, що росте: нарциси кожні 30 хвилин чи бандли раз на півтори години — рахуються гроші 💰\nВиконала норму — день вдався! 🎉 Бот ставить тобі 🔥, і стрік росте.\n\nЗаробила більше — +1 ' + GEM + ' за кожні ' + overStep(st.cfg) + ' грн понад норму (до ' + st.cfg.overMax + ' на день).';
    } },
    { q: '☀️ Що за щоденні справи вранці?', a: function (st) {
      return 'Маленькі справи на кожному персонажі:\n' + DAILY.join('\n') +
        '\n\nЗробила все на одному персонажі — +' + st.cfg.taskGems.daily + ' ' + GEM + '. На трьох персонажах — утричі більше! Натисни кнопку за кожного, ' + esc(ownerName(st)) + ' підтвердить 👍';
    } },
    { q: '📣 Чому бот пише смішні повідомлення?', a: function (st) {
      return 'Якщо врожай готовий, а його ніхто не збирає ' + st.cfg.nagAfter + ' ' + plural(st.cfg.nagAfter, ['хвилину', 'хвилини', 'хвилин']) + ', бот починає кликати 📢😄\n\nНатисни «🙋 Я ТУТ! ЗАРАЗ ЗРОБЛЮ!», і він заспокоїться.';
    } },
    { q: '🧺 Чому іноді «Зібрати все»?', a: function () {
      return 'Коли грядки і компостери готові майже одночасно, бот чекає і кличе один раз 🧺\n\nТакий збір рахується як 2 у норму! ✌️';
    } },
    { q: '😴 Що робить «Пауза до завтра»?', a: function () {
      return 'Бот не кличе до ранку 🌙\n\nАле стрік від паузи не рятує: якщо норму не зроблено, допоможе лише ❄️ заморозка.';
    } },
  ] },
  { title: '📈 Статистика і досягнення', items: [
    { q: '🏅 Що таке досягнення?', a: function () {
      return 'Це значки за твої успіхи 🏅: перший урожай, стрік, перша сотня гривень, своя земля, перемога в перегонах…\n\nКоли отримуєш нове, бот хвалить тебе в чаті 🎉 Усі значки й скільки лишилось до наступного — у «🏅 Досягнення».\n\nЦе просто гордість, вони нічого не коштують і назавжди твої 😊';
    } },
    { q: '📈 Що показує статистика?', a: function () {
      return 'Таблицю, скільки кожен заробив у кожен день 📊\n\n🔥 — норму виконано\n💔 — пропущено\n❄️ — день врятувала заморозка\n🏆 — найкращий день';
    } },
  ] },
  { title: '🔥 Стрік і кристали', items: [
    { q: '🔥 Що таке стрік?', a: function () {
      return 'Це скільки днів поспіль ти виконуєш норму 🔥🔥🔥\n\nЩо довший стрік, то більше кристалів і то більше відкривається в магазині 🛒✨';
    } },
    { q: '💎 Як заробити кристали?', a: function (st) {
      const t = st.cfg.taskGems;
      return 'Є три способи:\n\n🔥 Норма щодня: 5 кристалів за перший день, потім 6, 7, 8, а з п\'ятого дня поспіль по 10!\n🚜 Заробіток понад норму: +1 за кожні ' + overStep(st.cfg) + ' грн (до ' + st.cfg.overMax + ' на день)\n📜 Завдання: ' +
        TASKS.map(function (x) { return x.label.charAt(0).toLowerCase() + x.label.slice(1) + ' (+' + t[x.id] + ')'; }).join(', ') +
        '.\nЗавдання можна робити скільки завгодно разів, хоч на кожному персонажі! Натисни кнопку, ' + esc(ownerName(st)) + ' підтвердить 👍';
    } },
    { q: '💎 Кристали — це гроші?', a: function () {
      return 'Ні! 🙅‍♀️ Гривні — це гроші, їх можна забрати.\n\nА кристали — це ферма-валюта для послуг: наприклад, щоб хтось помив за тебе посуд 🍽😄';
    } },
    { q: '💔 Що буде, якщо я пропущу день?', a: function () {
      return 'Стрік почнеться з нуля 😢\n\nАле не засмучуйся: завтра можна почати новий! 💪 А щоб не втрачати стрік, купи ❄️ заморозку.';
    } },
    { q: '❄️ Що таке заморозка?', a: function () {
      return 'Це рятувальний круг для стріку 🛟\n\nЯкщо день без норми, заморозка спрацює сама: стрік не зламається. Тільки кристалів за цей день не буде.';
    } },
    { q: '🛒 Чому в магазині деякі товари закриті?', a: function () {
      return 'Кожен новий день стріку відкриває щось круте 🔓\n\nЦифра зліва показує, з якого дня товар відкриється. Що там сховано, дізнаєшся, коли доростеш 😉';
    } },
    { q: '🎟 Як використати купон?', a: function (st) {
      return 'Відкрий 🎒 Інвентар і натисни «🎟 Використати».\n\nБот напише всім, і ' + esc(ownerName(st)) + ' вже не відкрутиться! 😄';
    } },
  ] },
  { title: '🏡 Наша земля', items: [
    { q: '🏡 Чия це земля?', a: function (st) {
      return 'Ту землю, яка вже є, ' + ownerVerb(st, 'купив', 'купила') + ' ' + esc(ownerName(st)) + ', і ферма почалась з неї 🏡\n\nКоли ти на ній збираєш, отримуєш зарплату за роботу 💪 А трохи (' + st.cfg.bankPct + ' копійок з гривні) іде в 🐷 скарбничку на призи.';
    } },
    { q: '🌱 Як стати власницею ділянки?', a: function () {
      return 'Коли ферма купує нову ділянку, бот пише «🏗 Ферма купує нову ділянку!» 📢\n\nТам можна вкласти свої гривні з балансу 💼 Наприклад, вклала 100 грн — частинка ділянки твоя! 🌱\n\nКупуємо, коли всі разом зберуть 100% ціни 🎯 Бот показує смужку: хто скільки вклав і скільки ще треба.';
    } },
    { q: '💸 Що таке пасивний дохід?', a: function (st) {
      const w = st.cfg.invWage;
      return 'Це гроші, які приходять, навіть коли ти відпочиваєш! ✨\n\nНаприклад: ' + esc(ownerName(st)) + ' ' + ownerVerb(st, 'зібрав', 'зібрала') + ' урожай з твоєї ділянки — і ти отримаєш ' + (w === 50 ? 'половину грошей' : (100 - w) + '% грошей') + '! 🤑\nА якщо збираєш сама, отримуєш усе: і зарплату за роботу, і частину як власниця 💪🌱\n\nЩовечора дохід з землі складається в 🏦 твого портфеля (🏡 Ферма → 💼 Інвестиції → 👤 Мій портфель) — дивись, як він росте! 🏦 Коли захочеш, натисни «💰 Забрати», і гроші підуть на баланс.';
    } },
    { q: '↩️ Чи можна забрати вкладені гроші назад?', a: function (st) {
      return 'Можна, але не одразу: через ' + SELL_AFTER + ' днів ' + esc(ownerName(st)) + ' викупить твою частку за ту саму ціну 🤝\n\nА все, що ділянка вже принесла, лишиться твоїм. Кнопка — на сторінці ділянки: 🏡 Ферма → 💼 Інвестиції.';
    } },
    { q: '😕 Чому сьогодні дохід менший?', a: function () {
      return 'Дохід залежить від того, скільки разів ми зібрали врожай і почім його купують у грі 📉📈\n\nЯкщо ніхто не збирав — ділянка нічого не принесла. А податок за землю (сертифікати) платити треба завжди 🧾\n\nТак і в справжньому бізнесі: бувають кращі й гірші дні.';
    } },
  ] },
  { title: '🏁 Перегони', items: [
    { q: '🏁 Що таке перегони?', a: function () {
      return 'Іноді бот несподівано оголошує змагання на кілька днів 🏁\n\nХто більше разів збере врожай, той переможе! 🥇';
    } },
    { q: '🎁 Що можна виграти?', a: function () {
      return 'Приз таємний до самого кінця 🤫\n\nЦе може бути морозиво 🍦, оплачувана відпустка 🏖 або гроші 💰 зі скарбнички.';
    } },
    { q: '🏖 Що таке оплачувана відпустка?', a: function () {
      return 'Один день, коли можна не працювати, а гроші все одно отримати, ніби виконала норму 😎\n\nНатисни в інвентарі «Хочу у відпустку», і бот тебе сьогодні не кличе.';
    } },
    { q: '🎒 Що лежить в інвентарі?', a: function () {
      return 'Усе твоє: кристали 💎, стрік 🔥, призи з перегонів 🎁, заморозки ❄️ і купони 🎟';
    } },
  ] },
  { title: '🐾 Улюбленець', items: [
    { q: '🐾 Як завести улюбленця?', a: function (st) {
      return 'У кущах біля ферми ховається хтось маленький 👀 Він довіряє лише дару!\n\n«👤 Я» → «🐾 Улюбленець»: дай відповідь на 3 питання про догляд за тваринками, потім перетворись у грі на дару — ' + esc(ownerName(st)) + ' підтвердить. І тоді побачиш, хто це, і дасиш ім\'я 🐕🐈';
    } },
    { q: '🍖 Навіщо годувати?', a: function (st) {
      const P = st.cfg.pet;
      return 'Тваринка голодніє: кожні ' + P.tickH + ' год ситість −' + P.decay + '%. Після кожного збору в дару вона набігається: −' + P.run + '%. Корм коштує ' + P.food + ' ' + GEM + ' (у 🛒 Магазині, у кристальний сезон — набір ' + P.packN + ' за ' + P.pack + ' ' + GEM + ') і дає +' + P.feed + '% ситості та +5 ⭐.\n\nГолодна тваринка не допомагає збирати (треба щонайменше ' + P.min + '%) і повільніше росте. Вона ніколи не втече — просто сумує 🥺';
    } },
    { q: '⭐ Як росте рівень?', a: function () {
      return 'Тваринка росте лише тоді, коли ти поруч у формі дару 🐾\n\nДосвід ⭐ дають:\n• збір хробаків/бандлів у дару, коли тваринка сита: +10\n• 🎓 навчання — перший такий збір за день: ще +10\n• корм: +5\n• прийнята знахідка: +5\n\nГрядки і збори без дару досвіду не дають. Перші рівні швидко, далі довше. 10-й рівень — приблизно за 2 тижні 🎓';
    } },
    { q: '🐾 Що таке Помічник?', a: function (st) {
      return 'З 3 рівня тваринка допомагає збирати! Коли збираєш хробаків чи бандли в дару, вона бігає поруч і знаходить те, що ти не помітила: це ' + b('справжні гроші') + ' на баланс.\n\n' +
        'Скільки: від 1% на 3 рівні до 7% на 9-му, і ще +1% за кожен вид одягу (голова, тіло, ніжки). Найбільше — ' + st.cfg.pet.cap + '%.\n\n' +
        'На грядках тваринці нецікаво 🌱 — вона любить бігати лише там, де хробаки. На персонажі без костюма дару вона вчиться й росте, але знахідок не приносить (там немає костюма дару).';
    } },
  ] },
];
// 🧠 Quiz (Telegram quiz poll in the group): a random question about how the farm works.
const QUIZ = [
  ['Звідки беруться справжні гроші за нашу ферму?', ['Їх друкує бот', 'Гравці купують у нас золото', 'Їх дарує гра'], 1, 'Ми продаємо врожай за золото, а {O} продає золото гравцям за гривні 💵'],
  ['Що таке стрік?', ['Скільки днів поспіль виконана норма', 'Скільки грошей на балансі', 'Назва ділянки'], 0, 'Стрік росте щодня, коли норма виконана 🔥'],
  ['Що врятує стрік, якщо день без норми?', ['Морозиво', 'Заморозка ❄️', 'Пауза до завтра'], 1, 'Заморозка спрацьовує сама. Пауза стрік не рятує!'],
  ['Кристали — це гроші?', ['Так, їх можна вивести', 'Ні, вони для послуг у магазині', 'Так, 1 кристал = 1 грн'], 1, 'Гроші — це гривні. Кристали купують послуги, наприклад помити посуд 🍽'],
  ['{O} {зібрав} урожай з твоєї ділянки. Що отримаєш ти?', ['Нічого', 'Свою частку грошей', 'Тільки кристали'], 1, 'Це пасивний дохід: земля працює на тебе, навіть коли ти відпочиваєш ✨'],
  ['Звідки беруться призи за перегони?', ['Зі скарбнички ферми 🐷', 'З нізвідки', 'Їх купує бот'], 0, 'З кожного збору трохи відкладається у скарбничку. {O} теж відкладає!'],
  ['Скільки кристалів за 5-й день стріку поспіль?', ['5', '8', '10'], 2, '1-й день 5, потім 6, 7, 8, а з 5-го дня по 10 💎'],
  ['Чи можна забрати вкладені в ділянку гроші?', ['Ніколи', 'Так, через 14 днів за ту саму ціну', 'Тільки половину'], 1, 'Через 14 днів {O} викупить частку за ту саму ціну, а зароблене лишиться твоїм 🤝'],
  ['Чому сьогодні ділянка могла принести менше?', ['Мало зборів або дешевший врожай', 'Бот зламався', 'Так буває тільки в іграх'], 0, 'Дохід залежить від роботи і цін. Так і в справжньому бізнесі 📉📈'],
  ['Що дає заробіток понад норму?', ['Нічого', 'Кристал за кожні 10 грн понад норму', 'Мінус гроші'], 1, 'Норма 50 грн, заробила 72 — це 22 грн понад норму: +2 💎 🚜'],
];
function sendQuiz(st) {
  const x = QUIZ[Math.floor(Math.random() * QUIZ.length)];
  const fill = function (t) { return t.replace(/\{O\}/g, ownerName(st)).replace(/\{зібрав\}/g, ownerVerb(st, 'зібрав', 'зібрала')); };
  dropK(st, 'quiz');
  keepK(st, 'quiz', tg('sendPoll', { chat_id: st.group, question: fill('🧠 ' + x[0]), options: x[1].map(function (t) { return { text: fill(t) }; }), type: 'quiz',
    correct_option_id: x[2], explanation: fill(x[3]), is_anonymous: false }));
}
function faqText() { return '❓ ' + b('Питання') + '\nОбери тему 👇'; }
function faqKeyboard() {
  return { inline_keyboard: FAQ.map(function (sec, i) { return [button(sec.title, 'faq:s:' + i)]; }).concat([[button('🧠 Перевір себе: вікторина', 'quiz')]]) };
}
function faqSectionKeyboard(i) {
  return { inline_keyboard: FAQ[i].items.map(function (it, j) { return [button(it.q, 'faq:q:' + i + ':' + j)]; })
    .concat([[button('⬅️ Усі теми', 'faq:home')]]) };
}
function onFaq(st, user, parts, q, edit) {
  toast(q, '');
  if (parts[1] === 's' && FAQ[+parts[2]]) { edit('❓ ' + b(FAQ[+parts[2]].title), faqSectionKeyboard(+parts[2])); return; }
  const sec = FAQ[+parts[2]], it = sec && sec.items[+parts[3]];
  if (parts[1] === 'q' && it) {
    edit(b(it.q) + '\n\n' + it.a(st, String(user.id)), { inline_keyboard: [[button('⬅️ Інші питання', 'faq:s:' + parts[2]), button('🏠 Усі теми', 'faq:home')]] });
    return;
  }
  edit(faqText(), faqKeyboard());
}

// ================================================================ 🐾 PETS
// Each person can befriend a pet. The game link: the pet "helps" only when the person really harvests in Daru form on
// a character whose Daru costume gives Farming Gain (cfg.chars[].pct). A shy animal becomes yours after a quest:
// three questions about animal care, then turning into Daru in the game (the owner confirms in private).
// Satiety drops by cfg.pet.decay % every 3 hours; food costs crystals (a crystal sink: ~4 meals a day keep it ≥ min).
// Levels come from harvests with a fed pet, the daily norm, training (a harvest in Daru, once a day), meals, finds.
// From level 3 the 🐾 Helper skill works: after a composter/bundle harvest in Daru the pet "finds" pct % of that
// harvest's pay; pct = min(level % + clothes %, the character's costume %, cap). Seedbeds: no bonus (as in the game:
// the costume does not work on fields). Clothes: head / body / legs, +1 % each, unlocked at levels 4 / 5 / 7.
const PET_KINDS = { dog: { icon: '🐕', baby: 'цуценя', who: 'Цуценя' }, cat: { icon: '🐈', baby: 'кошеня', who: 'Кошеня' } };
const PET_XP = [0, 30, 70, 130, 210, 320, 460, 620, 800, 1000]; // total XP for levels 1..10
const PET_SLOTS = [
  { id: 'head', title: '🎩 Голова', lvl: 4, items: [['bow', '🎀', 'Бантик'], ['hat', '🎩', 'Капелюшок'], ['cap', '🧢', 'Кепка'], ['crown', '👑', 'Корона']] },
  { id: 'body', title: '🦺 Тіло', lvl: 5, items: [['sweater', '🧥', 'Светрик'], ['cape', '🦸', 'Плащ супергероя'], ['vest', '🦺', 'Жилетка']] },
  { id: 'legs', title: '🧦 Ніжки', lvl: 7, items: [['socks', '🧦', 'Шкарпетки'], ['boots', '👢', 'Чобітки'], ['sneakers', '👟', 'Кросівки']] },
];
const PET_QUIZ = [
  ['Що можна давати тваринці їсти?', ['🍫 Шоколад', '🍖 Її спеціальний корм', '🍬 Цукерки'], 1,
    'Шоколад і солодощі для собачок і котиків отруйні! Тільки їхній корм або м\'ясо 🍖'],
  ['Що тваринці потрібно щодня?', ['🧸 Нова іграшка', '🛁 Ванна', '💧 Свіжа вода й корм'], 2,
    'Вода й їжа — кожного дня. Іграшки й ванна — не обов\'язково щодня 🙂'],
  ['Тваринка злякалась. Що робити?', ['🤫 Говорити тихо й почекати', '📢 Голосно кликати', '🏃 Швиденько її впіймати'], 0,
    'Налякана тваринка тікає від шуму й погоні. Будь спокійною — і вона сама підійде 🐾'],
];
function petTickMs(st) { return (st.cfg.pet.tickH || 3) * 3600 * 1000; }
function petOf(st, id) { return (st.pets || {})[id]; }
function petOk(pet) { return pet && pet.stage === 'ok'; }
function pv(pet, m, f) { return pet && pet.female ? f : m; }
function petLevel(pet) { let l = 0; PET_XP.forEach(function (x) { if (pet.xp >= x) l++; }); return l; }
function petLvlPct(l) { return l >= 3 ? Math.min(7, l - 2) : 0; }
function petSlotItem(slot, itemId) { return slot.items.filter(function (x) { return x[0] === itemId; })[0]; }
function petClothes(pet) { // slots with something bought and unlocked: +1 % each
  const l = petLevel(pet);
  return PET_SLOTS.filter(function (s) { return l >= s.lvl && ((pet.own || {})[s.id] || []).length; }).length;
}
function petPct(st, pet) { return Math.min(st.cfg.pet.cap, petLvlPct(petLevel(pet)) + petClothes(pet)); }
function charPct(st, ci) {
  if (st.cfg.pet.anyChar) return st.cfg.pet.cap; // for now: only Oleksa has a costume (14 %), pets give 1–10 %, so any harvest is covered
  const c = st.cfg.chars[ci]; return c ? Math.min(c.pct, st.cfg.pet.cap) : 0;
}
function petFace(pet) { // 🐕🎀🧥 Бусінка
  return PET_KINDS[pet.kind].icon + PET_SLOTS.map(function (s) { const it = petSlotItem(s, (pet.wear || {})[s.id]); return it ? it[1] : ''; }).join('');
}
function petName(pet) { return petFace(pet) + ' ' + b(pet.name); }
function petTick(st, pet, now) { // satiety drops every cfg.pet.tickH hours (lazy: counted when someone looks)
  if (!petOk(pet)) return;
  const T = petTickMs(st), n = Math.floor((now - pet.fedAt) / T);
  if (n > 0) { pet.fed = Math.max(0, pet.fed - n * st.cfg.pet.decay); pet.fedAt += n * T; }
}
function petChar(st, id) { // the character a person usually harvests on: the first button
  const p = st.people[id], cs = st.cfg.chars;
  if (p && p.char !== undefined && cs[p.char]) return p.char;
  const own = cs.findIndex(function (c) { return p && c.name.toLowerCase().slice(0, 3) === String(p.name).toLowerCase().replace('марія', 'maria').slice(0, 3); });
  return own >= 0 ? own : 0;
}
// XP; a level-up is announced in the group (one message per person, the new one replaces the old)
function petXp(st, id, n) {
  const pet = petOf(st, id);
  if (!petOk(pet) || !n) return '';
  const pb = ((st.boosts || {})[id] || {}).petxp; if (pb && pb.until > Date.now()) n = Math.round(n * 1.3); // 🐾 boost: +30%
  const before = petLevel(pet); pet.xp += n;
  const after = petLevel(pet);
  if (after > before && st.group) {
    const p = st.people[id], news = [];
    if (after >= 3 && before < 3) news.push('🐾 Відкрито навичку ' + b('Помічник') + ': тепер ' + pv(pet, 'він', 'вона') + ' допомагає збирати хробаків і бандли, коли ти в дару!');
    PET_SLOTS.forEach(function (s) { if (after >= s.lvl && before < s.lvl) news.push('👕 Відкрито одяг: ' + s.title + ' (+1% до Помічника)'); });
    if (after >= 3) news.push('🐾 Помічник тепер: +' + petPct(st, pet) + '%');
    sayK(st, 'petlvl:' + id, '🎉 ' + petName(pet) + ' (' + esc(p ? p.name : '') + ') ' + pv(pet, 'досяг', 'досягла') + ' ' + b(after + ' рівня') + '!' + (news.length ? '\n' + news.join('\n') : ''));
  }
  return ' +' + n + ' ⭐';
}
function petBar(v) { return ebar(Math.round(v / 10), levelColor(v, 100), 10); }
function petCard(st, id) {
  const pet = petOf(st, id), now = Date.now(), c = st.cfg;
  if (!pet || !petOk(pet)) return petQuestText(st, id);
  petTick(st, pet, now);
  const l = petLevel(pet), nextXp = PET_XP[l], pct = petPct(st, pet), day = dayKey(now, c);
  const xpLine = l >= PET_XP.length ? '⭐ Максимальний рівень! Досвід: ' + pet.xp
    : '⭐ Досвід: ' + pbar(pet.xp - PET_XP[l - 1], nextXp - PET_XP[l - 1]) + ' ' + pet.xp + '/' + nextXp + ' (до ' + (l + 1) + ' рівня)';
  const help = l < 3 ? '🐾 Помічник: відкриється на 3 рівні'
    : '🐾 Помічник: ' + b('+' + pct + '%') + ' (рівень ' + petLvlPct(l) + '% + одяг ' + petClothes(pet) + '%)' +
      (pet.fed < c.pet.min ? '\n    🥺 Голодн' + pv(pet, 'ий', 'а') + ', не допомагає — нагодуй до ' + c.pet.min + '%' : '') +
      (c.pet.anyChar ? '' : '\n    ' + c.chars.map(function (ch, i) { const e = Math.min(pct, charPct(st, i)); return ch.name + ': ' + (e > 0 ? '+' + e + '%' : 'лише досвід ⭐'); }).join(' · '));
  const clothes = PET_SLOTS.map(function (s) {
    const it = petSlotItem(s, (pet.wear || {})[s.id]);
    return s.title.split(' ')[0] + ' ' + (l < s.lvl ? '🔒 з ' + s.lvl + ' рівня' : it ? it[1] + ' ' + it[2] : '—');
  }).join(' · ');
  return petName(pet) + ' · ' + b(l + ' рівень') + '\n' + xpLine +
    '\n🍖 Ситість: ' + petBar(pet.fed) + ' ' + pet.fed + '%' + (pet.fed < c.pet.min ? ' 🥺' : '') +
    '\n' + help +
    '\n🎓 Навчання сьогодні: ' + (pet.trainDay === day ? '✅ є' : 'ще ні — збери хробаків/бандли в дару') +
    '\n👕 ' + clothes +
    '\n\n' + GEM + ' У тебе: ' + b(inv(st, id).gems) + ' · 🍖 ' + (inv(st, id).food ? 'корму: ' + b(inv(st, id).food) : 'корм ' + priceOf(st, { price: c.pet.food }) + ' ' + GEM) + ' (+' + c.pet.feed + '% ситості, +5 ⭐)';
}
function petKeyboard(st, id) {
  const pet = petOf(st, id);
  if (!petOk(pet)) return withBack(petQuestKeyboard(st, id), 'pet');
  return withBack({ inline_keyboard: [[button('🍖 Нагодувати · ' + (inv(st, id).food ? 'корм з інвентаря (' + inv(st, id).food + ')' : priceOf(st, { price: st.cfg.pet.food }) + ' ' + GEM), 'pet:feed')],
    [button('👕 Одяг', 'pet:wardrobe')]] }, 'pet');
}
// ---- the quest «Довіра»
function petQuestText(st, id) {
  const pet = petOf(st, id) || { stage: 'new' }, p = st.people[id];
  if (pet.stage === 'new') return '🌿 ' + b('Квест «Довіра»') + '\n\nБіля ферми в кущах хтось шарудить… Видно тільки два блискучі оченятка 👀\n' +
    'Хтось маленький і дуже наляканий. Він боїться людей і довіряє лише дару.\n\nПокажи, що вмієш доглядати за тваринками, а потім стань дару — щоб воно не втекло.';
  if (pet.stage === 'quiz') { const x = PET_QUIZ[pet.q]; return '🌿 ' + b('Догляд за тваринкою') + ' · питання ' + (pet.q + 1) + ' з ' + PET_QUIZ.length + '\n\n' + x[0]; }
  if (pet.stage === 'wait') return '🌿 Оченятка трохи наблизились… Хтось уже не тремтить, але все ще ховається в тіні.\n\n' +
    '🐾 Останній крок: ' + b('перетворись у грі на дару') + '. Перетвори' + verb(p, 'вся', 'лась') + '? Натисни кнопку, і ' + esc(ownerName(st)) + ' підтвердить.';
  if (pet.stage === 'asked') return '🌿 Чекаємо, поки ' + esc(ownerName(st)) + ' підтвердить, що ти ' + verb(p, 'став', 'стала') + ' дару… ⏳';
  if (pet.stage === 'pick') return '✨ Ти тепер дару. Із кущів обережно виходить… Ти нарешті можеш роздивитись! Це…';
  if (pet.stage === 'sex') return '✨ …маленьке ' + PET_KINDS[pet.kind].baby + '! ' + PET_KINDS[pet.kind].icon + ' Воно обнюхало твою лапку й довірливо лизнуло її.\n\nЦе хлопчик чи дівчинка?';
  if (pet.stage === 'name') return PET_KINDS[pet.kind].icon + ' Як назвеш ' + pv(pet, 'його', 'її') + '?\nНапиши в чат: ' + b('/n Ім\'я') + ' (наприклад /n Бусінка)';
  return '';
}
function petQuestKeyboard(st, id) {
  const pet = petOf(st, id) || { stage: 'new' };
  if (pet.stage === 'new') return { inline_keyboard: [[button('👀 Підійти ближче', 'pet:start')]] };
  if (pet.stage === 'quiz') return { inline_keyboard: PET_QUIZ[pet.q][1].map(function (t, i) { return [button(t, 'pet:ans:' + i)]; }) };
  if (pet.stage === 'wait') return { inline_keyboard: [[button('🐾 Я ' + verb(st.people[id], 'став', 'стала') + ' дару!', 'pet:daru')]] };
  if (pet.stage === 'pick') return { inline_keyboard: [Object.keys(PET_KINDS).map(function (k) { return button(PET_KINDS[k].icon + ' ' + PET_KINDS[k].who, 'pet:kind:' + k); })] };
  if (pet.stage === 'sex') return { inline_keyboard: [[button('♂ Хлопчик', 'pet:sex:m'), button('♀ Дівчинка', 'pet:sex:f')]] };
  return { inline_keyboard: [] };
}
function petApprove(st, uid, yes) {
  const pet = petOf(st, uid);
  if (!pet || pet.stage !== 'asked') return false;
  pet.stage = yes ? 'pick' : 'wait';
  if (yes) sayTo(st, uid, petQuestText(st, uid), petQuestKeyboard(st, uid));
  else sayTo(st, uid, '🌿 ' + esc(ownerName(st)) + ' ще не бачить тебе в дару. Перетворись у грі й натисни ще раз 🐾', petQuestKeyboard(st, uid));
  return true;
}
// ---- after a harvest: XP; for composters/bundles the pet asks whether it was in Daru form and on which character
function petAfterHarvest(st, uid, kinds, normDone, now) {
  const pet = petOf(st, uid);
  if (!petOk(pet)) return null;
  petTick(st, pet, now);
  const xp = 0; // the pet grows only with you in Daru form (petOnDaru) and from meals: seedbeds or a harvest without Daru give nothing
  if (kinds.indexOf('plots') < 0) return null;
  const daru = st.cfg.chars.map(function (c, i) { return c.daru ? i : -1; }).filter(function (i) { return i >= 0; });
  if (!daru.length) return null;
  let lost = '';
  if (pet.find) { // an old find nobody took: gone, the pet is a bit sad
    lost = '\n😿 Минула знахідка (' + money(pet.find.uah) + ' грн) пропала — ' + esc(pet.name) + ' трохи ' + pv(pet, 'образився', 'образилась') + '.';
    pet.fed = Math.max(0, pet.fed - 10); delete pet.find;
  }
  st.petAsk = st.petAsk || {};
  st.petAsk[uid] = { uah: KINDS.plots.reward(st.cfg), at: now };
  const first = petChar(st, uid), order = [first].concat(daru.filter(function (i) { return i !== first; })).filter(function (i) { return daru.indexOf(i) >= 0; });
  const p = st.people[uid];
  if (!pet.meals) return { text: petHungryText(st, uid), kb: petKeyboard(st, uid) }; // never fed: first things first
  return { text: (xp ? '⭐ ' + esc(pet.name) + ': +' + xp + ' досвіду\n' : '') + petFace(pet) + ' ' + esc(pet.name) + ' крутиться біля тебе. Ти ' + verb(p, 'збирав', 'збирала') + ' хробаків/бандли ' + b('в дару') + '?' + (st.cfg.pet.anyChar ? '' : ' На якому персонажі в грі?') + lost,
    kb: { inline_keyboard: (st.cfg.pet.anyChar ? [-1] : order).map(function (i) { return [button(i < 0 ? '🐾 Так, у дару' : '🐾 Так, у дару на ' + st.cfg.chars[i].name, 'pet:dar:' + i)]; }).concat([[button('🙅 Ні, не в дару', 'pet:nodar')]]) } };
}
function petOnDaru(st, user, ci, now) {
  const id = String(user.id), pet = petOf(st, id), c = st.cfg, ask = (st.petAsk || {})[id], p = st.people[id];
  if (!petOk(pet) || !ask || now - ask.at > 6 * 3600 * 1000) { if (st.petAsk) delete st.petAsk[id]; return { text: 'Це вже старе питання 🙂', kb: null }; }
  delete st.petAsk[id];
  petTick(st, pet, now);
  const day = dayKey(now, c), lines = [], ch = c.chars[ci];
  if (pet.trainDay !== day) { pet.trainDay = day; lines.push('🎓 Навчання: ' + esc(pet.name) + ' ' + pv(pet, 'дивився', 'дивилась') + ', як працює дару.' + petXp(st, id, 10)); }
  if (pet.fed >= c.pet.min) lines.push('⭐ ' + esc(pet.name) + ' ' + pv(pet, 'ситий і радо пішов', 'сита і радо пішла') + ' з тобою.' + petXp(st, id, 10)); // a fed pet comes along
  const l = petLevel(pet), pct = Math.min(petPct(st, pet), charPct(st, ci));
  if (l < 3) lines.push('📚 ' + esc(pet.name) + ' ще вчиться. З 3 рівня ' + pv(pet, 'він', 'вона') + ' допомагатиме збирати!');
  else if (pet.fed < c.pet.min && pct > 0) { // hungry: offer to feed now and still get the find
    const n = Math.ceil((c.pet.min - pet.fed) / c.pet.feed), x = inv(st, id), fromInv = Math.min(n, x.food), gems = (n - fromInv) * priceOf(st, { price: c.pet.food });
    pet.miss = { base: ask.uah, ci: ci, at: now };
    lines.push('🥺 ' + esc(pet.name) + ' голодн' + pv(pet, 'ий', 'а') + ' (' + pet.fed + '%) і не ' + pv(pet, 'може', 'може') + ' допомогти — треба ' + c.pet.min + '%.' +
      '\nНагодуй зараз — і знахідка ≈ ' + grn(Math.max(0.01, money(ask.uah * pct / 100))) + ' не пропаде!');
    return { text: lines.join('\n'), kb: { inline_keyboard: [
      [button('🍖 Нагодувати ×' + n + ' (' + [fromInv ? fromInv + ' з інвентаря' : '', gems ? gems + ' ' + GEM : ''].filter(Boolean).join(' + ') + ') і забрати', 'pet:rescue')],
      [button('Ні, без знахідки', 'pet:norescue')]] } };
  }
  else if (pet.fed < c.pet.min) lines.push('🥺 ' + esc(pet.name) + ' голодн' + pv(pet, 'ий', 'а') + ' і не ' + pv(pet, 'зміг', 'змогла') + ' допомогти. Нагодуй до ' + c.pet.min + '% 🍖');
  else if (pct <= 0) lines.push('🐾 ' + esc(pet.name) + ' ' + pv(pet, 'бігав', 'бігала') + ' поруч. На ' + esc(ch.name) + ' ще немає костюма дару, тож знахідок не буде — лише досвід.');
  else {
    const uah = Math.max(0.01, money(ask.uah * pct / 100));
    pet.find = { uah: uah, pct: pct, base: ask.uah, at: now };
    lines.push(petFace(pet) + ' ' + b(pet.name + ' ' + pv(pet, 'бігав', 'бігала') + ' за тобою й ' + pv(pet, 'зібрав', 'зібрала') + ' дещо, що ти не ' + verb(p, 'помітив', 'помітила') + '!') +
      '\nЗнахідка: ' + grn(uah) + ' (' + pct + '% від збору ' + money(ask.uah) + ' грн)');
    lines.push(petRun(st, pet));
    return { text: lines.join('\n'), kb: { inline_keyboard: [[button('✅ Прийняти', 'pet:take')],
      [button('🍖 Прийняти й пригостити · ' + (inv(st, id).food ? 'корм з інвентаря (' + inv(st, id).food + ')' : priceOf(st, { price: c.pet.food }) + ' ' + GEM), 'pet:treat')]] } };
  }
  lines.push(petRun(st, pet));
  return { text: lines.join('\n'), kb: withBack({ inline_keyboard: [[button('🐾 До улюбленця', 'menu:pet')]] }, 'pet') };
}
// running around with you in Daru form makes the pet hungry
function petRun(st, pet) {
  const before = pet.fed; pet.fed = Math.max(0, pet.fed - st.cfg.pet.run);
  return before > pet.fed ? '🍖 ' + esc(pet.name) + ' ' + pv(pet, 'набігався', 'набігалась') + ': ситість −' + (before - pet.fed) + '% → ' + pet.fed + '%' + (pet.fed < st.cfg.pet.min ? ' 🥺 нагодуй!' : '') : '';
}
function petFeed(st, id, now) { // returns '' or why not
  const pet = petOf(st, id), x = inv(st, id), price = priceOf(st, { price: st.cfg.pet.food });
  petTick(st, pet, now);
  if (pet.fed >= 100) return esc(pet.name) + ' не ' + pv(pet, 'голодний', 'голодна') + ' 😊';
  if (x.food > 0) x.food -= 1; // 🍖 from the inventory first (bought in 🛒)
  else if (x.gems < price) return 'Немає корму і не вистачає ' + (price - x.gems) + ' ' + GEM + '. Корм — у 🛒 Магазині';
  else x.gems -= price;
  pet.fed = Math.min(100, pet.fed + st.cfg.pet.feed); pet.meals = (pet.meals || 0) + 1;
  petXp(st, id, 5);
  return '';
}
function petTake(st, user, treat, now) {
  const id = String(user.id), pet = petOf(st, id);
  if (!petOk(pet) || !pet.find) return { err: 'Знахідку вже забрано' };
  if (treat) { const why = petFeed(st, id, now); if (why && !/не голодн/.test(why)) return { err: why }; if (why) treat = false; } // full: no treat needed
  const f = pet.find; delete pet.find;
  credit(st, user, 'pet', f.uah, now);
  pet.finds = (pet.finds || 0) + 1; pet.found = money((pet.found || 0) + f.uah);
  petXp(st, id, 5);
  const p = st.people[id];
  sayK(st, 'petfind', '🐾 ' + petName(pet) + ' (' + esc(p.name) + ') ' + pv(pet, 'знайшов', 'знайшла') + ' ' + grn(f.uah) + (treat ? ' і ' + pv(pet, 'отримав', 'отримала') + ' смаколик 🍖' : '') + '!');
  checkAch(st, id);
  return { text: '✅ +' + grn(f.uah) + ' на баланс' + (treat ? '\n🍖 ' + esc(pet.name) + ' ' + pv(pet, 'задоволений', 'задоволена') + '! Ситість ' + pet.fed + '%' : '') + '\n⭐ +5 досвіду' };
}
function petWardrobe(st, id) {
  const pet = petOf(st, id), l = petLevel(pet), price = priceOf(st, { price: st.cfg.pet.cloth });
  const text = '👕 ' + b('Гардероб') + ': ' + petName(pet) + '\nКожен вид одягу (голова, тіло, ніжки) додає +1% до Помічника. Інші речі того ж виду — для краси й колекції 👗\n' +
    GEM + ' У тебе: ' + b(inv(st, id).gems) + ' · річ ' + price + ' ' + GEM + '\n\n' +
    PET_SLOTS.filter(function (s) { return l >= s.lvl; }).map(function (s) { return s.title + ': ' + s.items.map(function (it) { return it[1] + ' ' + it[2]; }).join(' · '); }).join('\n');
  const rows = [];
  PET_SLOTS.forEach(function (s) {
    if (l < s.lvl) { rows.push([lockedButton('🔒 ' + s.title + ' — з ' + s.lvl + ' рівня')]); return; }
    const own = (pet.own || {})[s.id] || [];
    rows.push(s.items.map(function (it) {
      const has = own.indexOf(it[0]) >= 0, on = (pet.wear || {})[s.id] === it[0];
      return button((on ? '✅ ' : '') + it[1] + (has ? '' : ' ' + price + GEM), 'pet:cl:' + s.id + ':' + it[0]);
    }));
  });
  rows.push([button('⬅️ ' + esc(pet.name), 'menu:pet')]);
  return { text: text, kb: { inline_keyboard: rows } };
}
function petCloth(st, id, slotId, itemId) {
  const pet = petOf(st, id), s = PET_SLOTS.filter(function (x) { return x.id === slotId; })[0], it = s && petSlotItem(s, itemId);
  if (!it) return 'Такої речі немає';
  if (petLevel(pet) < s.lvl) return '🔒 З ' + s.lvl + ' рівня';
  pet.own = pet.own || {}; pet.wear = pet.wear || {};
  const own = pet.own[s.id] = pet.own[s.id] || [];
  if (own.indexOf(itemId) < 0) {
    const x = inv(st, id), price = priceOf(st, { price: st.cfg.pet.cloth });
    if (x.gems < price) return 'Не вистачає ' + (price - x.gems) + ' ' + GEM;
    x.gems -= price; own.push(itemId);
    sayK(st, 'petcloth:' + id, '👕 Обновка! ' + petFace(pet) + ' ' + b(pet.name) + ' (' + esc(nameOf(st, id)) + ') тепер має ' + it[1] + ' ' + b(it[2]) + '!');
  }
  pet.wear[s.id] = itemId; // a bought or tapped item goes on
  checkAch(st, id);
  return '';
}
// ---- buttons: pet:<what>[:...]
function onPetButton(st, user, parts, q, edit, eph) {
  const id = String(user.id), now = Date.now(), what = parts[1], p = person(st, user);
  st.pets = st.pets || {};
  let pet = st.pets[id];
  const show = function (text, kb) { if (eph) edit(text, kb); else sayTo(st, id, text, kb, q); };
  const card = function () { show(petCard(st, id), petKeyboard(st, id)); };
  if (what === 'start') {
    if (pet && pet.stage !== 'new') { toast(q, ''); card(); return; }
    pet = st.pets[id] = { stage: 'quiz', q: 0 }; toast(q, '👀'); show(petQuestText(st, id), petQuestKeyboard(st, id)); return;
  }
  if (what === 'ans' && pet && pet.stage === 'quiz') {
    const x = PET_QUIZ[pet.q];
    if (+parts[2] !== x[2]) { toast(q, '🤔 Не зовсім'); show('🤔 Не зовсім! ' + x[3] + '\n\n' + petQuestText(st, id), petQuestKeyboard(st, id)); return; }
    toast(q, '✅ Правильно!');
    pet.q += 1;
    if (pet.q >= PET_QUIZ.length) { pet.stage = 'wait'; delete pet.q; }
    show('✅ ' + x[3] + '\n\n' + petQuestText(st, id), petQuestKeyboard(st, id)); return;
  }
  if (what === 'daru' && pet && pet.stage === 'wait') {
    pet.stage = 'asked';
    if (String(id) === String(st.owner)) { toast(q, '🐾'); pet.stage = 'pick'; show(petQuestText(st, id), petQuestKeyboard(st, id)); return; }
    toast(q, '⏳ ' + ownerName(st) + ' підтвердить');
    say(st.owner, '🐾 ' + esc(p.name) + ' ' + verb(p, 'каже, що став', 'каже, що стала') + ' дару (квест «Довіра» для улюбленця). Так?',
      { inline_keyboard: [[button('✅ Так, в дару', 'petok:' + id), button('❌ Ще ні', 'petno:' + id)]] });
    show(petQuestText(st, id), null); return;
  }
  if (what === 'kind' && pet && pet.stage === 'pick' && PET_KINDS[parts[2]]) { pet.kind = parts[2]; pet.stage = 'sex'; toast(q, PET_KINDS[pet.kind].icon); show(petQuestText(st, id), petQuestKeyboard(st, id)); return; }
  if (what === 'sex' && pet && pet.stage === 'sex') { pet.female = parts[2] === 'f'; pet.stage = 'name'; toast(q, ''); show(petQuestText(st, id), null); return; }
  if (!petOk(pet)) { toast(q, ''); show(petQuestText(st, id), petQuestKeyboard(st, id)); return; }
  if (what === 'rescue' || what === 'norescue') {
    const m = pet.miss; delete pet.miss;
    if (!m || now - m.at > 2 * 3600 * 1000) { toast(q, 'Це вже старе питання 🙂'); card(); return; }
    if (what === 'norescue') { toast(q, ''); const r = petRun(st, pet); show('🐾 Добре, наступного разу 🙂' + (r ? '\n' + r : ''), withBack({ inline_keyboard: [[button('🐾 До улюбленця', 'menu:pet')]] }, 'pet')); return; }
    while (pet.fed < st.cfg.pet.min) { const why = petFeed(st, id, now); if (why) { toast(q, why.replace(/<[^>]+>/g, '')); pet.miss = m; return; } }
    const pct = Math.min(petPct(st, pet), charPct(st, m.ci)), uah = Math.max(0.01, money(m.base * pct / 100));
    pet.find = { uah: uah, pct: pct, base: m.base, at: now };
    toast(q, '🍖 Ням!');
    show(petFace(pet) + ' ' + b(pet.name + ' ' + pv(pet, 'наївся', 'наїлась') + ' (' + pet.fed + '%) і ' + pv(pet, 'приніс', 'принесла') + ' знахідку!') +
      '\nЗнахідка: ' + grn(uah) + ' (' + pct + '% від збору ' + money(m.base) + ' грн)\n' + petRun(st, pet),
      { inline_keyboard: [[button('✅ Прийняти', 'pet:take')]] });
    return;
  }
  if (what === 'feed') { const why = petFeed(st, id, now); toast(q, why ? why.replace(/<[^>]+>/g, '') : '🍖 Ням! +' + st.cfg.pet.feed + '% ситості, +5 ⭐'); checkAch(st, id); card(); return; }
  if (what === 'wardrobe') { toast(q, ''); const v = petWardrobe(st, id); show(v.text, v.kb); return; }
  if (what === 'cl') { const why = petCloth(st, id, parts[2], parts[3]); toast(q, why || '👕'); const v = petWardrobe(st, id); show(v.text, v.kb); return; }
  if (what === 'dar' || what === 'nodar') {
    if (what === 'nodar') { if (st.petAsk) delete st.petAsk[id]; toast(q, ''); show('🐾 Добре! Наступного разу перетворись у дару — ' + esc(pet.name) + ' навчиться і допомагатиме збирати.', null); return; }
    const r = petOnDaru(st, user, +parts[2], now); toast(q, ''); show(r.text, r.kb); checkAch(st, id); return;
  }
  if (what === 'take' || what === 'treat') { const r = petTake(st, user, what === 'treat', now); if (r.err) { toast(q, r.err.replace(/<[^>]+>/g, '')); return; } toast(q, '✅'); show(r.text, withBack({ inline_keyboard: [[button('🐾 До улюбленця', 'menu:pet')]] }, 'pet')); return; }
  toast(q, ''); card();
}
// /n <name> while the pet waits for a name. Returns true when handled.
function onPetName(st, msg, arg) {
  const id = String(msg.from.id), pet = petOf(st, id);
  if (!pet || pet.stage !== 'name') return false;
  const name = String(arg || '').trim().replace(/[<>]/g, '').slice(0, 20);
  if (!name) { sayTo(st, id, 'Напиши ім\'я так: /n Бусінка'); return true; }
  tg('deleteMessage', { chat_id: st.group, message_id: msg.message_id });
  Object.assign(pet, { name: name, stage: 'ok', xp: 0, fed: 10, fedAt: Date.now(), own: {}, wear: {}, meals: 0, finds: 0, found: 0, since: dayKey(Date.now(), st.cfg) });
  const p = st.people[id];
  sayK(st, 'petnew:' + id, '🎉 ' + esc(p ? p.name : '') + ' ' + verb(p, 'знайшов', 'знайшла') + ' друга: ' + PET_KINDS[pet.kind].icon + ' ' + b(name) + '!\n' +
    'Годувати, вчити в дару — і з 3 рівня ' + esc(name) + ' допомагатиме збирати 🐾');
  sayTo(st, id, petHungryText(st, id), petKeyboard(st, id)); // found in the bushes, hungry: the first meal is the first thing to do
  checkAch(st, id);
  return true;
}
// never fed yet: the bot itself says the pet trusts you, but is hungry
function petHungryText(st, id) {
  const pet = petOf(st, id), p = st.people[id];
  return petName(pet) + ' тобі ' + pv(pet, 'довірився', 'довірилась') + '! ' + pv(pet, 'Він', 'Вона') + ' ' + pv(pet, 'притулився', 'притулилась') + ' до тебе й тихенько ' + (pet.kind === 'cat' ? pv(pet, 'нявкнув', 'нявкнула') : pv(pet, 'заскавчав', 'заскавчала')) + '…\n\n' +
    '🥺 ' + pv(pet, 'Він', 'Вона') + ' дуже ' + pv(pet, 'голодний', 'голодна') + ': ситість ' + b(pet.fed + '%') + '. Мабуть, давно нічого не ' + pv(pet, 'їв', 'їла') + ' в тих кущах…\n' +
    'Нагодуй ' + pv(pet, 'його', 'її') + ' — корм ' + priceOf(st, { price: st.cfg.pet.food }) + ' ' + GEM + ' (+' + st.cfg.pet.feed + '% ситості). Від ' + st.cfg.pet.min + '% ' + esc(pet.name) + ' зможе допомагати тобі 🐾';
}
// a hint in the composter/bundle reminder: turn into Daru so the pets learn (or help)
function petRemLine(st) {
  if (!st.cfg.chars.some(function (c) { return c.daru; })) return '';
  const day = dayKey(Date.now(), st.cfg), ids = Object.keys(st.pets || {}).filter(function (id) { return petOk(st.pets[id]); });
  const who = function (list) { return list.map(function (id) { return petFace(st.pets[id]) + ' ' + esc(st.pets[id].name); }).join(', '); };
  const learn = ids.filter(function (id) { return st.pets[id].trainDay !== day; });
  // only the pet of whoever harvests learns or helps, so the line speaks to that person
  if (learn.length) return '\n🐾 Збираєш? Перетворись у дару — твій улюбленець повчиться (+10 ⭐). Ще не вчились сьогодні: ' + who(learn);
  const help = ids.filter(function (id) { return petLevel(st.pets[id]) >= 3; });
  if (help.length) return '\n🐾 Збираєш? Перетворись у дару — твій улюбленець допоможе знайти більше (' + who(help) + ')';
  return '';
}
// a short line for the morning: whose pet is hungry
function petMorningLine(st) {
  const now = Date.now(), hungry = Object.keys(st.pets || {}).filter(function (id) { const pet = st.pets[id]; petTick(st, pet, now); return petOk(pet) && pet.fed < st.cfg.pet.min; });
  return hungry.length ? '\n\n🥺 Голодні улюбленці: ' + hungry.map(function (id) { return petFace(st.pets[id]) + ' ' + esc(st.pets[id].name) + ' (' + st.pets[id].fed + '%)'; }).join(', ') + ' — 🍖 у «👤 Я» → «🐾 Улюбленець»' : '';
}
function petSettingsText(st) {
  const c = st.cfg, P = c.pet;
  return PAGES.pets + '\n' + (P.anyChar ? '🐾 Зараз персонажа не питаємо: будь-який збір у дару дає знахідку (до ' + P.cap + '%).\n' : '') + b('Персонажі') + ' (бонус костюма дару на Farming; Помічник не дає більше за нього):\n' +
    c.chars.map(function (ch) { return '  ' + esc(ch.name) + ': ' + b(ch.pct + '%') + ' · вміння дару ' + (ch.daru ? '✅' : '❌'); }).join('\n') +
    '\n' + b('Хто де зазвичай збирає') + ' (перша кнопка в питанні «на кому?»):\n' +
    Object.keys(st.people).map(function (id) { return '  ' + esc(st.people[id].name) + ' → ' + esc(c.chars[petChar(st, id)].name); }).join('\n') +
    '\n\n🐾 Стеля Помічника: ' + b(P.cap + '%') + ' · корм ' + b(P.food + ' ' + GEM) + ' · одяг ' + b(P.cloth + ' ' + GEM) + ' за річ' +
    '\n🍖 Корм +' + b(P.feed + '%') + ' · набір у 💎 сезон ' + P.packN + ' за ' + P.pack + ' ' + GEM + '\n🍖 Голод: −' + b(P.decay + '%') + ' кожні ' + P.tickH + ' год (≈' + Math.round(P.decay * 24 / P.tickH) + '% на день) · Помічник працює від ' + b(P.min + '%') + ' ситості · після збору в дару −' + b(P.run + '%') +
    '\nУлюбленці: ' + (Object.keys(st.pets || {}).map(function (id) { const pet = st.pets[id]; return esc(nameOf(st, id)) + ' — ' + (petOk(pet) ? PET_KINDS[pet.kind].icon + ' ' + esc(pet.name) + ' ' + petLevel(pet) + ' рів. (' + pet.xp + ' ⭐)' : 'квест'); }).join(', ') || 'ще немає');
}
function petSettingsKeyboard(st) {
  const c = st.cfg;
  return { inline_keyboard: c.chars.map(function (ch, i) {
    return [button('➖ ' + ch.name + ' ' + ch.pct + '%', 'set:charPct:' + i + ':-1'), button('➕', 'set:charPct:' + i + ':1'), button('дару ' + (ch.daru ? '✅' : '❌'), 'set:charDaru:' + i)];
  }).concat(Object.keys(st.people).map(function (id) { return [button('👤 ' + st.people[id].name + ' → ' + c.chars[petChar(st, id)].name, 'set:pchar:' + id)]; }), [
    [button('➖ стеля', 'set:petCap:-1'), button('➕ стеля', 'set:petCap:1')],
    [button('➖ корм', 'set:petFood:-1'), button('➕ корм', 'set:petFood:1')],
    [button('➖ одяг 5', 'set:petCloth:-5'), button('➕ одяг 5', 'set:petCloth:5')],
    [button('➖ голод', 'set:petDecay:-1'), button('➕ голод', 'set:petDecay:1')],
    [button('➖ годин між голодом', 'set:petTickH:-1'), button('➕ годин між голодом', 'set:petTickH:1')],
    [button('➖ ситість від корму 5%', 'set:petFeed:-5'), button('➕ ситість від корму 5%', 'set:petFeed:5')],
    [button('➖ поріг 5%', 'set:petMin:-5'), button('➕ поріг 5%', 'set:petMin:5')],
    [button('➖ біг у дару 5%', 'set:petRun:-5'), button('➕ біг у дару 5%', 'set:petRun:5')],
    [button('Питати персонажа (костюм): ' + (c.pet.anyChar ? '❌' : '✅'), 'set:petAny')]].concat(
    Object.keys(st.pets || {}).filter(function (id) { return petOk(st.pets[id]); }).map(function (id) { const pet = st.pets[id];
      return [button('⭐ ' + pet.name + ' −10', 'set:petXp:' + id + ':-10'), button('−50', 'set:petXp:' + id + ':-50'), button('−1 рівень', 'set:petLvl:' + id), button('+10', 'set:petXp:' + id + ':10')]; }), [
    [button('◂ Назад', 'set:page:main')]])) };
}
function applyPetSetting(st, parts) {
  const c = st.cfg, P = c.pet, what = parts[1], clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  if (what === 'charPct' && c.chars[parts[2]]) { c.chars[parts[2]].pct = clamp(c.chars[parts[2]].pct + +parts[3], 0, 50); return true; }
  if (what === 'charDaru' && c.chars[parts[2]]) { c.chars[parts[2]].daru = !c.chars[parts[2]].daru; return true; }
  if (what === 'pchar' && st.people[parts[2]]) { st.people[parts[2]].char = (petChar(st, parts[2]) + 1) % c.chars.length; return true; }
  if (what === 'petCap') { P.cap = clamp(P.cap + +parts[2], 1, 50); return true; }
  if (what === 'petFood') { P.food = clamp(P.food + +parts[2], 1, 50); return true; }
  if (what === 'petCloth') { P.cloth = clamp(P.cloth + +parts[2], 5, 200); return true; }
  if (what === 'petDecay') { P.decay = clamp(P.decay + +parts[2], 0, 50); return true; }
  if (what === 'petFeed') { P.feed = clamp(P.feed + +parts[2], 5, 100); return true; }
  if (what === 'petTickH') { P.tickH = clamp(P.tickH + +parts[2], 1, 24); return true; }
  if (what === 'petMin') { P.min = clamp(P.min + +parts[2], 0, 100); return true; }
  if (what === 'petXp' && petOk((st.pets || {})[parts[2]])) { const pet = st.pets[parts[2]]; pet.xp = Math.max(0, pet.xp + +parts[3]); return true; }
  if (what === 'petLvl' && petOk((st.pets || {})[parts[2]])) { const pet = st.pets[parts[2]], l = petLevel(pet); pet.xp = l > 1 ? PET_XP[l - 2] : 0; return true; } // to the start of the level below
  if (what === 'petAny') { P.anyChar = !P.anyChar; return true; }
  if (what === 'petRun') { P.run = clamp(P.run + +parts[2], 0, 100); return true; }
  return false;
}

// ---- the announcement: the owner sends the poster as a photo to the bot (private) or writes /news, then confirms
function petNewsText(st) {
  return '🐾 ' + b('Хто ж ховається в кущах?') + ' 👀\n\nБіля ферми з\'явився маленький звір. Він боїться людей… і довіряє лише дару.\n\n' +
    'Подружись — і він стане твоїм: росте, вбирається, а згодом допомагає заробляти 💰\n\nШукай: «👤 Я» → «🐾 Улюбленець»';
}
function newsPrompt(st) {
  return say(st.owner, '📣 Анонс улюбленців' + (st.newsPhoto ? ' з картинкою' : ' (без картинки: надішліть мені її як фото, щоб додати)') + '. Надіслати в сімейний чат?',
    { inline_keyboard: [[button('📣 Надіслати анонс', 'news:pets')]] });
}
function postPetNews(st) {
  if (st.newsPhoto) { tg('sendPhoto', { chat_id: st.group, photo: st.newsPhoto, caption: petNewsText(st), parse_mode: 'HTML', reply_markup: { inline_keyboard: [[button('🐾 Подружитися', 'menu:pet')]] } }); return; }
  say(st.group, petNewsText(st), { inline_keyboard: [[button('🐾 Подружитися', 'menu:pet')]] });
}
// ---------------------------------------------------------------- settings (owner, private chat, buttons only)
// Telegram makes all buttons of a row equally wide, so values live in the message text and the buttons stay short:
// a main page with sections, and one page per section with two or three short buttons a row.
const PAGES = { shop: '🛒 Ціни в магазині', main: '⚙️ Налаштування', crop: '🌱 Що в грядках', norms: '👥 Люди: норми, стать, колір', plots: '🏡 Ділянки',
  timers: '⏰ Як часто нагадувати', nag: '📣 Кличі', other: '💰 Інше', race: '🏁 Перегони і банк', bundles: '📦 Що росте: бандли й компостери', gems: '💎 Завдання за кристали', invest: '💼 Інвестиції', season: '🎪 Сезони', pets: '🐾 Улюбленці й персонажі' };
function settingsText(st, page) {
  const c = st.cfg, t = st.timers, f = farmCalc(c);
  const next = function (k) { return t[k] ? ', наступне ' + whenText(t[k].due) : ''; };
  const every = function (manual, auto) { return dur(manual || auto) + (manual ? ' (вручну)' : ' (як росте)'); };
  const people = Object.keys(st.people);
  page = page || 'main';
  if (page === 'shop') return PAGES.shop + ' (у ' + GEM + ')\nМагазин сам сортує товари від дешевого до дорогого: кожен день стріку відкриває наступний. У 💎 сезон діє знижка.\n' +
    SHOP.map(function (it) { const pr = (c.shopPrices || {})[it.id]; return it.icon + ' ' + esc(it.label) + ': ' + b((pr || it.price) + ' ' + GEM) + (pr && pr !== it.price ? ' (було ' + it.price + ')' : '') + (it.kid ? ' · лише Марії' : ''); }).join('\n') +
    '\n🍖 Корм: ' + b(c.pet.food + ' ' + GEM) + ' · набір у 💎 сезон: ' + b(c.pet.packN + ' за ' + c.pet.pack + ' ' + GEM);
  if (page === 'crop') return PAGES.crop + '\nЗараз: ' + bedCrop(c).label + '. Виберіть культуру:';
  if (page === 'norms') return PAGES.norms + '\nЕталонний день ферми: ' + b(farmMax(c) + ' грн') + ' (еталон: грядки Cactus/Turmeric, ⅔ місць — бандли Clover, ⅓ — компостери, по 6 зборів на день). Не залежить від того, що посаджено сьогодні; росте разом із землею. Норма — частка від нього.\n' +
    (people.map(function (id) { const p = st.people[id]; return '  ' + colorOf(st, id) + ' ' + esc(p.name) + ': ' + p.share + '% → ' + b(p.norm + ' грн') + ' на день ' + (p.female ? '♀' : '♂'); }).join('\n') || '  ще нікого немає (/iam у групі)') +
    '\n♀/♂ — щоб бот писав «зібрала» чи «зібрав». Квадратик — колір людини в прогрес-барах (натисни, щоб змінити).';
  if (page === 'plots') return PAGES.plots + ' — наша (засновницька) земля\n' +
    Object.keys(PLOTS).map(function (k) { return '  ' + PLOTS[k].label + ': ' + b(c[k] + ' шт'); }).join('\n') +
    ((c.iplots || []).length ? '\n🌱 Плюс інвесторські — додаються самі після «Куплено», сюди їх не додавайте:\n' + Object.keys(PLOTS).map(function (k) {
      const n = c.iplots.filter(function (p) { return p.type === k; });
      return n.length ? '  ' + typeLabel(k) + ': ' + b(n.length + ' шт') + ' (' + n.map(function (p) { return '«' + esc(p.name) + '»'; }).join(', ') + ')' : '';
    }).filter(Boolean).join('\n') + '\n  Разом землі: ' + b(Object.keys(PLOTS).reduce(function (a, k) { return a + c[k]; }, 0) + c.iplots.length + ' ділянок') : '') +
    '\nМісць під компостери/бандли на ділянках: ' + farmCalc(c).spots + '. Що на них стоїть і що на нейтральній землі — ⚙️ → 📦 Що росте.' +
    '\nНагорода за збір рахується з цього сама: грядки ' + grn(KINDS.beds.reward(c)) + ', ' + plotType(c).label.toLowerCase() + ' ' + grn(KINDS.plots.reward(c)) + ' (після ' + c.bankPct + '% у банк).';
  if (page === 'timers') return PAGES.timers + '\n  🌱 Грядки: кожні ' + every(c.bedTimer, bedCrop(c).min) + next('beds') +
    '\n  ' + plotType(c).icon + ' ' + plotType(c).label + ': кожні ' + every(c.plotTimer, plotType(c).min) + next('plots') +
    '\n🧺 Разом: якщо грядки й ' + plotType(c).label.toLowerCase() + ' готові з різницею до ' + b(c.together ? c.together + ' хв' : '0 (вимкнено)') + ', чекаю на пізніше і надсилаю одне нагадування' +
    '\n«Як росте» — за часом росту. ±15 хв — вручну, «🔄» — знову як росте.';
  if (page === 'nag') return PAGES.nag + '\n  Якщо нагадування висить без реакції ' + (c.nagAfter ? b(c.nagAfter + ' хв') + ', кличу кожну хвилину' : b('вимкнено')) +
    '\n  Гіфок і стікерів для кличів: ' + (st.gifs || []).length + '. Щоб додати — надішліть їх мені сюди.';
  if (page === 'race') return raceSettingsText(st);
  if (page === 'invest') return investSettingsText(st);
  if (page === 'season') return seasonSettingsText(st);
  if (page === 'pets') return petSettingsText(st);
  if (page === 'gems') return PAGES.gems + '\n💱 Обмін: 1 ' + GEM + ' = ' + b(c.gemUah + ' грн') + ' · 🌾 за збір: ' + b('+' + c.harvestGem + ' ' + GEM) + ' (культура ≤1 год — +' + c.harvestGem / 2 + ')' + '\n' + TASKS.map(function (t) { return t.icon + ' ' + t.label + ': ' + b(c.taskGems[t.id] + ' ' + GEM); }).join('\n') +
    '\n\n💎 Кристали зараз: ' + (people.map(function (id) { return esc(st.people[id].name) + ' ' + b(inv(st, id).gems); }).join(', ') || '—') + ' (кнопки внизу; точно: /gems Сашко 45)' +
    '\nЗавдання можна робити скільки завгодно разів (на кожному персонажі); кожне ви підтверджуєте тут у приватному чаті. Плюс понад норму: +1 ' + GEM + ' за кожні ' + overStep(c) + ' грн (' + c.overPct + '% від еталонного дня ферми), до ' + c.overMax + ' на день.';
  if (page === 'bundles') {
    const f = farmCalc(c), B = bundleCrop(c);
    return PAGES.bundles +
      '\n🏡 ' + b('На наших ділянках') + ' (' + f.spots + ' місць; бандл займає місце компостера):' +
      '\n  📦 бандлів ' + B.label + ': ' + b(f.pbundles) + ' · 🪱 компостерів: ' + b(f.comps) +
      '\n🌍 ' + b('На нейтральній землі') + ':' +
      '\n  📦 бандлів ' + B.label + ': ' + b(f.nbundles) + ' · 🪱 компостерів: ' + b(f.neutral) + ' (у середньому, бо крадуть)' +
      '\nРостуть: бандли ' + B.label + ' ' + dur(B.min) + ', компостери ' + dur(COMPOSTER_MIN) + '.' +
      '\nЗбір один на всіх: нагадую, коли готове те, що росте довше (' + dur(plotType(c).min) + ').' +
      '\n💰 1 бандл за збір ≈ ' + bundleHarvest(c).gold.toFixed(2).replace('.', ',') + 'g, 1 компостер ≈ ' + composterHarvest().gold.toFixed(2).replace('.', ',') + 'g' +
      '\nЯкий бандл саджаємо:';
  }
  if (page === 'other') return PAGES.other + '\n  Курс: 1000g = ' + c.uahPer1000 + ' грн' +
    '\n  «Зараз не можу»: ' + dur(c.snooze) + '\n  Нагадую з ' + c.dayStart + ':00 до ' + c.dayEnd + ':00';
  return PAGES.main +
    '\n🌱 Грядки: ' + bedCrop(c).label + ' · 🪱 компостерів ' + (farmCalc(c).comps + farmCalc(c).neutral) + ' · 📦 бандлів ' + farmCalc(c).bundles + ' ' + bundleCrop(c).label +
    '\n💰 За збір людям: грядки ' + grn(KINDS.beds.reward(c)) + ', ' + plotType(c).label.toLowerCase() + ' ' + grn(KINDS.plots.reward(c)) + ' (з ділянок і цін), щоденні справи +' + c.taskGems.daily + ' ' + GEM + ' за персонажа' +
    '\n🏦 Банк: ' + grn(st.bank) + ', ' + c.bankPct + '% з кожного збору · 🏁 Перегони: ' + (c.races ? 'увімкнені' : 'вимкнені') +
    '\n🎯 Норми: ' + (people.map(function (id) { return esc(st.people[id].name) + ' ' + st.people[id].norm + ' грн'; }).join(', ') || '—') +
    '\n🏡 Ділянки: ' + Object.keys(PLOTS).map(function (k) { return PLOTS[k].label.split(' ')[0] + ' — ' + c[k]; }).join(', ') + ', нейтральна — ' + (c.neutral || 0) + ' компостерів' +
    '\n⏰ Грядки кожні ' + every(c.bedTimer, bedCrop(c).min) + ', ' + plotType(c).label.toLowerCase() + ' кожні ' + every(c.plotTimer, plotType(c).min) +
    '\n📣 Кличі: ' + (c.nagAfter ? 'через ' + c.nagAfter + ' хв мовчання' : 'вимкнено') +
    '\n\nВиберіть, що змінити:';
}
function settingsKeyboard(st, page) {
  const c = st.cfg, back = [button('◂ Назад', 'set:page:main')];
  const people = Object.keys(st.people);
  page = page || 'main';
  if (page === 'crop') return { inline_keyboard: Object.keys(CROPS).map(function (k) {
    return [button((c.bedCrop === k ? '● ' : '') + CROPS[k].label + ' (' + dur(CROPS[k].min) + ')', 'set:bedCrop:' + k)];
  }).concat([back]) };
  if (page === 'norms') return { inline_keyboard: people.map(function (id) {
    const n = st.people[id].name;
    return [button('➖5% ' + n, 'set:norm:' + id + ':-1'), button('➕5% ' + n, 'set:norm:' + id + ':1'), button(st.people[id].female ? '♀' : '♂', 'set:gender:' + id), button(colorOf(st, id), 'set:color:' + id)];
  }).concat([back]) };
  if (page === 'plots') return { inline_keyboard: Object.keys(PLOTS).map(function (k) {
    const n = PLOTS[k].label.split(' ')[0];
    return [button('➖ ' + n, 'set:' + k + ':-1'), button('➕ ' + n, 'set:' + k + ':1')];
  }).concat([back]) };
  if (page === 'timers') return { inline_keyboard: [
    [button('➖15 хв грядки', 'set:bedTimer:-15'), button('➕15 хв грядки', 'set:bedTimer:15')],
    [button('🔄 Грядки: як росте', 'set:bedTimer:0')],
    [button('➖15 хв ' + plotType(c).label.toLowerCase(), 'set:plotTimer:-15'), button('➕15 хв ' + plotType(c).label.toLowerCase(), 'set:plotTimer:15')],
    [button('🔄 ' + plotType(c).label + ': як росте', 'set:plotTimer:0')],
    [button('➖5 хв разом', 'set:together:-5'), button('➕5 хв разом', 'set:together:5')], back] };
  if (page === 'nag') return { inline_keyboard: [
    [button('➖1 хв', 'set:nagAfter:-1'), button('➕1 хв', 'set:nagAfter:1')],
    [button(c.nagAfter ? '🔕 Вимкнути кличі' : '🔔 Увімкнути (10 хв)', 'set:nagToggle')],
    (st.gifs || []).length ? [button('🗑 Очистити гіфки (' + st.gifs.length + ')', 'set:gifsClear')] : null, back].filter(Boolean) };
  if (page === 'bundles') return { inline_keyboard: [
    [button('🏡 ➖10 бандлів', 'set:bundles:-10'), button('🏡 ➕10 бандлів', 'set:bundles:10')],
    [button('🏡 ➖1 бандл', 'set:bundles:-1'), button('🏡 ➕1 бандл', 'set:bundles:1')],
    [button('🌍 ➖10 бандлів', 'set:nbundles:-10'), button('🌍 ➕10 бандлів', 'set:nbundles:10')],
    [button('🌍 ➖5 компостерів', 'set:neutral:-5'), button('🌍 ➕5 компостерів', 'set:neutral:5')]].concat(
    Object.keys(BUNDLES).map(function (k) { return [button((c.bundleCrop === k ? '● ' : '') + BUNDLES[k].label + ' (' + dur(BUNDLES[k].min) + ')', 'set:bundleCrop:' + k)]; }), [back]) };
  if (page === 'shop') return { inline_keyboard: SHOP.map(function (it) {
      const v = (c.shopPrices || {})[it.id] || it.price;
      return [button(it.icon + ' ' + v + ' ' + GEM, 'noop'), button('−5', 'set:sp:' + it.id + ':-5'), button('−1', 'set:sp:' + it.id + ':-1'), button('+1', 'set:sp:' + it.id + ':1'), button('+5', 'set:sp:' + it.id + ':5')];
    }).concat([
      [button('🍖 ' + c.pet.food + ' ' + GEM, 'noop'), button('−1', 'set:shopFood:-1'), button('+1', 'set:shopFood:1')],
      [button('🍖×' + c.pet.packN + ' за ' + c.pet.pack + ' ' + GEM, 'noop'), button('−1 ' + GEM, 'set:packPrice:-1'), button('+1 ' + GEM, 'set:packPrice:1'), button('−1 шт', 'set:packN:-1'), button('+1 шт', 'set:packN:1')],
      [button('🗓 Щодня в продажу: ' + c.shopDaily, 'noop'), button('−1', 'set:shopDaily:-1'), button('+1', 'set:shopDaily:1')],
      [button('📈 Повтор за тиждень: +' + c.shopRise + '%', 'noop'), button('−10', 'set:shopRise:-10'), button('+10', 'set:shopRise:10')],
      [button('↺ Ціни як були', 'set:spReset')], back]) };
  if (page === 'gems') return { inline_keyboard: [
    [button('💱 1 ' + GEM + ' = ' + c.gemUah + ' грн', 'noop'), button('−0.1', 'set:gemUah:-1'), button('+0.1', 'set:gemUah:1')],
    [button('🌾 За збір: ' + c.harvestGem + ' ' + GEM + ' (≤1 год: ' + c.harvestGem / 2 + ')', 'noop'), button('−1', 'set:harvestGem:-1'), button('+1', 'set:harvestGem:1')],
    [button('🏰 WoW 1-й раз: ' + c.wowFirst + ' ' + GEM, 'noop'), button('−5', 'set:wowFirst:-5'), button('+5', 'set:wowFirst:5')],
    [button('🔁 WoW повтор: ' + c.wowRepeat + ' ' + GEM, 'noop'), button('−5', 'set:wowRepeat:-5'), button('+5', 'set:wowRepeat:5')],
    [button('🐉 Данжі до ' + c.wowMaxLvl + ' рівня', 'noop'), button('−5', 'set:wowMaxLvl:-5'), button('+5', 'set:wowMaxLvl:5')]].concat(TASKS.map(function (t) {
    return [button(t.icon + ' ' + c.taskGems[t.id] + ' ' + GEM, 'noop'), button('−1', 'set:task:' + t.id + ':-1'), button('+1', 'set:task:' + t.id + ':1')];
  })).concat(people.map(function (id) { // each person's crystals: the label shows how many there are now
    return [button(st.people[id].name + ' ' + inv(st, id).gems + GEM, 'noop'), button('−10', 'set:gems:' + id + ':-10'), button('−1', 'set:gems:' + id + ':-1'), button('+1', 'set:gems:' + id + ':1'), button('+10', 'set:gems:' + id + ':10')]; }), [back]) };
  if (page === 'pets') return petSettingsKeyboard(st);
  if (page === 'invest') return { inline_keyboard: st.offers.map(function (o) {
      const n = st.offers.length > 1 ? ' «' + o.name + '»' : '';
      return [offerSum(o) >= o.price - 0.005 ? button('✅ Куплено' + n, 'ivdone:' + o.id) : lockedButton('✅ Куплено' + n + ' — після 100%'), button('❌ Скасувати' + (n || ' збір'), 'ivcancel:' + o.id)]; })
    .concat([[button('➖ 5% тому, хто зібрав', 'set:invWage:-5'), button('➕ 5% тому, хто зібрав', 'set:invWage:5')], back]) };
  if (page === 'season') {
    const race = st.race && st.race.active && !st.season;
    return { inline_keyboard: (st.season ? [[button('🏁 Завершити з підсумками', 'sn:stop')], [button('🗑 Скасувати без нагород', 'sn:kill')]]
      : race ? [[button('🗑 Скасувати перегони (без призів)', 'sn:kill')], [button('🏁 Завершити перегони з призами', 'sn:racefin')]]
      : [[button('🎪 Обрати сезон', 'sn:menu')]])
      .concat(seasonOn(st, 'early') ? [[button('➖ 🌅 раніше', 'set:earlyHour:-1'), button('➕ 🌅 пізніше', 'set:earlyHour:1')]] : [])
      .concat(st.seasonNext ? [[button('❌ Скасувати запланований сезон', 'sn:unplan')]] : [])
      .concat([[button('⬅️ Назад', 'set:page:main')]]) };
  }
  if (page === 'race') return { inline_keyboard: [
    [button('➖ банк 1%', 'set:bankPct:-1'), button('➕ банк 1%', 'set:bankPct:1')],
    st.splitAsk && Date.now() - st.splitAsk < 5 * 60000
      ? [button('✅ Так, розділити ' + money(st.bank) + ' грн', 'set:bankSplitOk'), button('✖️ Ні', 'set:bankSplitNo')]
      : [button('🎁 Розділити банк порівну (' + money(st.bank) + ' грн)', 'set:bankSplit')],
    [button('➖ морозиво 5', 'set:icePrice:-5'), button('➕ морозиво 5', 'set:icePrice:5')],
    [button('➖ 50 грн з банку', 'set:bank:-50'), button('➕ 50 грн у банк', 'set:bank:50')],
    [button('➖ перегони від', 'set:raceMin:-1'), button('➕ перегони від', 'set:raceMin:1')],
    [button('➖ перегони до', 'set:raceMax:-1'), button('➕ перегони до', 'set:raceMax:1')],
    [button('➖ відпочинок від', 'set:restMin:-1'), button('➕ відпочинок від', 'set:restMin:1')],
    [button('➖ відпочинок до', 'set:restMax:-1'), button('➕ відпочинок до', 'set:restMax:1')],
    [button(c.races ? '⏸ Вимкнути перегони' : '▶️ Увімкнути перегони', 'set:raceToggle'), button('🏁 Почати зараз', 'set:raceNow')], back] };
  if (page === 'other') return { inline_keyboard: [
    [button('➖ Курс', 'set:uahPer1000:-1'), button('➕ Курс', 'set:uahPer1000:1')],
    [button('➖5 хв «не можу»', 'set:snooze:-5'), button('➕5 хв «не можу»', 'set:snooze:5')],
    [button('➖ Початок', 'set:dayStart:-1'), button('➕ Початок', 'set:dayStart:1')],
    [button('➖ Кінець', 'set:dayEnd:-1'), button('➕ Кінець', 'set:dayEnd:1')], back] };
  return { inline_keyboard: [
    [button('🌱 ' + bedCrop(c).label, 'set:page:crop')],
    [button('📦 Що росте: бандли й компостери', 'set:page:bundles')],
    [button('🏡 Ділянки', 'set:page:plots'), button('👥 Люди', 'set:page:norms')],
    [button('⏰ Таймери', 'set:page:timers'), button('📣 Кличі', 'set:page:nag')],
    [button('🎪 Сезони', 'set:page:season'), button('🐾 Улюбленці', 'set:page:pets')],
    [button('🏁 Перегони і банк', 'set:page:race'), button('💎 Завдання', 'set:page:gems')],
    [button('💼 Інвестиції', 'set:page:invest'), button('💰 Інше', 'set:page:other')],
    [button('🛒 Ціни в магазині', 'set:page:shop')],
  ] };
}
// "set:<what>[:<id>]:<value>" from a settings page; returns the page to show next
function applySetting(st, parts) {
  const c = st.cfg, what = parts[1], clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  if (what === 'page') return PAGES[parts[2]] ? parts[2] : 'main';
  if (applyPetSetting(st, parts)) return 'pets';
  if (what === 'bedCrop' && CROPS[parts[2]]) { c.bedCrop = parts[2]; return 'main'; }
  if (what === 'bundleCrop' && BUNDLES[parts[2]]) { c.bundleCrop = parts[2]; return 'bundles'; }
  if (what === 'nbundles') { c.nbundles = clamp((c.nbundles || 0) + +parts[2], 0, 1000); return 'bundles'; }
  if (what === 'bundles') { c.bundles = clamp((c.bundles || 0) + +parts[2], 0, farmCalc(c).spots); return 'bundles'; }
  if (what === 'dailyReward') { c.dailyReward = clamp(c.dailyReward + +parts[2], 0, 500); return 'other'; }
  if (what === 'uahPer1000') { c.uahPer1000 = clamp(c.uahPer1000 + +parts[2], 1, 200); return 'other'; }
  if (what === 'snooze') { c.snooze = clamp(c.snooze + +parts[2], 5, 120); return 'other'; }
  if (what === 'dayStart') { c.dayStart = clamp(c.dayStart + +parts[2], 0, c.dayEnd - 1); if (st.group) scheduleDayEvents(st); return 'other'; }
  if (what === 'dayEnd') { c.dayEnd = clamp(c.dayEnd + +parts[2], c.dayStart + 1, 24); if (st.group) scheduleDayEvents(st); return 'other'; }
  if (what === 'bedTimer' || what === 'plotTimer') {
    const auto = what === 'bedTimer' ? bedCrop(c).min : plotType(c).min;
    c[what] = +parts[2] === 0 ? 0 : clamp((c[what] || auto) + +parts[2], 15, 24 * 60);
    return 'timers';
  }
  if (what === 'neutral') { c.neutral = clamp((c.neutral || 0) + +parts[2], 0, 500); return 'bundles'; }
  if (PLOTS[what]) { c[what] = clamp(c[what] + +parts[2], 0, 200); return 'plots'; }
  if (what === 'together') { c.together = clamp(c.together + +parts[2], 0, 120); return 'timers'; }
  if (what === 'nagAfter') { c.nagAfter = clamp(c.nagAfter + +parts[2], 0, 60); return 'nag'; }
  if (what === 'nagToggle') { c.nagAfter = c.nagAfter ? 0 : 10; return 'nag'; }
  if (what === 'gifsClear') { st.gifs = []; return 'nag'; }
  if (what === 'task' && c.taskGems[parts[2]] !== undefined) { c.taskGems[parts[2]] = clamp(c.taskGems[parts[2]] + +parts[3], 0, 100); return 'gems'; }
  if (what === 'earlyHour') { c.earlyHour = clamp(c.earlyHour + +parts[2], c.dayStart + 1, c.dayEnd); return 'season'; }
  if (what === 'invWage') { c.invWage = clamp(c.invWage + +parts[2], 0, 100); return 'invest'; }
  if (what === 'bankPct') { c.bankPct = clamp(c.bankPct + +parts[2], 0, 20); return 'race'; }
  if (what === 'sp') { const it = shopItem(parts[2]); if (!it) return 'shop'; c.shopPrices = c.shopPrices || {}; c.shopPrices[it.id] = clamp((c.shopPrices[it.id] || it.price) + +parts[3], 1, 999); if (c.shopPrices[it.id] === it.price) delete c.shopPrices[it.id]; return 'shop'; }
  if (what === 'shopDaily') { c.shopDaily = clamp(c.shopDaily + +parts[2], 1, 20); return 'shop'; }
  if (what === 'shopRise') { c.shopRise = clamp(c.shopRise + +parts[2], 0, 200); return 'shop'; }
  if (what === 'spReset') { c.shopPrices = {}; return 'shop'; }
  if (what === 'shopFood') { c.pet.food = clamp(c.pet.food + +parts[2], 1, 50); return 'shop'; }
  if (what === 'packPrice') { c.pet.pack = clamp(c.pet.pack + +parts[2], 1, 999); return 'shop'; }
  if (what === 'packN') { c.pet.packN = clamp(c.pet.packN + +parts[2], 1, 99); return 'shop'; }
  if (what === 'bankSplit') { st.splitAsk = Date.now(); return 'race'; }
  if (what === 'bankSplitNo') { delete st.splitAsk; return 'race'; }
  if (what === 'bankSplitOk') { delete st.splitAsk; splitBank(st); return 'race'; }
  if (what === 'gemUah') { c.gemUah = Math.round(clamp(c.gemUah * 10 + +parts[2], 1, 50)) / 10; return 'gems'; }
  if (what === 'wowMaxLvl') { c.wowMaxLvl = clamp(c.wowMaxLvl + +parts[2], 15, 60); return 'gems'; }
  if (what === 'wowFirst' || what === 'wowRepeat') { c[what] = clamp(c[what] + +parts[2], 0, 500); return 'gems'; }
  if (what === 'harvestGem') { c.harvestGem = clamp(c.harvestGem + +parts[2], 0, 10); return 'gems'; }
  if (what === 'icePrice') { c.icePrice = clamp(c.icePrice + +parts[2], 5, 200); return 'race'; }
  if (what === 'bank') { st.bank = money(Math.max(0, st.bank + +parts[2])); return 'race'; }
  if (what === 'raceToggle') { c.races = !c.races; if (c.races && !st.raceNext) st.raceNext = addDays(dayKey(Date.now(), c), Math.max(1, rnd(c.restMin, c.restMax))); return 'race'; }
  if (what === 'raceMin') { c.raceMin = clamp(c.raceMin + +parts[2], 1, c.raceMax); return 'race'; }
  if (what === 'raceMax') { c.raceMax = clamp(c.raceMax + +parts[2], c.raceMin, 14); return 'race'; }
  if (what === 'restMin') { c.restMin = clamp(c.restMin + +parts[2], 0, c.restMax); return 'race'; }
  if (what === 'restMax') { c.restMax = clamp(c.restMax + +parts[2], c.restMin, 14); return 'race'; }
  if (what === 'raceNow') { if (st.group && !(st.race && st.race.active)) startRace(st, Date.now()); return 'race'; }
  if (what === 'norm' && st.people[parts[2]]) { const p = st.people[parts[2]]; p.share = clamp(p.share + 5 * +parts[3], 0, 100); p.norm = normFor(c, p.share); return 'norms'; }
  if (what === 'gems' && st.people[parts[2]]) { const x = inv(st, parts[2]); x.gems = Math.max(0, x.gems + +parts[3]); return 'gems'; }
  if (what === 'gender' && st.people[parts[2]]) { st.people[parts[2]].female = !st.people[parts[2]].female; return 'norms'; }
  if (what === 'color' && st.people[parts[2]]) { const cur = colorOf(st, parts[2]); st.people[parts[2]].color = COLORS[(COLORS.indexOf(cur) + 1) % COLORS.length]; refreshOffer(st); return 'norms'; }
  return 'main';
}

// 💱 Crystals -> UAH at cfg.gemUah (part of the crystal tasks is real gold in the game)
function gxView(st, id) {
  const x = inv(st, id), r = st.cfg.gemUah, rows = [];
  const opts = [10, 25, 50, 100].filter(function (n) { return n <= x.gems; }).map(function (n) { return button(n + ' ' + GEM + ' → ' + money(n * r) + ' грн', 'gemx:' + n); });
  for (let i = 0; i < opts.length; i += 2) rows.push(opts.slice(i, i + 2));
  if (x.gems > 0) rows.push([button('Усі ' + x.gems + ' ' + GEM + ' → ' + money(x.gems * r) + ' грн', 'gemx:all')]);
  rows.push([button('⬅️ 🎒 Інвентар', 'menu:inv')]);
  return { text: '💱 ' + b('Обмін кристалів') + '\n1 ' + GEM + ' = ' + b(r + ' грн') + '\n\nУ тебе: ' + b(x.gems + ' ' + GEM) + ' = ' + grn(money(x.gems * r)) + '\nГривні підуть на баланс 💰', kb: { inline_keyboard: rows } };
}
function gemExchange(st, user, what, q, edit, eph) {
  const id = String(user.id), x = inv(st, id), p = person(st, user);
  const show = function (v) { if (eph) edit(v.text, v.kb); else sayTo(st, id, v.text, v.kb, q, 'inv'); };
  if (what === 'menu') { toast(q, ''); show(gxView(st, id)); return; }
  const n = what === 'all' ? x.gems : Math.floor(+what);
  if (!(n > 0) || n > x.gems) { toast(q, 'Стільки кристалів немає'); show(gxView(st, id)); return; }
  const uah = money(n * st.cfg.gemUah);
  x.gems -= n; st.balance[id] = money((st.balance[id] || 0) + uah);
  toast(q, '💱 ' + n + ' ' + GEM + ' → +' + uah + ' грн');
  sayK(st, 'gx', '💱 ' + esc(p.name) + ' ' + verb(p, 'обміняв', 'обміняла') + ' ' + n + ' ' + GEM + ' на ' + grn(uah));
  show(gxView(st, id));
}
// 🎁 The whole bank, split equally between everyone, onto their balances
function splitBank(st) {
  const ids = Object.keys(st.people), each = ids.length ? Math.floor(st.bank / ids.length * 100) / 100 : 0;
  if (!(each > 0)) return;
  ids.forEach(function (id) { st.balance[id] = money((st.balance[id] || 0) + each); });
  st.bank = money(st.bank - each * ids.length);
  sayK(st, 'banksplit', '🎁 ' + b('Банк ферми розділено!') + '\nКожному на баланс: ' + grn(each) + '\n' + ids.map(function (id) { return colorOf(st, id) + ' ' + esc(nameOf(st, id)); }).join(' · ') + ' 💰');
}

// ================================================================ 📱 MINI APP
// A web page (GitHub Pages) that opens inside Telegram. It POSTs {initData, action, args} to this web app with ?app=1;
// initData is signed by Telegram with the bot token, so a person can only see and spend their own things.
function appUser(initData) {
  const kv = {};
  String(initData || '').split('&').forEach(function (pair) {
    const i = pair.indexOf('='); if (i < 0) return;
    kv[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, '%20'));
  });
  if (!kv.hash || !kv.user) return null;
  const check = Object.keys(kv).filter(function (k) { return k !== 'hash'; }).sort().map(function (k) { return k + '=' + kv[k]; }).join('\n');
  const bytes = function (t) { return Utilities.newBlob(t).getBytes(); };
  const secret = Utilities.computeHmacSha256Signature(bytes(props().getProperty('BOT_TOKEN')), bytes('WebAppData'));
  const sig = Utilities.computeHmacSha256Signature(bytes(check), secret).map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
  if (sig !== kv.hash) return null;
  if (Date.now() / 1000 - (+kv.auth_date || 0) > 7 * 86400) return null; // an old link: reopen the app
  try { return JSON.parse(kv.user); } catch (err) { return null; }
}
function appJson(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function appApi(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}'), user = appUser(body.initData);
    if (!user) return appJson({ error: 'auth', msg: 'Не вдалося перевірити вхід. Відкрий застосунок ще раз з Telegram.' });
    return appJson(withLock(function () {
      const st = loadState(), id = String(user.id);
      if (!st.people[id]) return { error: 'member', msg: 'Тебе ще немає на фермі. Натисни ▶️ Почати день у групі.' };
      const q = { app: true, out: [] }, noop = function () {}, a = body.args || {}, now = Date.now();
      let changed = true;
      if (body.action === 'buy') buy(st, user, String(a.item), id, q, noop);
      else if (body.action === 'food') buyFood(st, user, a.pack ? 'pack' : 'one', q, noop);
      else if (body.action === 'gemx') gemExchange(st, user, String(a.n), q, noop, true);
      else if (body.action === 'use') { if (useCoupon(st, user, String(a.item), q)) q.out.push('🎟 Купон використано! Дивись у групі'); }
      else if (body.action === 'feed') { const pet = petOf(st, id); if (!petOk(pet)) q.out.push('Улюбленця ще немає'); else { const why = petFeed(st, id, now); q.out.push(why ? why.replace(/<[^>]+>/g, '') : '🍖 Ням! +' + st.cfg.pet.feed + '% ситості'); } }
      else if (body.action === 'harvest') appHarvest(st, user, String(a.kind), a.crop ? String(a.crop) : '', q, now);
      else if (body.action === 'task') { const t = taskDef(String(a.id)); if (!t) q.out.push('Такого завдання немає'); else doTask(st, user, String(a.id), id, q, noop); }
      else if (body.action === 'item') { // 🎒 use something from the inventory
        const w = String(a.what || '');
        if (w === 'prize') { q.message = { text: '' }; openPrizes(st, user, q, '', noop); }
        else if (/^(ice|vac|cash|cpn_[\w-]+)$/.test(w)) useItem(st, user, w, id, q, noop);
        else q.out.push('Такого предмета немає');
      }
      else if (body.action === 'look') appLook(st, id, a, q);
      else if (body.action === 'tr') appTrade(st, user, a, q);
      else if (body.action === 'boost') buyBoost(st, user, String(a.key), q);
      else if (body.action === 'prize') claimPrize(st, id, String(a.id || 'all'), q);
      else if (body.action === 'excl') buyExcl(st, id, String(a.key), q);
      else if (body.action === 'claim') appClaim(st, id, String(a.key || 'all'), q);
      else if (body.action === 'pledge') pledge(st, user, String(a.oid), String(a.amt), q);
      else if (body.action === 'ivtake') {
        const w = money((st.invWallet || {})[id] || 0);
        if (w <= 0) q.out.push('Поки нічого забирати');
        else { st.invWallet[id] = 0; st.balance[id] = money((st.balance[id] || 0) + w); q.out.push('💰 +' + w + ' грн на баланс');
          sayK(st, 'ivtake', '🏦 ' + esc(person(st, user).name) + ' ' + verb(person(st, user), 'забрав', 'забрала') + ' дохід із землі: ' + grn(w) + '! 🌱'); checkAch(st, id); }
      }
      else if (body.action === 'sell') sellShare(st, user, String(a.pid), id, true, q, noop);
      else if (body.action === 'decide') { if (String(id) !== String(st.owner)) q.out.push('Підтверджує лише власник'); else { decideTasks(st, !!a.ok, String(a.which), q, noop); postPending(st); } }
      else if (body.action === 'wear') { const pet = petOf(st, id); const why = petOk(pet) ? petCloth(st, id, String(a.slot), String(a.item)) : 'Улюбленця ще немає'; q.out.push(why ? why.replace(/<[^>]+>/g, '') : '👕 Обновка!'); }
      else changed = false; // 'state': just look
      const pet = petOf(st, id); if (petOk(pet)) petTick(st, pet, now);
      saveState(st);
      return { ok: true, toast: q.out.join(' · '), changed: changed, res: q.res || null, state: appState(st, id) };
    }));
  } catch (err) {
    console.error(err); reportError(err);
    return appJson({ error: 'server', msg: 'Щось пішло не так. Спробуй ще раз.' });
  }
}
// 📱 a harvest from the app: the same as "✅ Я вже зібрав(ла)…" in the menu. crop: a one-off seedbed crop
// (Narcissus / Clover / Mint) that is paid by its own price; the seedbed timer still restarts for the usual crop.
const ONCE_CROPS = { narcissus: '🌼', clover: '🍀', mr: '🌿' };
function appHarvest(st, user, k, crop, q, now) {
  if (!KINDS[k] || (crop && (k !== 'beds' || !ONCE_CROPS[crop]))) { q.out.push('Невідомий збір'); return; }
  const p = person(st, user), before = doneToday(st, user.id, now);
  st._cut = 0; st._early = 0; st._hgem = 0;
  if (crop) st._crop = crop;
  let r = 0, gems = 0;
  try { r = KINDS[k].reward(hcfg(st, k, now)); gems = credit(st, user, k, r, now); } finally { delete st._crop; }
  startTimer(st, k, KINDS[k].cycle(st.cfg));
  const saved = st._cut || 0, early = st._early || 0, hgem = st._hgem || 0; delete st._cut; delete st._early; delete st._hgem;
  const reward = money(r - saved);
  refreshSeason(st);
  const n = doneToday(st, user.id, now), normHit = before < p.norm && n >= p.norm;
  stopNag(st);
  const shared = st.open && st.open[k] && st.open[k] === st.open[k === 'beds' ? 'plots' : 'beds'];
  closeReminder(st, k);
  if (shared) { const o = k === 'beds' ? 'plots' : 'beds'; delete st.open[o]; postReminder(st, o); }
  armNag(st, st.cfg.nagAfter);
  const what = crop ? 'грядки (' + CROPS[crop].label + ')' : k === 'beds' ? 'грядки' : KINDS.plots.title(st.cfg).replace(/^\S+ /, '').toLowerCase();
  sayK(st, 'harvest', '✅ ' + esc(p.name) + ' ' + verb(p, 'зібрав', 'зібрала') + ' ' + what + ' о ' + hhmm(now) + ' (+' + grn(reward) + ') 📱' +
    (normHit ? '\n🎯 ' + esc(p.name) + ': норму на сьогодні виконано!' + streakNow(st, user.id, now) : '') +
    (gems ? '\n' + GEM + ' ' + esc(p.name) + ': +' + gems + ' ' + GEM + ' за заробіток понад норму' : '') + (hgem ? '\n' + GEM + ' +' + hgem + ' за збір' : '') +
    (saved ? '\n🐷 ' + grn(saved) + ' відкладено на цілі' : '') + (early ? '\n🌅 Рання пташка: +' + early + ' ' + GEM + '!' : '') + goalLine(st) + seasonLine(st) +
    '\n\n📊 Сьогодні:\n' + earnedLines(st, today(st, now)));
  checkAch(st, String(user.id));
  const ask = petAfterHarvest(st, String(user.id), [k], normHit, now);
  if (ask) sayTo(st, user.id, ask.text, ask.kb, null);
  q.out.push('+' + reward + ' грн' + (gems + hgem + early ? ' · +' + money(gems + hgem + early) + ' 💎' : '') + (normHit ? ' · 🎯 норму виконано!' : ''));
  q.res = { uah: reward, gems: money(gems + hgem + early), norm: normHit };
}
function appFarm(st, id, now) {
  const g = st.cfg.harvestGem || 0, p = st.people[id], day = dayKey(now, st.cfg), week = [];
  for (let i = 6; i >= 0; i--) { // the last 7 days: was the norm done?
    const d = dayKey(now - i * 86400000, st.cfg), r = (st.stats['d:' + d] || {})[id], got = r ? (r.g !== undefined ? r.g : r.uah) : 0;
    week.push({ day: d, ok: i === 0 ? doneToday(st, id, now) >= (p.norm || 0) && p.norm > 0 : got >= (p.norm || 0) && p.norm > 0 || onVacation(st, id, now - i * 86400000) });
  }
  return {
    now: now, week: week,
    crops: ['beds', 'plots'].map(function (k) { const t = st.timers[k];
      return { id: k, name: k === 'beds' ? 'Грядки' : 'Хробаки', icon: k === 'beds' ? '🌱' : '🪱',
        uah: rewardNow(st, k), gem: harvestGemFor(st, k, now), cycle: KINDS[k].cycle(st.cfg), due: t ? t.due : 0, ripe: (st.grown || {})[k] || 0 }; }),
    once: Object.keys(ONCE_CROPS).map(function (c) { const cf = Object.assign({}, st.cfg, { bedCrop: c });
      return { id: c, icon: ONCE_CROPS[c], name: { narcissus: 'Narcissus', clover: 'Clover', mr: 'Mint' }[c], uah: KINDS.beds.reward(cf), gem: KINDS.beds.cycle(cf) <= 60 ? g / 2 : g }; }),
  };
}
const TASK_ORDER = ['daily', 'gift', 'nui', 'quest', 'dog', 'restock', 'flower', 'neutral', 'event', 'alt']; // the usual frequency, until there is history
function appTasks(st, id) {
  const used = {}; // how often each task was done in the last days (gemLog keeps 7): the most used go first
  Object.keys(st.gemLog || {}).forEach(function (d) { const n = ((st.gemLog[d] || {})[id] || {}).n || {}; Object.keys(n).forEach(function (k) { used[k] = (used[k] || 0) + n[k]; }); });
  (st.pend || []).forEach(function (x) { if (String(x.uid) === String(id)) used[x.task] = (used[x.task] || 0) + 1; });
  const day = dayKey(Date.now(), st.cfg), lg = (st.gemLog[day] || {})[id] || { tasks: {}, n: {} }, n = lg.n || {}, pend = (st.pend || []).filter(function (x) { return String(x.uid) === String(id); });
  const waitOf = function (tid) { return pend.filter(function (x) { return x.task === tid; }).length; };
  return {
    ar: TASKS.filter(function (t) { return gameOf(t) === 'ar'; }).sort(function (a, b) { return (used[b.id] || 0) - (used[a.id] || 0) || TASK_ORDER.indexOf(a.id) - TASK_ORDER.indexOf(b.id); })
      .map(function (t) { return { id: t.id, icon: t.icon, label: t.label, per: t.per, note: t.note || '', list: t.list ? DAILY : null, gems: st.cfg.taskGems[t.id], today: n[t.id] || 0, wait: waitOf(t.id) }; }),
    wow: wowList(st).map(function (d) { return { id: 'wd_' + d[0], icon: '🏰', label: d[1], lvl: d[2], gems: wowGems(st, id, d[0]), done: wowDone(st, id, d[0]), wait: waitOf('wd_' + d[0]) }; }),
    waitGems: pend.reduce(function (a, x) { return a + x.gems; }, 0), waitN: pend.length,
    approve: String(id) === String(st.owner) ? (st.pend || []).map(function (x) { const t = taskDef(x.task) || { icon: '?', label: x.task }; return { id: x.id, uid: String(x.uid), who: nameOf(st, x.uid), icon: t.icon, label: t.label, gems: x.gems, at: hhmm(x.at) }; }) : null,
    todayGems: Object.keys(lg.tasks || {}).reduce(function (a, k) { return a + lg.tasks[k]; }, 0), game: (st.earnGame || {})[id] || 'ar', maxLvl: st.cfg.wowMaxLvl,
  };
}
function appInvest(st, id) {
  const mine = function (p) { return shareOf(p, id); };
  const today = dayKey(Date.now(), st.cfg);
  const plots = (st.cfg.iplots || []).map(function (p) { const d = offerDaily(st, p), k = mine(p);
    return { owners: Object.keys(p.shares).filter(function (u) { return p.shares[u] > 0; }).map(function (u) { return { id: u, share: shareOf(p, u), uah: money(p.shares[u]) }; }).sort(function (x, y) { return y.share - x.share; }), sellFrom: addDays(p.since, SELL_AFTER), canSell: !!p.shares[id] && String(id) !== String(st.owner) && today >= addDays(p.since, SELL_AFTER), got: money((p.got || {})[id] || 0), id: p.id, name: p.name, type: typeLabel(p.type), share: k, my: money(p.shares[id] || 0), price: p.price, dayAll: money(d), day: d * k }; });
  const offers = (st.offers || []).map(function (o) { return { who: Object.keys(o.pledges).filter(function (u) { return o.pledges[u] > 0; }).map(function (u) { return { id: u, uah: money(o.pledges[u]) }; }).sort(function (x, y) { return y.uah - x.uah; }), id: o.id, name: o.name, type: typeLabel(o.type), price: o.price, raised: money(offerSum(o)), my: money(o.pledges[id] || 0), dayAll: money(offerDaily(st, o)) }; });
  return { min: INV_MIN, balance: money(st.balance[id] || 0), daily: plots.reduce(function (a, p) { return a + p.day; }, 0), wallet: money((st.invWallet || {})[id] || 0), plots: plots, offers: offers };
}
// 🏅 +1 💎 for every achievement, taken by hand in the app (old ones too): st.achPaid[uid] = { achKey: day }
function achLabel(st, id, key) {
  if (key === 'first') return { icon: '🌅', name: 'З першого дня' };
  const g = ACH_GROUPS[+key.split('.')[0]], s = g && g.steps[+key.split('.')[1]];
  return s ? { icon: s[1], name: achName(st, id, s) } : null;
}
function achUnpaid(st, id) {
  const mine = st.ach[id] || {}, paid = (st.achPaid || {})[id] || {};
  return Object.keys(mine).filter(function (k) { return !paid[k] && achLabel(st, id, k); });
}
function appClaim(st, id, key, q) {
  const list = achUnpaid(st, id).filter(function (k) { return key === 'all' || k === key; });
  if (!list.length) { q.out.push('Уже забрано'); return; }
  const per = st.cfg.achGem || 1, day = dayKey(Date.now(), st.cfg);
  st.achPaid = st.achPaid || {}; st.achPaid[id] = st.achPaid[id] || {};
  list.forEach(function (k) { st.achPaid[id][k] = day; });
  inv(st, id).gems = money(inv(st, id).gems + list.length * per);
  q.out.push('🏅 +' + list.length * per + ' 💎 за ' + list.length + ' ' + plural(list.length, ['досягнення', 'досягнення', 'досягнень']));
  q.res = { gems: list.length * per };
}
// ---------------------------------------------------------------- 🎨 looks: avatar, colour, frame, title (for crystals)
// st.look[uid] = { av, bg, fr, ti } what is worn; st.lookOwn[uid] = { 'av:🦄': day } what is bought. price 0 = free for everyone.
const LOOKS = { // free: only the plain start; everything else is for crystals
  av: [['🙂', 0], ['🐱', 5], ['🐶', 5], ['🐰', 5], ['🐥', 5], ['🐹', 5], ['🦊', 8], ['🐻', 8], ['🐼', 8], ['🐸', 8],
    ['🦋', 15], ['🦄', 15], ['🌸', 15], ['🧚', 20], ['🌈', 20], ['🐲', 25], ['🦖', 25], ['🐙', 25], ['🧜‍♀️', 30], ['👸', 30], ['🤴', 30], ['🐉', 35], ['🦁', 35], ['👑', 40], ['🪐', 45], ['🔮', 50]],
  bg: [['sand', 0, 'Пісок'], ['sky', 8, 'Небо'], ['mint', 12, 'М’ята'], ['peach', 12, 'Персик'], ['lavender', 18, 'Лаванда'], ['rose', 18, 'Троянда'],
    ['ocean', 30, 'Океан'], ['sunset', 40, 'Захід сонця'], ['galaxy', 60, 'Галактика'], ['gold', 80, 'Золото']],
  fr: [['none', 0, 'Без рамки'], ['silver', 30, 'Срібна'], ['gold', 60, 'Золота'], ['rainbow', 120, 'Веселка ✨'], ['fire', 150, 'Вогняна 🔥'], ['stars', 200, 'Зоряна ⭐']],
  ti: [['', 0, 'Без титулу'], ['farmer', 10, 'Фермерка', 'Фермер'], ['worm', 40, 'Майстриня хробаків', 'Майстер хробаків'], ['queen', 50, 'Королева грядок', 'Король грядок'],
    ['gem', 80, 'Кристальна принцеса', 'Кристальний принц'], ['tycoon', 100, 'Магнатка землі', 'Магнат землі'], ['legend', 150, 'Легенда ферми', 'Легенда ферми']],
};
function lookOf(st, id) {
  const l = (st.look || {})[id] || {}, p = st.people[id] || {}, t = LOOKS.ti.filter(function (x) { return x[0] === (l.ti || ''); })[0];
  const mine = function (k) { const e = exclHolder(st, k); return !!e && String(e.uid) === String(id); }, tmp = (st.temp || {})[id] || {};
  return { av: l.av || '🙂', bg: l.bg || 'sand', fr: l.fr || 'none', ti: t && t[0] ? (p.female === false && t[3] ? t[3] : t[2]) : '',
    crown: mine('crown'), sparkle: mine('sparkle'), rainbow: mine('rainbow'), aura: (tmp.aura || 0) > Date.now() };
}
function lookOwns(st, id, kind, key) { const L = LOOKS[kind].filter(function (x) { return x[0] === key; })[0]; return !!L && (L[1] === 0 || !!(((st.lookOwn || {})[id] || {})[kind + ':' + key])); }
function appLook(st, id, a, q) {
  const kind = String(a.kind), key = String(a.key === undefined ? '' : a.key), L = LOOKS[kind] && LOOKS[kind].filter(function (x) { return x[0] === key; })[0];
  if (!L) { q.out.push('Такого немає'); return; }
  st.look = st.look || {}; st.look[id] = st.look[id] || {};
  if (!lookOwns(st, id, kind, key)) {
    const x = inv(st, id);
    if (x.gems < L[1]) { q.out.push('Не вистачає ' + money(L[1] - x.gems) + ' 💎'); return; }
    x.gems = money(x.gems - L[1]); dayAdd(st, id, 'style', L[1]);
    st.lookOwn = st.lookOwn || {}; st.lookOwn[id] = st.lookOwn[id] || {}; st.lookOwn[id][kind + ':' + key] = dayKey(Date.now(), st.cfg);
    q.out.push('✨ Куплено за ' + L[1] + ' 💎 і вдягнуто!');
    const pe = st.people[id]; if (pe && L[1] >= 30) sayK(st, 'look:' + id, '✨ ' + esc(pe.name) + ' ' + verb(pe, 'оновив', 'оновила') + ' свій стиль: ' + (kind === 'av' ? key : (L[2] || '')) + ' 💅');
  } else q.out.push('👌 Вдягнуто');
  st.look[id][kind] = key;
}
function appPeople(st) { return Object.keys(st.people).map(function (u) { return { id: u, name: nameOf(st, u), look: lookOf(st, u), owner: String(u) === String(st.owner) }; }); }
function appLooks(st, id) {
  const p = st.people[id] || {};
  return Object.keys(LOOKS).reduce(function (o, k) { o[k] = LOOKS[k].map(function (x) { return { key: x[0], price: x[1], label: k === 'ti' && p.female === false && x[3] ? x[3] : x[2] || '', own: lookOwns(st, id, k, x[0]) }; }); return o; }, {});
}
// 🔁 trades for the app: the same deals as in the bot (st.trades)
function trUnit(key) { return key === 'uah' || key === 'cash' ? 'грн' : key === 'gem' ? '💎' : key.indexOf('s_') === 0 ? 'грн частки' : 'шт'; }
function trIcon(st, key) { const it = key.indexOf('c_') === 0 ? shopItem(key.slice(2)) : null; return { uah: '💰', gem: '💎', ice: '🍦', vac: '🏖', cash: '💵', frz: '❄️', food: '🍖' }[key] || (it ? it.icon : '🏡'); }
function trItem(st, key, n) { return { key: key, n: n, icon: trIcon(st, key), label: trName(st, key).replace(/^\S+\s/, ''), unit: trUnit(key), pct: trPlot(st, key) ? money(n / trPlot(st, key).price * 100) : null }; }
function appTrades(st, id) {
  const has = function (u) { return trKeys(st, u).map(function (k) { return Object.assign(trItem(st, k, trHave(st, u, k)), { step: trSteps(st, k).filter(function (x) { return x[0] > 0; })[0][0] }); }); };
  return (st.trades || []).filter(function (t) { return String(t.a) === id || String(t.b) === id; }).map(function (t) {
    const o = trOther(t, id), side = function (u) { const g = t.give[u] || {}; return Object.keys(g).filter(function (k) { return g[k] > 0; }).map(function (k) { return trItem(st, k, g[k]); }); };
    return { id: t.id, other: o, sent: !!t.sent, mine: String(t.turn) === id, theyAgreed: !!(t.agreed || {})[o], give: side(id), get: side(o), myHave: has(id), theirHave: has(o) };
  });
}
function appTrade(st, user, a, q) {
  const id = String(user.id), op = String(a.op), noop = function () {};
  if (op === 'new') {
    const to = String(a.to);
    if (!st.people[to] || to === id) { q.out.push('Немає такої людини'); return; }
    if (st.trades.filter(function (t) { return String(t.a) === id; }).length >= TRADE_MAX) { q.out.push('Забагато відкритих угод'); return; }
    st.tradeSeq = (st.tradeSeq || 0) + 1;
    const t = { id: 't' + st.tradeSeq, a: id, b: to, give: {}, turn: id, agreed: {}, sent: false, at: Date.now() };
    t.give[t.a] = {}; t.give[t.b] = {}; st.trades.push(t); q.res = { tid: t.id }; return;
  }
  const t = trById(st, String(a.tid));
  if (!t || (String(t.a) !== id && String(t.b) !== id)) { q.out.push('Цієї угоди вже немає'); return; }
  if (op === 'set') {
    if (String(t.turn) !== id) { q.out.push('Зараз черга ' + nameOf(st, trOther(t, id))); return; }
    const u = a.who === 'm' ? id : trOther(t, id), key = String(a.key), h = trHave(st, u, key), n = money(Math.max(0, Math.min(h, +a.n || 0)));
    if (trKeys(st, u).indexOf(key) < 0 && !(t.give[u] || {})[key]) { q.out.push('Цього немає'); return; }
    t.give[u] = t.give[u] || {}; if (n > 0) t.give[u][key] = n; else delete t.give[u][key];
    t.agreed = {}; return;
  }
  if (['send', 'ok', 'no'].indexOf(op) >= 0) { q.message = { text: '' }; onTrade(st, user, ['tr', op, t.id], q, noop, true); return; }
  q.out.push('?');
}
// 📊 the whole farm: everyone side by side (a bit of competition)
function appFarmStats(st, now) {
  const day = dayKey(now, st.cfg), wk = 'w:' + weekKey(day), mo = 'm:' + monthKey(now);
  const pick = function (key, u) { const r = (st.stats[key] || {})[u]; return { n: r ? r.n : 0, uah: r ? money(r.g !== undefined ? r.g : r.uah) : 0 }; };
  const days = []; for (let i = 13; i >= 0; i--) days.push(dayKey(now - i * 86400000, st.cfg));
  const people = Object.keys(st.people).map(function (u) {
    const p = st.people[u], tasks = Object.keys(st.gemLog || {}).reduce(function (a, d) { const n = ((st.gemLog[d] || {})[u] || {}).n || {}; return a + Object.keys(n).reduce(function (b, k) { return b + n[k]; }, 0); }, 0);
    return { id: u, norm: p.norm || 0, today: pick('d:' + day, u), week: pick(wk, u), month: pick(mo, u), all: { n: harvestsRaw(st, u), uah: money(earnedRaw(st, u)) },
      streak: streakOf(st, u, now), best: bestStreak(st, u), bestDay: bestDay(st, u), ach: Object.keys(st.ach[u] || {}).length, tasks7: tasks,
      normDays: days.filter(function (d) { const r = (st.stats['d:' + d] || {})[u]; return r && p.norm && (r.g !== undefined ? r.g : r.uah) >= p.norm; }).length,
      land: money((st.cfg.iplots || []).reduce(function (a, pl) { return a + (pl.shares[u] || 0); }, 0)),
      fun: (function () { // the kid-friendly numbers: crystals earned / spent, style items, pet XP, money invested
        const sum = function (from, k) { return money(Object.keys(st.dayLog || {}).filter(function (d) { return d >= from; }).reduce(function (a, d) { return a + (((st.dayLog[d] || {})[u] || {})[k] || 0); }, 0)); };
        const own = (st.lookOwn || {})[u] || {}, looks = function (from) { return Object.keys(own).filter(function (k) { return own[k] >= from; }).length; };
        const w = weekKey(day), m = monthKey(now) + '-01';
        return { today: { gin: sum(day, 'gin'), gout: sum(day, 'gout'), xp: sum(day, 'xp'), inv: sum(day, 'inv'), looks: looks(day) },
          week: { gin: sum(w, 'gin'), gout: sum(w, 'gout'), xp: sum(w, 'xp'), inv: sum(w, 'inv'), looks: looks(w) },
          month: { gin: sum(m, 'gin'), gout: sum(m, 'gout'), xp: sum(m, 'xp'), inv: sum(m, 'inv'), looks: looks(m) },
          all: { gin: sum('', 'gin'), gout: sum('', 'gout'), xp: sum('', 'xp'), inv: sum('', 'inv'), looks: Object.keys(own).length } };
      })(),
      normPct: p.norm ? Math.round(pick('d:' + day, u).uah / p.norm * 100) : 0,
      days: days.map(function (d) { return pick('d:' + d, u).uah; }) };
  });
  const tot = function (k) { return people.reduce(function (a, p) { return { n: a.n + p[k].n, uah: money(a.uah + p[k].uah) }; }, { n: 0, uah: 0 }); };
  return { days: days, people: people, farm: { today: tot('today'), week: tot('week'), month: tot('month'), all: tot('all'), bank: money(st.bank || 0), plots: (st.cfg.iplots || []).length } };
}
function appMe(st, id, now) { // 👤 stats, records, the family this week, the next achievements, the inventory
  const day = dayKey(now, st.cfg), wk = 'w:' + weekKey(day), mo = 'm:' + monthKey(now);
  const pick = function (key, u) { const r = (st.stats[key] || {})[u || id]; return { n: r ? r.n : 0, uah: r ? money(r.g !== undefined ? r.g : r.uah) : 0 }; };
  const days = []; for (let i = 6; i >= 0; i--) { const d = dayKey(now - i * 86400000, st.cfg); days.push(Object.assign({ day: d }, pick('d:' + d))); }
  const mine = st.ach[id] || {}, x = inv(st, id);
  return {
    claim: achUnpaid(st, id).map(function (k) { return Object.assign({ key: k }, achLabel(st, id, k)); }), achGem: st.cfg.achGem || 1, gemUah: st.cfg.gemUah,
    today: pick('d:' + day), week: pick(wk), month: pick(mo), days: days,
    rec: { bestStreak: bestStreak(st, id), bestDay: bestDay(st, id), harvests: harvestsRaw(st, id), earned: money(earnedRaw(st, id)) },
    family: Object.keys(st.people).map(function (u) { const w = pick(wk, u); return { id: u, name: nameOf(st, u), color: colorOf(st, u), uah: w.uah, n: w.n, me: u === String(id) }; })
      .sort(function (a, b) { return b.uah - a.uah; }),
    ach: { got: Object.keys(mine).length, total: ACH_GROUPS.reduce(function (a, g) { return a + g.steps.length; }, 0) + 1,
      next: ACH_GROUPS.map(function (g) { const v = g.of(st, id), i = g.steps.findIndex(function (s, k) { return !mine[achId(g, k)]; });
        const last = g.steps.filter(function (s, k) { return mine[achId(g, k)]; }).pop(), paid = (st.achPaid || {})[id] || {};
        const ci = g.steps.findIndex(function (s, k) { return mine[achId(g, k)] && !paid[achId(g, k)]; });
        return { title: g.title, v: money(v), unit: g.unit, need: i >= 0 ? g.steps[i][0] : null, icon: i >= 0 ? g.steps[i][1] : (last ? last[1] : '🏅'), name: i >= 0 ? achName(st, id, g.steps[i]) : 'Усе зібрано!', from: i > 0 ? g.steps[i - 1][0] : 0,
          done: g.steps.filter(function (s, k) { return mine[achId(g, k)]; }).length, steps: g.steps.length,
          claim: ci >= 0 ? { key: achId(g, ci), icon: g.steps[ci][1], name: achName(st, id, g.steps[ci]) } : null }; }),
      first: mine.first ? { key: 'first', paid: !!(((st.achPaid || {})[id] || {}).first) } : null },
    items: [].concat(
      x.gift.length ? [{ what: 'prize', icon: '🎁', label: 'Невідкритий приз', n: x.gift.length, act: 'Відкрити' }] : [],
      x.ice ? [{ what: 'ice', icon: '🍦', label: 'Морозиво', n: x.ice, act: 'Хочу!' }] : [],
      x.vac.length ? [{ what: 'vac', icon: '🏖', label: 'Відпустка (' + money(x.vac[0]) + ' грн)', n: x.vac.length, act: 'Сьогодні' }] : [],
      x.cash ? [{ what: 'cash', icon: '💰', label: 'Грошовий приз', n: money(x.cash), unit: 'грн', act: 'Забрати' }] : [],
      Object.keys(x.coupons).filter(function (k) { return x.coupons[k] > 0 && shopItem(k); }).map(function (k) { const it = shopItem(k); return { what: 'cpn_' + k, icon: it.icon, label: it.label, n: x.coupons[k], act: 'Використати' }; }),
      x.freeze ? [{ what: '', icon: '❄️', label: 'Заморозка стріку', n: x.freeze, note: 'спрацює сама' }] : [],
      x.food ? [{ what: '', icon: '🍖', label: 'Корм', n: x.food, note: 'для улюбленця' }] : []),
  };
}
function appState(st, id) {
  const now = Date.now(), p = st.people[id], x = inv(st, id), n = streakOf(st, id, now), today = shopToday(st, id);
  const pet = petOf(st, id), ok = petOk(pet), P = st.cfg.pet;
  const shop = shopFor(st, id);
  return {
    me: { id: id, name: p.name, female: !!p.female, color: colorOf(st, id), owner: String(id) === String(st.owner),
      gems: x.gems, balance: money(st.balance[id] || 0), streak: n, done: money(doneToday(st, id, now)), norm: p.norm || 0,
      invest: money(myShares(st, id).reduce(function (a, pl) { return a + offerDaily(st, pl) * shareOf(pl, id); }, 0) * 30),
      wallet: money((st.invWallet || {})[id] || 0) },
    pet: ok ? { kind: pet.kind, icon: PET_KINDS[pet.kind].icon, name: pet.name, female: !!pet.female, level: petLevel(pet), xp: pet.xp,
      xpFrom: PET_XP[petLevel(pet) - 1] || 0, xpTo: PET_XP[petLevel(pet)] || null, fed: Math.round(pet.fed), min: P.min, help: petPct(st, pet),
      trainedToday: pet.trainDay === dayKey(now, st.cfg), finds: pet.finds || 0, found: money(pet.found || 0),
      slots: PET_SLOTS.map(function (s) { return { id: s.id, title: s.title, lvl: s.lvl, open: petLevel(pet) >= s.lvl, wear: (pet.wear || {})[s.id] || null,
        items: s.items.map(function (it) { return { id: it[0], icon: it[1], label: it[2], own: ((pet.own || {})[s.id] || []).indexOf(it[0]) >= 0 }; }) }; }),
      cloth: priceOf(st, { price: P.cloth }) } : null,
    shop: { season: seasonOn(st, 'gems'), boost: SEASON_BOOST, daily: st.cfg.shopDaily, rise: st.cfg.shopRise,
      items: shop.map(function (it) { const open = n >= it.need, on = today.indexOf(it.id) >= 0;
        return open && !on ? null : { id: open ? it.id : null, icon: open ? it.icon : '🔒', label: open ? it.label : null, hint: open ? it.hint || '' : '',
          need: it.need, open: open, price: priceOf(st, it), base: it.base, times: it.times }; }).filter(Boolean),
      resting: shop.filter(function (it) { return n >= it.need && today.indexOf(it.id) < 0; }).length,
      food: { price: priceOf(st, { price: P.food }), pack: P.pack, packN: P.packN } },
    inv: { food: x.food, ice: x.ice, vac: x.vac.length, cash: money(x.cash), freeze: x.freeze, gifts: x.gift.length,
      coupons: Object.keys(x.coupons).filter(function (k) { return x.coupons[k] > 0 && shopItem(k); }).map(function (k) { const it = shopItem(k); return { id: k, icon: it.icon, label: it.label, n: x.coupons[k] }; }) },
    gemUah: st.cfg.gemUah,
    farm: appFarm(st, id, now), tasks: appTasks(st, id), invest: appInvest(st, id), my: appMe(st, id, now), people: appPeople(st), looks: appLooks(st, id), trades: appTrades(st, id), fstats: appFarmStats(st, now), contest: appContest(st, id, now), boosts: boostState(st, id, now), excl: Object.keys(EXCL).map(function (k) { const e = exclHolder(st, k); return { key: k, icon: EXCL[k].icon, label: EXCL[k].label, price: EXCL[k].price, holder: e ? e.uid : null, until: e ? e.until : 0 }; }),
  };
}

// ---------------------------------------------------------------- 🔁 TRADE
// Anyone can offer a deal to anyone: UAH, crystals, inventory items or a piece of a plot share, for something back
// (or nothing: a gift). The deal goes back and forth: whoever's turn it is may accept, change it (then the other side
// has to agree again) or decline. When both agreed, everything moves at once, if both still have what they give.
// st.trades = [{ id, a, b, give: { uid: { key: amount } }, turn: uid, agreed: { uid: true }, sent: bool, at }]
// keys: uah, gem, ice, vac, cash, frz, c_<shop item>, s_<plot id> (share in UAH of the plot's price)
const TRADE_MAX = 10; // open deals at once
function trById(st, tid) { return st.trades.filter(function (t) { return t.id === tid; })[0]; }
function trOther(t, id) { return String(t.a) === String(id) ? String(t.b) : String(t.a); }
function trPlot(st, key) { return key.indexOf('s_') === 0 ? (st.cfg.iplots || []).filter(function (p) { return p.id === key.slice(2); })[0] : null; }
function trHave(st, id, key) {
  const x = inv(st, id);
  if (key === 'uah') return money(st.balance[id] || 0);
  if (key === 'gem') return x.gems;
  if (key === 'ice') return x.ice;
  if (key === 'vac') return x.vac.length;
  if (key === 'cash') return money(x.cash);
  if (key === 'frz') return x.freeze;
  if (key === 'food') return x.food;
  if (key.indexOf('c_') === 0) return x.coupons[key.slice(2)] || 0;
  const p = trPlot(st, key); return p ? money(p.shares[id] || 0) : 0;
}
function trKeys(st, id) { // what this person could give now
  const x = inv(st, id), keys = ['uah', 'gem', 'food', 'ice', 'vac', 'cash', 'frz'].concat(Object.keys(x.coupons).map(function (k) { return 'c_' + k; }))
    .concat((st.cfg.iplots || []).map(function (p) { return 's_' + p.id; }));
  return keys.filter(function (k) { return trHave(st, id, k) > 0; });
}
function trName(st, key) {
  const it = key.indexOf('c_') === 0 ? shopItem(key.slice(2)) : null, p = trPlot(st, key);
  return { uah: '💰 Гривні', gem: GEM + ' Кристали', ice: '🍦 Морозиво', vac: '🏖 Відпустка', cash: '💵 Грошовий приз', frz: '❄️ Заморозка стріку', food: '🍖 Корм' }[key] ||
    (it ? it.icon + ' ' + it.label : p ? '🏡 Частка «' + p.name + '»' : key);
}
function trLabel(st, key, n) { // one line of a deal
  const p = trPlot(st, key);
  if (key === 'uah' || key === 'cash') return trName(st, key) + ': ' + b(money(n) + ' грн');
  if (key === 'gem') return GEM + ' ' + b(n) + ' ' + plural(n, ['кристал', 'кристали', 'кристалів']);
  if (p) return '🏡 ' + b(pct1(n / p.price)) + ' «' + esc(p.name) + '» (' + money(n) + ' грн, ≈ +' + mon(offerDaily(st, p) * n / p.price) + ' грн/міс)';
  return trName(st, key) + ' × ' + b(n);
}
function pct1(x) { const v = Math.round(x * 1000) / 10; return v + '%'; }
function trSide(st, t, id) { const g = t.give[id] || {}, k = Object.keys(g).filter(function (k) { return g[k] > 0; }); return k.length ? k.map(function (k) { return '   ' + trLabel(st, k, g[k]); }).join('\n') : '   нічого'; }
function trEmpty(t) { return !Object.keys(t.give).some(function (id) { return Object.keys(t.give[id]).some(function (k) { return t.give[id][k] > 0; }); }); }
function trShort(st, t, id) { // "💰 20 грн + 💎 5" for lists
  const g = t.give[id] || {}, k = Object.keys(g).filter(function (k) { return g[k] > 0; });
  return k.length ? k.map(function (k) { return trLabel(st, k, g[k]).replace(/<\/?b>/g, '').replace(/ \(.*\)$/, ''); }).join(' + ') : 'нічого';
}
function tradeHome(st, id) {
  const mine = st.trades.filter(function (t) { return String(t.a) === id || String(t.b) === id; });
  const rows = mine.map(function (t) {
    const o = trOther(t, id), my = String(t.turn) === id;
    return [button((my ? '🔔 ' : '⏳ ') + nameOf(st, o) + ': ' + (t.sent ? (my ? 'чекає тебе' : 'чекаю відповідь') : 'чернетка'), 'tr:v:' + t.id)];
  });
  rows.push([button('➕ Нова угода', 'tr:new')]);
  return { text: '🔁 ' + b('Торгівля') + '\nОбмінюйся з родиною: гривні, кристали, речі з інвентаря чи частка ділянки. Можна і просто подарувати 🎁\n\n' +
    (mine.length ? 'Твої угоди:\n🔔 — твоя черга відповісти · ⏳ — чекаємо іншого' : 'Поки угод немає.'), kb: withBack({ inline_keyboard: rows }, 'trade') };
}
function tradeView(st, t, id) {
  const o = trOther(t, id), my = String(t.turn) === id, rows = [];
  let text = '🔁 ' + b('Угода з ' + nameOf(st, o)) + '\n\n📤 ' + b('Ти віддаєш:') + '\n' + trSide(st, t, id) + '\n\n📥 ' + b('Ти отримуєш:') + '\n' + trSide(st, t, o);
  if (!t.sent) text += '\n\nДодай, що віддаєш і що хочеш отримати. Потім надішли — ' + esc(nameOf(st, o)) + ' прийме або запропонує зміни.';
  else if (my && t.agreed[o]) text += '\n\n' + esc(nameOf(st, o)) + ' вже ' + verb(st.people[o], 'згоден', 'згодна') + '. Приймеш — і все переміститься одразу.';
  else if (my) text += '\n\nТи ' + verb(st.people[id], 'змінив', 'змінила') + ' угоду. Надішли її назад — ' + esc(nameOf(st, o)) + ' має погодитись.';
  else text += '\n\n⏳ Чекаємо, що скаже ' + esc(nameOf(st, o)) + '.';
  if (my) {
    rows.push([button('📤 + Віддати…', 'tr:add:' + t.id + ':m'), button('📥 + Отримати…', 'tr:add:' + t.id + ':o')]);
    const edits = [];
    [id, o].forEach(function (u) { Object.keys(t.give[u] || {}).forEach(function (k) { if (t.give[u][k] > 0) edits.push(button('✏️ ' + trName(st, k).split(' ')[0] + (u === id ? ' 📤' : ' 📥'), 'tr:pick:' + t.id + ':' + (u === id ? 'm' : 'o') + ':' + k)); }); });
    for (let i = 0; i < edits.length; i += 3) rows.push(edits.slice(i, i + 3));
    if (t.sent && t.agreed[o]) rows.push([button('✅ Прийняти угоду', 'tr:ok:' + t.id)]);
    else rows.push([button('📨 Надіслати ' + nameOf(st, o), 'tr:send:' + t.id)]);
  }
  rows.push([button(t.sent ? '❌ Відмовитись від угоди' : '🗑 Видалити чернетку', 'tr:no:' + t.id), button('⬅️ Торгівля', 'menu:trade')]);
  return { text: text, kb: { inline_keyboard: rows } };
}
function tradeAddView(st, t, id, side) { // what can be added: the giver's things
  const u = side === 'm' ? id : trOther(t, id), keys = trKeys(st, u);
  const rows = keys.map(function (k) { return [button(trName(st, k) + ' (є ' + (k.indexOf('s_') === 0 ? pct1(trHave(st, u, k) / trPlot(st, k).price) : trHave(st, u, k) + (k === 'uah' || k === 'cash' ? ' грн' : '')) + ')', 'tr:pick:' + t.id + ':' + side + ':' + k)]; });
  rows.push([button('⬅️ До угоди', 'tr:v:' + t.id)]);
  return { text: (side === 'm' ? '📤 Що ти віддаєш?' : '📥 Що хочеш отримати від ' + esc(nameOf(st, u)) + '?') + (keys.length ? '' : '\n\nУ ' + (side === 'm' ? 'тебе' : esc(nameOf(st, u))) + ' поки нічого немає для обміну.'), kb: { inline_keyboard: rows } };
}
function trSteps(st, key) {
  const p = trPlot(st, key);
  if (p) return [[-0.1, '−10%'], [-0.05, '−5%'], [-0.01, '−1%'], [0.01, '+1%'], [0.05, '+5%'], [0.1, '+10%']].map(function (x) { return [money(x[0] * p.price), x[1]]; });
  if (key === 'uah' || key === 'cash') return [[-50, '−50'], [-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10'], [50, '+50']];
  if (key === 'gem') return [[-10, '−10'], [-5, '−5'], [-1, '−1'], [1, '+1'], [5, '+5'], [10, '+10']];
  return [[-1, '−1'], [1, '+1']];
}
function tradeAmtView(st, t, id, side, key) {
  const u = side === 'm' ? id : trOther(t, id), have = trHave(st, u, key), n = (t.give[u] || {})[key] || 0, p = trPlot(st, key);
  const steps = trSteps(st, key), pre = 'tr:amt:' + t.id + ':' + side + ':' + key + ':', rows = [];
  for (let i = 0; i < steps.length; i += 3) rows.push(steps.slice(i, i + 3).map(function (x) { return button(x[1], pre + x[0]); }));
  rows.push([button('Все (' + (p ? pct1(have / p.price) : have) + ')', pre + 'all'), button('🗑 Прибрати', pre + 'zero')]);
  rows.push([button('✅ Готово', 'tr:v:' + t.id)]);
  return { text: (side === 'm' ? '📤 Ти віддаєш' : '📥 Ти отримуєш від ' + esc(nameOf(st, u))) + '\n' + trName(st, key) + '\n\nЗараз: ' + (n > 0 ? trLabel(st, key, n) : '0') +
    '\nЄ у ' + (side === 'm' ? 'тебе' : esc(nameOf(st, u))) + ': ' + (p ? pct1(have / p.price) + ' (' + money(have) + ' грн)' : have + (key === 'uah' || key === 'cash' ? ' грн' : '')), kb: { inline_keyboard: rows } };
}
function trNotice(st, t, text) { // a short note in the chat with a button for both sides
  sayK(st, 'trade:' + t.id, text, { inline_keyboard: [[button('👀 Відкрити угоду', 'tr:v:' + t.id)]] });
}
function trMove(st, from, to, key, n) {
  const x = inv(st, from), y = inv(st, to), p = trPlot(st, key);
  if (key === 'uah') { st.balance[from] = money((st.balance[from] || 0) - n); st.balance[to] = money((st.balance[to] || 0) + n); }
  else if (key === 'gem') { x.gems -= n; y.gems += n; }
  else if (key === 'ice') { x.ice -= n; y.ice += n; }
  else if (key === 'vac') { y.vac = y.vac.concat(x.vac.splice(0, n)); }
  else if (key === 'cash') { x.cash = money(x.cash - n); y.cash = money(y.cash + n); }
  else if (key === 'frz') { x.freeze -= n; y.freeze += n; }
  else if (key === 'food') { x.food -= n; y.food += n; }
  else if (key.indexOf('c_') === 0) { const k = key.slice(2); x.coupons[k] -= n; if (!x.coupons[k]) delete x.coupons[k]; y.coupons[k] = (y.coupons[k] || 0) + n; }
  else if (p) { p.shares[from] = money(p.shares[from] - n); if (p.shares[from] <= 0.004) delete p.shares[from]; p.shares[to] = money((p.shares[to] || 0) + n); }
}
function trClose(st, t) { st.trades = st.trades.filter(function (x) { return x !== t; }); }
function onTrade(st, user, parts, q, edit, eph) {
  const id = String(user.id), act = parts[1], show = function (v) { if (eph) edit(v.text, v.kb); else sayTo(st, id, v.text, v.kb, q, 'trade'); };
  if (!st.people[id]) { toast(q, 'Спершу натисни ▶️ Почати день у /menu'); return; }
  if (act === 'new') {
    toast(q, '');
    const others = Object.keys(st.people).filter(function (k) { return k !== id; });
    show({ text: '🔁 ' + b('Нова угода') + '\nЗ ким торгуємо?', kb: { inline_keyboard: others.map(function (k) { return [button(colorOf(st, k) + ' ' + nameOf(st, k), 'tr:to:' + k)]; }).concat([[button('⬅️ Торгівля', 'menu:trade')]]) } });
    return;
  }
  if (act === 'to') {
    if (!st.people[parts[2]] || parts[2] === id) { toast(q, 'Немає такої людини'); return; }
    const open = st.trades.filter(function (t) { return String(t.a) === id; }).length;
    if (open >= TRADE_MAX) { toast(q, 'Забагато відкритих угод. Заверши якусь 🙂'); return; }
    st.tradeSeq = (st.tradeSeq || 0) + 1;
    const t = { id: 't' + st.tradeSeq, a: id, b: String(parts[2]), give: {}, turn: id, agreed: {}, sent: false, at: Date.now() };
    t.give[t.a] = {}; t.give[t.b] = {};
    st.trades.push(t); toast(q, ''); show(tradeView(st, t, id)); return;
  }
  const t = trById(st, parts[2]);
  if (!t) { toast(q, 'Цієї угоди вже немає'); show(tradeHome(st, id)); return; }
  if (String(t.a) !== id && String(t.b) !== id) { toast(q, 'Це не твоя угода 🙂'); return; }
  const o = trOther(t, id), my = String(t.turn) === id, pe = person(st, user);
  if (act === 'v') { toast(q, ''); show(tradeView(st, t, id)); return; }
  if (act === 'no') {
    trClose(st, t); toast(q, t.sent ? 'Угоду скасовано' : 'Чернетку видалено');
    if (t.sent) sayK(st, 'trade:' + t.id, '🔁 ' + esc(pe.name) + ' ' + verb(pe, 'скасував', 'скасувала') + ' угоду з ' + esc(nameOf(st, o)) + '.');
    show(tradeHome(st, id)); return;
  }
  if (!my) { toast(q, '⏳ Зараз черга ' + nameOf(st, o)); show(tradeView(st, t, id)); return; }
  const side = parts[3], key = parts[4], u = side === 'm' ? id : o;
  if (act === 'add') { toast(q, ''); show(tradeAddView(st, t, id, side)); return; }
  if (act === 'pick') {
    if (!((t.give[u] || {})[key] > 0)) { const h = trHave(st, u, key), st1 = trSteps(st, key).filter(function (x) { return x[0] > 0; })[0][0]; t.give[u][key] = Math.min(h, st1); t.agreed = {}; }
    toast(q, ''); show(tradeAmtView(st, t, id, side, key)); return;
  }
  if (act === 'amt') {
    const h = trHave(st, u, key), d = parts[5], cur = t.give[u][key] || 0;
    t.give[u][key] = d === 'all' ? h : d === 'zero' ? 0 : money(Math.max(0, Math.min(h, cur + +d)));
    if (!t.give[u][key]) delete t.give[u][key];
    t.agreed = {}; toast(q, '');
    if (d === 'zero') show(tradeView(st, t, id)); else show(tradeAmtView(st, t, id, side, key)); return;
  }
  if (act === 'send') {
    if (trEmpty(t)) { toast(q, 'Угода порожня: додай, що віддаєш або що хочеш'); return; }
    const first = !t.sent;
    t.sent = true; t.agreed = {}; t.agreed[id] = true; t.turn = o; t.at = Date.now();
    toast(q, '📨 Надіслано ' + nameOf(st, o));
    trNotice(st, t, '🔁 ' + esc(pe.name) + (first ? ' пропонує угоду ' : ' ' + verb(pe, 'змінив', 'змінила') + ' угоду з ') + esc(nameOf(st, o)) + ':\n📤 ' + esc(trShort(st, t, id)) + '\n📥 ' + esc(trShort(st, t, o)) +
      '\n\n' + esc(nameOf(st, o)) + ', твоя черга: прийняти, змінити або відмовитись.');
    show(tradeView(st, t, id)); return;
  }
  if (act === 'ok') {
    if (!t.agreed[o]) { toast(q, 'Спершу надішли угоду — ' + nameOf(st, o) + ' має погодитись'); return; }
    const lack = [];
    [t.a, t.b].forEach(function (g) { Object.keys(t.give[g]).forEach(function (k) { if (t.give[g][k] > trHave(st, g, k) + 0.004) lack.push(nameOf(st, g) + ': ' + trName(st, k)); }); });
    if (lack.length) { toast(q, 'Не вистачає: ' + lack.join(', ')); show(tradeView(st, t, id)); return; }
    [t.a, t.b].forEach(function (g) { const r = trOther(t, g); Object.keys(t.give[g]).forEach(function (k) { if (t.give[g][k] > 0) trMove(st, g, r, k, t.give[g][k]); }); });
    trClose(st, t); toast(q, '🤝 Угоду укладено!');
    sayK(st, 'trade:' + t.id, '🤝 ' + b('Угоду укладено!') + '\n' + esc(nameOf(st, t.a)) + ' → ' + esc(nameOf(st, t.b)) + ': ' + esc(trShort(st, t, t.a)) +
      '\n' + esc(nameOf(st, t.b)) + ' → ' + esc(nameOf(st, t.a)) + ': ' + esc(trShort(st, t, t.b)));
    refreshOffer(st); show(tradeHome(st, id)); return;
  }
}

// ---------------------------------------------------------------- webhook
function doPost(e) {
  if (e && e.parameter && e.parameter.app === '1') return appApi(e);
  if (e && e.parameter && e.parameter.update) { // GitHub Action after a push: ?update=<SECRET>
    if (e.parameter.update !== props().getProperty('SECRET')) return ok();
    try { const r = selfUpdate(e.parameter.sha || ''); const st = loadState(); if (st.owner) say(st.owner, r); } catch (err) { console.error(err); reportError(err); }
    return ok();
  } // 📱 Mini App requests (checked by Telegram's signature)
  try {
    const secretOk = !!e.parameter && e.parameter.k === props().getProperty('SECRET');
    console.log('doPost: secret ' + (secretOk ? 'ok' : 'MISMATCH (run setup() again)'));
    if (!secretOk) return ok();
    handleUpdate(JSON.parse(e.postData.contents));
  } catch (err) {
    console.error(err);
    reportError(err);
  }
  return ok();
}
// Fallback mode (setupPolling): every minute fetch new updates from Telegram, if the webhook ever misbehaves.
function poll() {
  const last = +(props().getProperty('LAST_UPDATE') || 0);
  const r = tg('getUpdates', { offset: last + 1, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  (r.result || []).forEach(function (u) {
    try { handleUpdate(u); } catch (err) { console.error(err); }
  });
}
// Something broke: tell the owner privately (at most once in 10 minutes), so a silent bot never goes unnoticed.
function reportError(err) {
  try {
    const p = props(), last = +(p.getProperty('ERR_AT') || 0), owner = (JSON.parse(readState() || '{}')).owner;
    if (!owner || Date.now() - last < 600000) return;
    p.setProperty('ERR_AT', String(Date.now()));
    tg('sendMessage', { chat_id: owner, text: '⚠️ Помилка в боті:\n' + String(err && err.stack || err).slice(0, 1500) });
  } catch (e) { console.error(e); }
}
function handleUpdate(u) {
  withLock(function () {
    const last = +(props().getProperty('LAST_UPDATE') || 0); // every update is handled once
    if (u.update_id && u.update_id <= last) { console.log('duplicate update ' + u.update_id + ', skipped'); return; }
    if (u.update_id) props().setProperty('LAST_UPDATE', String(u.update_id));
    if (u.callback_query) onButton(u.callback_query);
    else if (u.message && (u.message.animation || u.message.sticker || u.message.photo)) onMedia(u.message);
    else if (u.message && u.message.text) onMessage(u.message);
    else if (u.message && (u.message.migrate_to_chat_id || u.message.migrate_from_chat_id)) onMessage(Object.assign({ text: '' }, u.message));
  });
}
// HtmlService answers 200 directly; ContentService makes Apps Script answer with a 302 redirect, which Telegram
// treats as a failed delivery (it then re-sends the update and holds back newer ones).
function ok() { return HtmlService.createHtmlOutput('ok'); }
function doGet() { return ok(); }

function onButton(q) {
  const st = loadState();
  const now = Date.now(), user = q.from, chat = q.message.chat.id, mid = q.message.message_id;
  const parts = String(q.data).split(':'), action = parts[0];
  const isOwner = st.owner && String(user.id) === String(st.owner);
  const eph = q.message.ephemeral_message_id; // a button in a message only this user sees
  if (catchUpStreaks(st, now)) saveState(st);
  const edit = function (html, markup) {
    if (eph) tg('editEphemeralMessageText', { chat_id: chat, receiver_user_id: user.id, ephemeral_message_id: eph, text: html, parse_mode: 'HTML', reply_markup: markup || { inline_keyboard: [] } });
    else tg('editMessageText', { chat_id: chat, message_id: mid, text: html, parse_mode: 'HTML', reply_markup: markup || { inline_keyboard: [] } });
  };
  const old = toHtml(q.message);

  if (action === 'noop') { toast(q, ''); return; }
  if (action === 'set') { // settings panel in the owner's private chat
    if (!isOwner) { toast(q, 'Налаштування міняє лише власник'); return; }
    const page = applySetting(st, parts);
    saveState(st); toast(q, parts[1] === 'page' ? '' : 'Збережено'); edit(settingsText(st, page), settingsKeyboard(st, page)); return;
  }
  if (action === 'ivdone' || action === 'ivcancel') { // the owner, private chat
    const o = offerById(st, parts[1]);
    if (!isOwner || !o) { toast(q, 'Немає відкритого збору'); return; }
    if (action === 'ivdone' && offerSum(o) < o.price - 0.005) { toast(q, 'Ще не 100%: зібрано ' + money(offerSum(o)) + ' з ' + o.price + ' грн'); return; }
    closeOffer(st, o, action === 'ivdone'); saveState(st); toast(q, action === 'ivdone' ? '🎉' : 'Скасовано');
    edit(settingsText(st, 'invest'), settingsKeyboard(st, 'invest')); return;
  }
  if (action === 'sn') { // seasons, the owner's private chat
    if (!isOwner) { toast(q, 'Сезони обирає власник'); return; }
    onSeasonButton(st, parts, q, edit); saveState(st); return;
  }
  if (action === 'tok' || action === 'tno') { // crystal tasks, the owner's private chat
    if (!isOwner) { toast(q, 'Підтверджує лише власник'); return; }
    decideTasks(st, action === 'tok', parts[1], q, edit); saveState(st); return;
  }
  if (action === 'petok' || action === 'petno') { // the pet quest: the owner confirms the Daru form, private chat
    if (!isOwner) { toast(q, 'Підтверджує лише власник'); return; }
    const done = petApprove(st, parts[1], action === 'petok');
    toast(q, done ? (action === 'petok' ? '🐾 Підтверджено' : 'Ок') : 'Вже вирішено');
    edit(old + '\n' + (done ? (action === 'petok' ? '✅ Підтверджено' : '❌ Ще ні') : '—')); saveState(st); return;
  }
  if (action === 'news') { // the owner publishes the announcement
    if (!isOwner || !st.group) { toast(q, 'Лише власник'); return; }
    postPetNews(st); toast(q, '📣 Надіслано'); edit('📣 Анонс надіслано в сімейний чат ✅'); return;
  }
  if (action === 'icebought') { toast(q, '😋'); edit(old + '\n✅ Куплено ' + hhmm(now)); if (st.group) sayK(st, 'ice', '🍦 ' + esc(nameOf(st, parts[1])) + ', морозиво вже чекає! 😋'); return; }
  if (String(chat) !== String(st.group)) { toast(q, 'Цей чат не прив\'язаний'); return; }
  if (/^g[wvjpx]$/.test(action)) { onGoalButton(st, user, parts, q, edit, eph); saveState(st); return; }
  const p = person(st, user);
  const kind = parts[1] === 'slot' ? 'plots' : parts[1];
  const K = KINDS[kind];

  if (action === 'here') { // "Я ТУТ! ЗАРАЗ ЗРОБЛЮ!"
    stopNag(st);
    armNag(st, st.cfg.snooze); // nobody harvested by then: nag again
    toast(q, 'Дякую, ' + p.name + '! Чекаю на «Зібрано!»');
    sayK(st, 'here', '🙋 ' + b(p.name) + ' тут і зараз зробить! Якщо за ' + minutesWords(st.cfg.snooze) + ' ніхто не збере, я знову почну кликати 😉');
    saveState(st); return;
  }
  if (action === 'payout') {
    const text = payout(st, user, now);
    saveState(st); toast(q, text.replace(/<[^>]+>/g, '')); sayTo(st, user.id, text, withBack(null, 'payout'), q, 'payout'); return;
  }
  if (action === 'menu') {
    toast(q, '');
    if (FOLDERS[kind]) { const v = folderView(kind, st, user.id); if (eph) edit(v.text, v.kb); else sayTo(st, user.id, v.text, v.kb, q); }
    else if (kind === 'season') sayTo(st, user.id, st.season ? seasonCard(st) : '😌 Зараз між сезонами — відпочиваємо. Новий сезон скоро!', null, q);
    else if (kind === 'close') { if (eph) tg('deleteEphemeralMessage', { chat_id: chat, receiver_user_id: user.id, ephemeral_message_id: eph }); }
    else if (kind === 'go') startDay(st);
    else if (kind === 'next') sayTo(st, user.id, nextText(st, now), null, q, 'next');
    else if (kind === 'early') sayTo(st, user.id, '🌾 Меню: що ти вже зібрав(ла)?', earlyKeyboard(st), q, 'early');
    else if (kind === 'back') { if (eph) edit('🌾 Меню: закрито', null); else edit(old, menuKeyboard(st)); }
    else if (kind === 'stats') sayTo(st, user.id, statsText(st, now), withBack(MONEY_BUTTON, 'stats'), q, 'stats');
    else if (kind === 'farm') sayTo(st, user.id, farmText(st) + '\n\n' + landText(st) + goalList(st).map(function (g) { return '\n\n' + goalCard(st, g); }).join(''), withBack(null, 'farm'), q, 'farm');
    else if (kind === 'pet') { if (eph) edit(petCard(st, String(user.id)), petKeyboard(st, String(user.id))); else sayTo(st, user.id, petCard(st, String(user.id)), petKeyboard(st, String(user.id)), q); }
    else if (kind === 'trade') { const v = tradeHome(st, String(user.id)); if (eph) edit(v.text, v.kb); else sayTo(st, user.id, v.text, v.kb, q, 'trade'); }
    else if (kind === 'myinv') { if (eph) edit(myInvText(st, String(user.id)), myInvKeyboard(st, String(user.id))); else sayTo(st, user.id, myInvText(st, String(user.id)), myInvKeyboard(st, String(user.id)), q, 'invest'); }
    else if (kind === 'invest') { if (eph) edit(famInvText(st), famInvKeyboard(st)); else sayTo(st, user.id, famInvText(st), famInvKeyboard(st), q, 'invest'); }
    else if (kind === 'table') { const w = weekKey(dayKey(now, st.cfg)); sendViewTo(st, user.id, weekView(st, w), weekKeyboard(st, w), q, 'table'); }
    else if (kind === 'inv') sayTo(st, user.id, invText(st, user.id), invKeyboard(st, user.id), q, 'inv');
    else if (kind === 'race') sayTo(st, user.id, raceStatus(st, now), withBack(null, 'race'), q, 'race');
    else if (kind === 'shop') sayTo(st, user.id, shopText(st, user.id), shopKeyboard(st, user.id), q, 'shop');
    else if (kind === 'earn') { if (eph) edit(earnPickText(st, user.id), earnPickKeyboard(st, user.id)); else sayTo(st, user.id, earnPickText(st, user.id), earnPickKeyboard(st, user.id), q, 'earn'); }
    else if (kind === 'faq') sayK(st, 'faq', faqText(), faqKeyboard());
    else if (kind === 'goals') { const v = goalsView(st, String(user.id)); if (eph) edit(v.text, v.kb); else sayTo(st, user.id, v.text, v.kb, q, 'goals'); } // questions are for everyone
    else if (kind === 'ach') { checkAch(st, String(user.id)); sayTo(st, user.id, achText(st, String(user.id)), withBack(null, 'ach'), q, 'ach'); saveState(st); }
    else if (kind === 'pause') {
      ['beds', 'plots'].forEach(function (k) { cancelTimer(st, k); closeReminder(st, k); });
      stopNag(st);
      sayK(st, 'pause', '😴 ' + esc(p.name) + ' ' + verb(p, 'поставив', 'поставила') + ' паузу: нагадувань про землю до завтра не буде. ' +
        'Щоб продовжити — ▶️ Почати день у /menu. Щоденні справи і підсумки дня прийдуть як завжди.');
      if (eph) edit('😴 Пауза до завтра увімкнена.', withBack(null, 'farmg'));
    } else if (kind === 'settings') { // old menus still have this button
      if (isOwner) say(st.owner, settingsText(st), settingsKeyboard(st));
    }
    saveState(st); return;
  }
  if (action === 'tab') { // statistics pages: tab:w:<monday> / tab:m:<yyyy-MM>
    toast(q, '');
    const v = parts[1] === 'm' ? monthView(st, parts[2]) : weekView(st, parts[2]), kb = parts[1] === 'm' ? monthKeyboard(st, parts[2]) : weekKeyboard(st, parts[2]);
    if (eph) editViewEph(chat, user.id, eph, v, kb); else editView(chat, mid, v, kb);
    return;
  }
  if (action === 'pet') { onPetButton(st, user, parts, q, edit, eph); saveState(st); return; }
  if (action === 'tr') { onTrade(st, user, parts, q, edit, eph); saveState(st); return; }
  if (action === 'prize') { openPrizes(st, user, q, old, edit); saveState(st); return; }
  if (action === 'inv') { useItem(st, user, parts[1], parts[2], q, edit); saveState(st); return; }
  if (action === 'food') { buyFood(st, user, parts[1], q, edit); saveState(st); return; }
  if (action === 'gemx') { gemExchange(st, user, parts[1], q, edit, eph); saveState(st); return; }
  if (action === 'buy') { buy(st, user, parts[1], parts[2], q, edit); saveState(st); return; }
  if (action === 'earng') { // ArcheRage or WoW tasks; remembered so a task press shows the same game again
    const g = GAMES[parts[1]] ? parts[1] : 'ar'; st.earnGame = st.earnGame || {}; st.earnGame[String(user.id)] = g; toast(q, '');
    if (eph) edit(earnText(st, user.id, g), earnKeyboard(st, user.id, g)); else sayTo(st, user.id, earnText(st, user.id, g), earnKeyboard(st, user.id, g), q, 'earn');
    saveState(st); return;
  }
  if (action === 'task') { doTask(st, user, parts[1], parts[2], q, edit); saveState(st); return; }
  if (action === 'faq') { onFaq(st, user, parts, q, edit); return; }
  if (action === 'quiz') { toast(q, '🧠'); sendQuiz(st); return; }
  if (action === 'iv') { // old cards: iv:20
    const oid = parts.length > 2 ? parts[1] : null;
    pledge(st, user, oid, parts[parts.length - 1], q);
    const o = offerById(st, oid); if (eph) { if (o) edit(offerText(st, o), offerDetailKeyboard(st, o)); else edit(famInvText(st), famInvKeyboard(st)); }
    saveState(st); return;
  }
  if (action === 'ivp' || action === 'ivo') { // a plot's or a fundraising's page
    toast(q, '');
    const p = action === 'ivp' ? (st.cfg.iplots || []).filter(function (x) { return x.id === parts[1]; })[0] : null, o = action === 'ivo' ? offerById(st, parts[1]) : null;
    const t = p ? plotDetailText(st, p) : o ? offerText(st, o) : famInvText(st), kb = p ? plotDetailKeyboard(st, p, String(user.id)) : o ? offerDetailKeyboard(st, o) : famInvKeyboard(st);
    if (eph) edit(t, kb); else sayTo(st, user.id, t, kb, q, 'invest');
    return;
  }
  if (action === 'ivshow') { toast(q, ''); const o = offerById(st, parts[1] || null); if (o) { showOffer(st, o); saveState(st); } return; }
  if (action === 'ivsell' || action === 'ivsellok') { sellShare(st, user, parts[1], parts[2], action === 'ivsellok', q, edit); saveState(st); return; }
  if (action === 'ivtake') { // move the land income from 💼 to the balance
    const id = String(user.id), w = money((st.invWallet || {})[id] || 0), pe = person(st, user);
    if (parts[1] !== id) { toast(q, 'Це не твої інвестиції'); return; }
    if (w <= 0) { toast(q, 'Поки нічого забирати'); edit(myInvText(st, id), myInvKeyboard(st, id)); return; }
    st.invWallet[id] = 0; st.balance[id] = money((st.balance[id] || 0) + w);
    toast(q, '💰 +' + w + ' грн на баланс');
    sayK(st, 'ivtake', '🏦 ' + esc(pe.name) + ' ' + verb(pe, 'забрав', 'забрала') + ' дохід із землі: ' + grn(w) + '! 🌱');
    edit(myInvText(st, id), myInvKeyboard(st, id)); checkAch(st, id); saveState(st); return;
  }
  if (action === 'ivinv') { toast(q, ''); edit(myInvText(st, String(user.id)), myInvKeyboard(st, String(user.id))); return; }
  if (action === 'daily') {
    if (parts[1] === 'done') {
      startTimerAt(st, 'daily', nextHour(st.cfg.dayStart)); // drop a pending "later", wait for tomorrow morning
      const r = 0; // old morning messages: dailies pay crystals now (task:daily)
      toast(q, (r ? '+' + r + ' грн, ' : 'Дякую, ') + p.name + '!');
      edit(old + '\n\n✅ ' + esc(p.name) + ' ' + verb(p, 'зробив', 'зробила') + ' усе о ' + hhmm(now) + (r ? ' (+' + grn(r) + ')' : ''));
    } else {
      startTimer(st, 'daily', 60);
      toast(q, 'Нагадаю ' + whenText(st.timers.daily.due));
      edit(old + '\n⏳ ' + esc(p.name) + ': нагадаю ' + whenText(st.timers.daily.due) + '.');
    }
    saveState(st); return;
  }
  if (!K && kind !== 'both') return;
  const kinds = kindsOf(kind), title = kind === 'both' ? '🧺 Грядки й ' + plotType(st.cfg).label.toLowerCase() : K.title(st.cfg);
  const base = old.split('\n⏳ ')[0]; // drop older "готовий через" lines
  const fromMenu = /^🌾 Меню/.test(q.message.text || '');
  const isOpen = function (k) { return st.open && st.open[k] === mid; };
  // a reminder that is no longer the open one (already harvested, or replaced by a newer one): ignore its buttons
  if (!fromMenu && !kinds.some(isOpen)) {
    const t = kinds.map(function (k) { return st.timers[k]; }).filter(Boolean)[0];
    toast(q, action === 'done' && t ? 'Вже зібрано, наступне ' + whenText(t.due) : 'Це старе нагадування, дивіться нове нижче');
    if (action === 'done') edit(old);
    return;
  }
  const mine = fromMenu ? kinds : kinds.filter(isOpen);
  const nextLine = function () {
    return mine.map(function (k) { return st.timers[k] ? (mine.length > 1 ? KINDS[k].title(st.cfg).split(' ')[0] + ' ' : '') + whenText(st.timers[k].due) : ''; })
      .filter(Boolean).join(', ');
  };
  if (action === 'done') {
    const before = doneToday(st, user.id, now);
    let reward = 0, gems = 0;
    st._cut = 0; st._early = 0; st._hgem = 0;
    mine.forEach(function (k) {
      const r = KINDS[k].reward(hcfg(st, k, now)); // the first seedbed harvest of the day: the night crop
      gems += credit(st, user, k, r, now); reward += r;
      startTimer(st, k, KINDS[k].cycle(st.cfg));
    });
    const saved = st._cut || 0; delete st._cut;
    reward = money(reward - saved);
    const early = st._early || 0; delete st._early;
    const hgem = st._hgem || 0; delete st._hgem;
    const savedLine = (saved ? '\n🐷 ' + grn(saved) + ' відкладено на цілі' : '') + (early ? '\n🌅 Рання пташка: +' + early + ' ' + GEM + '!' : '');
    refreshSeason(st);
    const n = doneToday(st, user.id, now);
    const normDone = (before < p.norm && n >= p.norm ? '\n🎯 ' + esc(p.name) + ': норму на сьогодні виконано!' + streakNow(st, user.id, now) : '') +
      (gems ? '\n' + GEM + ' ' + esc(p.name) + ': +' + gems + ' ' + GEM + ' за заробіток понад норму' : '') + (hgem ? '\n' + GEM + ' +' + hgem + ' за збір' : '');
    stopNag(st);
    toast(q, '+' + reward + ' грн' + (gems + hgem ? ', +' + (gems + hgem) + ' ' + GEM : '') + ', ' + p.name + '!');
    if (!fromMenu && !eph) react(chat, mid, before < p.norm && n >= p.norm ? '🔥' : '👍'); // 🔥 when this harvest completed the norm
    checkAch(st, String(user.id));
    const petAsk = petAfterHarvest(st, String(user.id), mine, before < p.norm && n >= p.norm, now); // 🐾 XP; composters/bundles: "in Daru?"
    const petSay = function (head) { if (petAsk) sayTo(st, user.id, head + petAsk.text, petAsk.kb, q); };
    if (fromMenu) { // "Я вже зібрав(ла)…" in the menu
      mine.forEach(function (k) {
        const shared = st.open && st.open[k] && st.open[k] === st.open[k === 'beds' ? 'plots' : 'beds'];
        closeReminder(st, k);
        if (shared) { const o = k === 'beds' ? 'plots' : 'beds'; delete st.open[o]; postReminder(st, o); } // the other part still waits
      });
      armNag(st, st.cfg.nagAfter);
      if (eph) edit('✅ Зараховано: +' + grn(reward), null); else edit(old, menuKeyboard(st));
      sayK(st, 'harvest', '✅ ' + esc(p.name) + ' ' + verb(p, 'зібрав', 'зібрала') + ' ' + (kind === 'beds' ? 'грядки' : KINDS.plots.title(st.cfg).replace(/^\S+ /, '').toLowerCase()) +
        ' о ' + hhmm(now) + ' (+' + grn(reward) + ')' + normDone + savedLine + goalLine(st) + seasonLine(st) +
        '\n⏰ Наступне нагадування ' + nextLine() + '\n\n📊 Сьогодні:\n' + earnedLines(st, today(st, now)));
      petSay('✅ Зараховано: +' + grn(reward) + '\n\n');
      saveState(st); return;
    }
    mine.forEach(function (k) { delete st.open[k]; });
    armNag(st, st.cfg.nagAfter); // the other kind may still wait
    edit(base + '\n\n✅ ' + esc(p.name) + ' ' + verb(p, 'зібрав', 'зібрала') + (mine.length > 1 ? ' все' : '') + ' о ' + hhmm(now) +
      ' (+' + grn(reward) + (mine.length > 1 ? ', 2 збори' : '') + ')' + normDone + savedLine + goalLine(st) + seasonLine(st) +
      '\n⏰ Наступне нагадування ' + nextLine() +
      '\n\n📊 Сьогодні:\n' + earnedLines(st, today(st, now)));
    petSay('');
  } else if (action === 'later') {
    mine.forEach(function (k) { startTimer(st, k, st.cfg.snooze); });
    stopNag(st); armNag(st, st.cfg.snooze + st.cfg.nagAfter);
    toast(q, 'Нагадаю ' + whenText(st.timers[mine[0]].due));
    edit(base + '\n⏳ ' + esc(p.name) + ' ' + verb(p, 'готовий', 'готова') + ' зробити через ' + minutesWords(st.cfg.snooze) +
      '. Інші можуть збирати зараз! 💰💰💰', harvestButtons(kind, st));
  } else if (action === 'stop') {
    mine.forEach(function (k) { cancelTimer(st, k); delete st.open[k]; });
    stopNag(st); armNag(st, st.cfg.nagAfter);
    toast(q, 'Добре, до завтра!');
    edit(base + '\n\n🛑 ' + esc(p.name) + ': ' + title + ' на сьогодні все. Завтра «▶️ Почати день» у /menu.');
  } else {
    return;
  }
  saveState(st);
}

// The owner sends GIFs or stickers to the bot in a private chat: they go into the pool for nag messages.
function onMedia(msg) {
  const st = loadState();
  if (msg.chat.type !== 'private' || String(msg.from.id) !== String(st.owner)) return;
  if (msg.photo) { st.newsPhoto = msg.photo[msg.photo.length - 1].file_id; newsPrompt(st); saveState(st); return; } // a poster for the announcement
  st.gifs = st.gifs || [];
  const item = msg.animation ? { type: 'animation', id: msg.animation.file_id } : { type: 'sticker', id: msg.sticker.file_id };
  if (st.gifs.some(function (g) { return g.id === item.id; })) { say(msg.chat.id, 'Ця вже є.'); return; }
  st.gifs.push(item); st.gifs = st.gifs.slice(-50); saveState(st);
  say(msg.chat.id, '🎞 Додав! Тепер для кликів є ' + st.gifs.length + ' ' + plural(st.gifs.length, ['гіфка', 'гіфки', 'гіфок']) + ' / стікерів.');
}

function startDay(st) {
  cancelTimer(st, 'beds'); cancelTimer(st, 'plots'); // postReminder closes the old reminders
  if (!st.timers.daily || !st.timers.evening) scheduleDayEvents(st);
  if (st.cfg.together) postBoth(st); else { postReminder(st, 'beds'); postReminder(st, 'plots'); }
}

function onMessage(msg) {
  const st = loadState();
  const text = msg.text.trim();
  const cmd = (text.match(/^\/(\w+)(?:@\w+)?/) || [])[1];
  const arg = text.replace(/^\/\w+(?:@\w+)?\s*/, '').trim();
  const isOwner = st.owner && String(msg.from.id) === String(st.owner);

  if (msg.chat.type === 'private') {
    if (cmd === 'start' && !st.owner) {
      st.owner = msg.from.id; person(st, msg.from); saveState(st);
      say(msg.chat.id, 'Ви власник бота. Додайте мене в сімейний чат і напишіть там /bind. Налаштування: /menu');
      return;
    }
    if (!isOwner) { say(msg.chat.id, 'Цей бот уже має власника.'); return; }
    if (cmd === 'diag') { // can the bot read plain messages in the group?
      const me = tg('getMe', {}), mem = st.group ? tg('getChatMember', { chat_id: st.group, user_id: me && me.result ? me.result.id : 0 }) : null;
      const status = mem && mem.result ? mem.result.status : '?', all = me && me.result ? me.result.can_read_all_group_messages : '?';
      say(msg.chat.id, '🩺 Бот у групі: ' + b(status) + (status === 'administrator' ? ' ✅' : ' ⚠️ (зробіть адміністратором)') +
        '\nPrivacy mode: ' + (all === true ? 'вимкнено ✅' : 'увімкнено (бот бачить звичайні повідомлення лише як адмін)') +
        '\nГрупа: ' + st.group); return;
    }
    if (cmd === 'news') { newsPrompt(st); return; }
    if (cmd === 'update') { // /update: take the bot's code from GitHub and publish it as a new version
      try { say(msg.chat.id, selfUpdate('')); } catch (err) { say(msg.chat.id, '⚠️ Оновлення не вдалося: ' + esc(String(err.message || err)).slice(0, 600)); }
      return;
    }
    if (cmd === 'app') { // /app https://<you>.github.io/farm/ : connect the 📱 Mini App
      if (arg) props().setProperty('APP_URL', arg.trim().replace(/\?.*$/, ''));
      const full = appFullUrl();
      if (!full) { say(msg.chat.id, '📱 Напишіть адресу сторінки застосунку: /app https://ваш-нік.github.io/farm/'); return; }
      const me = tg('getMe', {}); if (me && me.result) props().setProperty('BOT_USERNAME', me.result.username);
      tg('setChatMenuButton', { menu_button: { type: 'web_app', text: '🌱 Ферма', web_app: { url: full } } });
      say(msg.chat.id, '📱 ' + b('Застосунок підключено!') + '\n\nОстанній крок — у @BotFather:\n/mybots → ваш бот → Bot Settings → Configure Mini App → Enable Mini App і вставте цю адресу:\n\n<code>' + esc(full) + '</code>\n\n' +
        'Після цього в меню групи з\'явиться кнопка «📱 Відкрити ферму», а тут, у приватному чаті, — кнопка «🌱 Ферма» біля поля вводу.');
      return;
    }
    if (cmd === 'gems') { // /gems Сашко 45: set someone's crystals exactly
      const m = arg.match(/^(.+?)\s+(\d+)$/), id = m && Object.keys(st.people).find(function (k) { return st.people[k].name.toLowerCase() === m[1].trim().toLowerCase(); });
      if (id) { inv(st, id).gems = +m[2]; saveState(st); }
      say(msg.chat.id, (m && !id ? 'Не знаю «' + esc(m[1]) + '». ' : '') + '💎 Кристали: ' + Object.keys(st.people).map(function (k) { return esc(st.people[k].name) + ' ' + b(inv(st, k).gems); }).join(', ') + '\nЗмінити: /gems Сашко 45'); return;
    }
    if (cmd === 'goal') { say(msg.chat.id, '🤝 Цілі тепер у меню сімейного чату: «🤝 Спільні цілі» → «➕ Нова ціль». Їх може створювати кожен.'); return; }
    if (cmd === 'newplot') { // /newplot 16 575 Сонячна: open fundraising for a new investor plot
      const m = arg.match(/^(8|16|24|28)\s+(\d+(?:[.,]\d+)?\s*(?:k|к)?g?)\s+(.{1,30})$/i), gold = m ? parseGold(m[2]) : 0;
      if (!m || !gold) { say(msg.chat.id, 'Напишіть так: /newplot 16 36000 Сонячна\n(тип 8, 16, 24 або 28 · ціна в золоті, можна 36k · назва як у грі)'); return; }
      if (!st.group) { say(msg.chat.id, 'Спершу прив\'яжіть сімейний чат: /bind у групі.'); return; }
      if (st.offers.some(function (o) { return o.name.toLowerCase() === m[3].trim().toLowerCase(); })) { say(msg.chat.id, 'Збір «' + esc(m[3].trim()) + '» вже йде. Оберіть іншу назву.', settingsKeyboard(st, 'invest')); return; }
      const no = openOffer(st, 'plots' + m[1], gold2uah(st, gold), m[3].trim(), gold);
      saveState(st);
      const d = offerDaily(st, no);
      say(msg.chat.id, '🏗 Збір відкрито в сімейному чаті: ' + fmtGold(gold) + ' = ' + no.price + ' грн (курс 1000g = ' + st.cfg.uahPer1000 + ' грн).' + (st.offers.length > 1 ? ' Відкритих зборів: ' + st.offers.length + '.' : '') + '\n\n' + offerIncomeText(st, no) +
        '\nКупуємо, коли учасники зберуть 100%: я напишу вам сюди, тоді купите в грі й натиснете «✅ Куплено в грі».', settingsKeyboard(st, 'invest')); return;
    }
    if (cmd === 'price') { // /price 30000: a new (discount) price in gold for the open fundraising
      // /price 30000 (one fundraising) · /price 2 30000 or /price Сонячна 30000 (several)
      const pm = String(arg || '').trim().match(/^(?:(.+?)\s+)?(\d+(?:[.,]\d+)?\s*(?:k|к)?g?)$/i), gold = pm ? parseGold(pm[2]) : 0, sel = pm && pm[1] ? pm[1].trim() : '';
      const list = st.offers, cur = function (o, i) { return (list.length > 1 ? (i + 1) + '. ' : '') + '«' + esc(o.name) + '» ' + fmtGold(o.gold || o.price * 1000 / st.cfg.uahPer1000) + ' = ' + o.price + ' грн'; };
      if (!list.length) { say(msg.chat.id, 'Зараз немає відкритого збору.'); return; }
      const o = sel ? (/^\d+$/.test(sel) ? list[+sel - 1] : list.filter(function (x) { return x.name.toLowerCase() === sel.toLowerCase(); })[0]) : list.length === 1 ? list[0] : null;
      if (!gold || !o) { say(msg.chat.id, (sel && !o ? 'Не знайшов збір «' + esc(sel) + '». ' : '') + 'Напишіть нову ціну в золоті: ' + (list.length > 1 ? '/price 2 30000 (номер або назва збору, потім ціна)' : '/price 30000 (або 30k)') + '.\nЗараз:\n' + list.map(cur).join('\n')); return; }
      const r = repriceOffer(st, o, gold), full = offerSum(o) >= o.price - 0.005;
      const backTxt = Object.keys(r.back).map(function (id) { return esc(nameOf(st, id)) + ' ' + r.back[id] + ' грн'; }).join(', ');
      sayK(st, 'pledge', '🏷 ' + b(o.price < r.old ? 'Знижка!' : 'Нова ціна.') + ' «' + esc(o.name) + '» тепер коштує ' + b(o.price + ' грн') + ' (було ' + r.old + ' грн).' +
        (full ? '\n🎉 Грошей уже вистачає — збір завершено! ' + esc(ownerName(st)) + ' купує ділянку.' : '\nЩе треба: ' + money(o.price - offerSum(o)) + ' грн.') +
        (backTxt ? '\n↩️ Зайве повернуто на баланс: ' + backTxt + '.' : ''));
      refreshOffer(st, o); refreshSeason(st); saveState(st);
      say(msg.chat.id, '🏷 «' + esc(o.name) + '» — нова ціна: ' + fmtGold(gold) + ' = ' + o.price + ' грн.' + (backTxt ? ' Повернуто: ' + backTxt + '.' : '') +
        (full ? '\n✅ Зібрано 100% — купуйте в грі й натисніть «✅ Куплено в грі».' : ''), settingsKeyboard(st, 'invest')); return;
    }
    if (cmd === 'balance') { // fallback for corrections: /balance Марія 120
      const m = arg.match(/^(.+?)\s+(-?\d+(?:[.,]\d+)?)$/);
      if (m) {
        const id = Object.keys(st.people).find(function (k) { return st.people[k].name.toLowerCase() === m[1].trim().toLowerCase(); });
        if (id) { st.balance[id] = money(parseFloat(m[2].replace(',', '.'))); saveState(st); }
        else { say(msg.chat.id, 'Не знаю «' + m[1] + '».'); return; }
      }
      say(msg.chat.id, '💰 Можна отримати:\n' + balanceLines(st) + '\nВиправити: /balance Марія 120'); return;
    }
    if (st.setMsg) tg('deleteMessage', { chat_id: msg.chat.id, message_id: st.setMsg }); // one settings panel
    tg('deleteMessage', { chat_id: msg.chat.id, message_id: msg.message_id });
    const sr = say(msg.chat.id, settingsText(st), settingsKeyboard(st)); st.setMsg = sr && sr.result ? sr.result.message_id : null; saveState(st); return; // /menu, /config, anything else
  }

  // group
  // A basic group becomes a supergroup (e.g. when admin rights are changed) and gets a new id: follow it.
  const from = msg.migrate_from_chat_id, to = msg.migrate_to_chat_id;
  if ((to && String(msg.chat.id) === String(st.group)) || (from && String(from) === String(st.group))) {
    st.group = to || msg.chat.id; saveState(st);
    console.log('group migrated to ' + st.group);
    { say(st.group, '🔄 Група оновилась до супергрупи — бот перейшов разом з вами. Усе працює як раніше!'); sendMenu(st); saveState(st); }
    return;
  }
  if (cmd === 'bind') {
    if (!isOwner) { say(msg.chat.id, 'Прив\'язати чат може лише власник бота.'); return; }
    st.group = msg.chat.id; scheduleDayEvents(st); saveState(st);
    say(msg.chat.id, 'Готово! Кожен напишіть /iam <ім\'я>, наприклад /iam Марія. Далі все через /menu.');
    sendMenu(st); saveState(st);
    return;
  }
  if (String(msg.chat.id) !== String(st.group)) return;
  if (cmd === 'iam') {
    if (!arg) { say(st.group, 'Напишіть /iam <ім\'я>, наприклад /iam Марія'); return; }
    const p = person(st, msg.from);
    p.name = arg.slice(0, 30); p.female = isFemale(p.name); saveState(st);
    sayK(st, 'iam', 'Привіт, ' + esc(p.name) + '! Тепер збори рахуватимуться на вас. Норма: ' + p.norm + ' грн на день.'); return;
  }
  if (cmd === 'n') { if (!onPetName(st, msg, arg)) onGoalText(st, msg, arg); saveState(st); return; }
  if (!cmd && (onPetName(st, msg, text) || onGoalText(st, msg))) { saveState(st); return; }
  if (cmd === 'go') { startDay(st); saveState(st); return; }
  if (cmd === 'menu' || cmd === 'start') {
    tg('deleteMessage', { chat_id: st.group, message_id: msg.message_id }); // the "/menu" itself; works when the bot is an admin
    sendMenu(st); saveState(st); return;
  }
  if (cmd === 'stats') { sayK(st, 'stats', statsText(st, Date.now()), MONEY_BUTTON); return; }
  if (cmd === 'payout') { const t = payout(st, msg.from, Date.now()); saveState(st); sayK(st, 'payout', t); return; }
}

// ---------------------------------------------------------------- one-time setup
// Diagnostics: what Telegram knows about the webhook (the URL is hidden: it contains the secret).
function checkWebhook() {
  const info = tg('getWebhookInfo', {}).result || {};
  delete info.url;
  Logger.log(JSON.stringify(info));
  const s = readState();
  Logger.log('STATE: ' + s.length + ' chars in ' + (props().getProperty('STATE_N') || '1 (old format)') + ' pieces');
  Logger.log(s);
}
// Instant mode (default): Telegram calls this web app. Needs the Web app deployment, WEBAPP_URL and SECRET.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'poll') ScriptApp.deleteTrigger(t); });
  const url = props().getProperty('WEBAPP_URL') + '?k=' + encodeURIComponent(props().getProperty('SECRET'));
  Logger.log(JSON.stringify(tg('setWebhook', { url: url, allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true })));
  setCommands();
  migrate();
}
// ---------------------------------------------------------------- 🔄 code from GitHub
// The code runs through bot/loader.gs in the Apps Script project: it takes this file from GitHub and keeps it
// in the script cache for 15 minutes. selfUpdate drops that cache, so the next run uses the newest code.
function selfUpdate(sha) {
  // raw.githubusercontent.com keeps a file ~5 min in its cache, so the plain address can still give the old code.
  // The address with the exact commit is never stale: take the newest commit, fetch that file and put it into the loader's cache.
  const c = CacheService.getScriptCache();
  try {
    const head = UrlFetchApp.fetch('https://api.github.com/repos/Crystallord/farm/commits/main', { headers: { Accept: 'application/vnd.github.sha' }, muteHttpExceptions: true });
    const ref = head.getResponseCode() === 200 ? head.getContentText().trim() : (sha || '');
    if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('GitHub: ' + head.getResponseCode());
    const r = UrlFetchApp.fetch('https://raw.githubusercontent.com/Crystallord/farm/' + ref + '/bot/farm_reminder_bot.gs', { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('GitHub: ' + r.getResponseCode());
    const src = r.getContentText();
    new Function(src); // a broken file would stop the bot: check that it parses before using it
    const parts = {}, N = Math.ceil(src.length / 40000);
    for (let i = 0; i < N; i++) parts['botsrc_' + i] = src.slice(i * 40000, (i + 1) * 40000);
    parts.botsrc_n = String(N);
    c.putAll(parts, 900);
    return '🔄 ' + b('Готово!') + ' Код із GitHub (' + ref.slice(0, 7) + ') уже працює.';
  } catch (err) {
    c.remove('botsrc_n');
    return '🔄 Кеш скинуто, свіжий код підтягнеться за кілька хвилин (' + esc(String(err.message || err)).slice(0, 120) + ').';
  }
}
// Fallback: no webhook, the bot checks Telegram every minute (replies come up to a minute late).
function setupPolling() {
  Logger.log(JSON.stringify(tg('deleteWebhook', { drop_pending_updates: false })));
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'poll') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('poll').timeBased().everyMinutes(1).create();
  setCommands();
  migrate();
}
// After an update: clear timers of old versions and plan the morning checklist and the evening summary.
function migrate() {
  withLock(function () {
    const st = loadState();
    ['trig', 'ftrig'].forEach(function (k) { if (st[k]) dropTrigger(st[k]); delete st[k]; });
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (['fireReminder', 'fireFarm'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
    });
    if (st.timers.slot) { st.timers.plots = st.timers.slot; delete st.timers.slot; }
    if (st.group) scheduleDayEvents(st);
    saveState(st);
    Logger.log(settingsText(st));
  });
}
// Only three commands in the "/" list; everything else is in /menu.
function setCommands() {
  Logger.log(JSON.stringify(tg('setMyCommands', { commands: [
    { command: 'menu', description: 'Меню ферми: статистика, гроші, нагадування' },
    { command: 'go', description: 'Почати день' },
    { command: 'iam', description: 'Як мене звати: /iam Марія' },
  ] })));
  Logger.log(JSON.stringify(tg('setMyCommands', { scope: { type: 'all_private_chats' }, commands: [
    { command: 'menu', description: 'Налаштування бота' },
  ] })));
}

/* ---------------------------------------------------------------- FUTURE: the private chat with Марія (not built yet)
 * Researched 16.11.2026; for when we want a personal space for Марія outside the family group.
 * 1. HTML widgets (Bot API 10.4, 9.11.2026): sendWidget puts a small HTML/CSS/JS block inside a message.
 *    In production only in the private chat with the bot (groups/forwards: test server only). One document,
 *    <= 32768 bytes HTML and <= 4096 bytes zlib-compressed; offline (no fetch, no external fonts/images);
 *    CSS animations, theme colors (--tg-theme-*), localStorage 4 KB per message; taps only, no text input.
 *    Data: chat_data / public_data JSON <= 1024 bytes, written by the bot (editMessageWidgetData); an open widget
 *    gets changes at once (chatDataChanged). The widget can ask the bot: TelegramWidget.request(1-64 bytes) ->
 *    widget_query -> answerWidgetQuery (<= 1024 bytes). Apps without support show "unsupported" + the caption.
 *    Idea: "Панель Марії": animated streak flame, crystals, progress bar to the next badge, her plot's earnings,
 *    week chart; updated by the bot after each harvest. Docs: https://core.telegram.org/bots/widgets
 * 2. Message effects (Bot API 7.4): message_effect_id (confetti, hearts...) on send methods, private chats only:
 *    confetti for a new achievement, a land milestone, a race win.
 * 3. Needed first: the bot answers Марія in the private chat (now it answers only the owner there): /start from
 *    her links her private chat to her person; then personal notices (her reminders, her achievements) can go there.
 * 4. Maybe later: a Mini App (fullscreen dashboard, home-screen shortcut) needs its own HTTPS hosting; emoji status
 *    (setUserEmojiStatus) needs a Mini App permission. Custom emoji in messages need the bot owner's Premium.
 */
