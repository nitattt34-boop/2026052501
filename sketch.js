/**
 * 專案名稱：忍者切切樂 (Fruit Ninja)
 * 開發者：Junci Chen
 * 單元設計：計算手指軌跡與移動速度，並結合拋物線物理引擎。
 */

let video;
let handPose;
let hands = [];

// 切切樂遊戲變數
let fruits = [];
let score = 0;
let bladeTrail = []; // 儲存手指揮動的軌跡

// 遊戲狀態與計時
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let startTime = 0;
let gameDuration = 30000; // 30 秒 (30000 毫秒)

// 連擊系統與音效狀態
let fruitsCutInSwipe = 0; // 一次揮刀切中的水果數量
let isSwishing = false; // 是否正在揮動
let audioCtx; // 用於合成音效的 AudioContext

// 切割時觸發的特效粒子
let particles = [];

const FRUIT_EMOJIS = ['🍎', '🍊', '🍇', '🍉', '🍓', '🍑', '🍍', '🥝'];

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  console.log('ml5 loaded:', typeof ml5 !== 'undefined');
  console.log('ml5.handPose:', typeof ml5.handPose);
  console.log('ml5.handpose:', typeof ml5.handpose);

  // 初始化 ml5 手勢模型
  handPose = ml5.handPose(video, { flipHorizontal: true }, () => {
    console.log('HandPose model loaded');
    if (handPose && typeof handPose.detectStart === 'function') {
      handPose.detectStart(video, gotHands);
    } else if (handPose && typeof handPose.detect === 'function') {
      handPose.detect(video, gotHands);
    } else {
      console.warn('HandPose detect API unavailable:', handPose);
    }
  });
}

function gotHands(results) {
  hands = results;
}

