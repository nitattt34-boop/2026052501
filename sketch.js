/**
 * 專案名稱：教科大冒險：知識氣球爆破戰
 * 開發者：Junci Chen
 * 互動邏輯：手勢瞄準 + 滑鼠點擊觸發爆炸特效
 */

let video;
let handPose;
let hands = [];

// 遊戲物件
let balloons = [];
let particles = [];
let score = 0;

// 游標位置 (手部追蹤)
let cursorX = 0;
let cursorY = 0;
let hasHand = false;

// 數學題目庫 (作為教育科技的展示)
let mathProblems = ["1+1", "2x3", "8÷2", "5+4", "7-3"];

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);
  
  // 設定攝影機並翻轉
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  
  // 啟動手部追蹤
  handPose.detectStart(video, gotHands);
  
  // 初始產生幾顆氣球
  for (let i = 0; i < 4; i++) {
    balloons.push(new Balloon());
  }
}

function draw() {
  image(video, 0, 0, width, height);
  
  // 加上深色半透明遮罩，讓畫面UI更清楚
  fill(0, 0, 0, 120);
  rect(0, 0, width, height);

  // 顯示分數
  fill(255);
  textSize(24);
  textAlign(LEFT, TOP);
  text("Score: " + score, 20, 20);
  
  // 更新與繪製氣球
  for (let i = balloons.length - 1; i >= 0; i--) {
    balloons[i].update();
    balloons[i].display();
    
    // 如果氣球飄出上方，重置它
    if (balloons[i].y < -50) {
      balloons[i].reset();
    }
  }

  // 更新與繪製點擊後產生的爆炸粒子特效
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // 更新手部準心位置
  if (hands.length > 0) {
    let indexTip = hands[0].index_finger_tip;
    if (indexTip) {
      cursorX = indexTip.x;
      cursorY = indexTip.y;
      hasHand = true;
    }
  } else {
    hasHand = false;
  }

  // 畫出瞄準準心
  if (hasHand) {
    drawAimCursor(cursorX, cursorY);
  }
}

// 取得辨識資料
function gotHands(results) {
  hands = results;
}

// 核心互動邏輯：只有點擊滑鼠時，才會觸發爆炸與判定
function mousePressed() {
  // 如果有抓到手，用手部座標；如果沒有，允許用滑鼠座標測試
  let targetX = hasHand ? cursorX : mouseX;
  let targetY = hasHand ? cursorY : mouseY;

  // 檢查是否點擊到氣球
  for (let i = balloons.length - 1; i >= 0; i--) {
    let d = dist(targetX, targetY, balloons[i].x, balloons[i].y);
    
    if (d < balloons[i].r) {
      // 成功擊中氣球：觸發爆炸特效 (不隨機，由點擊嚴格控制)
      createExplosion(balloons[i].x, balloons[i].y, balloons[i].col);
      score += 10;
      balloons[i].reset(); // 重置氣球到底部
      break; // 一次點擊只爆破一顆
    }
  }
}

// 繪製科技感準心
function drawAimCursor(x, y) {
  push();
  translate(x, y);
  stroke(0, 255, 0);
  strokeWeight(2);
  noFill();
  circle(0, 0, 40);
  line(-25, 0, -10, 0);
  line(25, 0, 10, 0);
  line(0, -25, 0, -10);
  line(0, 25, 0, 10);
  fill(255, 0, 0);
  noStroke();
  circle(0, 0, 6);
  pop();
}

// 產生爆炸粒子
function createExplosion(x, y, col) {
  for (let i = 0; i < 30; i++) {
    particles.push(new Particle(x, y, col));
  }
}

// --- 氣球類別 ---
class Balloon {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.r = random(30, 45);
    this.x = random(this.r, width - this.r);
    this.y = height + this.r + random(50, 200); // 從底部產生
    this.speed = random(1.5, 3);
    this.col = color(random(100, 255), random(100, 255), random(100, 255), 200);
    this.text = random(mathProblems);
  }
  
  update() {
    this.y -= this.speed; // 向上飄
    this.x += sin(frameCount * 0.03 + this.y * 0.05) * 0.5; // 微微左右晃
  }
  
  display() {
    push();
    translate(this.x, this.y);
    
    // 畫氣球線
    stroke(255, 150);
    strokeWeight(1);
    line(0, this.r, 0, this.r + 30);
    
    // 畫氣球本體
    noStroke();
    fill(this.col);
    circle(0, 0, this.r * 2);
    
    // 畫文字
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(this.text, 0, 0);
    pop();
  }
}

// --- 爆炸粒子類別 (取代隨機爆炸) ---
class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-5, 5);
    this.vy = random(-5, 5);
    this.alpha = 255;
    this.col = col;
    this.size = random(4, 10);
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 10; // 逐漸透明
  }
  
  display() {
    noStroke();
    // 將氣球顏色帶入粒子並加上透明度
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    circle(this.x, this.y, this.size);
  }
  
  isDead() {
    return this.alpha <= 0;
  }
}