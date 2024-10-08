const worker = new Worker('../assets/js/worker.js');

const menu = document.getElementById("settings");
const PPSslider = document.getElementById("PPSSlider");
const ppsOutput = document.getElementById("PPSlimit");
const depthSlider = document.getElementById("DepthSlider");
const depthOutput = document.getElementById("Depth");
const fumenInput = document.getElementById("Fumen");
const queueInput = document.getElementById("Queue");

const app = new PIXI.Application({
    width: (COLS + 13) * BLOCK_SIZE, // 6 for hold and 6 for queue
    height: (RENDER_ROWS+1) * BLOCK_SIZE,
    antialias: true,
    resolution: 1,
});

document.getElementById('board').appendChild(app.view);

let seed = Date.now();

game = new Bot(app, seed, seed, worker);

let gameRunning = false;
let stopping = false;

let startTime = 0;
let targetPPS = 3;

let depth = 5;
let playingDepth = 5;
let ppsLimit  = 3;

let showSetting = false;
let quit = false;
let fumen = "";

Howler.volume(0.2);

function init(){
    game.init();
    drawBorder(game);
    game.state.sevenBag();
    game.state.sevenBag();
    game.state.sevenBag();

    const queue = game.encodeQueue();

    worker.postMessage({type: 'start', board: fumen, queue: queue});
    game.state.clearBoard();
    game.state.spawnPiece();
    game.hold();
    drawActive(game);
    drawQueue(game);
}

function play(){
    if (gameRunning) return;

    if (stopping) {
        document.getElementById("wait").style.display = "block";
        return
    }

    document.getElementById("wait").style.display = "none";

    gameRunning = true;
    init();
    queueToBoard();
    parseFumen(fumen, game.state.board);
    drawBoard(game);
    playingDepth = depth;
    targetPPS = ppsLimit;

    startTime = performance.now();

    worker.postMessage({type: 'suggest', depth: playingDepth});
    gameLoop();
}

function gameLoop(){
    if (!gameRunning) return;

    let t1 = performance.now();
    let time = (t1 - startTime) / 1000;

    let pps = game.state.stats.pieceCount / time
    let app = (game.state.stats.attack / game.state.stats.pieceCount)

    app = isNaN(app) ? 0 : app;

    let vs = (game.state.stats.attack + game.state.stats.garbageCleared) / game.state.stats.pieceCount * pps * 100;

    document.getElementById("Timer").innerHTML = "Time: " + time.toFixed(3);
    document.getElementById("PPS").innerHTML = game.state.stats.pieceCount + " | " + pps.toFixed(2) + " PPS";
    document.getElementById("APM").innerHTML = game.state.stats.attack + " | " + (game.state.stats.attack * 60 / time).toFixed(2) + " APM";
    document.getElementById("APP").innerHTML = app.toFixed(3) + " APP";

    let t2 = performance.now();

    setTimeout(gameLoop, FPS_DELTA - t2 + t1);
}

function stopGame(){
    if (!gameRunning) return;

    let seed = Date.now();

    stopping = true;
    gameRunning = false;
    game.destroy();
    game = new Bot(app, seed, seed, worker);
}

// let loop = setInterval(() =>{
//     if (!gameRunning) return;
//     game.garbageIn(5);
//     playerSounds["garbage_in_medium"].play();
// },1000);

worker.onmessage = (e) => {
    document.getElementById("Score").innerHTML = "Score: " + e.data.score;
    document.getElementById("Reward").innerHTML = "Reward: " + e.data.reward;

    if (stopping) {
        worker.postMessage({type: 'quit'});
        gameRunning = false;
        stopping = false;
        return;
    }

    if (e.data.value === 0) return;
    if (e.data.type !== 'suggestion') return;

    game.drawPV(e.data.pv);

    const move = e.data.move.location;
    const spin = e.data.move.spin;

    let t = performance.now() - startTime;
    let duration = ((game.pieceCount + 1) / targetPPS * 1000) - t;

    setTimeout(() => {
        if (stopping) {
            worker.postMessage({type: 'quit'});
            gameRunning = false;
            stopping = false;
            return;
        }

        if (move.piece === game.state.heldPiece) game.hold();

        game.movePiece(move, spin);
        game.place();
        game.clearLines();
        game.drawPV(e.data.pv.slice(1));

        worker.postMessage({type: 'suggest', depth: playingDepth});
    }, duration)
}