'use strict';

/**
 * Rexy AI - Phase 6.1
 * Adult ASA Discord AI helper
 *
 * Behavior:
 * - Replies only when called with: Rexy, ...
 * - Silently indexes configured channels and ticket-#### channels.
 * - Reads message text and embeds, including leaderboard/status embeds.
 * - Uses Adult ASA API context, Discord memory/history, roles, and trusted ARK wiki context.
 * - No staff suggestion channel required.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { Rcon } = require('rcon-client');

// =====================
// ENV
// =====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

const DATA_DIR = process.env.DATA_DIR || '/data';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const STATUS_API_BASE =
  process.env.STATUS_API_BASE ||
  process.env.ADULT_ASA_API_BASE ||
  process.env.PUBLIC_API_BASE ||
  'https://aasa-discord-bot-v-20-production.up.railway.app';
const ADULT_ASA_WEBSITE_URL = process.env.ADULT_ASA_WEBSITE_URL || 'https://adult-asa.org';

const AUTO_INDEX_HISTORY_ON_START = String(process.env.REXY_AUTO_INDEX_HISTORY_ON_START || 'true').toLowerCase() !== 'false';
const HISTORY_BATCH_LIMIT = Math.max(1, Math.min(100, Number(process.env.REXY_HISTORY_BATCH_LIMIT || 100)));
const HISTORY_MAX_MESSAGES_PER_CHANNEL = Math.max(0, Number(process.env.REXY_HISTORY_MAX_MESSAGES_PER_CHANNEL || 500));
const WEBSITE_FETCH_TIMEOUT_MS = Number(process.env.WEBSITE_FETCH_TIMEOUT_MS || 9000);
const NITRADO_TOKEN = process.env.NITRADO_TOKEN || process.env.NITRADO_API_TOKEN || '';
const NITRADO_TIMEOUT_MS = Number(process.env.NITRADO_TIMEOUT_MS || 15000);
const SERVER_CONFIG_FILE = path.join(__dirname, 'server.json');
const RCON_COMMAND_TIMEOUT_MS = Number(process.env.REXY_RCON_COMMAND_TIMEOUT_MS || 15000);
const REXY_GIVE_APPROVAL_CHANNEL_ID = process.env.REXY_GIVE_APPROVAL_CHANNEL_ID || process.env.SUBMIT_TICKET_CHANNEL_ID || '';

if (!DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
if (!GUILD_ID) throw new Error('Missing GUILD_ID');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (error) {
  console.warn('[REXY DATA] Could not create DATA_DIR:', error?.message || error);
}

const MEMORY_FILE = path.join(DATA_DIR, 'rexy_memory.ndjson');
const HISTORY_INDEX_FILE = path.join(DATA_DIR, 'rexy_history_index.ndjson');
const HISTORY_STATE_FILE = path.join(DATA_DIR, 'rexy_history_state.json');
const LEARNED_FACTS_FILE = path.join(DATA_DIR, 'rexy_learned_facts.json');
const DECISIONS_FILE = path.join(DATA_DIR, 'rexy_decisions.ndjson');
const ITEM_REGISTRY_FILE = path.join(DATA_DIR, 'rexy_item_registry.json');
const BRAIN_ENTITIES_FILE = path.join(DATA_DIR, 'rexy_entities.json');
const BRAIN_RELATIONSHIPS_FILE = path.join(DATA_DIR, 'rexy_relationships.json');
const BRAIN_TASKS_FILE = path.join(DATA_DIR, 'rexy_tasks.json');
const CONVERSATION_MEMORY_FILE = path.join(DATA_DIR, 'rexy_conversations.json');
const CONVERSATION_TIMELINE_FILE = path.join(DATA_DIR, 'rexy_conversation_timeline.ndjson');
const CONVERSATION_SUMMARY_FILE = path.join(DATA_DIR, 'rexy_conversation_summary.json');
const STAFF_CORRECTIONS_FILE = path.join(DATA_DIR, 'rexy_staff_corrections.json');
const PENDING_GIVE_REQUESTS = new Map();
const PENDING_GIVE_TIMERS = new Map();

// =====================
// DISCORD / OPENAI
// =====================
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// =====================
// CHANNELS / ROLES
// =====================
const DEFAULT_HISTORY_CHANNEL_IDS = [
  '1425090673618718780', // ark-server-info
  '1429564247532109904', // rules
  '1429595503372402740', // role-select
  '1431793687716827258', // introduce-yourself
  '1430663445564624927', // server-status
  '1426772490478424104', // updates
  '1488687285972111450', // events-info
  '1440114239401361538', // ark-patch-notes
  '1450657867865522389', // join-notification
  '1431809435625328730', // contributor-info
  '1441693457726046238', // server-sponsors
  '1425820625724899358', // suggestions
  '1459283951414935855', // submit-a-ticket
  '1424843119899316244', // general
  '1429637518021759036', // pets
  '1429638747057688647', // memes
  '1436169495394914406', // off-topic
  '1499456716100735169', // ask-a-question
  '1486171288396632094', // in-game-chat
  '1427103437643841556', // ark-pictures
  '1495137937329881268', // daily-rewards
  '1494964400661205092', // shiny-alerts
  '1493725632969052411', // boss-fights
  '1448476876103225465', // post-your-builds-here
  '1448818976510709991', // wall-of-fame
  '1453154583483514900', // playtime-leaderboard
  '1432363371789029487', // tips-and-tricks
  '1443756225421639811', // trading
  '1455459744524402804', // in-game-market
  '1457813988128849940', // lost-and-found
  '1437479702507028602', // vip-chat
  '1437479675038535760', // vip-suggestions
];

const ENV_HISTORY_CHANNEL_IDS = [
  process.env.ARK_SERVER_INFO_CHANNEL_ID,
  process.env.RULES_CHANNEL_ID,
  process.env.ROLE_SELECT_CHANNEL_ID,
  process.env.INTRODUCE_YOURSELF_CHANNEL_ID,
  process.env.STATUS_CHANNEL_ID,
  process.env.UPDATES_CHANNEL_ID,
  process.env.EVENTS_INFO_CHANNEL_ID,
  process.env.PATCH_NOTES_CHANNEL_ID,
  process.env.JOIN_NOTIFICATION_CHANNEL_ID,
  process.env.CONTRIBUTOR_INFO_CHANNEL_ID,
  process.env.SERVER_SPONSORS_CHANNEL_ID,
  process.env.SUGGESTION_CHANNEL_ID,
  process.env.SUBMIT_TICKET_CHANNEL_ID,
  process.env.GENERAL_CHANNEL_ID,
  process.env.PETS_CHANNEL_ID,
  process.env.MEMES_CHANNEL_ID,
  process.env.OFF_TOPIC_CHANNEL_ID,
  process.env.ASK_CHANNEL_ID,
  process.env.ASK_A_QUESTION_CHANNEL_ID,
  process.env.INGAME_CHAT_CHANNEL_ID,
  process.env.ARK_PICTURES_CHANNEL_ID,
  process.env.DAILY_REWARDS_CHANNEL_ID,
  process.env.SHINY_ALERTS_CHANNEL_ID,
  process.env.BOSS_FIGHTS_CHANNEL_ID,
  process.env.POST_BUILDS_CHANNEL_ID,
  process.env.WALL_OF_FAME_CHANNEL_ID,
  process.env.LEADERBOARD_CHANNEL_ID,
  process.env.PLAYTIME_LEADERBOARD_CHANNEL_ID,
  process.env.TIPS_TRICKS_CHANNEL_ID,
  process.env.TRADING_CHANNEL_ID,
  process.env.INGAME_MARKET_CHANNEL_ID,
  process.env.LOST_AND_FOUND_CHANNEL_ID,
  process.env.VIP_CHAT_CHANNEL_ID,
  process.env.VIP_SUGGESTIONS_CHANNEL_ID,
].filter(Boolean);

const HISTORY_CHANNEL_IDS = Array.from(new Set([...DEFAULT_HISTORY_CHANNEL_IDS, ...ENV_HISTORY_CHANNEL_IDS]));

const KNOWN_ROLE_IDS = {
  overseer: process.env.OVERSEER_ROLE_ID || '1429560181523484844',
  mods: process.env.MOD_ROLE_ID || '1421644117242417304',
  monthlyContributor: '1431778372068835328',
  contributor: '1431777903707684965',
  kingTitan: '1443642727828033637',
  iceTitan: '1443642264806101112',
  forestTitan: '1443642005766012978',
  desertTitan: '1443641875272827123',
  lostColonyAscension: '1462639875466723617',
  alphaRockwell: '1443641037128990780',
  seManticoreSurvivor: '1435470977323630722',
  islandAscendedSurvivor: '1434233759749636299',
  islandAlphaSurvivor: '1434233634574958652',
  islandBetaSurvivor: '1434233306718797834',
  pc: '1429576300653314108',
  ps5: '1429575927192617052',
  xbox: '1429576009501376572',
  serverBooster: '1438216653492977797',
  bossFightAlerts: '1493730883180429423',
  dailyRewardsAlerts: '1495137034652614746',
  shinyCreatureAlerts: '1495210598210867241',
  rexy: process.env.REXY_ROLE_ID || '1450686273604943933',
};

const ADMIN_ROLE_IDS = new Set([KNOWN_ROLE_IDS.overseer, KNOWN_ROLE_IDS.mods, KNOWN_ROLE_IDS.rexy].filter(Boolean));
const REXY_COMMAND_PATTERN = /^rexy\s*[,.:;!?-]?\s*/i;
const ADMIN_COMMANDS = new Set(['status', 'index', 'memory', 'say', 'learn', 'reload', 'start', 'stop', 'restart', 'kick', 'register', 'give']);

