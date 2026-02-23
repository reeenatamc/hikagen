import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * A rotating wireframe globe made of connected glowing particles.
 * Nodes pulse and connections shimmer — very techy and premium.
 */
function ParticleGlobe({ nodeCount = 300 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let width = container.clientWidth
    let height = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000)
    camera.position.z = 500

    /* --- Generate nodes on a sphere --- */
    const radius = 160
    const nodes = []
    const positions = new Float32Array(nodeCount * 3)
    const colors = new Float32Array(nodeCount * 3)
    const sizes = new Float32Array(nodeCount)

    for (let i = 0; i < nodeCount; i++) {
      // Fibonacci sphere distribution
      const y = 1 - (i / (nodeCount - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const theta = ((1 + Math.sqrt(5)) / 2) * i * Math.PI * 2

      const px = Math.cos(theta) * r * radius
      const py = y * radius
      const pz = Math.sin(theta) * r * radius

      nodes.push(new THREE.Vector3(px, py, pz))
      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz

      // Color: indigo to white
      const brightness = 0.6 + Math.random() * 0.4
      colors[i * 3] = 0.39 * brightness
      colors[i * 3 + 1] = 0.40 * brightness
      colors[i * 3 + 2] = 0.95 * brightness

      sizes[i] = Math.random() * 2.5 + 1.5
    }

    /* --- Points (nodes) --- */
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pointGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    pointGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const pointMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        varying float vPulse;
        uniform float uTime;
        void main() {
          vColor = color;
          vPulse = 0.6 + 0.4 * sin(uTime * 2.0 + position.x * 0.02 + position.y * 0.03);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * vPulse * (250.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vPulse;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, glow * vPulse * 0.9);
        }
      `,
    })

    const points = new THREE.Points(pointGeo, pointMat)
    scene.add(points)

    /* --- Lines (connections) --- */
    const maxDist = 50
    const linePositions = []
    const lineOpacities = []

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodes[i].distanceTo(nodes[j])
        if (dist < maxDist) {
          linePositions.push(
            nodes[i].x, nodes[i].y, nodes[i].z,
            nodes[j].x, nodes[j].y, nodes[j].z,
          )
          const op = 1.0 - dist / maxDist
          lineOpacities.push(op, op)
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('aOpacity', new THREE.Float32BufferAttribute(lineOpacities, 1))

    const lineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x6366f1) },
      },
      vertexShader: `
        attribute float aOpacity;
        varying float vOp;
        void main() {
          vOp = aOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vOp;
        void main() {
          float shimmer = 0.5 + 0.5 * sin(uTime * 3.0 + gl_FragCoord.x * 0.02);
          gl_FragColor = vec4(uColor, vOp * 0.25 * shimmer);
        }
      `,
    })

    const lines = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(lines)

    /* --- Outer ring glow --- */
    const ringGeo = new THREE.RingGeometry(radius * 1.05, radius * 1.12, 128)
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float pulse = 0.4 + 0.2 * sin(uTime * 1.5 + vUv.x * 12.0);
          vec3 col = vec3(0.39, 0.40, 0.95);
          gl_FragColor = vec4(col, pulse * 0.3);
        }
      `,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI * 0.1
    scene.add(ring)

    /* --- Globe group for rotation --- */
    const group = new THREE.Group()
    group.add(points)
    group.add(lines)
    group.add(ring)
    scene.remove(points)
    scene.remove(lines)
    scene.remove(ring)
    scene.add(group)

    // Slight tilt like a real globe
    group.rotation.x = 0.3
    group.rotation.z = 0.1

    /* --- Mouse interaction --- */
    let mouseX = 0
    let mouseY = 0
    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    document.addEventListener('mousemove', onMouseMove)

    /* --- Animation --- */
    const startTime = Date.now()
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const t = (Date.now() - startTime) * 0.001

      pointMat.uniforms.uTime.value = t
      lineMat.uniforms.uTime.value = t
      ringMat.uniforms.uTime.value = t

      // Auto-rotate + mouse influence
      group.rotation.y = t * 0.15 + mouseX * 0.3
      group.rotation.x = 0.3 + mouseY * 0.15

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      width = container.clientWidth
      height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      pointGeo.dispose()
      pointMat.dispose()
      lineGeo.dispose()
      lineMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [nodeCount])

  return <div ref={containerRef} className="globe-canvas" />
}

export default ParticleGlobe
