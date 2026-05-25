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
  
  // 繪製教學區提示與放置框
  drawUI();
  
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
  }
  
  drawBlade(); // 畫出刀光軌跡
  
  // 更新與繪製水果，並檢查切割邏輯
  for (let i = fruits.length - 1; i >= 0; i--) {
    let f = fruits[i];
    f.update();
    f.display();
    
    // 如果手部有被追蹤、水果還沒被切開，且有軌跡可以計算速度
    if (isTracking && !f.sliced && bladeTrail.length >= 2) {
      let p1 = bladeTrail[bladeTrail.length - 1]; // 當前點
      let p2 = bladeTrail[bladeTrail.length - 2]; // 上一個點
      let speed = dist(p1.x, p1.y, p2.x, p2.y);   // 移動距離即為揮動速度
      
      // 再次放寬切擊靈敏度 (速度 > 2 且碰撞半徑再稍微加大)
      if (speed > 2 && dist(currentX, currentY, f.x, f.y) < f.size * 1.2) {
        f.slice();
        score += 10;
        createExplosion(f.x, f.y); // 自動觸發切開特效
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
function drawUI() {
  fill(50);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(24);
  text("得分: " + score, 20, 20);
  
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
      this.leftHalf -= 2;
      this.rightHalf += 2;
      this.y += this.vy;
      this.vy += 0.6; // 切開後掉落得更快
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