// =====================
// BASIC HELPERS
// =====================
function cleanContent(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function channelName(channel) {
  return String(channel?.name || '').toLowerCase().trim();
}

function isTicketChannel(channel) {
  return /^ticket-\d+/i.test(channelName(channel));
}

function startsWithRexyCommand(content) {
  return REXY_COMMAND_PATTERN.test(cleanContent(content));
}

function stripRexyCommand(content) {
  return cleanContent(content).replace(REXY_COMMAND_PATTERN, '').trim();
}

function appendJsonLine(file, obj) {
  try {
    fs.appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8');
  } catch (error) {
    console.warn('[REXY FILE WRITE]', error?.message || error);
  }
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile(file, value) {
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (error) {
    console.warn('[REXY JSON WRITE]', error?.message || error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadServerConfigs() {
  const raw = readJsonFile(SERVER_CONFIG_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function cleanServerDisplayName(name) {
  const cleaned = String(name || '').replace(/^Adult\s+ASA\s*-\s*/i, '').trim();
  if (/^SE$/i.test(cleaned)) return 'Scorched Earth';
  if (/^The Island$/i.test(cleaned)) return 'Island';
  return cleaned;
}

function normalizeLookupText(value) {
  return String(value || '').toLowerCase().replace(/adult\s+asa/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function getServerAliases(server) {
  const display = cleanServerDisplayName(server.name);
  const base = normalizeLookupText(display);
  const aliases = new Set([base, normalizeLookupText(server.name)]);
  const map = {
    island: ['island', 'the island'],
    'scorched earth': ['scorched earth', 'scorched', 'se'],
    aberration: ['aberration', 'ab', 'abb'],
    extinction: ['extinction', 'ext'],
    'lost colony': ['lost colony', 'lost', 'lc'],
    ragnarok: ['ragnarok', 'rag'],
    valguero: ['valguero', 'valg'],
    'the center': ['the center', 'center'],
    astraeos: ['astraeos', 'astra'],
  };
  for (const [key, values] of Object.entries(map)) if (base === key) values.forEach((v) => aliases.add(normalizeLookupText(v)));
  return Array.from(aliases).filter(Boolean);
}

function serverSortOrder(name) {
  const order = ['island', 'scorched earth', 'aberration', 'extinction', 'lost colony', 'ragnarok', 'valguero', 'the center', 'astraeos'];
  const index = order.indexOf(normalizeLookupText(cleanServerDisplayName(name)));
  return index === -1 ? 999 : index;
}

function resolveServerTargets(rawTargetText) {
  const servers = loadServerConfigs();
  const text = normalizeLookupText(rawTargetText).replace(/\b(the|server|servers|map|maps|please|pls|now)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!servers.length) return { servers: [], errors: ['server.json could not be loaded.'] };
  if (!text || /\b(all|cluster|whole cluster|entire cluster)\b/.test(text)) return { servers: servers.slice().sort((a, b) => serverSortOrder(a.name) - serverSortOrder(b.name)), errors: [] };
  const pieces = text.split(/\s*(?:,|\band\b|\&|\+)\s*/i).map((x) => normalizeLookupText(x)).filter(Boolean);
  const selected = new Map();
  const errors = [];
  for (const piece of pieces) {
    let matches = servers.filter((server) => getServerAliases(server).includes(piece));
    if (!matches.length) matches = servers.filter((server) => getServerAliases(server).some((alias) => alias.includes(piece) || piece.includes(alias)));
    if (matches.length === 1) selected.set(matches[0].name, matches[0]);
    else if (matches.length > 1) errors.push(`"${piece}" matched multiple maps: ${matches.map((s) => cleanServerDisplayName(s.name)).join(', ')}`);
    else errors.push(`I could not match "${piece}" to a known map.`);
  }
  return { servers: Array.from(selected.values()).sort((a, b) => serverSortOrder(a.name) - serverSortOrder(b.name)), errors };
}

async function fetchNitrado(action, serviceId) {
  if (!NITRADO_TOKEN) throw new Error('Missing NITRADO_TOKEN / NITRADO_API_TOKEN.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NITRADO_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.nitrado.net/services/${encodeURIComponent(serviceId)}/gameservers/${action}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${NITRADO_TOKEN}`, Accept: 'application/json', 'User-Agent': 'AdultASA-Rexy/6.1' },
    });
    const text = await res.text().catch(() => '');
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { text }; }
    if (!res.ok) throw new Error(String(body?.message || body?.error || body?.text || `${res.status} ${res.statusText}`).slice(0, 240));
    return body || { ok: true };
  } finally { clearTimeout(timeout); }
}

function rconForServer(server) {
  return new Rcon({ host: server.host, port: Number(server.rconPort), password: server.rconPassword, timeout: RCON_COMMAND_TIMEOUT_MS });
}

async function withHardTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))]);
}

async function rconSend(server, command) {
  const rcon = rconForServer(server);
  try {
    await withHardTimeout(rcon.connect(), RCON_COMMAND_TIMEOUT_MS, `${cleanServerDisplayName(server.name)} RCON connect`);
    return await withHardTimeout(rcon.send(command), RCON_COMMAND_TIMEOUT_MS, `${cleanServerDisplayName(server.name)} RCON command`);
  } finally { try { await withHardTimeout(rcon.end(), 1500, `${cleanServerDisplayName(server.name)} RCON close`); } catch {} }
}

async function rconSendOpen(rcon, server, command, label = 'RCON command') {
  return await withHardTimeout(
    rcon.send(command),
    RCON_COMMAND_TIMEOUT_MS,
    `${cleanServerDisplayName(server.name)} ${label}`
  );
}

async function closeRconQuietly(rcon, server) {
  try {
    await withHardTimeout(rcon.end(), 1500, `${cleanServerDisplayName(server.name)} RCON close`);
  } catch {}
}

async function saveAndWarnBeforeServerAction(server, action) {
  if (action === 'start') return;
  try { await rconSend(server, `Broadcast "Adult ASA: ${cleanServerDisplayName(server.name)} is ${action === 'restart' ? 'restarting' : 'stopping'} by staff command."`); } catch {}
  try { await rconSend(server, 'SaveWorld'); } catch {}
}

function parseServerActionTarget(commandText, action) {
  return cleanContent(commandText).replace(new RegExp(`^${action}\\b`, 'i'), '').replace(/^\s*(the\s+)?/i, '').trim();
}

async function runServerPowerAction(action, targetText, message) {
  const { servers, errors } = resolveServerTargets(targetText);
  if (errors.length) return `I need a cleaner map target: ${errors.join(' ')}`;
  if (!servers.length) return 'I could not find any matching servers.';
  const verb = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
  await message.reply(`${verb}: ${servers.map((s) => cleanServerDisplayName(s.name)).join(', ')}`);
  const results = [];
  for (const server of servers) {
    if (!server.serviceId) { results.push(`❌ ${cleanServerDisplayName(server.name)}: missing serviceId in server.json`); continue; }
    try {
      await saveAndWarnBeforeServerAction(server, action);
      await fetchNitrado(action, server.serviceId);
      results.push(`✅ ${cleanServerDisplayName(server.name)}`);
    } catch (error) { results.push(`❌ ${cleanServerDisplayName(server.name)}: ${sanitize(error?.message || error)}`); }
    await sleep(500);
  }
  appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'server_power_action', action, targets: servers.map((s) => ({ name: s.name, serviceId: s.serviceId })), requestedBy: message.author.tag, requestedById: message.author.id, channelId: message.channelId });
  return `${action.toUpperCase()} command finished:\n${results.join('\n')}`;
}

function parseKickTarget(commandText) {
  return cleanContent(commandText).replace(/^kick\b/i, '').replace(/^\s*(player\s+)?/i, '').replace(/^['"“”]+|['"“”]+$/g, '').trim();
}

async function getLiveStatusPlayersForKick() {
  const players = [];
  try {
    const status = await fetchJson(`${STATUS_API_BASE}/api/status`, WEBSITE_FETCH_TIMEOUT_MS);
    for (const server of status?.servers || []) {
      const serverName = server.name || server.map || 'Unknown';
      for (const detail of server.playerDetails || []) if (detail?.name) players.push({ name: detail.name, id: detail.id || null, serverName, source: 'api/status playerDetails' });
      for (const name of server.playerNames || []) if (!players.some((p) => p.name.toLowerCase() === String(name).toLowerCase() && p.serverName === serverName)) players.push({ name, id: null, serverName, source: 'api/status playerNames' });
    }
  } catch {}
  return players;
}

async function rconListPlayersForKick(server) {
  try {
    const raw = await rconSend(server, 'ListPlayers');
    const rows = String(raw || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const players = [];
    for (const row of rows) {
      const match = row.match(/^\s*(\d+)\s*[.)-]?\s*([^,|\/]+?)\s*(?:[,|\/]\s*(.+))?$/);
      if (!match) continue;
      const playerNum = match[1];
      const name = cleanContent(match[2]);
      const rest = cleanContent(match[3] || '');
      const idMatch = rest.match(/(EOS_[A-Za-z0-9_\-]+|[0-9a-f]{32}|\d{15,20})/i);
      if (name) players.push({ name, id: idMatch ? idMatch[1] : null, playerNum, serverName: server.name, server, source: 'rcon ListPlayers' });
    }
    return players;
  } catch { return []; }
}

async function findKickTargets(nameText) {
  const wanted = normalizeLookupText(nameText);
  if (!wanted) return [];
  const servers = loadServerConfigs();
  const apiPlayers = await getLiveStatusPlayersForKick();
  const apiMatches = apiPlayers.filter((p) => normalizeLookupText(p.name).includes(wanted) || wanted.includes(normalizeLookupText(p.name)));
  const rconMatches = [];
  for (const server of servers) {
    const rows = await rconListPlayersForKick(server);
    for (const player of rows) {
      const pName = normalizeLookupText(player.name);
      if (pName === wanted || pName.includes(wanted) || wanted.includes(pName)) rconMatches.push(player);
    }
  }
  const merged = [];
  for (const player of [...rconMatches, ...apiMatches]) {
    const key = `${normalizeLookupText(player.name)}|${normalizeLookupText(player.serverName)}|${player.id || player.playerNum || ''}`;
    if (!merged.some((p) => `${normalizeLookupText(p.name)}|${normalizeLookupText(p.serverName)}|${p.id || p.playerNum || ''}` === key)) merged.push(player);
  }
  return merged;
}

async function kickPlayerFromServer(target) {
  const server = target.server || loadServerConfigs().find((s) => normalizeLookupText(s.name) === normalizeLookupText(target.serverName));
  if (!server) throw new Error(`Could not identify server for ${target.name}.`);
  const identifiers = [target.id, target.playerNum, target.name].filter(Boolean);
  const commands = [];
  for (const identifier of identifiers) {
    commands.push(`KickPlayer "${identifier}"`, `admincheat KickPlayer "${identifier}"`, `KickPlayer ${identifier}`, `admincheat KickPlayer ${identifier}`);
  }
  let lastResult = '';
  for (const command of commands) {
    try {
      const result = await rconSend(server, command);
      lastResult = String(result || '').trim();
      const lower = lastResult.toLowerCase();
      if (!lower.includes('unknown') && !lower.includes('error') && !lower.includes('failed')) return { ok: true, server, response: lastResult };
    } catch (error) { lastResult = error?.message || String(error); }
  }
  throw new Error(lastResult || 'Kick command was not accepted.');
}

async function runKickCommand(commandText, message) {
  const targetName = parseKickTarget(commandText);
  if (!targetName) return 'Use it like: Rexy, kick PlayerName';
  const matches = await findKickTargets(targetName);
  if (!matches.length) return `I could not find an online player matching "${targetName}" from server status/RCON.`;
  const uniqueServers = new Set(matches.map((m) => normalizeLookupText(m.serverName)));
  if (matches.length > 1 && uniqueServers.size > 1) return `I found multiple matches. Be more specific: ${matches.map((m) => `${m.name} on ${cleanServerDisplayName(m.serverName)}`).join(', ')}`;
  const target = matches[0];
  try {
    const result = await kickPlayerFromServer(target);
    appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'kick', targetName: target.name, targetServer: result.server.name, requestedBy: message.author.tag, requestedById: message.author.id, channelId: message.channelId });
    return `✅ Kicked ${target.name} from ${cleanServerDisplayName(result.server.name)}.`;
  } catch (error) { return `❌ I found ${target.name}, but the kick failed: ${sanitize(error?.message || error)}`; }
}


// =====================
// ITEM REGISTRY + GIVE COMMANDS
// =====================
function loadItemRegistry() {
  const data = readJsonFile(ITEM_REGISTRY_FILE, { items: {} });
  if (!data || typeof data !== 'object' || !data.items || typeof data.items !== 'object') return { items: {} };
  return data;
}

function saveItemRegistry(registry) {
  writeJsonFile(ITEM_REGISTRY_FILE, registry && typeof registry === 'object' ? registry : { items: {} });
}

function normalizeItemKey(value) {
  const base = normalizeLookupText(value)
    .replace(/\bcurrency\b/g, ' ')
    .replace(/\bitem\b/g, ' ')
    .replace(/\bresource\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (base.endsWith('ies')) return base.slice(0, -3) + 'y';
  if (base.endsWith('s') && base.length > 3) return base.slice(0, -1);
  return base;
}

function stripBlueprintWrapper(value) {
  let text = cleanContent(value).replace(/^['"“”]+|['"“”]+$/g, '').trim();
  text = text.replace(/^blue\s*print\s*path\s*/i, '').replace(/^blueprint\s*path\s*/i, '').trim();

  const wrappedSingle = text.match(/^Blueprint'(.+)'$/i);
  if (wrappedSingle) return wrappedSingle[1].trim();

  const wrappedDouble = text.match(/^Blueprint"(.+)"$/i);
  if (wrappedDouble) return wrappedDouble[1].trim();

  return text;
}

function normalizeBlueprintPath(rawPath) {
  const raw = stripBlueprintWrapper(rawPath);
  if (!raw) return '';
  if (/^Blueprint'/i.test(raw)) return raw;
  if (raw.startsWith('/')) return `Blueprint'${raw}'`;
  return raw;
}

function getRawBlueprintPath(rawPath) {
  const raw = stripBlueprintWrapper(rawPath);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  return raw;
}

function withClassSuffix(rawPath) {
  const raw = getRawBlueprintPath(rawPath);
  if (!raw || raw.endsWith('_C')) return raw;
  return `${raw}_C`;
}

function blueprintWithClassSuffix(rawPath) {
  const raw = withClassSuffix(rawPath);
  if (!raw) return '';
  return raw.startsWith('/') ? `Blueprint'${raw}'` : raw;
}

function deriveGfiCodeFromBlueprint(rawPath) {
  const raw = getRawBlueprintPath(rawPath);
  const asset = String(raw || '').split('/').pop() || '';
  const short = asset.split('.')[0] || '';
  if (!short) return '';
  return short
    .replace(/^PrimalItem(Resource|Consumable|Armor|Weapon|Ammo|Structure)_/i, '')
    .replace(/^PrimalItem_/i, '')
    .replace(/_C$/i, '')
    .trim();
}

function parseExplicitGfiCode(commandText, blueprintPath) {
  const text = cleanContent(commandText);
  const cheat = text.match(/\bcheat\s+gfi\s+([A-Za-z0-9_\-]+)\b/i);
  if (cheat) return cheat[1].trim();

  const direct = text.match(/\bgfi\s+([A-Za-z0-9_\-]+)\b/i);
  if (direct) return direct[1].trim();

  return deriveGfiCodeFromBlueprint(blueprintPath);
}

function parseExplicitEngramClass(commandText) {
  const text = cleanContent(commandText);
  const match = text.match(/\b(EngramEntry_[A-Za-z0-9_]+_C)\b/i);
  return match ? match[1].trim() : '';
}

function parseRegisterItemCommand(commandText) {
  const rest = cleanContent(commandText).replace(/^register\b/i, '').trim();
  if (!rest) return null;

  const asMatch = rest.match(/^(.+?)\s+as\s+(?:the\s+)?(?:blue\s*print|blueprint)?\s*path\s+for\s+(?:the\s+)?(.+?)(?:\s+(?:currency|item|resource)\b.*)?$/i);
  if (asMatch) {
    return {
      blueprint: normalizeBlueprintPath(asMatch[1]),
      itemName: cleanContent(asMatch[2]).replace(/\b(currency|item|resource)\b.*$/i, '').trim(),
    };
  }

  const namedMatch = rest.match(/^(.+?)\s*[=:]\s*(.+)$/);
  if (namedMatch) {
    return {
      itemName: cleanContent(namedMatch[1]),
      blueprint: normalizeBlueprintPath(namedMatch[2]),
    };
  }

  // Also support a pasted command/reference like:
  // Rexy, register cheat gfi SimpleGem_Ruby 1 0 0 /Simple_Trade/... EngramEntry_... for Rubies
  // Rexy, register rubies cheat gfi SimpleGem_Ruby 1 0 0 /Simple_Trade/...
  const pastedPathMatch = rest.match(/(\/[A-Za-z0-9_\-\/]+\.[A-Za-z0-9_\-]+)/);
  if (pastedPathMatch) {
    const forMatch = rest.match(/for\s+(?:the\s+)?([A-Za-z0-9 _\-]+)$/i);
    const firstWord = rest.match(/^([A-Za-z][A-Za-z0-9 _\-]{1,30}?)\s+(?:cheat\s+)?gfi/i);
    const gfiMatch = rest.match(/(?:cheat\s+)?gfi\s+([A-Za-z0-9_\-]+)/i);
    let itemName = forMatch ? cleanContent(forMatch[1]) : '';
    if (!itemName && firstWord) itemName = cleanContent(firstWord[1]);
    if (!itemName && /rub(?:y|ies)/i.test(rest)) itemName = 'Rubies';
    if (!itemName && gfiMatch) itemName = gfiMatch[1].replace(/_/g, ' ');

    return {
      itemName: itemName || 'Registered Item',
      blueprint: normalizeBlueprintPath(pastedPathMatch[1]),
    };
  }

  return null;
}

function registerItemBlueprint(commandText, message) {
  const parsed = parseRegisterItemCommand(commandText);
  if (!parsed || !parsed.itemName || !parsed.blueprint) {
    return 'Use it like: Rexy, register /Path/Item.Item as the blueprint path for Rubies';
  }

  const registry = loadItemRegistry();
  const key = normalizeItemKey(parsed.itemName);
  if (!key) return 'I could not understand the item name to register.';

  const aliases = Array.from(new Set([
    parsed.itemName,
    key,
    key.endsWith('y') ? `${key.slice(0, -1)}ies` : `${key}s`,
  ].filter(Boolean)));

  const rawBlueprint = getRawBlueprintPath(parsed.blueprint);
  const gfiCode = parseExplicitGfiCode(commandText, rawBlueprint);
  const engramClass = parseExplicitEngramClass(commandText);

  registry.items[key] = {
    name: parsed.itemName,
    blueprint: normalizeBlueprintPath(rawBlueprint),
    rawBlueprint,
    blueprintClass: blueprintWithClassSuffix(rawBlueprint),
    gfiCode,
    engramClass,
    aliases,
    registeredById: message.author.id,
    registeredByTag: message.author.tag,
    channelId: message.channelId,
    updatedAt: new Date().toISOString(),
  };

  saveItemRegistry(registry);
  appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'item_register', item: parsed.itemName, key, registeredBy: message.author.tag, registeredById: message.author.id, channelId: message.channelId });
  return `✅ Registered **${parsed.itemName}** for in-game giving.`;
}

function findRegisteredItem(itemText) {
  const registry = loadItemRegistry();
  const wanted = normalizeItemKey(itemText);
  if (!wanted) return null;

  if (registry.items[wanted]) return { key: wanted, ...registry.items[wanted] };

  for (const [key, item] of Object.entries(registry.items || {})) {
    const aliases = [key, item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])].map(normalizeItemKey).filter(Boolean);
    if (aliases.includes(wanted)) return { key, ...item };
  }

  return null;
}

