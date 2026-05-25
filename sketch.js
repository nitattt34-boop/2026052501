let video;
let handPose;
let hands = [];

// 遊戲狀態： 0 = 載入中, 1 = 開始畫面, 2 = 遊戲中, 3 = 結束畫面
let gameState = 0; 

let score = 0;
let timer = 30; // 30秒遊戲時間
let lastTimeCheck = 0;

let bubbles = [];
let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function preload() {
  // 載入 ml5 handPose 模型
  handPose = ml5.handPose({ flipped: true }); 
}

function setup() {
  createCanvas(640, 480);
  
  // 開啟視訊鏡頭，並設定翻轉(flipped)以符合鏡像
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide(); // 隱藏原本的 HTML video，我們將畫在 p5 canvas 上
  
  // 開始偵測手部，當模型載入完畢後，切換狀態到開始畫面
  handPose.detectStart(video, gotHands);
  gameState = 1; // 模型準備好後進入開始畫面
  
  // 建立初始的字母泡泡
  for (let i = 0; i < 5; i++) {
    bubbles.push(new Bubble());
  }
}

function draw() {
  // 畫出鏡像翻轉的視訊背景
  image(video, 0, 0, width, height);
  
  // 加上一層半透明的黑色，讓文字和特效更清楚
  fill(0, 0, 0, 100);
  rect(0, 0, width, height);

  if (gameState === 0) {
    // 載入中
    drawLoadingScreen();
  } else if (gameState === 1) {
    // 開始畫面
    drawStartScreen();
    drawHandCursor(); // 依然畫出指標讓玩家熟悉
  } else if (gameState === 2) {
    // 遊戲進行中
    playGame();
  } else if (gameState === 3) {
    // 結束畫面
    drawGameOverScreen();
    drawHandCursor();
  }
}

// 取得手部偵測結果
function gotHands(results) {
  hands = results;
}

// --- 遊戲狀態繪製函式 ---

function drawLoadingScreen() {
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(32);
  text("AI 模型載入中...", width / 2, height / 2);
}

function drawStartScreen() {
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(40);
  text("✨ 魔法手勢字母保衛戰 ✨", width / 2, height / 2 - 40);
  
  textSize(20);
  fill(200, 255, 200);
  text("舉起手，用你的「食指指尖」觸碰泡泡！", width / 2, height / 2 + 10);
  
  textSize(24);
  fill(255, 255, 0);
  // 加入閃爍效果
  if (frameCount % 60 < 30) {
    text("點擊滑鼠或按 空白鍵 開始遊戲", width / 2, height / 2 + 60);
  }
}

function playGame() {
  // 處理計時器
  if (millis() - lastTimeCheck > 1000) {
    timer--;
    lastTimeCheck = millis();
    if (timer <= 0) {
      gameState = 3; // 時間到，切換到結束畫面
    }
  }

  // 繪製與更新泡泡
  for (let i = 0; i < bubbles.length; i++) {
    bubbles[i].move();
    bubbles[i].display();
    
    // 如果泡泡掉到底部，重置它
    if (bubbles[i].y > height + bubbles[i].r) {
      bubbles[i].reset();
    }
  }

  // 繪製 UI (分數與時間)
  drawUI();

  // 檢查玩家手勢互動
  checkHandInteraction();
}

function drawGameOverScreen() {
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(48);
  text("時間到！", width / 2, height / 2 - 40);
  
  textSize(32);
  fill(255, 255, 100);
  text("最終分數: " + score + " 分", width / 2, height / 2 + 20);
  
  textSize(24);
  fill(200);
  text("點擊滑鼠或按 空白鍵 重新開始", width / 2, height / 2 + 70);
}

function drawUI() {
  fill(255);
  noStroke();
  textSize(24);
  textAlign(LEFT, TOP);
  text("分數: " + score, 20, 20);
  
  textAlign(RIGHT, TOP);
  // 時間快到時變紅色
  if (timer <= 5) fill(255, 50, 50);
  else fill(255);
  text("剩餘時間: " + timer + " s", width - 20, 20);
}

// --- 手勢互動邏輯 ---

function checkHandInteraction() {
  if (hands.length > 0) {
    let hand = hands[0]; // 只取第一隻手
    
    // 在 ml5.js v1 中，食指的節點是一個陣列，指尖是第 4 個點 (索引值 3)
    let indexTip = hand.index_finger[3]; // 或是使用 hand.keypoints[8]
    
    if (indexTip) {
      let fX = indexTip.x;
      let fY = indexTip.y;
      
      // 畫出魔法光標
      noStroke();
      fill(0, 255, 255, 150);
      circle(fX, fY, 30);
      fill(255);
      circle(fX, fY, 10);
      
      // 檢查碰撞
      for (let i = 0; i < bubbles.length; i++) {
        let d = dist(fX, fY, bubbles[i].x, bubbles[i].y);
        if (d < bubbles[i].r + 15) { // 碰撞判定 (泡泡半徑 + 手指判定半徑)
          score += 1;
          bubbles[i].reset(); // 戳破後重新產生
        }
      }
    }
  }
}

// 非遊戲狀態下單純畫出指標
function drawHandCursor() {
  if (hands.length > 0) {
    let hand = hands[0];
    let indexTip = hand.index_finger[3];
    
    if (indexTip) {
      noStroke();
      fill(255, 100, 255, 150);
      circle(indexTip.x, indexTip.y, 30);
      fill(255);
      circle(indexTip.x, indexTip.y, 10);
    }
  }
}

// --- 遊戲控制 (滑鼠與鍵盤) ---

function mousePressed() {
  if (gameState === 1) {
    startGame();
  } else if (gameState === 3) {
    startGame();
  }
}

function keyPressed() {
  if (key === ' ' && (gameState === 1 || gameState === 3)) {
    startGame();
  }
}

function startGame() {
  score = 0;
  timer = 30;
  lastTimeCheck = millis();
  
  // 重置所有泡泡
  for (let i = 0; i < bubbles.length; i++) {
    bubbles[i].reset();
  }
  
  gameState = 2; // 進入遊戲
}

// --- 泡泡類別 ---

class Bubble {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.r = random(25, 40); // 泡泡大小
    this.x = random(this.r, width - this.r); // 隨機 X 位置
    this.y = random(-200, -50); // 從螢幕上方外面開始掉落
    this.speed = random(2, 4); // 掉落速度
    this.letter = random(letters); // 隨機字母
    this.col = color(random(100, 255), random(100, 255), random(100, 255), 200);
  }
  
  move() {
    this.y += this.speed;
    // 加入微微的左右飄動
    this.x += sin(frameCount * 0.05 + this.y) * 1; 
  }
  
  display() {
    stroke(255);
    strokeWeight(2);
    fill(this.col);
    circle(this.x, this.y, this.r * 2);
    
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(this.r);
    text(this.letter, this.x, this.y);
  }
}