function draw() {
  // 畫面鏡像翻轉，讓動作像照鏡子一樣直覺
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
  
  // 加上半透明白色遮罩，讓畫面像一塊白板
  fill(255, 255, 255, 120); // 降低透明度，也稍微減少效能負擔
  rect(0, 0, width, height);
  
  // === 遊戲狀態管理 ===
  if (gameState === 'start') {
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("點擊畫面開始遊戲", width / 2, height / 2 - 20);
    textSize(18);
    fill(200);
    text("(將啟動 30 秒計時與音效)", width / 2, height / 2 + 20);
    return; // 暫停遊戲邏輯
  }
  
  if (gameState === 'gameOver') {
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(40);
    text("時間到！", width / 2, height / 2 - 80);
    textSize(28);
    text("最終得分: " + score, width / 2, height / 2 - 20);
    
    textSize(18);
    fill(255, 215, 0); // 黃金色文字
    text("伸出你的黃金食指武士刀，看準水果，\n大膽地刷刷刷，下一場最繽紛的水果糖果粒子雨吧", width / 2, height / 2 + 50);
    
    textSize(16);
    fill(200);
    text("點擊畫面可重新開始", width / 2, height / 2 + 130);
    return; // 暫停遊戲邏輯
  }
  
  let timeLeft = ceil((gameDuration - (millis() - startTime)) / 1000);
  if (timeLeft <= 0) {
    gameState = 'gameOver';
    timeLeft = 0;
  }

  // 繪製教學區提示與放置框
  drawUI(timeLeft);
  
  // 加快水果出現的速度 (從 60 影格加快到 35 影格)
  if (frameCount % 35 === 0) {
    fruits.push(new Fruit());
  }
  
  let currentX = 0;
  let currentY = 0;
  let isTracking = false;
  
  // 偵測食指作為武士刀
  if (hands.length > 0) {
    let hand = hands[0];
    let index = (hand.landmarks && hand.landmarks[8]) || hand.index_finger_tip || (hand.keypoints && hand.keypoints[8]);
    let indexX = index ? (index[0] ?? index.x) : null;
    let indexY = index ? (index[1] ?? index.y) : null;

    if (indexX !== null && indexY !== null) {
      currentX = indexX;
      currentY = indexY;
      isTracking = true;
      
      // 將當前點位加入軌跡陣列
      bladeTrail.push(createVector(currentX, currentY));
      // 限制軌跡長度，只保留最近的 8 個點
      if (bladeTrail.length > 8) {
        bladeTrail.shift(); 
      }
      
      // 在食指尖端畫一把菜刀 🔪
      push();
      translate(currentX, currentY);
      textSize(60);
      textAlign(RIGHT, BOTTOM);
      text('🔪', 20, 20); 
      pop();
    }
  } else {
    bladeTrail = []; // 沒偵測到手時清空軌跡
    isSwishing = false;
    fruitsCutInSwipe = 0; // 重置連擊次數
  }
  
  drawBlade(); // 畫出刀光軌跡
  
  // 計算揮刀速度與音效、連擊邏輯
  let currentSpeed = 0;
  if (isTracking && bladeTrail.length >= 2) {
    let p1 = bladeTrail[bladeTrail.length - 1];
    let p2 = bladeTrail[bladeTrail.length - 2];
    currentSpeed = dist(p1.x, p1.y, p2.x, p2.y);
    
    if (currentSpeed > 5) {
      if (!isSwishing) {
        playSwish(); // 揮刀速度夠快時播放「唰——」聲
        isSwishing = true;
      }
    } else {
      isSwishing = false;
      fruitsCutInSwipe = 0; // 速度慢下來視為揮刀中斷，重置連擊
    }
  } else {
    isSwishing = false;
    fruitsCutInSwipe = 0;
  }

  // 更新與繪製水果，並檢查切割邏輯
  for (let i = fruits.length - 1; i >= 0; i--) {
    let f = fruits[i];
    f.update();
    f.display();
    
    // 如果手部有被追蹤、水果還沒被切開，且有軌跡可以計算速度
    if (isTracking && !f.sliced && bladeTrail.length >= 2) {
      
      // 再次放寬切擊靈敏度 (速度 > 2 且碰撞半徑再稍微加大)
      if (currentSpeed > 2 && dist(currentX, currentY, f.x, f.y) < f.size * 1.2) {
        f.slice();
        fruitsCutInSwipe++; // 增加連擊數量
        
        if (fruitsCutInSwipe >= 2) {
          score += 20; // 黃金連擊獲得雙倍分數
          createGoldenExplosion(f.x, f.y); // 爆發超級巨大金色煙火
        } else {
          score += 10;
          createExplosion(f.x, f.y); // 一般煙火
        }
        playBurst(); // 播放水果爆裂聲，達到聽視覺同步
      }
    }
    
    // 移除掉出畫面外的水果，節省效能
    if (f.isOffScreen()) {
      fruits.splice(i, 1);
    }
  }
  
  // 更新與繪製特效粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

// 繪製武士刀軌跡
function drawBlade() {
  if (bladeTrail.length > 1) {
    noFill();
    stroke(200, 255, 255, 200); // 淺藍色半透明刀光
    strokeWeight(8);
    beginShape();
    for (let pt of bladeTrail) {
      vertex(pt.x, pt.y);
    }
    endShape();
  }
}

// 教學介面 UI
function drawUI(timeLeft) {
  fill(50);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(24);
  text("得分: " + score, 20, 20);
  
  // 顯示剩餘時間
  textAlign(RIGHT, TOP);
  text("時間: " + timeLeft + "s", width - 20, 20);
  
  textAlign(CENTER, BOTTOM);
  textSize(20);
  text("伸出食指當作武士刀，在空中快速揮動切開水果！", width / 2, height - 20);
}

// 產生煙火粒子特效
function createExplosion(x, y) {
  for (let i = 0; i < 25; i++) {
    particles.push(new Particle(x, y));
  }
}

// === 水果類別 ===
class Fruit {
  constructor() {
    this.x = random(100, width - 100);
    this.y = height + 50;
    this.vx = random(-2, 2);
    this.vy = random(-12, -16); // 初速往上拋
    this.size = random(60, 90);
    this.emoji = random(FRUIT_EMOJIS); // 真實水果圖案 (Emoji)
    this.sliced = false;
    // 切開後兩半分離的距離
    this.leftHalf = 0;
    this.rightHalf = 0;
  }
  
  update() {
    if (!this.sliced) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.4; // 地心引力 (往下加速)
    } else {
      // 切開後兩半往左右分開掉落
      this.leftHalf -= 5;
      this.rightHalf += 5;
      this.y += this.vy;
      this.vy += 0.8; // 切開後掉落得更快，增加打擊回饋
    }
  }
  
  display() {
    push();
    translate(this.x, this.y);
    textAlign(CENTER, CENTER);
    textSize(this.size);
    
    if (!this.sliced) {
      text(this.emoji, 0, 0);
    } else {
      // 切開的左半邊
      push();
      translate(this.leftHalf, 0);
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.rect(-this.size, -this.size, this.size, this.size * 2);
      drawingContext.clip();
      text(this.emoji, 0, 0);
      drawingContext.restore();
      pop();
      
      // 切開的右半邊
      push();
      translate(this.rightHalf, 0);
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.rect(0, -this.size, this.size, this.size * 2);
      drawingContext.clip();
      text(this.emoji, 0, 0);
      drawingContext.restore();
      pop();
    }
    pop();
  }

  slice() {
    this.sliced = true;
    this.vy = -3; // 模擬被切到時的停滯感與微弱向上的衝擊力
  }
  
  isOffScreen() {
    return this.y > height + 100;
  }
}