function stripDecorativeQuotes(value) {
  return cleanContent(value).replace(/^['"“”]+|['"“”]+$/g, '').trim();
}

function parseGiveItemCommand(commandText) {
  const rest = cleanContent(commandText).replace(/^give\b/i, '').trim();
  if (!rest) return null;

  // Supports:
  // Rexy, give AbbyCake7 50 rubies
  // Rexy, give 50 rubies to AbbyCake7
  // Rexy, give 50 rubies AbbyCake7
  const amountItemToPlayer = rest.match(/^(\d{1,7})\s+(.+?)\s+(?:to|for)\s+(.+)$/i);
  if (amountItemToPlayer) {
    return {
      playerName: stripDecorativeQuotes(amountItemToPlayer[3]).replace(/^player\s+/i, '').trim(),
      quantity: Number(amountItemToPlayer[1]),
      itemName: stripDecorativeQuotes(amountItemToPlayer[2]),
    };
  }

  const playerAmountItem = rest.match(/^(.+?)\s+(\d{1,7})\s+(.+)$/i);
  if (playerAmountItem) {
    return {
      playerName: stripDecorativeQuotes(playerAmountItem[1]).replace(/^player\s+/i, '').trim(),
      quantity: Number(playerAmountItem[2]),
      itemName: stripDecorativeQuotes(playerAmountItem[3]),
    };
  }

  const amountItemPlayer = rest.match(/^(\d{1,7})\s+(.+?)\s+(.+)$/i);
  if (amountItemPlayer) {
    return {
      playerName: stripDecorativeQuotes(amountItemPlayer[3]).replace(/^player\s+/i, '').trim(),
      quantity: Number(amountItemPlayer[1]),
      itemName: stripDecorativeQuotes(amountItemPlayer[2]),
    };
  }

  return null;
}

function exactOrFuzzyPlayerMatches(players, targetName) {
  const wanted = normalizeLookupText(targetName);
  if (!wanted) return [];
  const exact = players.filter((p) => normalizeLookupText(p.name) === wanted);
  if (exact.length) return exact;
  return players.filter((p) => {
    const name = normalizeLookupText(p.name);
    return name.includes(wanted) || wanted.includes(name);
  });
}

function resolveServerForGivePlayer(player) {
  const servers = loadServerConfigs();
  const wanted = normalizeLookupText(player?.serverName || '');
  if (!wanted) return null;

  return servers.find((server) => {
    const full = normalizeLookupText(server.name);
    const display = normalizeLookupText(cleanServerDisplayName(server.name));
    return full === wanted || display === wanted || wanted.includes(display) || full.includes(wanted);
  }) || null;
}

async function getLiveStatusPlayersForGive() {
  const players = [];
  try {
    const status = await fetchJson(`${STATUS_API_BASE}/api/status`, WEBSITE_FETCH_TIMEOUT_MS);
    for (const server of status?.servers || []) {
      const serverName = server.name || server.map || 'Unknown';
      for (const detail of server.playerDetails || []) {
        if (!detail?.name) continue;
        players.push({
          name: detail.name,
          id: detail.id || null,
          playerNum: null,
          serverName,
          server: resolveServerForGivePlayer({ serverName }),
          source: 'Adult ASA /api/status playerDetails',
        });
      }
      for (const name of server.playerNames || []) {
        if (!name) continue;
        if (players.some((p) => normalizeLookupText(p.name) === normalizeLookupText(name) && normalizeLookupText(p.serverName) === normalizeLookupText(serverName))) continue;
        players.push({
          name,
          id: null,
          playerNum: null,
          serverName,
          server: resolveServerForGivePlayer({ serverName }),
          source: 'Adult ASA /api/status playerNames',
        });
      }
    }
  } catch (error) {
    console.warn('[REXY GIVE STATUS LOOKUP FAIL]', error?.message || error);
  }
  return players;
}

async function findGiveTargets(nameText) {
  const apiPlayers = await getLiveStatusPlayersForGive();
  const apiMatches = exactOrFuzzyPlayerMatches(apiPlayers, nameText);

  // Fast path: the website/status bot already knows the online player and their RCON ID.
  // This avoids Rexy sitting on the initial lookup while slow/offline maps time out.
  const apiMatchesWithId = apiMatches.filter((p) => p.id && (p.server || resolveServerForGivePlayer(p)));
  if (apiMatchesWithId.length) {
    return dedupeGiveMatches(apiMatchesWithId.map((p) => ({ ...p, server: p.server || resolveServerForGivePlayer(p) })));
  }

  // If the API found the player but not their ID, only RCON the matched map(s), not the whole cluster.
  const targetedServers = Array.from(new Map(
    apiMatches
      .map((p) => p.server || resolveServerForGivePlayer(p))
      .filter(Boolean)
      .map((server) => [server.name, server])
  ).values());

  const servers = targetedServers.length ? targetedServers : loadServerConfigs();
  const settled = await Promise.allSettled(servers.map(async (server) => {
    const rows = await rconListPlayersForKick(server);
    return rows.map((player) => ({ ...player, server, serverName: server.name }));
  }));

  const allPlayers = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') allPlayers.push(...result.value);
  }

  const rconMatches = exactOrFuzzyPlayerMatches(allPlayers, nameText);
  return dedupeGiveMatches([...rconMatches, ...apiMatches.map((p) => ({ ...p, server: p.server || resolveServerForGivePlayer(p) }))]);
}

function dedupeGiveMatches(players) {
  const seen = new Set();
  return (players || []).filter((player) => {
    const key = `${normalizeLookupText(player.name)}|${normalizeLookupText(player.serverName)}|${player.id || player.playerNum || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getGiveTargetIdentifiers(target) {
  const identifiers = [];
  for (const value of [target?.id, target?.playerNum, target?.name]) {
    const cleaned = cleanContent(value);
    if (!cleaned) continue;
    if (!identifiers.some((item) => item.toLowerCase() === cleaned.toLowerCase())) identifiers.push(cleaned);
  }
  return identifiers;
}

function looksLikeRconRejection(value) {
  const lower = String(value || '').toLowerCase();
  return lower.includes('unknown') ||
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('invalid') ||
    lower.includes('not allowed') ||
    lower.includes('permission');
}

async function sendGiveCommandSameSession(rcon, server, command, label) {
  try {
    const result = await rconSendOpen(rcon, server, command, label);
    const cleanResult = String(result || '').trim();
    if (!looksLikeRconRejection(cleanResult)) {
      return { ok: true, response: cleanResult, command };
    }
    return { ok: false, response: cleanResult, command };
  } catch (error) {
    return { ok: false, response: error?.message || String(error), command };
  }
}

function uniqueCommandList(commands) {
  const seen = new Set();
  return commands.filter((command) => {
    const key = String(command || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGiveItemToPlayerCommands(identifier, registeredItem, quantity) {
  const rawBlueprint = getRawBlueprintPath(registeredItem.rawBlueprint || registeredItem.blueprint);
  const blueprint = normalizeBlueprintPath(rawBlueprint || registeredItem.blueprint);
  const blueprintClass = blueprintWithClassSuffix(rawBlueprint || registeredItem.blueprint);
  const gfiCode = cleanContent(registeredItem.gfiCode || deriveGfiCodeFromBlueprint(rawBlueprint || registeredItem.blueprint));

  const quotedId = `"${identifier}"`;
  const bareId = identifier;
  const q = Number(quantity);

  const blueprintValues = uniqueCommandList([
    blueprint,
    blueprintClass,
    rawBlueprint,
    withClassSuffix(rawBlueprint),
    gfiCode,
  ].filter(Boolean));

  const commands = [];
  for (const bp of blueprintValues) {
    commands.push(`admincheat GiveItemToPlayer ${quotedId} "${bp}" ${q} 0 0`);
    commands.push(`admincheat GiveItemToPlayer ${quotedId} "${bp}" ${q} 0 false`);
    commands.push(`cheat GiveItemToPlayer ${quotedId} "${bp}" ${q} 0 0`);
    commands.push(`GiveItemToPlayer ${quotedId} "${bp}" ${q} 0 0`);

    if (/^[A-Za-z0-9_\-:.]+$/.test(identifier)) {
      commands.push(`admincheat GiveItemToPlayer ${bareId} "${bp}" ${q} 0 0`);
      commands.push(`cheat GiveItemToPlayer ${bareId} "${bp}" ${q} 0 0`);
    }
  }

  if (gfiCode) {
    commands.push(`admincheat GFI ${gfiCode} ${q} 0 0`);
    commands.push(`cheat GFI ${gfiCode} ${q} 0 0`);
  }

  return uniqueCommandList(commands);
}

function isDefinitelySuccessfulRconGiveResponse(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  if (looksLikeRconRejection(text)) return false;
  return /success|gave|added|sent|true|executed|server received|command/i.test(text);
}

async function giveRegisteredItemToPlayer(target, registeredItem, quantity) {
  const server = target.server || loadServerConfigs().find((s) => normalizeLookupText(s.name) === normalizeLookupText(target.serverName));
  if (!server) throw new Error(`Could not identify server for ${target.name}.`);

  const identifiers = getGiveTargetIdentifiers(target);
  if (!identifiers.length) throw new Error(`I found ${target.name}, but ListPlayers did not return a usable player ID.`);

  const rawBlueprint = getRawBlueprintPath(registeredItem.rawBlueprint || registeredItem.blueprint);
  const blueprint = normalizeBlueprintPath(rawBlueprint || registeredItem.blueprint);
  if (!blueprint && !registeredItem.gfiCode) throw new Error(`No blueprint path or GFI code is registered for ${registeredItem.name || registeredItem.key}.`);

  const adminPassword = server.adminPassword || server.rconPassword || 'IluvSCS';
  const rcon = rconForServer(server);
  const tried = [];
  const possibleSuccesses = [];

  try {
    await withHardTimeout(rcon.connect(), RCON_COMMAND_TIMEOUT_MS, `${cleanServerDisplayName(server.name)} RCON connect`);

    for (const command of [
      `EnableCheats ${adminPassword}`,
      `cheat EnableCheats ${adminPassword}`,
      `admincheat EnableCheats ${adminPassword}`,
    ]) {
      const result = await sendGiveCommandSameSession(rcon, server, command, 'EnableCheats');
      tried.push({ step: 'enablecheats', command, response: result.response });
      await sleep(150);
    }

    for (const identifier of identifiers) {
      try {
        await rconSendOpen(
          rcon,
          server,
          `ServerChatToPlayer "${identifier}" "Rexy is sending ${quantity} ${registeredItem.name || registeredItem.key}. Please check your inventory after approval."`,
          'ServerChatToPlayer before give'
        );
      } catch {}

      const commands = buildGiveItemToPlayerCommands(identifier, registeredItem, quantity);
      for (const command of commands) {
        const result = await sendGiveCommandSameSession(rcon, server, command, 'GiveItem/GFI');
        tried.push({ step: 'give', command, response: result.response });

        if (result.ok) {
          possibleSuccesses.push({ command, response: result.response, identifier });
          if (isDefinitelySuccessfulRconGiveResponse(result.response)) {
            await rconSendOpen(
              rcon,
              server,
              `ServerChatToPlayer "${identifier}" "Rexy give command finished. Check your inventory now."`,
              'ServerChatToPlayer after give'
            ).catch(() => {});
            return {
              ok: true,
              server,
              response: result.response,
              commandUsed: command.split(' ').slice(0, 3).join(' '),
              identifierUsed: identifier,
              triedCount: tried.length,
              confirmation: 'positive-rcon-response',
            };
          }
        }
        await sleep(175);
      }
    }

    if (possibleSuccesses.length) {
      const best = possibleSuccesses[0];
      await rconSendOpen(
        rcon,
        server,
        `ServerChatToPlayer "${best.identifier}" "Rexy sent the give command. Check your inventory now."`,
        'ServerChatToPlayer final'
      ).catch(() => {});
      return {
        ok: true,
        server,
        response: best.response,
        commandUsed: best.command.split(' ').slice(0, 3).join(' '),
        identifierUsed: best.identifier,
        triedCount: tried.length,
        confirmation: 'blank-rcon-response',
      };
    }
  } finally {
    await closeRconQuietly(rcon, server);
  }

  const useful = tried
    .filter((entry) => entry.step === 'give')
    .slice(-8)
    .map((entry) => `${entry.command.split(' ').slice(0, 3).join(' ')} => ${entry.response || '(blank response)'}`)
    .join(' | ');

  throw new Error(useful || 'GiveItemToPlayer/GFI was not accepted by the server.');
}

function createGiveRequestId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function buildGiveButtons(requestId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rexy_give_approve_${requestId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`rexy_give_deny_${requestId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function buildGiveConfirmationContent(request, status = 'pending') {
  const mapName = cleanServerDisplayName(request.target.serverName || request.target.server?.name || 'Unknown Map');
  const itemName = request.item.name || request.item.key || request.requestedItemName;
  const lines = [];

  if (status === 'pending') lines.push('⚠️ **Rexy Give Approval Needed**');
  if (status === 'approved') lines.push('⏳ **Approved — sending item now...**');
  if (status === 'denied') lines.push('❌ **Give request denied.**');
  if (status === 'expired') lines.push('⌛ **Give request expired.**');

  lines.push(`Give **${request.target.name}** **${request.quantity} ${itemName}** on **${mapName}**?`);
  lines.push(`Requested by: <@${request.requestedById}>`);
  lines.push(`Matched by: ${request.target.source || 'RCON ListPlayers'}${request.target.id ? ' with player ID confirmed' : ' without player ID'}`);

  if (status === 'pending') lines.push('Only authorized Rexy staff/admin roles can approve or deny this.');
  return lines.join('\n');
}

async function getGiveApprovalChannel(message) {
  if (!REXY_GIVE_APPROVAL_CHANNEL_ID) return message.channel;
  const channel = await client.channels.fetch(REXY_GIVE_APPROVAL_CHANNEL_ID).catch(() => null);
  if (channel?.isTextBased?.()) return channel;
  return message.channel;
}

async function sendGiveApprovalRequest(commandMessage, workingMessage, request) {
  const requestId = createGiveRequestId();
  request.id = requestId;
  request.expiresAt = Date.now() + (5 * 60 * 1000);
  PENDING_GIVE_REQUESTS.set(requestId, request);

  const approvalChannel = await getGiveApprovalChannel(commandMessage);
  const content = buildGiveConfirmationContent(request, 'pending');
  const components = buildGiveButtons(requestId, false);

  let approvalMessage;
  if (approvalChannel.id === commandMessage.channel.id) {
    approvalMessage = await workingMessage.edit({ content, components });
  } else {
    approvalMessage = await approvalChannel.send({ content, components });
    await workingMessage.edit(`✅ Found **${request.target.name}** online on **${cleanServerDisplayName(request.target.serverName)}**. Approval request sent here: ${approvalMessage.url}`);
  }

  request.channelId = approvalMessage.channel.id;
  request.messageId = approvalMessage.id;

  const timer = setTimeout(async () => {
    const pending = PENDING_GIVE_REQUESTS.get(requestId);
    if (!pending) return;
    PENDING_GIVE_REQUESTS.delete(requestId);
    PENDING_GIVE_TIMERS.delete(requestId);
    try {
      const channel = await client.channels.fetch(pending.channelId).catch(() => null);
      const msg = channel?.messages ? await channel.messages.fetch(pending.messageId).catch(() => null) : null;
      if (msg) await msg.edit({ content: buildGiveConfirmationContent(pending, 'expired'), components: buildGiveButtons(requestId, true) });
    } catch {}
  }, 5 * 60 * 1000);
  PENDING_GIVE_TIMERS.set(requestId, timer);

  return approvalMessage;
}

function closePendingGiveRequest(requestId) {
  PENDING_GIVE_REQUESTS.delete(requestId);
  const timer = PENDING_GIVE_TIMERS.get(requestId);
  if (timer) clearTimeout(timer);
  PENDING_GIVE_TIMERS.delete(requestId);
}

async function handleGiveButtonInteraction(interaction) {
  if (!interaction.isButton?.()) return false;
  const match = String(interaction.customId || '').match(/^rexy_give_(approve|deny)_(.+)$/);
  if (!match) return false;

  const action = match[1];
  const requestId = match[2];
  const request = PENDING_GIVE_REQUESTS.get(requestId);

  if (!request) {
    await interaction.reply({ content: 'This Rexy give request is no longer active.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (!canCommandRexy(interaction.member)) {
    await interaction.reply({ content: 'You do not have permission to approve Rexy give requests.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (Date.now() > Number(request.expiresAt || 0)) {
    closePendingGiveRequest(requestId);
    await interaction.update({ content: buildGiveConfirmationContent(request, 'expired'), components: buildGiveButtons(requestId, true) }).catch(() => {});
    return true;
  }

  if (action === 'deny') {
    closePendingGiveRequest(requestId);
    appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'give_item_denied', requestId, targetName: request.target.name, item: request.item.name || request.requestedItemName, quantity: request.quantity, requestedById: request.requestedById, deniedById: interaction.user.id, deniedByTag: interaction.user.tag, channelId: interaction.channelId });
    await interaction.update({ content: `${buildGiveConfirmationContent(request, 'denied')}\nDenied by: <@${interaction.user.id}>`, components: buildGiveButtons(requestId, true) }).catch(() => {});
    return true;
  }

  await interaction.update({ content: `${buildGiveConfirmationContent(request, 'approved')}\nApproved by: <@${interaction.user.id}>`, components: buildGiveButtons(requestId, true) }).catch(() => {});

  // Once approved, this is no longer pending. Clear the expiry timer BEFORE RCON work
  // so a slow give cannot be overwritten by the old expiration handler.
  closePendingGiveRequest(requestId);

  try {
    const result = await withHardTimeout(
      giveRegisteredItemToPlayer(request.target, request.item, request.quantity),
      Math.max(RCON_COMMAND_TIMEOUT_MS * 3, 45000),
      `Rexy give ${request.target.name}`
    );
    appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'give_item_approved_sent', requestId, targetName: request.target.name, targetServer: result.server.name, item: request.item.name || request.requestedItemName, quantity: request.quantity, requestedById: request.requestedById, approvedById: interaction.user.id, approvedByTag: interaction.user.tag, channelId: interaction.channelId });
    await interaction.message.edit({ content: `✅ RCON give command sent for **${request.quantity} ${request.item.name || request.requestedItemName}** to **${request.target.name}** on **${cleanServerDisplayName(result.server.name)}**.
Approved by: <@${interaction.user.id}>
RCON: ${result.commandUsed || 'GiveItemToPlayer/GFI'} using ${result.identifierUsed || 'live player ID'}
Attempts: ${result.triedCount || 'unknown'} | Confirmation: ${result.confirmation || 'RCON accepted command'}`, components: [] }).catch(() => {});
  } catch (error) {
    closePendingGiveRequest(requestId);
    appendJsonLine(DECISIONS_FILE, { at: new Date().toISOString(), type: 'give_item_failed_after_approval', requestId, targetName: request.target.name, item: request.item.name || request.requestedItemName, quantity: request.quantity, error: sanitize(error?.message || error), requestedById: request.requestedById, approvedById: interaction.user.id, channelId: interaction.channelId });
    await interaction.message.edit({ content: `❌ Approved, but the give failed for **${request.target.name}**: ${sanitize(error?.message || error)}`, components: [] }).catch(() => {});
  }

  return true;
}

async function runGiveCommand(commandText, message) {
  const parsed = parseGiveItemCommand(commandText);
  if (!parsed || !parsed.playerName || !Number.isFinite(parsed.quantity) || parsed.quantity <= 0 || !parsed.itemName) {
    await message.reply('Use it like: `Rexy, give AbbyCake7 50 rubies` or `Rexy, give 50 rubies to AbbyCake7`');
    return;
  }

  const registeredItem = findRegisteredItem(parsed.itemName);
  if (!registeredItem) {
    await message.reply(`I do not have **${parsed.itemName}** registered yet. Use: \`Rexy, register /Path/Item.Item as the blueprint path for ${parsed.itemName}\``);
    return;
  }

  const workingMessage = await message.reply(`🔎 Looking for an online player matching **${parsed.playerName}** before creating the give approval...`);

  try {
    const matches = await findGiveTargets(parsed.playerName);

    if (!matches.length) {
      await workingMessage.edit(`Player not online.`);
      return;
    }

    const uniqueServers = new Set(matches.map((m) => normalizeLookupText(m.serverName)));
    if (matches.length > 1 && uniqueServers.size > 1) {
      await workingMessage.edit(`I found multiple matches. Be more specific: ${matches.map((m) => `**${m.name}** on **${cleanServerDisplayName(m.serverName)}**`).join(', ')}`);
      return;
    }

    const target = matches[0];
    if (!target.id) {
      await workingMessage.edit(
        `I found **${target.name}** on **${cleanServerDisplayName(target.serverName)}**, but I still do not have a usable live player ID. ` +
        `That ID is required for \`GiveItemToPlayer\`. Have them relog once, then try again. Source: ${target.source || 'unknown'}.`
      );
      return;
    }

    await workingMessage.edit(`✅ Found **${target.name}** on **${cleanServerDisplayName(target.serverName)}** with a live player ID. Creating approval request...`);

    await sendGiveApprovalRequest(message, workingMessage, {
      requestedById: message.author.id,
      requestedByTag: message.author.tag,
      requestedItemName: parsed.itemName,
      quantity: parsed.quantity,
      item: registeredItem,
      target: {
        name: target.name,
        id: target.id,
        playerNum: target.playerNum || null,
        serverName: target.serverName,
        server: target.server || resolveServerForGivePlayer(target),
        source: target.source || 'RCON ListPlayers',
      },
    });
  } catch (error) {
    console.error('[REXY GIVE COMMAND ERROR]', error?.stack || error?.message || error);
    await workingMessage.edit(`❌ Rexy found the give command, but the approval setup failed: ${sanitize(error?.message || error)}. Check Railway logs if this repeats.`).catch(() => {});
  }
}

function limitDiscord(text, max = 1800) {
  const clean = cleanContent(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3).trim() + '...';
}

function sanitize(text) {
  return String(text || '')
    .replace(/(DISCORD_TOKEN|OPENAI_API_KEY|RCON_PASSWORD|ADMIN_PASSWORD|FTP_[A-Z0-9_]*PASSWORD)\s*[:=]\s*\S+/gi, '$1=[hidden]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [hidden]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[hidden-openai-key]')
    .replace(/\bIluvSCS\b/gi, '[hidden-password]')
    .replace(/\b99Skyline!\b/gi, '[hidden-password]');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function messageToIndexContent(msg) {
  const parts = [];
  const plain = cleanContent(msg.content);
  if (plain) parts.push(plain);

  for (const embed of msg.embeds || []) {
    if (embed.title) parts.push(`Embed title: ${embed.title}`);
    if (embed.description) parts.push(`Embed description: ${embed.description}`);
    for (const field of embed.fields || []) parts.push(`Embed field ${field.name}: ${field.value}`);
    if (embed.footer?.text) parts.push(`Embed footer: ${embed.footer.text}`);
  }

  return sanitize(cleanContent(parts.join(' | ')));
}

function shouldIndexMessage(message) {
  return HISTORY_CHANNEL_IDS.includes(message.channelId) || isTicketChannel(message.channel);
}

function canCommandRexy(member) {
  if (!member?.roles?.cache) return false;
  return member.roles.cache.some((role) => ADMIN_ROLE_IDS.has(role.id));
}

function getMemberRoleContext(member) {
  try {
    return member.roles.cache
      .filter((role) => role.name !== '@everyone')
      .map((role) => `${role.name} (${role.id})`)
      .join(', ') || 'No visible roles.';
  } catch {
    return 'No visible roles.';
  }
}

function isGreetingText(text) {
  return /^(hi|hello|hey|yo|sup|howdy|what'?s up)$/i.test(cleanContent(text));
}

function buildGreeting(user) {
  return `Hey ${user}, what’s up?`;
}

// =====================
// LEARNING / MEMORY
// =====================
function loadLearnedFacts() {
  const data = readJsonFile(LEARNED_FACTS_FILE, []);
  return Array.isArray(data) ? data : [];
}

function saveLearnedFact(entry) {
  const facts = loadLearnedFacts();
  facts.unshift(entry);
  writeJsonFile(LEARNED_FACTS_FILE, facts.slice(0, 1000));
}

function normalizeQuestionKey(text) {
  return cleanContent(text)
    .toLowerCase()
    .replace(/^rexy\s*[,.:;!?-]?\s*/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLearnedFactsContext(questionText, maxItems = 10) {
  const facts = loadLearnedFacts();
  if (!facts.length) return 'No saved Rexy facts yet.';

  const q = normalizeQuestionKey(questionText);
  const terms = q.split(/\s+/).filter((w) => w.length >= 3).slice(0, 16);
  const scored = facts.map((fact) => {
    const hay = `${fact.prompt || ''} ${fact.fact || ''} ${fact.answer || ''}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
    return { fact, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((x, i) => `${i + 1}. ${x.fact.fact || x.fact.answer || x.fact.prompt}`)
    .join('\n') || 'No directly matching saved Rexy facts.';
}

function getIndexedHistoryContext(questionText, maxItems = 18) {
  if (!fs.existsSync(HISTORY_INDEX_FILE)) return 'No indexed Discord history yet.';

  const q = normalizeQuestionKey(questionText);
  const terms = q.split(/\s+/).filter((w) => w.length >= 3).slice(0, 18);
  if (!terms.length) return 'No relevant indexed Discord history found.';

  let lines = [];
  try {
    lines = fs.readFileSync(HISTORY_INDEX_FILE, 'utf8').split('\n').filter(Boolean);
  } catch {
    return 'Indexed Discord history unavailable.';
  }

  const scored = [];
  for (let i = lines.length - 1; i >= 0 && scored.length < 6000; i--) {
    try {
      const row = JSON.parse(lines[i]);
      const hay = `${row.channelName || ''} ${row.authorTag || ''} ${row.displayName || ''} ${row.roles || ''} ${row.content || ''}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
      if (score > 0) scored.push({ row, score });
    } catch {}
  }

  const matches = scored.sort((a, b) => b.score - a.score).slice(0, maxItems).map((x) => x.row);
  if (!matches.length) return 'No relevant indexed Discord history found.';

  return matches.map((row, i) => {
    const who = row.displayName || row.authorTag || 'unknown';
    return `${i + 1}. #${row.channelName || row.channelId} | ${who} | ${row.createdAt || ''}: ${row.content}`;
  }).join('\n');
}

// =====================
// HISTORY INDEXING
// =====================
async function getAllIndexableChannelIds() {
  const ids = new Set(HISTORY_CHANNEL_IDS);
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    for (const [, channel] of channels) {
      if (!channel?.isTextBased?.()) continue;
      if (isTicketChannel(channel)) ids.add(channel.id);
    }
  } catch (error) {
    console.warn('[REXY HISTORY] Ticket discovery failed:', error?.message || error);
  }
  return Array.from(ids);
}

async function indexOneChannel(channelId, options = {}) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { channelId, ok: false, count: 0, reason: 'not text based or inaccessible' };

  const state = readJsonFile(HISTORY_STATE_FILE, {});
  const channelState = state[channelId] || {};
  let before = options.forceFull ? null : channelState.oldestIndexedMessageId || null;
  let total = 0;
  let oldestSeen = before;
  let newestSeen = channelState.newestIndexedMessageId || null;
  const maxMessages = Number(options.maxMessages || HISTORY_MAX_MESSAGES_PER_CHANNEL || 0);

  while (true) {
    const fetchOptions = { limit: HISTORY_BATCH_LIMIT };
    if (before) fetchOptions.before = before;

    const batch = await channel.messages.fetch(fetchOptions).catch((error) => {
      console.warn(`[REXY HISTORY] Fetch failed for #${channel.name || channelId}:`, error?.message || error);
      return null;
    });

    if (!batch || batch.size === 0) break;

    const messages = Array.from(batch.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const msg of messages) {
      if (!msg || msg.author?.bot) continue;
      const content = messageToIndexContent(msg);
      if (!content) continue;

      appendJsonLine(HISTORY_INDEX_FILE, {
        indexedAt: new Date().toISOString(),
        guildId: msg.guildId,
        channelId: msg.channelId,
        channelName: msg.channel?.name || channel.name || null,
        messageId: msg.id,
        authorId: msg.author.id,
        authorTag: msg.author.tag,
        displayName: msg.member?.displayName || null,
        roles: getMemberRoleContext(msg.member),
        createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
        content,
        url: msg.url,
      });
      total += 1;
      newestSeen = newestSeen || msg.id;
    }

    oldestSeen = messages[0]?.id || oldestSeen;
    before = messages[0]?.id;
    if (maxMessages > 0 && total >= maxMessages) break;
    if (batch.size < HISTORY_BATCH_LIMIT) break;
    await sleep(350);
  }

  state[channelId] = {
    channelId,
    channelName: channel.name || null,
    lastIndexedAt: new Date().toISOString(),
    oldestIndexedMessageId: oldestSeen,
    newestIndexedMessageId: newestSeen,
    lastIndexedCount: total,
  };
  writeJsonFile(HISTORY_STATE_FILE, state);

  return { channelId, channelName: channel.name || null, ok: true, count: total };
}

let isIndexingHistory = false;
async function indexAllowedHistory(options = {}) {
  if (isIndexingHistory) return { ok: false, reason: 'index already running', results: [] };
  isIndexingHistory = true;
  const results = [];

  try {
    const channelIds = await getAllIndexableChannelIds();
    console.log(`[REXY HISTORY] Starting index for ${channelIds.length} channels.`);
    for (const channelId of channelIds) {
      const result = await indexOneChannel(channelId, options);
      results.push(result);
      console.log(`[REXY HISTORY] ${result.channelName || result.channelId}: ${result.count} indexed.`);
      await sleep(650);
    }
    return { ok: true, results };
  } finally {
    isIndexingHistory = false;
  }
}

// =====================
// LIVE / INTERNET CONTEXT
// =====================
async function fetchJson(url, timeoutMs = WEBSITE_FETCH_TIMEOUT_MS, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; AdultASA-Rexy/6.1; +https://adult-asa.org)',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...extraHeaders,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const hint = body ? ` - ${body.slice(0, 180)}` : '';
      throw new Error(`${res.status} ${res.statusText}${hint}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { text }; }
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, timeoutMs = WEBSITE_FETCH_TIMEOUT_MS, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; AdultASA-Rexy/6.1; +https://adult-asa.org)',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...extraHeaders,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function getLiveStatusContext() {
  const parts = [];
  try {
    const status = await fetchJson(`${STATUS_API_BASE}/api/status`);
    const servers = Array.isArray(status.servers) ? status.servers : [];
    parts.push(`Adult ASA website/API: ${ADULT_ASA_WEBSITE_URL}`);
    parts.push(`Total online survivors right now: ${Number(status.totalOnline || 0)}`);
    for (const s of servers) {
      const name = String(s.name || 'Unknown').replace(/^Adult ASA\s*-\s*/i, '');
      const names = Array.isArray(s.playerNames) && s.playerNames.length ? ` Players: ${s.playerNames.join(', ')}` : '';
      parts.push(`${name}: ${s.online ? 'online' : 'offline'}, ${Number(s.players || 0)}/${Number(s.maxPlayers || 0)}, ${s.versionLabel || s.version || 'unknown version'}.${names}`);
    }
  } catch (error) {
    parts.push(`Live cluster status unavailable: ${error?.message || error}`);
  }

  try {
    const tracker = await fetchJson(`${STATUS_API_BASE}/api/tracker?range=7d`);
    if (Array.isArray(tracker.trend) && tracker.trend.length) {
      const peak = tracker.trend.reduce((best, row) => Number(row.value || 0) > Number(best.value || 0) ? row : best, tracker.trend[0]);
      parts.push(`7d cluster peak from tracker trend: ${Number(peak.value || 0)} around ${new Date(Number(peak.time || Date.now())).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT.`);
    }
    if (Array.isArray(tracker.players) && tracker.players.length) {
      const top = tracker.players.slice(0, 10).map((p, i) => `${i + 1}. ${p.player}: ${(Number(p.totalMs || 0) / 3600000).toFixed(1)}h${p.isOnline ? ` online on ${p.currentServer}` : ''}`);
      parts.push(`7d tracked player activity: ${top.join(' | ')}`);
    }
  } catch (error) {
    parts.push(`Tracker API unavailable: ${error?.message || error}`);
  }

  return sanitize(parts.join('\n'));
}

async function getArkWikiContext(question) {
  const q = cleanContent(question)
    .replace(/[?]/g, '')
    .replace(/\b(rexy|where|what|how|do|does|can|i|find|tame|a|an|the|is|are|best|way|in|on|for|with)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  if (!q || q.length < 3) return 'No ARK wiki query needed.';

  try {
    const url = 'https://ark.wiki.gg/api.php?action=opensearch&namespace=0&limit=5&format=json&search=' + encodeURIComponent(q);
    const data = await fetchJson(url, 8000);
    if (!Array.isArray(data) || !Array.isArray(data[1])) return 'No ARK wiki result found.';
    const titles = data[1] || [];
    const descs = data[2] || [];
    const links = data[3] || [];
    if (!titles.length) return 'No ARK wiki result found.';
    return titles.slice(0, 5).map((title, i) => `${title}: ${descs[i] || 'No summary'} (${links[i] || 'no link'})`).join('\n');
  } catch (error) {
    return `ARK wiki lookup unavailable: ${error?.message || error}`;
  }
}

function summarizeSteamStatPayload(data) {
  const raw = data?.text ? data.text : JSON.stringify(data || {});
  const text = String(raw || '');

  const signals = [];
  const lower = text.toLowerCase();

  if (lower.includes('offline') || lower.includes('down') || lower.includes('major')) {
    signals.push('possible outage/degradation mentioned');
  }
  if (lower.includes('normal') || lower.includes('online') || lower.includes('ok')) {
    signals.push('services appear normal/online');
  }

  return {
    sourceSummary: text.slice(0, 1400),
    signals: signals.length ? signals.join(', ') : 'no obvious outage keyword found',
  };
}

async function getSteamStatusContext(question) {
  const q = cleanContent(question).toLowerCase();
  if (!/\bsteam\b|network issues?|status|down|outage|ark.*connect|connection/.test(q)) return 'No Steam status query needed.';

  const errors = [];

  // Primary: steamstat.us API. This can occasionally block cloud providers with 403,
  // so Rexy tries it first, then falls back to the public page.
  try {
    const data = await fetchJson('https://steamstat.us/api/v2', 9000, {
      Referer: 'https://steamstat.us/',
      Origin: 'https://steamstat.us',
    });
    const summary = summarizeSteamStatPayload(data);
    return `Steam live status from steamstat.us API. Signals: ${summary.signals}. Data: ${summary.sourceSummary}`;
  } catch (error) {
    errors.push(`steamstat.us API: ${error?.message || error}`);
  }

  try {
    const html = await fetchText('https://steamstat.us/', 9000, {
      Referer: 'https://steamstat.us/',
    });
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const summary = summarizeSteamStatPayload({ text: stripped });
    return `Steam live status from steamstat.us page. Signals: ${summary.signals}. Page text: ${summary.sourceSummary}`;
  } catch (error) {
    errors.push(`steamstat.us page: ${error?.message || error}`);
  }

  // Last-resort connectivity check. It is not a full outage detector, but tells Rexy
  // whether Steam's public store API is reachable from Railway right now.
  try {
    const data = await fetchJson('https://store.steampowered.com/api/featuredcategories?cc=us&l=en', 9000, {
      Referer: 'https://store.steampowered.com/',
    });
    const ok = data && typeof data === 'object';
    return `Steam store API is reachable from Rexy right now (${ok ? 'received valid data' : 'received a response'}). I could not read steamstat.us directly. Errors: ${errors.join(' | ')}`;
  } catch (error) {
    errors.push(`Steam store API: ${error?.message || error}`);
  }

  return `I could not verify Steam live status from Railway right now. Checks failed: ${errors.join(' | ')}`;
}


function shouldUseInternetContext(question) {
  const q = cleanContent(question).toLowerCase();

  if (/\b(steam|xbox|playstation|psn|nitrado|curseforge|mod page|server status|outage|down|network issue|latest patch|patch notes|update|current|today|right now|newest|wiki|wikipedia|ark\.wiki|dododex|google|search|look up|internet|web)\b/.test(q)) {
    return true;
  }

  if (/\b(how do i|how to|where can i|where do i|what is|what are|best way|preferred|tame|spawn|artifact|boss|recipe|engram|resource|creature|dino|map)\b/.test(q)) {
    return true;
  }

  return false;
}

function buildSearchQuery(question) {
  const q = cleanContent(question)
    .replace(/^rexy\s*[,.:;!?-]?\s*/i, '')
    .replace(/[^\w\s'"!?-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!q) return 'ARK Survival Ascended Adult ASA';

  if (/\b(ark|asa|dino|tame|spawn|artifact|boss|engram|creature|resource|recipe|map)\b/i.test(q)) {
    return `${q} ARK Survival Ascended wiki.gg`;
  }

  if (/\bsteam\b/i.test(q)) return `${q} Steam status`;
  if (/\bxbox\b/i.test(q)) return `${q} Xbox status`;
  if (/\b(playstation|psn)\b/i.test(q)) return `${q} PlayStation Network status`;
  if (/\bnitrado\b/i.test(q)) return `${q} Nitrado status`;

  return q;
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtmlToText(match ? match[1] : '').slice(0, 160);
}

function extractDuckDuckGoResults(html, limit = 5) {
  const results = [];
  const seen = new Set();
  const text = String(html || '');
  const rx = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = rx.exec(text)) && results.length < limit) {
    let url = match[1] || '';
    const title = stripHtmlToText(match[2] || '');

    try {
      const parsed = new URL(url, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    } catch {}

    if (!title || !url || seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url });
  }

  if (!results.length) {
    const generic = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = generic.exec(text)) && results.length < limit) {
      let url = match[1] || '';
      const title = stripHtmlToText(match[2] || '');
      if (!title || title.length < 4) continue;
      if (!/^https?:/i.test(url) && !url.includes('/l/?')) continue;

      try {
        const parsed = new URL(url, 'https://duckduckgo.com');
        const uddg = parsed.searchParams.get('uddg');
        if (uddg) url = decodeURIComponent(uddg);
      } catch {}

      if (seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url });
    }
  }

  return results;
}

function preferTrustedResults(results) {
  const trusted = [
    'ark.wiki.gg',
    'wiki.gg',
    'survivetheark.com',
    'nitrado.net',
    'status.playstation.com',
    'support.xbox.com',
    'xbox.com',
    'steamstat.us',
    'store.steampowered.com',
    'steamcommunity.com',
    'curseforge.com',
    'mod.io',
  ];

  return (results || []).slice().sort((a, b) => {
    const ah = trusted.findIndex((domain) => String(a.url || '').toLowerCase().includes(domain));
    const bh = trusted.findIndex((domain) => String(b.url || '').toLowerCase().includes(domain));
    const as = ah === -1 ? 999 : ah;
    const bs = bh === -1 ? 999 : bh;
    return as - bs;
  });
}

async function searchWebLite(query, limit = 5) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url, 10000, {
    Referer: 'https://duckduckgo.com/',
  });

  return preferTrustedResults(extractDuckDuckGoResults(html, limit));
}

async function fetchPageSummary(url) {
  try {
    const html = await fetchText(url, 10000, {
      Referer: url,
    });
    const title = extractTitle(html);
    const body = stripHtmlToText(html).slice(0, 1800);
    return `${title ? `Title: ${title}. ` : ''}${body}`;
  } catch (error) {
    return `Could not fetch ${url}: ${error?.message || error}`;
  }
}

async function getPlatformStatusContext(question) {
  const q = cleanContent(question).toLowerCase();
  const parts = [];

  if (/\bxbox\b/.test(q)) {
    try {
      const html = await fetchText('https://support.xbox.com/en-US/xbox-live-status', 10000, {
        Referer: 'https://support.xbox.com/',
      });
      parts.push(`Xbox status page: ${stripHtmlToText(html).slice(0, 1200)}`);
    } catch (error) {
      parts.push(`Xbox status page unavailable: ${error?.message || error}`);
    }
  }

  if (/\bpsn\b|\bplaystation\b|\bps5\b/.test(q)) {
    try {
      const html = await fetchText('https://status.playstation.com/', 10000, {
        Referer: 'https://status.playstation.com/',
      });
      parts.push(`PlayStation status page: ${stripHtmlToText(html).slice(0, 1200)}`);
    } catch (error) {
      parts.push(`PlayStation status page unavailable: ${error?.message || error}`);
    }
  }

  if (/\bnitrado\b/.test(q)) {
    try {
      const html = await fetchText('https://status.nitrado.net/', 10000, {
        Referer: 'https://status.nitrado.net/',
      });
      parts.push(`Nitrado status page: ${stripHtmlToText(html).slice(0, 1200)}`);
    } catch (error) {
      parts.push(`Nitrado status page unavailable: ${error?.message || error}`);
    }
  }

  return parts.length ? parts.join('\n') : 'No platform status page needed.';
}

async function getGeneralInternetContext(question) {
  if (!shouldUseInternetContext(question)) return 'No general internet lookup needed.';

  const query = buildSearchQuery(question);
  const pieces = [`Search query used: ${query}`];

  try {
    const results = await searchWebLite(query, 6);
    if (!results.length) return `Internet lookup found no useful search results for: ${query}`;

    pieces.push('Search results:');
    results.slice(0, 6).forEach((result, i) => {
      pieces.push(`${i + 1}. ${result.title} - ${result.url}`);
    });

    const pagesToFetch = results.slice(0, 2);
    for (const result of pagesToFetch) {
      const summary = await fetchPageSummary(result.url);
      pieces.push(`Page summary from ${result.url}: ${summary}`);
      await sleep(250);
    }

    return sanitize(pieces.join('\n')).slice(0, 5000);
  } catch (error) {
    return `Internet lookup unavailable: ${error?.message || error}`;
  }
}

function getStaticAdultAsaKnowledge() {
  return sanitize(`
Adult ASA basics:
- Website: ${ADULT_ASA_WEBSITE_URL}
- Server name: Adult ASA
- Password: Enjoy
- Discord invite: https://discord.gg/adultasa
- PvE cluster.
- Max wild dino level: 150.
- Max wyvern level: 190.
- Max shiny level: 220.
- Harvest amount: 3x.
- Taming speed: 5x.
- Egg hatch speed: 100x.
- Gestation speed: 100x.
- Baby mature speed: 200x.
- No PvE structure decay. No PvE dino decay.
- Cryo fridge required: no. Cryo sickness PvE: off.
- Flyer speed leveling: on. Unlimited mindwipes: on.
- Pepper is the Overseer, owner, and creator of Adult ASA.
- Rexy should tag channels/roles/people when helpful, but never spam mentions.

Known role IDs:
${Object.entries(KNOWN_ROLE_IDS).map(([name, id]) => `${name}: ${id}`).join('\n')}

Rexy personality:
- Chill ARK player energy.
- Smart, useful, a little funny when it fits.
- Short answers first. Details only when needed.
- No corporate support voice.
- If the answer needs a current number, use live API/context/history instead of guessing.
- If a user corrects Rexy, learn from it.
- If asked for secrets, passwords, tokens, private credentials, or unsafe stuff, answer exactly: ...
`.trim());
}

async function getMentionedMemberContext(message, questionText) {
  const pieces = [];

  for (const [, member] of message.mentions.members || []) {
    pieces.push(`${member.displayName} / ${member.user.tag}: roles ${getMemberRoleContext(member)}`);
  }

  const whoMatch = cleanContent(questionText).match(/\bwho\s+is\s+(.+)\??$/i);
  if (whoMatch) {
    const query = whoMatch[1].replace(/[<@!>]/g, '').trim();
    if (query.length >= 2) {
      try {
        const found = await message.guild.members.fetch({ query, limit: 5 });
        for (const [, member] of found) {
          pieces.push(`${member.displayName} / ${member.user.tag}: roles ${getMemberRoleContext(member)}`);
        }
      } catch {}
    }
  }

  return pieces.length ? pieces.join('\n') : 'No specific mentioned/member context found.';
}


// =====================
// PHASE 6.1 STRUCTURED BRAIN + CONVERSATION MEMORY
// =====================
function ensureCollectionShape(collection, key) {
  if (!collection || typeof collection !== 'object') collection = { version: 1, [key]: [] };
  if (!Array.isArray(collection[key])) collection[key] = [];
  if (!collection.version) collection.version = 1;
  return collection;
}

function phaseReadJson(dataFile, repoFile, fallback) {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8');
      if (raw.trim()) return JSON.parse(raw);
    }
    if (repoFile && fs.existsSync(repoFile)) {
      const raw = fs.readFileSync(repoFile, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : fallback;
      writeJsonFile(dataFile, parsed);
      return parsed;
    }
  } catch (error) {
    console.warn('[REXY BRAIN READ]', dataFile, error?.message || error);
  }
  return fallback;
}

function loadBrain() {
  return {
    entities: ensureCollectionShape(phaseReadJson(BRAIN_ENTITIES_FILE, path.join(__dirname, 'rexy_entities.json'), { version: 1, entities: [] }), 'entities'),
    relationships: ensureCollectionShape(phaseReadJson(BRAIN_RELATIONSHIPS_FILE, path.join(__dirname, 'rexy_relationships.json'), { version: 1, relationships: [] }), 'relationships'),
    tasks: ensureCollectionShape(phaseReadJson(BRAIN_TASKS_FILE, path.join(__dirname, 'rexy_tasks.json'), { version: 1, tasks: [] }), 'tasks'),
  };
}

function saveBrain(brain) {
  if (brain?.entities) writeJsonFile(BRAIN_ENTITIES_FILE, brain.entities);
  if (brain?.relationships) writeJsonFile(BRAIN_RELATIONSHIPS_FILE, brain.relationships);
  if (brain?.tasks) writeJsonFile(BRAIN_TASKS_FILE, brain.tasks);
}

function brainKey(value) {
  return normalizeQuestionKey(value).replace(/\s+/g, '_') || `item_${Date.now()}`;
}

function upsertBrainEntity(name, patch = {}) {
  const cleanName = cleanContent(name);
  if (!cleanName) return null;

  const brain = loadBrain();
  const id = patch.id || brainKey(cleanName);
  let entity = brain.entities.entities.find((item) => item.id === id || normalizeQuestionKey(item.name) === normalizeQuestionKey(cleanName));

  if (!entity) {
    entity = {
      id,
      name: cleanName,
      type: patch.type || 'entity',
      aliases: [],
      facts: [],
      confidence: Number(patch.confidence || 0.75),
      priority: Number(patch.priority || 50),
      sources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    brain.entities.entities.unshift(entity);
  }

  entity.type = patch.type || entity.type || 'entity';
  entity.confidence = Math.max(Number(entity.confidence || 0), Number(patch.confidence || 0));
  entity.priority = Math.max(Number(entity.priority || 0), Number(patch.priority || 0));
  entity.aliases = Array.from(new Set([...(entity.aliases || []), ...(patch.aliases || [])].filter(Boolean))).slice(0, 40);
  entity.facts = Array.from(new Set([...(entity.facts || []), ...(patch.facts || [])].filter(Boolean))).slice(0, 120);
  entity.sources = Array.from(new Set([...(entity.sources || []), ...(patch.sources || [])].filter(Boolean))).slice(0, 60);

  for (const [key, value] of Object.entries(patch)) {
    if (!['id','name','type','aliases','facts','confidence','priority','sources'].includes(key)) entity[key] = value;
  }

  entity.updatedAt = new Date().toISOString();
  saveBrain(brain);
  return entity;
}

function rememberRelationship(subject, predicate, object, patch = {}) {
  const cleanSubject = cleanContent(subject);
  const cleanPredicate = cleanContent(predicate);
  const cleanObject = cleanContent(object);
  if (!cleanSubject || !cleanPredicate || !cleanObject) return null;

  const brain = loadBrain();
  const key = `${brainKey(cleanSubject)}|${brainKey(cleanPredicate)}|${brainKey(cleanObject)}`;
  let rel = brain.relationships.relationships.find((item) => item.key === key);

  if (!rel) {
    rel = {
      key,
      subject: cleanSubject,
      predicate: cleanPredicate,
      object: cleanObject,
      confidence: Number(patch.confidence || 0.8),
      priority: Number(patch.priority || 50),
      source: patch.source || 'Rexy brain',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    brain.relationships.relationships.unshift(rel);
  }

  Object.assign(rel, patch, { updatedAt: new Date().toISOString() });
  saveBrain(brain);
  return rel;
}

function rememberTask(title, patch = {}) {
  const cleanTitle = cleanContent(title);
  if (!cleanTitle) return null;
  const brain = loadBrain();
  const task = {
    id: patch.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: cleanTitle,
    status: patch.status || 'open',
    priority: patch.priority || 'normal',
    source: patch.source || 'Rexy brain',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  brain.tasks.tasks.unshift(task);
  saveBrain(brain);
  return task;
}

function loadStaffCorrections() {
  const data = readJsonFile(STAFF_CORRECTIONS_FILE, []);
  return Array.isArray(data) ? data : [];
}

function saveStaffCorrection(entry) {
  const rows = loadStaffCorrections();
  rows.unshift(entry);
  writeJsonFile(STAFF_CORRECTIONS_FILE, rows.slice(0, 2000));
}

function getStaffCorrectionContext(questionText, maxItems = 12) {
  const rows = loadStaffCorrections();
  if (!rows.length) return 'No Pepper/staff corrections stored yet.';
  const terms = normalizeQuestionKey(questionText).split(/\s+/).filter((w) => w.length >= 3).slice(0, 18);

  const scored = rows.map((row) => {
    const hay = `${row.fact || ''} ${row.context || ''} ${row.source || ''}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0) + Number(row.priority || 0) / 1000;
    return { row, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((x, i) => `${i + 1}. ${x.row.fact} (source: ${x.row.correctedByTag || x.row.source || 'staff'}, priority ${x.row.priority || 1000})`)
    .join('\n') || 'No matching Pepper/staff corrections.';
}

function inferCorrectionFact(message, commandText) {
  const text = cleanContent(commandText || message.content || '');
  if (!canCommandRexy(message.member)) return null;
  if (/^(bad rexy|wrong|that'?s wrong|no,?|nah,?|actually|correction|fix this|remember|learn)\b/i.test(text) || /\b(should be|is actually|the answer is|you need to|you should say|from now on)\b/i.test(text)) {
    return text.replace(/^(bad rexy|wrong|that'?s wrong|no,?|nah,?|actually|correction|fix this|remember|learn)\s*[:,.-]?\s*/i, '').trim();
  }
  return null;
}

function capturePhase6Learning(message, commandText) {
  const source = `${message.member?.displayName || message.author.tag} in #${message.channel?.name || message.channelId}`;
  const correction = inferCorrectionFact(message, commandText);

  if (correction && correction.length >= 5) {
    const entry = {
      fact: correction,
      context: commandText,
      correctedById: message.author.id,
      correctedByTag: message.author.tag,
      source,
      priority: canCommandRexy(message.member) ? 1000 : 250,
      createdAt: new Date().toISOString(),
    };
    saveStaffCorrection(entry);
    saveLearnedFact({
      fact: correction,
      prompt: correction,
      savedById: message.author.id,
      savedByTag: message.author.tag,
      channelId: message.channelId,
      channelName: message.channel?.name || null,
      createdAt: entry.createdAt,
      source: 'phase6 correction capture',
    });
    upsertBrainEntity('Adult ASA Corrections', { type: 'correction_bank', facts: [correction], sources: [source], confidence: 1.0, priority: 1000 });
  }

  // Structured payloads Rexy can ingest.
  if (/<ASA\.MEM>|MEMORY_TAG:|FACT_\d+|PX-\d+|ACRO150|CASINO=|CS_PULL|BaseGuardians|AUTH=/i.test(commandText) && canCommandRexy(message.member)) {
    const facts = [];
    if (/CS_PULL\s*=\s*500|CS Pull\s*=\s*500|PX-500/i.test(commandText)) facts.push('Cyber Structures pull range should be 500 foundations.');
    if (/ACRO150\s*=\s*10-?15BTX|Acro150_BioToxin\s*=\s*10-?15|Acro 150.*10-?15/i.test(commandText)) facts.push('Level 150 Acro on Adult ASA usually needs about 10-15 Bio Toxin; bring 50 to be safe.');
    if (/CASINO\s*=\s*VAL|Casino_Map\s*=\s*Valguero/i.test(commandText)) facts.push('LudopARK Casino is only on Valguero.');
    if (/BG\s*=\s*!EXT,!AST|BaseGuardians\s*=\s*!Extinction,!Astraeos/i.test(commandText)) facts.push('Base Guardians are unavailable on Extinction and Astraeos.');

    for (const fact of facts) {
      saveStaffCorrection({ fact, context: commandText, correctedById: message.author.id, correctedByTag: message.author.tag, source, priority: 1000, createdAt: new Date().toISOString() });
      saveLearnedFact({ fact, prompt: fact, savedById: message.author.id, savedByTag: message.author.tag, channelId: message.channelId, channelName: message.channel?.name || null, createdAt: new Date().toISOString(), source: 'structured ASA memory payload' });
    }
    if (facts.length) upsertBrainEntity('Adult ASA', { type: 'server_cluster', facts, sources: [source], confidence: 1.0, priority: 1000 });
  }
}

function searchBrainContext(questionText, maxItems = 20) {
  const brain = loadBrain();
  const q = normalizeQuestionKey(questionText);
  const terms = q.split(/\s+/).filter((w) => w.length >= 3).slice(0, 20);
  if (!terms.length) return 'No structured Rexy brain context found.';

  function score(value, priority = 0) {
    const hay = String(value || '').toLowerCase();
    return terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0) + Number(priority || 0) / 1000;
  }

  const entities = brain.entities.entities
    .map((entity) => ({ entity, score: score(`${entity.name} ${entity.type} ${(entity.aliases || []).join(' ')} ${(entity.facts || []).join(' ')}`, entity.priority) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  const rels = brain.relationships.relationships
    .map((rel) => ({ rel, score: score(`${rel.subject} ${rel.predicate} ${rel.object} ${rel.source || ''}`, rel.priority) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  const tasks = brain.tasks.tasks
    .map((task) => ({ task, score: score(`${task.title} ${task.status} ${task.notes || ''}`, task.priority === 'high' ? 500 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const lines = [];
  if (entities.length) {
    lines.push('Structured entities:');
    for (const { entity } of entities) lines.push(`- ${entity.name} (${entity.type || 'entity'}, priority ${entity.priority || 0}): ${(entity.facts || []).slice(0, 10).join('; ') || 'no facts'}${entity.aliases?.length ? ` | aliases: ${entity.aliases.join(', ')}` : ''}`);
  }
  if (rels.length) {
    lines.push('Structured relationships:');
    for (const { rel } of rels) lines.push(`- ${rel.subject} ${rel.predicate} ${rel.object} (${rel.source || 'memory'}, confidence ${rel.confidence ?? 'unknown'}, priority ${rel.priority || 0})`);
  }
  if (tasks.length) {
    lines.push('Tasks:');
    for (const { task } of tasks) lines.push(`- ${task.title} [${task.status || 'open'}]`);
  }

  return lines.length ? lines.join('\n') : 'No structured Rexy brain context found.';
}

function loadConversationMemory() {
  const data = readJsonFile(CONVERSATION_MEMORY_FILE, { version: 1, threads: {} });
  if (!data.threads || typeof data.threads !== 'object') data.threads = {};
  return data;
}

function saveConversationMemory(data) {
  writeJsonFile(CONVERSATION_MEMORY_FILE, data);
}

function conversationKey(message) {
  return `${message.channelId}:${message.author.id}`;
}

function recordConversationTurn(message, question, answer = null) {
  try {
    const data = loadConversationMemory();
    const key = conversationKey(message);
    const thread = data.threads[key] || {
      key,
      channelId: message.channelId,
      userId: message.author.id,
      displayName: message.member?.displayName || message.author.tag,
      turns: [],
      updatedAt: null,
    };
    thread.displayName = message.member?.displayName || message.author.tag;
    thread.channelName = message.channel?.name || null;
    thread.turns.unshift({ at: new Date().toISOString(), question: sanitize(question || ''), answer: answer ? sanitize(answer) : null });
    thread.turns = thread.turns.slice(0, 50);
    thread.updatedAt = new Date().toISOString();
    data.threads[key] = thread;
    saveConversationMemory(data);
  } catch (error) {
    console.warn('[REXY CONVERSATION MEMORY]', error?.message || error);
  }
}

function loadConversationSummary() {
  const data = readJsonFile(CONVERSATION_SUMMARY_FILE, { version: 1, users: {}, topics: {}, recent: [] });
  if (!data.users || typeof data.users !== 'object') data.users = {};
  if (!data.topics || typeof data.topics !== 'object') data.topics = {};
  if (!Array.isArray(data.recent)) data.recent = [];
  return data;
}

function saveConversationSummary(data) {
  writeJsonFile(CONVERSATION_SUMMARY_FILE, data);
}

function extractConversationTopics(text) {
  const clean = normalizeQuestionKey(text);
  const stop = new Set([
    'rexy','what','when','where','why','how','the','and','for','with','that','this','you','your','are','was','were','have','has','had','can','could','would','should','about','from','into','onto','then','than','them','they','there','here','does','did','will','list','give','tell','all','any','our','server','asa','adult','ark'
  ]);
  return clean.split(/\s+/).filter((word) => word.length >= 3 && !stop.has(word)).slice(0, 12);
}

function recordConversationObservation(message, indexedContent, addressedToRexy = false) {
  try {
    const content = sanitize(indexedContent || messageToIndexContent(message) || cleanContent(message.content || ''));
    if (!content) return;

    const roles = getMemberRoleContext(message.member);
    const displayName = message.member?.displayName || message.author.tag;
    const channelName = message.channel?.name || null;
    const topics = extractConversationTopics(content);

    const row = {
      at: new Date().toISOString(),
      guildId: message.guild?.id || null,
      channelId: message.channelId,
      channelName,
      messageId: message.id,
      authorId: message.author.id,
      authorTag: message.author.tag,
      displayName,
      roles,
      addressedToRexy,
      isTicket: isTicketChannel(message.channel),
      topics,
      content: content.slice(0, 1200),
      url: message.url,
    };

    appendJsonLine(CONVERSATION_TIMELINE_FILE, row);

    const summary = loadConversationSummary();
    const user = summary.users[message.author.id] || {
      userId: message.author.id,
      authorTag: message.author.tag,
      displayName,
      names: [],
      roles: [],
      channels: {},
      topicCounts: {},
      lastMessages: [],
      firstSeenAt: row.at,
      lastSeenAt: row.at,
    };

    user.authorTag = message.author.tag;
    user.displayName = displayName;
    user.names = Array.from(new Set([...(user.names || []), displayName, message.author.username, message.author.tag].filter(Boolean))).slice(0, 20);
    user.roles = Array.from(new Set([...(user.roles || []), ...roles.split(',').map((x) => x.trim()).filter(Boolean)])).slice(0, 40);
    user.channels[channelName || message.channelId] = (user.channels[channelName || message.channelId] || 0) + 1;
    user.lastSeenAt = row.at;
    for (const topic of topics) user.topicCounts[topic] = (user.topicCounts[topic] || 0) + 1;
    user.lastMessages = [{ at: row.at, channelName, content: row.content, addressedToRexy }, ...(user.lastMessages || [])].slice(0, 25);
    summary.users[message.author.id] = user;

    for (const topic of topics) {
      const bucket = summary.topics[topic] || { topic, count: 0, lastSeenAt: row.at, messages: [] };
      bucket.count += 1;
      bucket.lastSeenAt = row.at;
      bucket.messages = [{ at: row.at, authorId: message.author.id, displayName, channelName, content: row.content }, ...(bucket.messages || [])].slice(0, 25);
      summary.topics[topic] = bucket;
    }

    summary.recent = [row, ...(summary.recent || [])].slice(0, 400);
    saveConversationSummary(summary);

    upsertBrainEntity(displayName, {
      type: 'person',
      aliases: [message.author.username, message.author.tag].filter(Boolean),
      facts: [
        `Last seen talking in #${channelName || message.channelId} at ${row.at}.`,
        topics.length ? `Recent topics: ${topics.slice(0, 8).join(', ')}.` : null,
      ].filter(Boolean),
      sources: [`Discord conversation memory: ${message.url}`],
      confidence: 0.65,
      priority: addressedToRexy ? 120 : 40,
      userId: message.author.id,
      lastSeenAt: row.at,
      lastChannel: channelName || message.channelId,
    });
  } catch (error) {
    console.warn('[REXY CONVERSATION OBSERVE]', error?.message || error);
  }
}

function readConversationTimelineTail(maxLines = 3000) {
  if (!fs.existsSync(CONVERSATION_TIMELINE_FILE)) return [];
  try {
    const raw = fs.readFileSync(CONVERSATION_TIMELINE_FILE, 'utf8').trim();
    if (!raw) return [];
    return raw.split(/\r?\n/).filter(Boolean).slice(-maxLines).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (error) {
    console.warn('[REXY CONVERSATION TAIL]', error?.message || error);
    return [];
  }
}

function searchConversationTimeline(questionText, message, maxItems = 16) {
  const terms = extractConversationTopics(questionText);
  const rows = readConversationTimelineTail(4500);
  if (!rows.length) return 'No long-term conversation timeline stored yet.';

  const askUserId = message.author.id;
  const q = normalizeQuestionKey(questionText);
  const wantsSelfHistory = /\b(what did i|what was i|my question|my convo|we talk|remember|last time|yesterday|week ago|earlier)\b/i.test(q);
  const wantsPeople = /\b(who is|who's|who are|person|player|member|mod|owner|overseer)\b/i.test(q);

  const scored = rows.map((row) => {
    const hay = `${row.displayName || ''} ${row.authorTag || ''} ${row.channelName || ''} ${(row.roles || '')} ${(row.topics || []).join(' ')} ${row.content || ''}`.toLowerCase();
    let score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 2 : 0), 0);
    if (row.authorId === askUserId) score += wantsSelfHistory ? 4 : 1;
    if (row.addressedToRexy) score += 1;
    if (wantsPeople && /role|overseer|mod|contributor|survivor|player|xbox|ps5|pc/i.test(row.roles || '')) score += 1;
    return { row, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.row.at || '').localeCompare(String(a.row.at || ''));
  });

  if (!scored.length) return 'No matching long-term conversation records found.';

  return scored.slice(0, maxItems).map((x, i) => {
    const r = x.row;
    return `${i + 1}. ${r.at} #${r.channelName || r.channelId} ${r.displayName}: ${r.content}`;
  }).join('\n');
}

function getUserConversationSummaryContext(message, questionText) {
  const summary = loadConversationSummary();
  const terms = extractConversationTopics(questionText);
  const lines = [];

  const self = summary.users?.[message.author.id];
  if (self) {
    const topTopics = Object.entries(self.topicCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => `${topic}(${count})`).join(', ');
    const topChannels = Object.entries(self.channels || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([channel, count]) => `#${channel}(${count})`).join(', ');
    lines.push(`Asking user's stored conversation profile: ${self.displayName}; roles: ${(self.roles || []).slice(0, 12).join(', ') || 'unknown'}; common topics: ${topTopics || 'none yet'}; common channels: ${topChannels || 'none yet'}; last seen: ${self.lastSeenAt || 'unknown'}.`);
  }

  for (const term of terms.slice(0, 8)) {
    const topic = summary.topics?.[term];
    if (!topic) continue;
    lines.push(`Topic memory "${term}" appeared ${topic.count} times. Recent: ${(topic.messages || []).slice(0, 4).map((m) => `${m.displayName} in #${m.channelName}: ${m.content}`).join(' | ')}`);
  }

  return lines.length ? lines.join('\n') : 'No user/topic conversation summary found.';
}

function getConversationContext(message, questionText) {
  const data = loadConversationMemory();
  const thread = data.threads[conversationKey(message)];
  const isFollowUp = /^(what about|and|also|how about|what if|then|that|those|it|they|them|where|why|how many|how much|do they|did they|are they|was it|is it|you missed)\b/i.test(cleanContent(questionText));
  const lines = [];

  if (thread && Array.isArray(thread.turns) && thread.turns.length) {
    const turns = thread.turns.slice(0, isFollowUp ? 12 : 7).map((turn, i) => `${i + 1}. User: ${turn.question}${turn.answer ? ` | Rexy: ${turn.answer}` : ''}`);
    lines.push(`Recent direct Rexy thread with ${thread.displayName}:\n${turns.join('\n')}`);
  } else {
    lines.push('No prior direct Rexy thread with this user in this channel.');
  }

  lines.push(`Stored user/topic conversation summary:\n${getUserConversationSummaryContext(message, questionText)}`);
  lines.push(`Relevant long-term Discord conversation timeline:\n${searchConversationTimeline(questionText, message, isFollowUp ? 22 : 14)}`);

  return lines.join('\n\n');
}

// =====================
// AI ANSWERING
// =====================
async function answerWithRexy(message, questionText) {
  const [liveContext, wikiContext, steamContext, platformContext, generalInternetContext, memberContext] = await Promise.all([
    getLiveStatusContext(),
    getArkWikiContext(questionText),
    getSteamStatusContext(questionText),
    getPlatformStatusContext(questionText),
    getGeneralInternetContext(questionText),
    getMentionedMemberContext(message, questionText),
  ]);

  const brainContext = searchBrainContext(questionText);
  const staffCorrectionContext = getStaffCorrectionContext(questionText);
  const conversationContext = getConversationContext(message, questionText);
  const historyContext = getIndexedHistoryContext(questionText);
  const learnedContext = getLearnedFactsContext(questionText);

  const system = `
You are Rexy, the Adult ASA Discord AI helper.

Return ONLY valid JSON:
{
  "answer": "short Discord reply"
}

Rules:
- Reply only to the user's actual question, but use prior conversation context when the user is clearly following up or asking what was discussed before.
- Use this priority order: Pepper/staff corrections > structured Rexy brain > long-term conversation timeline > live Adult ASA/API data > Discord history/embeds > member roles > saved facts > ASA wiki/Dododex/mod pages > general knowledge.
- Be direct and useful. Usually 1-4 short sentences.
- If the user asks for a list, give the list.
- If the user asks current stats/status/news, use live API/status/internet context. Do not invent numbers.
- If the user asks about people/roles, use member role context and indexed Discord history.
- If the user asks something unsafe, private, sexual, hateful, credential-seeking, or secret-seeking, answer exactly: ...
- Never reveal tokens, passwords, RCON, FTP, admin passwords, or hidden config values.
- No staff suggestion channel exists. Do not say to wait for staff approval.
- You may ask one short follow-up if needed.
- Keep conversational continuity: if the user says "they", "them", "it", "what about", "do they", or "you missed", resolve it from recent direct Rexy thread plus long-term conversation timeline before answering.
- Use the long-term conversation timeline to remember who Rexy talked with, what they talked about, what Rexy was taught, and what Rexy learned.
- Sound like a bouncy, funny, sharp ARK player. Smart first, helpful always, witty when it fits. No corporate fluff. No rambling.
`;

  const user = `
Adult ASA static knowledge:
${getStaticAdultAsaKnowledge()}

Live Adult ASA/API context:
${liveContext}

Structured Rexy brain context:
${brainContext}

Pepper/staff correction context:
${staffCorrectionContext}

Recent and long-term conversation memory:
${conversationContext}

Trusted ARK wiki context:
${wikiContext}

Steam/status context if relevant:
${steamContext}

Console/platform/Nitrado status context if relevant:
${platformContext}

General internet search/page context if relevant:
${generalInternetContext}

Member/role context:
${memberContext}

Saved Rexy facts:
${learnedContext}

Relevant indexed Discord history and embeds:
${historyContext}

Current channel: #${message.channel?.name || message.channelId}
Asking user: ${message.member?.displayName || message.author.tag}
User roles: ${getMemberRoleContext(message.member)}
Question: ${questionText}
`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: system.trim() },
      { role: 'user', content: user.trim() },
    ],
    temperature: 0.35,
    max_tokens: 650,
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const parsed = safeJsonParse(raw);
  const answer = parsed?.answer || raw;
  return limitDiscord(sanitize(answer || '...'), 1800);
}

// =====================
// ADMIN COMMANDS
// =====================
function parseQuotedOrRest(text, command) {
  const clean = cleanContent(text);
  const rest = clean.replace(new RegExp(`^${command}\\s*`, 'i'), '').trim();
  const quoted = rest.match(/^["“](.+)["”]$/);
  return cleanContent(quoted ? quoted[1] : rest);
}

async function handleAdminCommand(message, commandText) {
  const clean = cleanContent(commandText);
  const command = clean.split(/\s+/)[0]?.toLowerCase();
  if (!ADMIN_COMMANDS.has(command)) return false;

  if (!canCommandRexy(message.member)) {
    await message.reply('You do not have permission to give Rexy admin commands.');
    return true;
  }

  if (command === 'start' || command === 'stop' || command === 'restart') {
    const targetText = parseServerActionTarget(commandText, command);
    const result = await runServerPowerAction(command, targetText || 'cluster', message);
    await message.channel.send(limitDiscord(result, 1900));
    return true;
  }

  if (command === 'kick') {
    const result = await runKickCommand(commandText, message);
    await message.reply(limitDiscord(result, 1900));
    return true;
  }

  if (command === 'register') {
    const result = registerItemBlueprint(commandText, message);
    await message.reply(limitDiscord(result, 1900));
    return true;
  }

  if (command === 'give') {
    await runGiveCommand(commandText, message);
    return true;
  }

  if (command === 'status') {
    await message.reply('Rexy is online. Phase 6.1 is active: activation-only replies, all configured channel indexing, ticket memory, embed reading, role awareness, internet/status lookups, ASA-first mod knowledge, live server stats, Nitrado start/stop/restart commands, and RCON kick commands.');
    return true;
  }

  if (command === 'index') {
    await message.reply('Starting a Discord history index. I will read configured channels plus ticket-#### channels I can access.');
    indexAllowedHistory({ forceFull: /full/i.test(clean) }).then((result) => {
      const total = (result.results || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
      message.channel.send(`History index complete. Indexed ${total} messages from ${result.results.length} channels.`).catch(() => {});
    }).catch((error) => {
      message.channel.send(`History index failed: ${error?.message || error}`).catch(() => {});
    });
    return true;
  }


  if (command === 'commands') {
    await message.reply('Rexy admin commands: status, index, index full, memory, learn, say, commands, reload, start, stop, restart, kick, register, give. Examples: Rexy, restart the island | Rexy, kick PlayerName | Rexy, register /Path/Item.Item as the blueprint path for Rubies | Rexy, give AbbyCake7 50 rubies.');
    return true;
  }

  if (command === 'memory') {
    const facts = loadLearnedFacts();
    const brain = loadBrain();
    const summary = loadConversationSummary();
    const entities = Array.isArray(brain.entities?.entities) ? brain.entities.entities.length : 0;
    const relationships = Array.isArray(brain.relationships?.relationships) ? brain.relationships.relationships.length : 0;
    const tasks = Array.isArray(brain.tasks?.tasks) ? brain.tasks.tasks.length : 0;
    const convoUsers = summary.users ? Object.keys(summary.users).length : 0;
    const convoTopics = summary.topics ? Object.keys(summary.topics).length : 0;
    await message.reply(`Memory online. Saved facts: ${facts.length}. Brain entities: ${entities}. Relationships: ${relationships}. Tasks: ${tasks}. Conversation users: ${convoUsers}. Topics: ${convoTopics}. Timeline: ${fs.existsSync(CONVERSATION_TIMELINE_FILE) ? 'yes' : 'not yet'}. Indexed history file: ${fs.existsSync(HISTORY_INDEX_FILE) ? 'yes' : 'not yet'}.`);
    return true;
  }

  if (command === 'say' || command === 'learn') {
    const fact = parseQuotedOrRest(commandText, command);
    if (!fact) {
      await message.reply(`Use it like: Rexy, ${command} Pepper is the Overseer.`);
      return true;
    }

    saveLearnedFact({
      fact,
      prompt: fact,
      savedById: message.author.id,
      savedByTag: message.author.tag,
      channelId: message.channelId,
      channelName: message.channel?.name || null,
      createdAt: new Date().toISOString(),
    });
    await message.reply('Got it. I’ll remember that.');
    return true;
  }

  if (command === 'reload') {
    await message.reply('Reload needs a Railway redeploy. Push the updated file to GitHub and Railway will restart me.');
    return true;
  }

  return false;
}

// =====================
// EVENTS
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`[REXY] Logged in as ${client.user.tag}`);
  console.log('[REXY] Phase 6.1 active: long-term conversation timeline, user/topic memory, structured brain, activation-only replies, full configured history indexing, ticket memory, embed reading, roles, broader internet/status lookups, wiki context, live stats, Nitrado controls, RCON kick commands.');
  console.log(`[REXY HISTORY] Configured base channels: ${HISTORY_CHANNEL_IDS.length}`);

  if (AUTO_INDEX_HISTORY_ON_START) {
    indexAllowedHistory({ forceFull: false }).catch((error) => {
      console.error('[REXY HISTORY ERROR]', error?.stack || error?.message || error);
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;
    if (await handleGiveButtonInteraction(interaction)) return;
  } catch (error) {
    console.error('[REXY INTERACTION ERROR]', error?.stack || error?.message || error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Rexy hit an error handling that approval button. Check Railway logs.', ephemeral: true }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    if (message.author.bot) return;

    const content = cleanContent(message.content);
    const indexedContent = messageToIndexContent(message);
    const isTicket = isTicketChannel(message.channel);
    const addressedToRexy = startsWithRexyCommand(content);
    const commandText = addressedToRexy ? stripRexyCommand(content) : content;

    appendJsonLine(MEMORY_FILE, {
      at: new Date().toISOString(),
      guildId: message.guild.id,
      channelId: message.channelId,
      channelName: message.channel?.name || null,
      isTicket,
      addressedToRexy,
      authorId: message.author.id,
      authorTag: message.author.tag,
      displayName: message.member?.displayName || null,
      roles: getMemberRoleContext(message.member),
      content: sanitize(content),
      indexedContent,
      url: message.url,
    });

    recordConversationObservation(message, indexedContent, addressedToRexy);

    if (shouldIndexMessage(message) && indexedContent) {
      appendJsonLine(HISTORY_INDEX_FILE, {
        indexedAt: new Date().toISOString(),
        guildId: message.guild.id,
        channelId: message.channelId,
        channelName: message.channel?.name || null,
        messageId: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        displayName: message.member?.displayName || null,
        roles: getMemberRoleContext(message.member),
        createdAt: message.createdAt ? message.createdAt.toISOString() : null,
        content: indexedContent,
        url: message.url,
      });
    }

    // Rexy listens everywhere it can, but only replies when explicitly called.
    if (!addressedToRexy) return;

    capturePhase6Learning(message, commandText);

    if (await handleAdminCommand(message, commandText)) return;

    if (isGreetingText(commandText)) {
      await message.reply(buildGreeting(message.author));
      return;
    }

    const questionText = commandText || content;
    if (!questionText) return;

    await message.channel.sendTyping().catch(() => {});
    const answer = await answerWithRexy(message, questionText);

    appendJsonLine(DECISIONS_FILE, {
      at: new Date().toISOString(),
      question: questionText,
      answer,
      channelId: message.channelId,
      channelName: message.channel?.name || null,
      authorId: message.author.id,
      authorTag: message.author.tag,
      url: message.url,
    });

    recordConversationTurn(message, questionText, answer);
    await message.reply(answer || '...');
  } catch (error) {
    console.error('[REXY MESSAGE ERROR]', error?.stack || error?.message || error);
    if (startsWithRexyCommand(message?.content || '')) {
      await message.reply('I hit an error reading that. Check Railway logs for the Rexy service.').catch(() => {});
    }
  }
});

process.on('unhandledRejection', (reason) => console.error('[REXY UNHANDLED]', reason));
process.on('uncaughtException', (error) => console.error('[REXY UNCAUGHT]', error));

client.login(DISCORD_TOKEN);
