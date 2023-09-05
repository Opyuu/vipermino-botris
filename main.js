const worker = new Worker('worker.js');

const game_canvas = document.getElementById("board");
const queue_canvas = document.getElementById("queue");
const hold_canvas = document.getElementById("hold");
const pps = document.getElementById("pps");


var gameRunning = false;
var startTime;
var moveDelay = 500;


function init(){
    let q1 = game.state.encodequeue();
    let q2 = game.state.sevenbag();
    let q3 = game.state.sevenbag();
    // Pass queue into wasm
    // Call seven bag 2 more times and pass those to wasm
    // Pass q1 q2 q3
    worker.postMessage({type: 'init', v1: q1, v2: q2, v3: q3});
    startTime = performance.now();
    game.state.hold = game.state.queue.shift(); // Move first piece to hold
}

function evaluate(){
    worker.postMessage({type: 'eval', q: 0});
}

function play(){
    if (gameRunning) return;
    gameRunning = true;
    game = new Game(game_canvas, queue_canvas, hold_canvas);
    game.init();
    init();

    game.drawframe();
    game.drawQueue();
    game.drawHold();

    evaluate();
    gameLoop();
}

function an(){
    document.body.style.backgroundColor = '#00bbdc';
}

function gameLoop(){
    t1 = performance.now();
    let time = (t1 - startTime) / 1000;
    // Draw frame only when COBRA plays a move

    // Update PPS counter
    document.getElementById("PPS").innerHTML = "PPS: " + (game.state.piececount / time).toFixed(2);
    document.getElementById("APM").innerHTML = "APM: " + (game.state.attack * 60 / time).toFixed(2);
    document.getElementById("APP").innerHTML = "APP: " + (game.state.attack / game.state.piececount).toFixed(3);


    // Update APM counter
    // console.log("Game running");
    t2 = performance.now()
    if(gameRunning) setTimeout(gameLoop, FPS_DELTA - t2 + t1);
}

function stopGame(){
    gameRunning = false;
    worker.postMessage({type: 'kill'});
    delete game;
}

worker.onmessage = (e) =>{
    if (gameRunning == false) return; // Avoids uncaught errors.
    game.state.piececount++;

    game.parseMove(e.data.value); // Move received & played. Draws shadow piece
    game.drawHold(); // Update hold 
    game.drawQueue(); // Update queue - piece used
    
    let delay = Math.max(0, moveDelay - e.data.time);
    setTimeout(() => {
        if (gameRunning == false) return // Is game still running after the timeout?
        // Actually play the move
        game.state.clearLines();

        // Update board & queue
        game.drawframe();
        game.drawQueue();

        let queue = 0
        if (game.state.piececount % 7 == 0) queue = game.state.sevenbag();

        worker.postMessage({type: 'eval', q: queue}); // Continue evaluating if game hasn't been stopped
    }, delay);
}