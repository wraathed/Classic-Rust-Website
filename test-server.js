const { GameDig } = require('gamedig');

console.log("Scanning for Rust Server...");

// Test 1: Standard Port (28015)
GameDig.query({
    type: 'rust',
    host: '192.168.50.117',
    port: 28015
}).then((state) => {
    console.log("✅ FOUND ON PORT 28015!");
    console.log("Map:", state.map);
    console.log("Players:", state.players.length);
}).catch((e) => {
    console.log("❌ Failed on 28015");
});

// Test 2: Query Port (28016) - Common for Rust
GameDig.query({
    type: 'rust',
    host: '192.168.50.117',
    port: 28016 
}).then((state) => {
    console.log("✅ FOUND ON PORT 28016!");
    console.log("Map:", state.map);
    console.log("Players:", state.players.length);
}).catch((e) => {
    console.log("❌ Failed on 28016");
});