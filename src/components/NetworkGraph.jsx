import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Animated network graph: nodes (schools, personas) connected by lines.
 * Futurista, minimalista, azul-cyan, con animación de pulsos y conexiones.
 */
function NetworkGraph({ nodeCount = 24 }) {
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
    camera.position.z = 320

    // Generate nodes in a circle (school network)
    const radius = 110
    const nodes = []
    const positions = new Float32Array(nodeCount * 3)
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius
      const pz = Math.sin(angle * 2) * 18
      nodes.push(new THREE.Vector3(px, py, pz))
      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
    }

    // Points (nodes)
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pointMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float pulse = 1.0 + 0.25 * sin(uTime * 2.0 + position.x * 0.03);
          gl_PointSize = 16.0 * pulse * (180.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(0.18, 0.65, 1.0, glow * 0.85);
        }
      `,
    })
    const points = new THREE.Points(pointGeo, pointMat)
    scene.add(points)

    // Lines (connections)
    const linePositions = []
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (Math.abs(i - j) === 1 || Math.abs(i - j) === nodeCount - 1 || Math.random() < 0.18) {
          linePositions.push(
            nodes[i].x, nodes[i].y, nodes[i].z,
            nodes[j].x, nodes[j].y, nodes[j].z,
          )
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    const lineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        void main() {
          float shimmer = 0.5 + 0.5 * sin(uTime * 3.0 + gl_FragCoord.x * 0.02);
          gl_FragColor = vec4(0.18, 0.65, 1.0, shimmer * 0.18);
        }
      `,
    })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(lines)

    // Animation
    const startTime = Date.now()
    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const t = (Date.now() - startTime) * 0.001
      pointMat.uniforms.uTime.value = t
      lineMat.uniforms.uTime.value = t
      points.rotation.z = t * 0.12
      lines.rotation.z = t * 0.12
      renderer.render(scene, camera)
    }
    animate()

    // Resize
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
      window.removeEventListener('resize', onResize)
      pointGeo.dispose()
      pointMat.dispose()
      lineGeo.dispose()
      lineMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={containerRef} className="network-graph-canvas" style={{ width: '100%', height: '100%' }} />
}

export default NetworkGraph
