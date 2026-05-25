/**
 * 專案名稱：魔法互動拼字盤 (Interactive Phonics Magnets)
 * 開發者：Junci Chen
 * 參考資源：Patt Vira - CT106_Interactive Fridge Magnets
 * 特效限制：爆炸特效絕對不自動觸發，僅限滑鼠點擊。
 */

let video;
let handPose;
let hands = [];

// 字母磁鐵
let magnets = [];
let targetWord = "APPLE";

// 滑鼠點擊觸發的爆炸特效
let particles = [];

function preload() {
  // 載入 ml5.js 手部辨識，並設定鏡像翻轉
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);
  
  // 建立字母磁鐵，隨機散落在畫面上方
  let chars = targetWord.split('');
  for (let i = 0; i < chars.length; i++) {
    magnets.push(new Magnet(chars[i], random(50, width - 50), random(50, 150)));
  }
}

function gotHands(results) {
  hands = results;
}

function draw() {
  image(video, 0, 0, width, height);
  
  // 加上半透明白色遮罩，讓畫面像一塊白板
  fill(255, 255, 255, 180);
  rect(0, 0, width, height);
  
  // 繪製教學區提示與放置框
  drawUI();
  
  let isPinching = false;
  let pinchX = 0;
  let pinchY = 0;
  
  // 偵測手勢捏合
  if (hands.length > 0) {
    let thumb = hands[0].thumb_tip;
    let index = hands[0].index_finger_tip;
    
    if (thumb && index) {
      pinchX = (thumb.x + index.x) / 2;
      pinchY = (thumb.y + index.y) / 2;
      
      // 計算指尖距離
      let d = dist(thumb.x, thumb.y, index.x, index.y);
      
      // 若距離小於 40 視為捏合
      if (d < 40) {
        isPinching = true;
        fill(255, 50, 50); // 捏合時顯示紅色
      } else {
        fill(50, 200, 50); // 張開時顯示綠色
      }
      
      noStroke();
      circle(pinchX, pinchY, 20); // 畫出手部游標
    }
  }
  
  // 更新與繪製磁鐵
  for (let m of magnets) {
    m.update(isPinching, pinchX, pinchY);
    m.display();
  }
  
  // 更新與繪製「僅限滑鼠點擊觸發」的特效粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

// 教學介面 UI
function drawUI() {
  stroke(0);
  strokeWeight(2);
  noFill();
  drawingContext.setLineDash([10, 10]); // 虛線框
  rectMode(CENTER);
  rect(width / 2, height - 100, 400, 100, 15);
  drawingContext.setLineDash([]); // 恢復實線
  
  noStroke();
  fill(50);
  textAlign(CENTER, BOTTOM);
  textSize(24);
  text("將字母拖曳至此框，拼出 " + targetWord, width / 2, height - 160);
  
  textSize(16);
  fill(100);
  text("老師確認拼字正確後，點擊畫面施放煙火！", width / 2, height - 20);
}

// ⚠️ 嚴格落實條件：動畫爆炸特效只能在此處透過滑鼠點擊觸發 ⚠️
function mousePressed() {
  createExplosion(mouseX, mouseY);
}

// 產生煙火粒子特效
function createExplosion(x, y) {
  // 一次產生 50 顆粒子
  for (let i = 0; i < 50; i++) {
    particles.push(new Particle(x, y));
  }
}

// === 字母磁鐵類別 ===
class Magnet {
  constructor(char, x, y) {
    this.char = char;
    this.x = x;
    this.y = y;
    this.size = 60;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
  }
  
  update(isPinching, px, py) {
    if (isPinching) {
      // 判斷是否碰到這個磁鐵
      if (!this.isDragging) {
        let d = dist(px, py, this.x, this.y);
        if (d < this.size / 2) {
          // 檢查有沒有其他磁鐵已經被抓起來了 (避免一次抓兩個)
          let othersDragging = magnets.some(m => m.isDragging && m !== this);
          if (!othersDragging) {
             this.isDragging = true;
             // 記錄偏差值，讓拖曳不瞬移
             this.offsetX = this.x - px;
             this.offsetY = this.y - py;
          }
        }
      }
    } else {
      this.isDragging = false; // 手指放開就停止拖曳
    }
    
    // 如果正在拖曳，更新位置
    if (this.isDragging) {
      this.x = px + this.offsetX;
      this.y = py + this.offsetY;
    }
  }
  
  display() {
    push();
    translate(this.x, this.y);
    rectMode(CENTER);
    
    // 拖曳時加深顏色
    if (this.isDragging) fill(255, 180, 50);
    else fill(255, 230, 100);
    
    stroke(50);
    strokeWeight(3);
    rect(0, 0, this.size, this.size, 8);
    
    // 字母陰影與文字
    noStroke();
    fill(0, 0, 0, 50);
    textAlign(CENTER, CENTER);
    textSize(36);
    text(this.char, 2, 2); // 陰影
    fill(0);
    text(this.char, 0, 0); // 實體字
    pop();
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