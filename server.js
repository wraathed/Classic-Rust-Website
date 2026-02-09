const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const Database = require('better-sqlite3');
const { GameDig } = require('gamedig'); // Required for Server Status

const app = express();
const port = 3000;
const db = new Database('tickets.db');

// --- CONFIGURATION ---

// 1. YOUR ADMIN STEAM ID (Replace with yours)
const ADMIN_IDS = ['76561198871950726']; 

// 2. YOUR SERVER LIST
const SERVERS = [
    { 
        name: "Classic Rust Test Server", 
        ip: "127.0.0.1", 
        port: 28016, 
        type: 'rust' 
    }
    // Add more servers here later like:
    // { name: "Another Server", ip: "1.2.3.4", port: 28015, type: 'rust' }
];

// --- DATABASE SETUP ---
db.prepare(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    steamId TEXT,
    username TEXT,
    avatar TEXT,
    category TEXT,
    subject TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    sender_steamId TEXT,
    sender_name TEXT,
    sender_avatar TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'rust_server_secret', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy({
    returnURL: 'http://localhost:3000/auth/steam/return',
    realm: 'http://localhost:3000/',
    apiKey: 'BAA48553BDB1ED78D06A56E6343FCDEE' // <--- PASTE YOUR API KEY HERE
  },
  (identifier, profile, done) => done(null, profile)
));

app.use(express.static(path.join(__dirname, '')));

// --- AUTH ROUTES ---
app.get('/auth/steam', passport.authenticate('steam'));
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => res.redirect('/index.html'));
app.get('/user', (req, res) => {
    if(!req.user) return res.json(null);
    const isAdmin = ADMIN_IDS.includes(req.user.id);
    res.json({ ...req.user, isAdmin });
});
app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// --- HELPER: Is Admin? ---
function isAdmin(req) {
    return req.user && ADMIN_IDS.includes(req.user.id);
}

// --- SERVER STATUS ROUTE (NEW) ---
app.get('/api/servers', async (req, res) => {
    try {
        const promises = SERVERS.map(server => 
            GameDig.query({
                type: server.type,
                host: server.ip,
                port: server.port,
                maxAttempts: 2 // Don't wait too long if offline
            }).then((state) => {
                return {
                    name: server.name,
                    ip: server.ip,
                    port: server.port,
                    map: state.map,
                    players: state.players.length,
                    maxPlayers: state.maxplayers,
                    status: 'Online'
                };
            }).catch((error) => {
                return {
                    name: server.name,
                    ip: server.ip,
                    port: server.port,
                    map: "N/A",
                    players: 0,
                    maxPlayers: 0,
                    status: 'Offline'
                };
            })
        );

        const results = await Promise.all(promises);
        res.json(results);
    } catch (err) {
        res.json([]);
    }
});

// --- TICKET ROUTES ---
app.post('/api/tickets', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Login required' });
    const { category, subject, description } = req.body;

    const createTx = db.transaction(() => {
        const stmt = db.prepare('INSERT INTO tickets (steamId, username, avatar, category, subject) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(req.user.id, req.user.displayName, req.user.photos[2].value, category, subject);
        const ticketId = info.lastInsertRowid;

        const msgStmt = db.prepare('INSERT INTO messages (ticket_id, sender_steamId, sender_name, sender_avatar, content) VALUES (?, ?, ?, ?, ?)');
        msgStmt.run(ticketId, req.user.id, req.user.displayName, req.user.photos[2].value, description);
    });

    createTx();
    res.json({ success: true });
});

app.get('/api/my-tickets', (req, res) => {
    if (!req.user) return res.status(401).json([]);
    const stmt = db.prepare('SELECT * FROM tickets WHERE steamId = ? ORDER BY id DESC');
    res.json(stmt.all(req.user.id));
});

app.get('/api/ticket/:id', (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const ticketId = req.params.id;
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return res.status(404).send("Ticket not found");
    if (ticket.steamId !== req.user.id && !isAdmin(req)) return res.status(403).send("Forbidden");

    const messages = db.prepare('SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
    res.json({ ticket, messages, currentUserSteamId: req.user.id, isAdmin: isAdmin(req) });
});

app.post('/api/ticket/:id/reply', (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const ticketId = req.params.id;
    const { content } = req.body;

    const stmt = db.prepare('INSERT INTO messages (ticket_id, sender_steamId, sender_name, sender_avatar, content) VALUES (?, ?, ?, ?, ?)');
    stmt.run(ticketId, req.user.id, req.user.displayName, req.user.photos[2].value, content);

    const newStatus = isAdmin(req) ? 'Answered' : 'Open';
    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(newStatus, ticketId);
    res.json({ success: true });
});

app.post('/api/ticket/:id/status', (req, res) => {
    if (!isAdmin(req)) return res.status(403).send("Admins only");
    const { status } = req.body;
    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
});

// --- ADMIN ROUTES ---
app.get('/api/admin/tickets', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json([]);
    const tickets = db.prepare('SELECT * FROM tickets ORDER BY status DESC, created_at DESC').all();
    res.json(tickets);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});