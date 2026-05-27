const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 51234;
const SECRET = 'ai-config-switcher-2024';

const CLAUDE_DIR = path.join(process.env.USERPROFILE, '.claude');
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const OPENCODE_SETTINGS = path.join(process.env.USERPROFILE, '.opencode.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function encrypt(text) {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length));
  }
  return Buffer.from(result, 'binary').toString('base64');
}

function decrypt(encoded) {
  if (!encoded) return '';
  try {
    const text = Buffer.from(encoded, 'base64').toString('binary');
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length));
    }
    return result;
  } catch (e) { return encoded; }
}

function readJson(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) {}
  return def;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(CLAUDE_DIR)) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
}

if (!fs.existsSync(CONFIG_FILE)) {
  writeJson(CONFIG_FILE, { configs: [], activeId: null });
}

function decryptConfigs(data) {
  if (data.configs) {
    data.configs = data.configs.map(c => ({
      ...c,
      token: decrypt(c.token)
    }));
  }
  return data;
}

app.get('/api/configs', (req, res) => {
  const data = readJson(CONFIG_FILE, { configs: [], activeId: null });
  res.json(decryptConfigs(data));
});

app.post('/api/configs', (req, res) => {
  const data = readJson(CONFIG_FILE, { configs: [], activeId: null });
  const config = {
    id: Date.now().toString(),
    name: req.body.name || '未命名',
    type: req.body.type || 'claude',
    providerType: req.body.providerType || 'anthropic',
    token: encrypt(req.body.token || ''),
    baseUrl: req.body.baseUrl || '',
    model: req.body.model || '',
    haikuModel: req.body.haikuModel || ''
  };
  data.configs.push(config);
  writeJson(CONFIG_FILE, data);
  res.json({ success: true, config: { ...config, token: req.body.token || '' } });
});

app.put('/api/configs/:id', (req, res) => {
  const data = readJson(CONFIG_FILE, { configs: [], activeId: null });
  const index = data.configs.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '不存在' });
  
  const updates = { ...req.body };
  if (updates.token !== undefined) updates.token = encrypt(updates.token);
  
  data.configs[index] = { ...data.configs[index], ...updates };
  writeJson(CONFIG_FILE, data);
  res.json({ success: true, config: { ...data.configs[index], token: decrypt(data.configs[index].token) } });
});

app.delete('/api/configs/:id', (req, res) => {
  const data = readJson(CONFIG_FILE, { configs: [], activeId: null });
  data.configs = data.configs.filter(c => c.id !== req.params.id);
  if (data.activeId === req.params.id) data.activeId = null;
  writeJson(CONFIG_FILE, data);
  res.json({ success: true });
});

function switchClaude(config) {
  const s = readJson(CLAUDE_SETTINGS);
  if (!s.env) s.env = {};
  if (config.token) s.env.ANTHROPIC_AUTH_TOKEN = config.token;
  if (config.baseUrl) s.env.ANTHROPIC_BASE_URL = config.baseUrl;
  if (config.model) {
    s.env.ANTHROPIC_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
  }
  if (config.haikuModel) s.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.haikuModel;
  writeJson(CLAUDE_SETTINGS, s);
}

function switchOpencode(config) {
  const s = readJson(OPENCODE_SETTINGS, { providers: {}, agents: { coder: { model: '', maxTokens: 5000 }, task: { model: '', maxTokens: 5000 }, title: { model: '', maxTokens: 80 } } });
  const p = config.providerType || 'anthropic';
  if (!s.providers[p]) s.providers[p] = {};
  if (config.token) s.providers[p].apiKey = config.token;
  if (config.baseUrl) s.providers[p].baseUrl = config.baseUrl;
  if (config.model) {
    s.agents.coder.model = config.model;
    s.agents.task.model = config.model;
  }
  writeJson(OPENCODE_SETTINGS, s);
}

app.post('/api/switch/:id', (req, res) => {
  const data = readJson(CONFIG_FILE, { configs: [], activeId: null });
  const config = data.configs.find(c => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: '不存在' });
  
  const decrypted = { ...config, token: decrypt(config.token) };
  
  try {
    if (decrypted.type === 'opencode') switchOpencode(decrypted);
    else switchClaude(decrypted);
    data.activeId = config.id;
    writeJson(CONFIG_FILE, data);
    res.json({ success: true, config: decrypted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    exec(`start http://localhost:${PORT}`);
    process.exit(0);
  }
});
