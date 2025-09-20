// 從 importmap 中指定的 'three' 模組匯入所有功能
import * as THREE from 'three';

// 1. 建立場景 (Scene)
// 場景就像一個舞台，用來放置所有物體、燈光和攝影機
const scene = new THREE.Scene();

// 2. 建立攝影機 (Camera)
// PerspectiveCamera 是一種模擬人眼透視效果的攝影機
// 参数：視野角度(FOV), 畫面長寬比, 近裁剪面, 遠裁剪面
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. 建立渲染器 (Renderer)
// 渲染器負責將攝影機看到的場景畫面，畫到瀏覽器上
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight); // 設定渲染畫面的大小
document.body.appendChild(renderer.domElement); // 將渲染器的畫布(canvas)加到 body 中

// 4. 建立物體 (Object/Mesh)
// 一個物體由「幾何體(Geometry)」和「材質(Material)」組成
const geometry = new THREE.BoxGeometry(1, 1, 1); // 建立一個 1x1x1 的立方體幾何體
const material = new THREE.MeshNormalMaterial(); // 一種會根據法向量顯示顏色的材質，不需要燈光
const cube = new THREE.Mesh(geometry, material); // 將幾何體和材質結合成一個網格物體
scene.add(cube); // 將立方體加入到場景中

// 5. 設定攝影機位置
// 預設攝影機和物體都在 (0,0,0) 的位置，所以我們把攝影機往後拉一點才能看到物體
camera.position.z = 5;

// 6. 建立動畫迴圈 (Animation Loop)
// 這個函式會不斷地被呼叫，來產生動畫效果
function animate() {
  requestAnimationFrame(animate); // 請求瀏覽器在下一次重繪前呼叫 animate 函式

  // 讓立方體旋轉
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  // 進行渲染
  renderer.render(scene, camera);
}

// 啟動動畫
animate();