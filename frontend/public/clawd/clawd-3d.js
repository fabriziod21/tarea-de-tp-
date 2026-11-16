/* =============================================================================
   Clawd 3D — la mascota de Claude Code, viva, en la terminal de "Herramientas de IA".
   Modelo: assets/3d/clawd.glb (Blender, assets/3d/source/clawd.py) incrustado en
   assets/3d/clawd-data.js. Todo el movimiento es por código:
     · Rutina: programa, piensa, encuentra un bug, lo arregla, festeja, se estira, saluda.
     · Te sigue con la mirada, saluda cuando llegas, se sonroja con corazones si lo tocas,
       se duerme si no haces nada y se despierta sobresaltado cuando vuelves.
   Uso:  Clawd3D.mount(terminalEl, statusEl) -> true si arrancó (si no, queda el sprite SVG).
   Requiere: three r128 + GLTFLoader (+ RoomEnvironment opcional) y window.CLAWD_GLB.

   Versión del chatbot (copiada del portafolio): además expone terminalEl.clawd3d con
     act(nombre, estado?)       dispara una acción (think, type, bug, fix, celebrate, wave...)
     busy(true|false, estado?)  modo ocupado: solo teclea/piensa, no se duerme ni "encuentra bugs"
     status(texto)              cambia la línea de estado
   y emite el evento 'clawd:ready' cuando el modelo terminó de cargar.
============================================================================= */
(function () {
    'use strict';

    const CODE = [
        "const clawd = new Agent('claude-code');",
        "await clawd.read('index.html');",
        "",
        "function fix(bug) {",
        "  return bug.root.cause();",
        "}",
        "",
        "for (const p of proyectos) {",
        "  p.deploy({ prod: true });",
        "}",
        "// TODO: más café",
        "export default portfolio;",
        "const ideas = await brainstorm();",
        "ideas.filter(i => i.cool).ship();"
    ];
    const FIX = ["  if (!user) return null;", "  return user.name ?? 'anon';"];
    const KW = /\b(const|let|await|new|function|return|for|of|if|export|default|async|null|true)\b/g;

    // Rutina de trabajo (se repite); las interrupciones (hola, amor, sueño) la pausan.
    const PLAN = ['type', 'think', 'type', 'bug', 'fix', 'celebrate', 'type', 'stretch', 'type', 'think', 'type', 'hi'];
    const ACTS = {
        type:      { dur: [5, 8],     status: 'clawd --coding' },
        think:     { dur: [2.6, 3.6], status: 'clawd --thinking...' },
        bug:       { dur: [2.2, 2.2], status: 'npm test  ✗ 1 failed' },
        fix:       { dur: [3.4, 4.2], status: 'clawd --fix bug' },
        celebrate: { dur: [2.4, 2.4], status: 'npm test  ✓ all passed' },
        stretch:   { dur: [3, 3],     status: 'clawd --stretch' },
        hi:        { dur: [2.4, 2.4], status: 'clawd --hi :)' },
        wave:      { dur: [2.4, 2.4], status: 'clawd --wave ¡hola!' },
        love:      { dur: [2.6, 2.6], status: 'clawd --love <3' },
        sleep:     { dur: [1e9, 1e9], status: 'clawd --sleep zZz' },
        wake:      { dur: [1.5, 1.5], status: 'clawd --wake ?!' }
    };
    const IDLE_SLEEP = 16;          // segundos sin tocar nada -> se duerme

    function supported() {
        if (!window.THREE || !THREE.GLTFLoader || !window.CLAWD_GLB) return false;
        try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
    }

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const damp = (v, t, k, dt) => v + (t - v) * (1 - Math.exp(-k * dt));
    const backOut = x => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

    // ---------- pantalla de la mini laptop (canvas con código que se escribe solo) ----------
    function makeScreen(mesh) {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
        // UV planas: la pantalla mira hacia Clawd (-Z), así que el eje X va espejado
        const geo = mesh.geometry; geo.computeBoundingBox();
        const bb = geo.boundingBox, pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
            uv[i * 2] = (bb.max.x - pos.getX(i)) / (bb.max.x - bb.min.x);
            uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        mesh.material = new THREE.MeshBasicMaterial({ map: tex });

        const s = { lines: [''], src: 0, col: 0, banner: null, mode: 'code', dirty: true, blink: 0 };
        const MAXL = 9;
        function push(line) { s.lines.push(line); if (s.lines.length > MAXL) s.lines.shift(); }
        s.type = n => {                              // escribe n caracteres del "código"
            let k = Math.floor(n + (s.carry || 0)); s.carry = n + (s.carry || 0) - k;
            while (k-- > 0) {
                const line = s.queue ? s.queue[0] : CODE[s.src % CODE.length];
                if (s.col < line.length) { s.lines[s.lines.length - 1] += line[s.col++]; }
                else { s.col = 0; if (s.queue) { s.queue.shift(); if (!s.queue.length) s.queue = null; } else s.src++; push(''); }
            }
            s.dirty = true;
        };
        s.error = () => { s.banner = ['#ff2a4a', '✗ TypeError: user is undefined']; s.dirty = true; };
        s.fix = () => { s.banner = null; s.lines.pop(); s.lines.push(''); s.queue = FIX.slice(); s.col = 0; s.dirty = true; };
        s.ok = () => { s.banner = ['#3ddc84', '✓ 12 tests passed']; s.dirty = true; };
        s.clear = () => { if (s.banner) { s.banner = null; s.dirty = true; } };
        s.setMode = m => { if (s.mode !== m) { s.mode = m; s.dirty = true; } };

        function colorize(line, x, y) {
            const parts = []; let last = 0; line.replace(/'[^']*'?|\/\/.*$/g, (m, i) => { parts.push([line.slice(last, i), null]); parts.push([m, m.startsWith('//') ? '#5c6370' : '#9ece6a']); last = i + m.length; });
            parts.push([line.slice(last), null]);
            for (const [txt, col] of parts) {
                if (col) { g.fillStyle = col; g.fillText(txt, x, y); x += g.measureText(txt).width; continue; }
                let l2 = 0; txt.replace(KW, (m, i) => {
                    const pre = txt.slice(l2, i); g.fillStyle = '#c0caf5'; g.fillText(pre, x, y); x += g.measureText(pre).width;
                    g.fillStyle = '#ff5c8a'; g.fillText(m, x, y); x += g.measureText(m).width; l2 = i + m.length;
                });
                const rest = txt.slice(l2); g.fillStyle = '#c0caf5'; g.fillText(rest, x, y); x += g.measureText(rest).width;
            }
            return x;
        }
        s.draw = (t) => {
            const cur = Math.floor(t * 2.5) % 2;
            if (!s.dirty && cur === s.blink) return;
            s.blink = cur; s.dirty = false;
            g.fillStyle = s.mode === 'sleep' ? '#020304' : '#070a10'; g.fillRect(0, 0, 512, 320);
            if (s.mode === 'sleep') {                // protector de pantalla
                g.fillStyle = 'rgba(138,160,255,.5)'; g.font = '700 40px "Fira Code", monospace';
                g.fillText('z', 300 + Math.sin(t) * 40, 170 + Math.cos(t * .7) * 30);
                tex.needsUpdate = true; return;
            }
            g.fillStyle = '#11151f'; g.fillRect(0, 0, 512, 34);
            ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(20 + i * 20, 17, 6, 0, 7); g.fill(); });
            g.font = '20px "Fira Code", monospace'; g.fillStyle = '#5c6370'; g.fillText('portfolio.js', 90, 24);
            g.font = '21px "Fira Code", monospace'; g.textBaseline = 'alphabetic';
            s.lines.forEach((ln, i) => {
                const y = 66 + i * 29;
                g.fillStyle = '#3b4252'; g.fillText(String(i + 1).padStart(2, ' '), 10, y);
                const end = colorize(ln, 48, y);
                if (i === s.lines.length - 1 && cur) { g.fillStyle = '#DD775B'; g.fillRect(end + 2, y - 18, 11, 22); }
            });
            if (s.banner) {
                g.fillStyle = s.banner[0]; g.globalAlpha = .18; g.fillRect(0, 0, 512, 320); g.globalAlpha = 1;
                g.fillRect(0, 272, 512, 48); g.fillStyle = '#05070a'; g.font = '700 22px "Fira Code", monospace'; g.fillText(s.banner[1], 16, 304);
            }
            tex.needsUpdate = true;
        };
        return s;
    }

    function floorGlow() {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(221,119,91,.32)'); gr.addColorStop(1, 'rgba(221,119,91,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(0, .001, .3);
        return m;
    }

    function mount(term, statusEl) {
        if (!term || !supported()) return false;
        const stage = term.querySelector('.clawd-stage');
        if (!stage) return false;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.className = 'c3d-canvas';
        const hint = document.createElement('span'); hint.className = 'c3d-hint'; hint.textContent = 'tócalo · arrastra para girar';

        const scene = new THREE.Scene();
        if (THREE.RoomEnvironment) scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), .04).texture;
        const camera = new THREE.PerspectiveCamera(30, 1.8, .05, 20);
        const target = new THREE.Vector3(0, .56, .2);

        scene.add(new THREE.HemisphereLight(0xffeee6, 0x1a0c0c, .55));
        const key = new THREE.DirectionalLight(0xfff1e6, 1.05);
        key.position.set(1.2, 2.4, 2.2); key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0008; key.shadow.radius = 4;
        Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.4, bottom: -.6, near: .5, far: 6 });
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xff003c, 1.1); rim.position.set(-1.8, 1.4, -1.6); scene.add(rim);
        const glow = new THREE.PointLight(0x4f7cff, .9, 1.3); glow.position.set(0, .62, .42); scene.add(glow);
        const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: .45 }));
        shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);
        scene.add(floorGlow());

        let rig, scr, cheekMat, raf = 0, visible = false;
        const tpl = {}, fx = [];

        function start(model) {
            scene.add(model);
            const $ = n => model.getObjectByName(n);
            model.traverse(o => {
                if (!o.isMesh) return;
                o.castShadow = true; o.receiveShadow = true;
                if (o.material && o.material.name === 'Clawd') o.material.envMapIntensity = .45;
            });
            ['Zzz', 'Corazon', 'Alerta'].forEach(n => { const o = $(n); o.parent.remove(o); o.position.set(0, 0, 0); o.castShadow = false; tpl[n] = o; });
            rig = {
                root: $('Clawd'), body: $('Cuerpo'), armL: $('BrazoIzq'), armR: $('BrazoDer'),
                eyes: [$('OjoIzq'), $('OjoDer')], happy: [$('OjoFelizIzq'), $('OjoFelizDer')], cheeks: [$('MejillaIzq'), $('MejillaDer')]
            };
            rig.base = {
                body: rig.body.position.clone(), armL: rig.armL.position.clone(), armR: rig.armR.position.clone(),
                eyes: rig.eyes.map(e => e.position.clone()), happy: rig.happy.map(e => e.position.clone())
            };
            cheekMat = rig.cheeks[0].material.clone(); cheekMat.transparent = true; cheekMat.opacity = 0;
            rig.cheeks.forEach(c => { c.material = cheekMat; c.castShadow = false; });
            rig.happy.forEach(h => { h.scale.set(1, .001, 1); h.castShadow = false; });
            rig.eyes.forEach(e => e.castShadow = false);
            scr = makeScreen($('LaptopPantalla'));

            stage.append(renderer.domElement, hint);
            term.classList.add('c3d');
            term.dataset.pose = '';
            resize();
            if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else addEventListener('resize', resize);
            new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); } }).observe(stage);
            bindInput();
            go('type');
            // para controlar a Clawd desde el chat
            term.clawd3d = {
                act: (name, text) => { if (!ACTS[name]) return; idle = 0; go(name); if (text) setStatus(text); },
                busy: (on, text) => { busy = !!on; statusOverride = on ? (text || null) : null; idle = 0; if (on && act === 'sleep') go('wake'); },
                status: text => { if (busy) statusOverride = text; setStatus(text); }
            };
            term.dispatchEvent(new CustomEvent('clawd:ready'));
        }

        // ---------- cámara ----------
        let az = .42, azDrag = 0, elDrag = 0, dist = 2.4;
        function resize() {
            const w = stage.clientWidth, h = stage.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h; camera.updateProjectionMatrix();
            const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
            dist = Math.max(.74 / t, 1 / (t * camera.aspect));
        }
        function placeCamera() {
            const a = az + azDrag, e = .3 + elDrag;
            camera.position.set(target.x + dist * Math.sin(a) * Math.cos(e), target.y + dist * Math.sin(e), target.z + dist * Math.cos(a) * Math.cos(e));
            camera.lookAt(target);
        }

        // ---------- estado / línea de estado ----------
        let act = 'type', at = 0, dur = 6, planIdx = 0, T = 0, idle = 0, lastMove = -9, gaze = { x: 0, y: 0 }, blink = 0, nextBlink = 2, spawnT = 0;
        let busy = false, statusOverride = null;   // modo ocupado (mientras el chat trabaja)
        function setStatus(text) {
            if (!statusEl) return;
            clearInterval(statusEl._typer);
            statusEl.textContent = ''; let c = 0;
            statusEl._typer = setInterval(() => { statusEl.textContent = text.slice(0, ++c); if (c >= text.length) clearInterval(statusEl._typer); }, 35);
        }
        function go(name) {
            act = name; at = 0; spawnT = 0;
            const d = ACTS[name].dur; dur = rand(d[0], d[1]);
            setStatus(statusOverride || ACTS[name].status);
            term.dispatchEvent(new CustomEvent('clawd:act', { detail: name }));   // la terminal de Claude Code se sincroniza
            if (name === 'bug') { scr.error(); spawn('Alerta', new THREE.Vector3(.14, 1.06, .05), { life: 1.6, pop: true }); }
            if (name === 'fix') scr.fix();
            if (name === 'celebrate') scr.ok();
            if (name === 'type' || name === 'think') scr.clear();
            if (name === 'wake') { scr.setMode('code'); spawn('Alerta', new THREE.Vector3(.14, 1.06, .05), { life: 1.2, pop: true }); }
            if (name === 'sleep') scr.setMode('sleep');
            if (name === 'love') hearts(4);
        }
        function next() {
            if (act === 'sleep') return;
            if (busy) { go(act === 'type' ? 'think' : 'type'); return; }   // trabajando: teclea y piensa
            go(PLAN[planIdx++ % PLAN.length]);
        }
        const interrupt = name => { if (act !== 'sleep' || name === 'wake') go(name); };

        // ---------- efectos (Zzz, corazones, "!") ----------
        function spawn(kind, pos, o) {
            const m = tpl[kind].clone(); m.material = m.material.clone(); m.material.transparent = true;
            const g = new THREE.Group(); g.add(m); g.position.copy(pos); scene.add(g);
            fx.push(Object.assign({ g, m, t: 0, vel: new THREE.Vector3(), size: 1 }, o));
        }
        function hearts(n) {
            for (let i = 0; i < n; i++) setTimeout(() => spawn('Corazon', new THREE.Vector3(rand(-.35, .35), rand(.85, 1), rand(0, .15)),
                { life: rand(1.3, 1.9), pop: true, vel: new THREE.Vector3(rand(-.06, .06), rand(.22, .32), 0), size: rand(.7, 1.15), wob: rand(0, 6) }), i * 120);
        }
        function updateFx(dt) {
            for (let i = fx.length - 1; i >= 0; i--) {
                const f = fx[i]; f.t += dt; const k = f.t / f.life;
                if (k >= 1) { scene.remove(f.g); f.m.material.dispose(); fx.splice(i, 1); continue; }
                f.g.position.addScaledVector(f.vel, dt);
                if (f.wob !== undefined) f.g.position.x += Math.sin(f.t * 5 + f.wob) * .0015;
                const s = (f.pop ? backOut(Math.min(1, f.t / .28)) : .6 + k * .7) * f.size;
                f.g.scale.setScalar(Math.max(.001, s));
                f.g.rotation.y = az + azDrag;
                f.g.rotation.z = f.spin ? Math.sin(f.t * 2) * .25 : 0;
                f.m.material.opacity = k < .65 ? 1 : 1 - (k - .65) / .35;
            }
        }

        // ---------- entrada: mirada, saludo, caricias, arrastre, sueño ----------
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        function hitClawd(ev) {
            const r = renderer.domElement.getBoundingClientRect();
            ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ndc, camera);
            return ray.intersectObject(rig.root, true).length > 0;
        }
        function bindInput() {
            const wakeUp = () => { idle = 0; if (act === 'sleep') interrupt('wake'); };
            addEventListener('pointermove', ev => {
                const r = stage.getBoundingClientRect();
                gaze.x = clamp((ev.clientX - (r.left + r.width / 2)) / (r.width * .8), -1, 1);
                gaze.y = clamp(-(ev.clientY - (r.top + r.height * .35)) / (r.height * 1.4), -1, 1);
                lastMove = T; wakeUp();
            }, { passive: true });
            addEventListener('scroll', wakeUp, { passive: true });
            addEventListener('keydown', wakeUp);

            let away = -99;
            stage.addEventListener('pointerenter', () => { if (T - away > 5 && ['type', 'think', 'stretch'].includes(act)) interrupt('wave'); });
            stage.addEventListener('pointerleave', () => { away = T; stage.classList.remove('c3d-hover'); });

            const cv = renderer.domElement;
            let down = null;
            cv.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, az: azDrag, el: elDrag, moved: false }; cv.setPointerCapture(ev.pointerId); });
            cv.addEventListener('pointermove', ev => {
                if (!down) { stage.classList.toggle('c3d-hover', hitClawd(ev)); return; }
                const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
                if (Math.abs(dx) + Math.abs(dy) > 5) down.moved = true;
                azDrag = clamp(down.az - dx * .008, -1.4, 1.1);
                elDrag = clamp(down.el + dy * .004, -.2, .45);
            });
            const up = ev => {
                if (!down) return;
                if (!down.moved && hitClawd(ev)) { if (act === 'love') hearts(3); else interrupt('love'); hint.classList.add('c3d-used'); }
                if (down.moved) hint.classList.add('c3d-used');
                down = null; dragRelease = T;
            };
            cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { down = null; });
        }
        let dragRelease = -9;

        // ---------- animación ----------
        // armL/armR: giro en el hombro; armUpL/armUpR: cuánto sube el brazo por el costado (si no, no se ve el saludo)
        const P = { rootY: 0, yaw: 0, lean: 0, tilt: 0, rise: 0, squash: 1, armL: 0, armR: 0, armUpL: 0, armUpR: 0, fwd: 0, eyeX: 1, eyeY: 1, happy: 0, cheeks: 0, gx: 0, gy: 0, shake: 0 };
        const cur = Object.assign({}, P);
        const glowCol = new THREE.Color(0x4f7cff), tmpCol = new THREE.Color();
        let glowI = .9;

        function pose(t) {             // objetivo de cada parámetro según la acción actual
            const p = Object.assign({}, P);
            let gl = [0x4f7cff, .9], cursorW = 1;
            const tapA = Math.max(0, Math.sin(T * 23)), tapB = Math.max(0, -Math.sin(T * 23));
            const faceCam = az + azDrag;
            switch (act) {
                case 'type': case 'fix': {
                    const fast = act === 'fix' ? 1.35 : 1;
                    p.lean = .07; p.fwd = .06;
                    p.armL = .16 + .16 * Math.max(0, Math.sin(T * 23 * fast)); p.armR = -(.16 + .16 * Math.max(0, -Math.sin(T * 23 * fast)));
                    p.rootY = (tapA + tapB) * .003;
                    p.eyeY = act === 'fix' || Math.sin(at * .8) > .35 ? .55 : 1;
                    p.gy = -.85; p.gx = Math.sin(at * 2.2) * .35; cursorW = .55;
                    scr.type(DT * (act === 'fix' ? 26 : 16));
                    gl = [act === 'fix' ? 0xffb347 : 0x4f7cff, .8 + Math.sin(T * 9) * .08];
                    break;
                }
                case 'think':
                    p.armR = .5 + Math.sin(at * 7) * .06; p.armL = .12;
                    p.tilt = Math.sin(at * 1.5) * .05; p.gx = (at % 2.4) < 1.2 ? -.85 : .85; p.gy = .85; cursorW = .2;
                    gl = [0x4f7cff, .55];
                    break;
                case 'bug':
                    p.lean = -.14; p.eyeX = p.eyeY = 1.4; p.armL = -.55; p.armR = .55; p.armUpL = p.armUpR = .1; p.shake = at < .45 ? 1 : 0;
                    p.rootY = at < .3 ? Math.sin(at / .3 * Math.PI) * .05 : 0;
                    p.gy = -.5; cursorW = 0;
                    gl = [0xff2a3c, 1.1 + Math.sin(T * 14) * .35];
                    break;
                case 'celebrate': case 'love': {
                    p.happy = 1; p.cheeks = 1; p.yaw = faceCam * .7;
                    const hop = act === 'love' ? .05 : .09, hops = act === 'love' ? 1.6 : 1.3;
                    p.rootY = at < hops ? Math.abs(Math.sin(at * Math.PI / .42)) * hop : 0;
                    if (act === 'celebrate') { p.armL = -1.5 - Math.sin(T * 14) * .3; p.armR = 1.5 + Math.sin(T * 14) * .3; p.armUpL = p.armUpR = .26; gl = [0x3ddc84, 1.2]; }
                    else { p.armL = .35 + Math.sin(T * 6) * .1; p.armR = -.35 - Math.sin(T * 6) * .1; p.tilt = Math.sin(T * 7) * .07; gl = [0xff4d6d, .9]; }
                    break;
                }
                case 'stretch': {
                    const k = Math.min(1, at / .7) * Math.min(1, (dur - at) / .6);
                    p.rise = .07 * k; p.squash = 1 + .05 * k; p.armL = -1.7 * k; p.armR = 1.7 * k; p.armUpL = p.armUpR = .3 * k;
                    p.tilt = Math.sin(at * 2.4) * .08 * k; p.happy = k > .5 ? 1 : 0; cursorW = 0;
                    break;
                }
                case 'hi': case 'wave':
                    p.yaw = faceCam * .85; p.armR = 1.6 + Math.sin(T * 11) * .45; p.armUpR = .28; p.cheeks = .5;
                    p.happy = act === 'wave' && at < 1.2 ? 1 : 0; p.gx = 0; p.gy = 0;
                    break;
                case 'sleep': {
                    const k = Math.min(1, at / 1.5);
                    p.lean = .16 * k; p.squash = 1 + Math.sin(T * 1.5) * .02; p.armL = .3 * k; p.armR = -.3 * k;
                    p.eyeY = at < .8 ? .45 : (at < 1.1 ? .8 : .1); p.gy = -.6; cursorW = 0; gl = [0x8aa0ff, .25];
                    spawnT -= DT;
                    if (spawnT <= 0 && at > 1) { spawnT = 1.3; spawn('Zzz', new THREE.Vector3(.36, .98, .05), { life: 2.8, vel: new THREE.Vector3(.07, .14, 0), size: .8, spin: true }); }
                    break;
                }
                case 'wake':
                    p.eyeX = p.eyeY = 1.35; p.rootY = at < .35 ? Math.sin(at / .35 * Math.PI) * .07 : 0;
                    p.armL = -.6; p.armR = .6; p.armUpL = p.armUpR = .1; p.gx = Math.sin(at * 9) * .9; cursorW = 0;
                    break;
            }
            // mirada hacia el cursor cuando lo mueves cerca
            const w = (T - lastMove < 1.6 ? 1 : 0) * cursorW;
            p.gx = p.gx * (1 - w) + gaze.x * w; p.gy = p.gy * (1 - w) + gaze.y * w;
            if (w > 0 && !p.yaw) p.yaw = gaze.x * .18 * w;
            return { p, gl };
        }

        let DT = 0;
        const clock = new THREE.Clock();
        function loop() {
            raf = 0;
            if (!visible || document.hidden) return;
            const dt = Math.min(clock.getDelta(), .05); DT = dt; T += dt; at += dt;
            if (at >= dur) next();
            idle += dt;
            if (!busy && idle > IDLE_SLEEP && act !== 'sleep' && act !== 'love') go('sleep');

            const { p, gl } = pose(T);
            for (const k in p) cur[k] = damp(cur[k], p[k], k.startsWith('arm') ? 22 : (k === 'rootY' ? 30 : 9), dt);

            // parpadeo
            nextBlink -= dt;
            if (nextBlink <= 0) { blink = .13; nextBlink = Math.random() < .2 ? .25 : rand(1.8, 4.5); }
            if (blink > 0) blink -= dt;
            const blinkK = blink > 0 && act !== 'sleep' ? .08 : 1;

            const r = rig, b = r.base;
            r.root.position.y = cur.rootY;
            r.root.rotation.y = cur.yaw;
            r.body.position.set(b.body.x + (cur.shake > .5 ? Math.sin(T * 70) * .012 : 0), b.body.y + cur.rise, b.body.z);
            r.body.rotation.set(cur.lean, 0, cur.tilt);
            r.body.scale.set(1 / Math.sqrt(cur.squash), cur.squash, 1);
            r.armL.rotation.z = cur.armL; r.armR.rotation.z = cur.armR;
            r.armL.position.set(b.armL.x, b.armL.y + cur.armUpL, b.armL.z + cur.fwd);
            r.armR.position.set(b.armR.x, b.armR.y + cur.armUpR, b.armR.z + cur.fwd);
            const ox = cur.gx * .024, oy = cur.gy * .017, open = 1 - cur.happy;
            r.eyes.forEach((e, i) => { e.position.set(b.eyes[i].x + ox, b.eyes[i].y + oy, b.eyes[i].z); e.scale.set(cur.eyeX, Math.max(.001, cur.eyeY * blinkK * open), cur.eyeX); });
            r.happy.forEach((h, i) => { h.position.set(b.happy[i].x + ox * .5, b.happy[i].y + oy * .5, b.happy[i].z); h.scale.set(1, Math.max(.001, cur.happy), 1); });
            cheekMat.opacity = cur.cheeks * .85;

            tmpCol.setHex(gl[0]); glowCol.lerp(tmpCol, 1 - Math.exp(-6 * dt)); glow.color.copy(glowCol);
            glowI = damp(glowI, gl[1], 6, dt); glow.intensity = glowI;

            if (T - dragRelease > 1.2) { azDrag = damp(azDrag, 0, 2.5, dt); elDrag = damp(elDrag, 0, 2.5, dt); }
            placeCamera();
            updateFx(dt);
            scr.draw(T);
            renderer.render(scene, camera);
            raf = requestAnimationFrame(loop);
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && rig && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); } });

        const bin = Uint8Array.from(atob(window.CLAWD_GLB), c => c.charCodeAt(0)).buffer;
        new THREE.GLTFLoader().parse(bin, '', gltf => start(gltf.scene), err => console.warn('Clawd 3D:', err));
        return true;
    }

    window.Clawd3D = { mount, supported };
})();
