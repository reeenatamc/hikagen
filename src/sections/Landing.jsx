import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { centralMenuLinks } from '../constants/centralMenuLinks'
import ParticleGlobe from '../components/ParticleGlobe'
import FloatingGeometry from '../components/FloatingGeometry'
import NetworkGraph from '../components/NetworkGraph'
import '../styles/landing.css'

const cloudShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    varying vec2 vUv;

    void main() {
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep(fogNear, fogFar, depth);

      gl_FragColor = texture2D(map, vUv);
      gl_FragColor.w *= pow(gl_FragCoord.z, 20.0);
      gl_FragColor = mix(gl_FragColor, vec4(fogColor, gl_FragColor.w), fogFactor);
    }
  `,
}

/* ---------- Aurora ray shader ---------- */
const auroraShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // noise helpers
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / uResolution.y;
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

      float t = uTime * 0.4;

      // horizontal band distance from center
      float band = abs(p.y + 0.02);

      // noise displacement for organic movement
      float n1 = fbm(vec2(p.x * 3.0 + t, p.y * 8.0 + t * 0.3));
      float n2 = fbm(vec2(p.x * 5.0 - t * 0.7, p.y * 12.0));
      float distort = n1 * 0.04 + n2 * 0.02;

      band += distort;

      // expanding pulse rays
      float pulse1 = sin(t * 2.0 + p.x * 4.0) * 0.5 + 0.5;
      float pulse2 = sin(t * 1.3 - p.x * 6.0 + 1.5) * 0.5 + 0.5;
      float expand = 1.0 + pulse1 * 0.15 + pulse2 * 0.1;

      // core glow – thin bright line
      float core = exp(-band * 120.0 * expand) * 1.2;

      // mid halo
      float mid = exp(-band * 30.0 * expand) * 0.6;

      // wide soft glow
      float wide = exp(-band * 8.0) * 0.25;

      // subtle lightning tendrils
      float tendril = fbm(vec2(p.x * 10.0 + t * 2.0, p.y * 40.0));
      float tendrilMask = exp(-band * 50.0) * 0.3;
      float tendrils = tendril * tendrilMask;

      // color layers
      vec3 coreColor = vec3(0.88, 0.86, 1.0);        // white-indigo
      vec3 midColor  = vec3(0.39, 0.40, 0.95);         // indigo
      vec3 wideColor = vec3(0.18, 0.15, 0.55);         // deep indigo
      vec3 tendrilColor = vec3(0.55, 0.55, 0.98);

      vec3 col = coreColor * core
               + midColor * mid
               + wideColor * wide
               + tendrilColor * tendrils;

      // vignette
      float vig = 1.0 - length(p * vec2(0.6, 1.2)) * 0.8;
      vig = clamp(vig, 0.0, 1.0);
      col *= vig;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

function Landing() {
  const cloudRef = useRef(null)
  const auroraRef = useRef(null)
  const landingRef = useRef(null)
  const hasSeenIntro = window.localStorage.getItem('hikagen-intro-seen') === '1'

  const [phase, setPhase] = useState(hasSeenIntro ? 'ready' : 'loading')
  // phases: loading → intro → revealing → ready

  /* ---------- Dev shortcut: press R to replay intro ---------- */
  useEffect(() => {
    if (import.meta.env.PROD) return undefined
    const onKey = (e) => {
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && e.target === document.body) {
        window.localStorage.removeItem('hikagen-intro-seen')
        window.location.reload()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- Scroll-triggered reveal (IntersectionObserver) ---------- */
  useEffect(() => {
    if (phase !== 'ready') return undefined
    const targets = document.querySelectorAll('.landing-section, .slide-gradient')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        })
      },
      { threshold: 0.12 },
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [phase])

  /* ---------- Three.js aurora ray background ---------- */
  useEffect(() => {
    const container = auroraRef.current
    if (!container) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    }

    const geo = new THREE.PlaneGeometry(2, 2)
    const mat = new THREE.ShaderMaterial({
      vertexShader: auroraShader.vertexShader,
      fragmentShader: auroraShader.fragmentShader,
      uniforms,
    })
    scene.add(new THREE.Mesh(geo, mat))

    const startTime = Date.now()
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      uniforms.uTime.value = (Date.now() - startTime) * 0.001
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  /* ---------- Three.js cloud layer ---------- */
  useEffect(() => {
    if (hasSeenIntro) return undefined

    const container = cloudRef.current
    if (!container) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 3000)
    camera.position.z = 6000

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    let mouseX = 0
    let mouseY = -(window.innerHeight / 2) * 0.15
    let hasMouseInteraction = false
    const startTime = Date.now()
    let frameId = 0

    const fog = new THREE.Fog(0x4584b4, -100, 3000)
    scene.fog = fog

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null },
        fogColor: { value: fog.color },
        fogNear: { value: fog.near },
        fogFar: { value: fog.far },
      },
      vertexShader: cloudShader.vertexShader,
      fragmentShader: cloudShader.fragmentShader,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    })

    const onMouseMove = (event) => {
      hasMouseInteraction = true
      mouseX = (event.clientX - window.innerWidth / 2) * 0.25
      mouseY = (event.clientY - window.innerHeight / 2) * 0.15
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      if (!hasMouseInteraction) {
        mouseX = 0
        mouseY = -(window.innerHeight / 2) * 0.15
      }
    }

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const position = ((Date.now() - startTime) * 0.03) % 8000
      camera.position.x += (mouseX - camera.position.x) * 0.01
      camera.position.y += (-mouseY - camera.position.y) * 0.01
      camera.position.z = -position + 8000
      renderer.render(scene, camera)
    }

    new THREE.TextureLoader().load(
      'https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.magFilter = THREE.LinearFilter
        texture.minFilter = THREE.LinearMipmapLinearFilter
        material.uniforms.map.value = texture

        const planeGeo = new THREE.PlaneGeometry(64, 64)
        const planeObj = new THREE.Object3D()
        const geometries = []

        for (let i = 0; i < 8000; i += 1) {
          planeObj.position.x = Math.random() * 1000 - 500
          planeObj.position.y = -Math.random() * Math.random() * 200 - 15
          planeObj.position.z = i
          planeObj.rotation.z = Math.random() * Math.PI
          planeObj.scale.x = planeObj.scale.y = Math.random() * Math.random() * 1.5 + 0.5
          planeObj.updateMatrix()
          const clone = planeGeo.clone()
          clone.applyMatrix4(planeObj.matrix)
          geometries.push(clone)
        }

        const merged = mergeGeometries(geometries)
        const mesh = new THREE.Mesh(merged, material)
        mesh.renderOrder = 2
        const meshBg = mesh.clone()
        meshBg.position.z = -8000
        meshBg.renderOrder = 1
        scene.add(mesh)
        scene.add(meshBg)

        planeGeo.dispose()
        geometries.forEach((g) => g.dispose())

        const bg = document.createElement('canvas')
        bg.width = 32
        bg.height = window.innerHeight
        bg.getContext('2d').fillRect(0, 0, bg.width, bg.height)
        container.style.background = `url(${bg.toDataURL('image/png')})`
        container.style.backgroundSize = '32px 100%'

        container.appendChild(renderer.domElement)
        onResize()
        animate()

        // Scene is ready → start intro phase
        setPhase('intro')

        // After 3s start revealing the menu underneath
        setTimeout(() => {
          setPhase('revealing')
          window.localStorage.setItem('hikagen-intro-seen', '1')
        }, 3000)

        // After reveal animation completes, remove cloud layer
        setTimeout(() => {
          setPhase('ready')
        }, 4200)
      },
    )

    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      scene.traverse((obj) => {
        if (!obj.isMesh) return
        obj.geometry?.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material?.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [hasSeenIntro])

  const showClouds = phase === 'loading' || phase === 'intro' || phase === 'revealing'

  return (
    <div ref={landingRef} className={`landing landing--${phase}`}>
      {/* Background layer – Three.js aurora ray (fixed) */}
      <div className="landing-bg" aria-hidden="true">
        <div ref={auroraRef} className="aurora-canvas" />
      </div>

      {/* ====== HERO (first screen) ====== */}
      <section className="landing-hero">
        <div className="landing-center">
          <h1>HIKAGEN</h1>

          <nav className="glass-menu" aria-label="Menú principal">
            {centralMenuLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="scroll-indicator" aria-hidden="true">
          <span>Scroll</span>
          <div className="scroll-arrow" />
        </div>

        {/* Cloud overlay: sits on top, fades away */}
        {showClouds && (
          <div className="cloud-layer">
            <div ref={cloudRef} className="cloud-canvas" />
            <div className="cloud-text-overlay">
              <h1>HIKAGEN</h1>
              <p>Innovamos la educación, porque el límite es el cielo.</p>
            </div>
          </div>
        )}
      </section>

      {/* ====== SLIDE 2 – Gradient + Globe ====== */}
        <section className="slide-gradient slide-network">
          <div className="slide-gradient-content">
            <div className="slide-gradient-text">
              <span className="badge badge-dark">Conexión educativa</span>
              <h2>Gestión escolar conectada</h2>
              <p>
                Un ecosistema donde escuelas, docentes y familias están interconectados.
                Visualiza tu red, comparte datos y colabora en tiempo real.
              </p>
              <div className="stats-row">
                <div className="stat">
                  <strong>24</strong>
                  <span>Nodos activos</span>
                </div>
                <div className="stat">
                  <strong>+120</strong>
                  <span>Conexiones</span>
                </div>
                <div className="stat">
                  <strong>99.9%</strong>
                  <span>Uptime</span>
                </div>
              </div>
            </div>
            <div className="network-graph-wrapper">
              <NetworkGraph nodeCount={24} />
            </div>
          </div>
        </section>

      {/* ====== SLIDE 3 – Features ====== */}
      <FloatingGeometry scrollRef={landingRef} />
      <section id="info" className="landing-section section-features">
        <div className="section-content">
          <span className="badge badge-dark">Funcionalidades</span>
          <h2>Todo lo que necesitas, nada que te sobre</h2>
          <p className="section-subtitle">
            Herramientas diseñadas por educadores, para educadores.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">dashboard</span>
              </div>
              <h3>Panel intuitivo</h3>
              <p>Vista general de tu institución con métricas clave, alertas y accesos rápidos.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">school</span>
              </div>
              <h3>Gestión académica</h3>
              <p>Calificaciones, horarios, materias y planes de estudio en un flujo integrado.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">group</span>
              </div>
              <h3>Comunicación</h3>
              <p>Chat directo entre maestros, alumnos y padres. Notificaciones automáticas.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">bar_chart</span>
              </div>
              <h3>Reportes avanzados</h3>
              <p>Análisis de rendimiento por alumno, grupo o institución con gráficas interactivas.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">fingerprint</span>
              </div>
              <h3>Asistencia digital</h3>
              <p>Control de asistencia con QR, biométricos o lista manual. Todo en la nube.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <h3>Cobranza automatizada</h3>
              <p>Control de pagos, recibos digitales y recordatorios automáticos a padres.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SLIDE 4 – Pricing ====== */}
      <section id="pricing" className="landing-section section-pricing">
        <div className="section-content">
          <span className="badge badge-dark">Precios</span>
          <h2>Planes para cada institución</h2>
          <p className="section-subtitle">
            Sin sorpresas. Sin contratos largos. Cancela cuando quieras.
          </p>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Starter</h3>
                <p className="pricing-desc">Para escuelas pequeñas</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount">$29</span>
                <span className="price-period">/mes</span>
              </div>
              <ul className="pricing-features">
                <li>Hasta 200 alumnos</li>
                <li>Panel administrativo</li>
                <li>Asistencia digital</li>
                <li>Soporte por email</li>
              </ul>
              <button type="button" className="btn-pricing">Comenzar gratis</button>
            </div>
            <div className="pricing-card pricing-card--popular">
              <div className="popular-tag">Más popular</div>
              <div className="pricing-header">
                <h3>Pro</h3>
                <p className="pricing-desc">Para instituciones en crecimiento</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount">$79</span>
                <span className="price-period">/mes</span>
              </div>
              <ul className="pricing-features">
                <li>Hasta 1,000 alumnos</li>
                <li>Todo de Starter</li>
                <li>Reportes avanzados</li>
                <li>Comunicación integrada</li>
                <li>Cobranza automatizada</li>
              </ul>
              <button type="button" className="btn-pricing btn-pricing--primary">Comenzar gratis</button>
            </div>
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Enterprise</h3>
                <p className="pricing-desc">Para universidades y redes</p>
              </div>
              <div className="pricing-price">
                <span className="price-amount">Custom</span>
              </div>
              <ul className="pricing-features">
                <li>Alumnos ilimitados</li>
                <li>Todo de Pro</li>
                <li>API dedicada</li>
                <li>Soporte 24/7 prioritario</li>
                <li>Implementación asistida</li>
              </ul>
              <button type="button" className="btn-pricing">Contactar ventas</button>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SLIDE 5 – About / CTA ====== */}
      <section id="about" className="landing-section section-about">
        <div className="section-content">
          <span className="badge badge-dark">Nosotros</span>
          <h2>Creemos que el límite es el cielo</h2>
          <p className="section-subtitle">
            Somos un equipo de ingenieros y educadores construyendo el futuro
            de la gestión escolar. Desde Latinoamérica para el mundo.
          </p>
          <div className="about-values">
            <div className="value-item">
              <span className="material-symbols-outlined">rocket_launch</span>
              <h4>Innovación</h4>
              <p>Tecnología de punta aplicada a la educación real.</p>
            </div>
            <div className="value-item">
              <span className="material-symbols-outlined">handshake</span>
              <h4>Cercanía</h4>
              <p>Soporte humano, no bots. Estamos contigo.</p>
            </div>
            <div className="value-item">
              <span className="material-symbols-outlined">shield</span>
              <h4>Seguridad</h4>
              <p>Datos encriptados y respaldados siempre.</p>
            </div>
          </div>
          <div className="cta-block">
            <h3>¿Listo para transformar tu institución?</h3>
            <div className="cta-buttons">
              <button type="button" className="btn-cta-primary">Empezar ahora</button>
              <button type="button" className="btn-cta-secondary">Agendar demo</button>
            </div>
          </div>
        </div>
      </section>
    {/* ====== FOOTER ====== */}
    <footer className="landing-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <span className="footer-logo">HIKAGEN</span>
          <span className="footer-slogan">Futuro escolar, hoy.</span>
        </div>
        <nav className="footer-links">
          <a href="#info">Información</a>
          <a href="#pricing">Precios</a>
          <a href="#about">Nosotros</a>
        </nav>
        <div className="footer-copy">
          <span>© {new Date().getFullYear()} HIKAGEN. Todos los derechos reservados.</span>
        </div>
      </div>
      <div className="footer-anim-bg" />
    </footer>
    </div>
  )
}

export default Landing
