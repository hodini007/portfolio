import * as THREE from "three";
import DeltaTime from "../DeltaTime";
import Screen from "./screen/";
import Stats from "stats.js";
import { loadAssists } from "./loader";
import { Vector3 } from "three";

function valMap(x: number, from: [number, number], to: [number, number]) {
  const y = ((x - from[0]) / (from[1] - from[0])) * (to[1] - to[0]) + to[0];

  if (to[0] < to[1]) {
    if (y < to[0]) return to[0];
    if (y > to[1]) return to[1];
  } else {
    if (y > to[0]) return to[0];
    if (y < to[1]) return to[1];
  }

  return y;
}

let viewHeight = document.documentElement.clientHeight;
let scroll = window.scrollY / document.documentElement.clientHeight;
window.addEventListener(
  "scroll",
  (ev) => {
    scroll = window.scrollY / viewHeight;
  },
  { passive: true }
);

export default function WebGL() {
  loadAssists((assists) => {
    const stats = new Stats();
    const hash = window.location.hash;
    if (hash) {
      if (hash.toLowerCase() === "#debug") {
        stats.showPanel(0);
        document.body.appendChild(stats.dom);

        const textarea = document.getElementById(
          "textarea"
        ) as HTMLTextAreaElement;
        textarea.style.zIndex = "3";
        textarea.style.opacity = "1";
      }
    }

    // Canvas
    const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;
    if (!canvas) console.error("no canvas");
    /**
     * Sizes
     */
    const sizes = {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
      portraitOffset: valMap(
        window.innerHeight / document.documentElement.clientWidth,
        [0.75, 2.5],
        [0, 1.2]
      ),
    };

    // Scene
    const scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    scene.background = new THREE.Color(0x050505);

    /**
     * Camera
     */
    // Base camera
    const camera = new THREE.PerspectiveCamera(
      50,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.set(0, 0, -2.5);
    // camera.position.set(0, -1, -5.5);
    camera.rotation.set(-Math.PI, 0, Math.PI);
    scene.add(camera);

    // Controls
    const controlProps = {
      computerHeight: 1.5,
      computerAngle: Math.PI * 0.2,
      computerHorizontal: 0.5,

      minAzimuthAngleOffest: -Math.PI * 0.3,
      maxAzimuthAngleOffest: Math.PI * 0.3,

      minPolarAngleOffest: -Math.PI * 0.3,
      maxPolarAngleOffest: 0,
    };

    let mousedown: { x: number; y: number } | null = null;
    function checkIfTouch(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        mousedown = null;
        computerParallax.x = 0;
        computerParallax.y = 0;
      }
    }
    const computerParallax = { x: 0, y: 0 };
    canvas.addEventListener(
      "pointermove",
      (event) => {
        checkIfTouch(event);
        if (mousedown) {
          computerParallax.x +=
            (event.clientX - mousedown.x) / (window.innerWidth * 0.5);
          computerParallax.x = valMap(computerParallax.x, [-1, 1], [-1, 1]);

          computerParallax.y +=
            (event.clientY - mousedown.y) / (window.innerHeight * 0.5);
          computerParallax.y = valMap(computerParallax.y, [-1, 1], [-1, 1]);

          mousedown = { x: event.clientX, y: event.clientY };
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      "pointerdown",
      (event) => {
        checkIfTouch(event);
        mousedown = { x: event.clientX, y: event.clientY };
      },
      { passive: true }
    );

    document.addEventListener(
      "pointerup",
      (event) => {
        checkIfTouch(event);
        mousedown = null;
      },
      { passive: true }
    );

    /**
     * Renderer
     */

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(2);
    renderer.outputEncoding = THREE.sRGBEncoding;

    function updateCanvasSize(width: number, height: number) {
      // Update camera
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Update renderer
      renderer.setSize(width, height);
    }
    window.addEventListener(
      "resize",
      () => {
        // Update sizes

        viewHeight = document.documentElement.clientHeight;
        sizes.width = document.documentElement.clientWidth;
        sizes.height = window.innerHeight;
        updateCanvasSize(sizes.width, sizes.height);
        sizes.portraitOffset = valMap(
          sizes.height / sizes.width,
          [0.75, 2.5],
          [0, 1.2]
        );
      },
      { passive: true }
    );

    const screen = Screen(assists, renderer);

    const planelikeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.Mesh(
      planelikeGeometry,
      // texture
      new THREE.MeshBasicMaterial({ color: "blue" })
    );
    plane.scale.x = 1.33;

    // Materials
    const computerMaterial = new THREE.MeshBasicMaterial({
      map: assists.bakeTexture,
    });

    /**
     * Models
     */
    const computerGroup = new THREE.Group();

    assists.screenMesh.material = screen.screenRenderEngine.material;
    computerGroup.add(assists.screenMesh);

    assists.computerMesh.material = computerMaterial;
    computerGroup.add(assists.computerMesh);

    assists.crtMesh.material = computerMaterial;
    computerGroup.add(assists.crtMesh);

    assists.keyboardMesh.material = computerMaterial;
    computerGroup.add(assists.keyboardMesh);

    assists.shadowPlaneMesh.material = new THREE.MeshBasicMaterial({
      map: assists.bakeFloorTexture,
    });
    computerGroup.add(assists.shadowPlaneMesh);

    computerGroup.position.x = controlProps.computerHorizontal;
    computerGroup.position.y = controlProps.computerHeight;
    computerGroup.rotation.y = controlProps.computerAngle;
    scene.add(computerGroup);

    /**
     * Animate
     */

    const clock = new THREE.Clock();
    const tick = () => {
      stats.begin();

      const deltaTime = DeltaTime();

      const elapsedTime = clock.getElapsedTime();

      const zoomFac = valMap(scroll, [0, 1], [0, 1]);

      // Use actual dimensions — works on real phones AND DevTools responsive mode
      const isPortrait = sizes.width < sizes.height;
      const hOffset = isPortrait ? 0 : controlProps.computerHorizontal * zoomFac;
      const yAngle  = isPortrait ? 0 : controlProps.computerAngle * zoomFac;

      if (isPortrait) {
        // In portrait: stay close, aim at the screen area (upper part of model)
        camera.position.z = -2.2;
      } else {
        camera.position.z = valMap(
          scroll,
          [0, 1],
          [-2.5 - sizes.portraitOffset, -10 - sizes.portraitOffset]
        );
      }

      computerGroup.position.x = hOffset;
      computerGroup.position.y = valMap(
        scroll,
        [0, 1],
        [0, controlProps.computerHeight]
      );

      computerGroup.rotation.y = yAngle;

      let targetCameraX = 0;
      let targetCameraY = 0;
      let targetLookAtX = 0;
      let targetLookAtY = 0;

      if (isPortrait) {
        // Scroll from 0 to 0.6 rotates -90deg to 0deg
        const rotProgress = valMap(scroll, [0, 0.6], [0, 1]);
        const rotZ = -Math.PI / 2 * (1 - rotProgress);
        computerGroup.rotation.z = rotZ;

        // The terminal screen's pivot radius from the base (0,0)
        const screenRadius = 0.5;
        
        // We add a pan offset when sideways. Since the camera is at Z = -4.6 (looking down +Z),
        // World +X is actually visually LEFT on screen! To push the camera visual center right 
        // (moving the object left), we must shift the camera to World -X.
        const panOffset = valMap(rotProgress, [0, 1], [-0.5, 0]);

        // As model rotates, screen moves in an arc
        targetLookAtX = screenRadius * Math.sin(-rotZ) + panOffset;
        targetLookAtY = screenRadius * Math.cos(rotZ);
        
        // Camera stays directly in front of the screen
        targetCameraX = targetLookAtX;
        targetCameraY = targetLookAtY;
        
        // Move camera significantly further away when sideways to prevent edges cutting
        // and to keep everything properly framed despite the HTML sidebar.
        camera.position.z = valMap(rotProgress, [0, 1], [-4.8, -2.4]);
      } else {
        computerGroup.rotation.z = 0;
        targetLookAtX = 0;
        targetLookAtY = 0;
        targetCameraX = 0;
        targetCameraY = 0;
      }

      // Add mouse parallax on top of tracking target
      const parallaxX = computerParallax.x * valMap(scroll, [0, 1], [0.2, 5]);
      const parallaxY = computerParallax.y * valMap(scroll, [0, 1], [0.2, 1.5]);

      // Exponential smoothing (lerp) towards target — avoids flying off to infinity
      camera.position.x = (targetCameraX + parallaxX) * 0.1 + camera.position.x * 0.9;
      camera.position.y = (targetCameraY + parallaxY) * 0.1 + camera.position.y * 0.9;

      camera.lookAt(new THREE.Vector3(targetLookAtX, targetLookAtY, 0));

      canvas.style.opacity = `${valMap(scroll, [1.25, 1.75], [1, 0])}`;

      if (assists.crtMesh.morphTargetInfluences) {
        assists.crtMesh.morphTargetInfluences[0] = valMap(
          zoomFac,
          [0, 0.1],
          [0.5, 0]
        );
      }

      screen.tick(deltaTime, elapsedTime);

      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      stats.end();
      // Call tick again on the next frame
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}