// === 特效粒子類別 ===
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // 隨機噴發速度
    this.vx = random(-8, 8);
    this.vy = random(-8, 8);
    this.alpha = 255;
    // 隨機鮮豔色彩
    this.col = color(random(150, 255), random(150, 255), random(150, 255));
    this.size = random(5, 12);
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.3; // 重力效果讓粒子往下墜
    this.alpha -= 6; // 逐漸透明消失
  }
  
  display() {
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    circle(this.x, this.y, this.size);
  }
  
  isDead() {
    return this.alpha < 0;
  }
}

// === 黃金隱藏版粒子類別 (繼承自一般粒子) ===
class GoldenParticle extends Particle {
  constructor(x, y) {
    super(x, y);
    this.vx = random(-15, 15); // 更廣泛的噴發範圍
    this.vy = random(-15, 15);
    this.col = color(255, 215, 0); // 純金色
    this.size = random(8, 22); // 超級巨大的尺寸
  }
  
  display() {
    noStroke();
    fill(255, 215, 0, this.alpha);
    circle(this.x, this.y, this.size);
    // 內部加上閃爍的白光核心
    fill(255, 255, 255, this.alpha); 
    circle(this.x, this.y, this.size * 0.4);
  }
}

function createGoldenExplosion(x, y) {
  for (let i = 0; i < 40; i++) {
    particles.push(new GoldenParticle(x, y));
  }
}

// === 遊戲互動與音效系統 (使用內建 Web Audio API 合成聲音) ===
function mousePressed() {
  // 點擊畫面重新開始或啟動遊戲，並解鎖瀏覽器音效限制
  if (gameState === 'start' || gameState === 'gameOver') {
    initAudio();
    score = 0;
    fruits = [];
    particles = [];
    bladeTrail = [];
    fruitsCutInSwipe = 0;
    startTime = millis();
    gameState = 'playing';
  }
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 播放「唰——」刀切聲
function playSwish() {
  if (!audioCtx) return;
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine'; // 改用正弦波搭配極速降頻，呈現銳利的風切聲
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

// 播放水果爆裂聲
function playBurst() {
  if (!audioCtx) return;
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sawtooth'; // 改用鋸齒波讓低頻爆裂聲更有粗糙的衝擊感
  osc.frequency.setValueAtTime(350, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.2);
}