import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Floating particles that drift upward — looks like light dust / fireflies.
 * Rendered with Three.js for smooth GPU-accelerated animation.
 */
function FloatingParticles({ count = 120, color = '#3b82f6' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const width = container.clientWidth
    const height = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000)
    camera.position.z = 300

    // Particle geometry
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const opacities = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600       // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 400   // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200   // z

      velocities[i * 3] = (Math.random() - 0.5) * 0.15     // vx drift
      velocities[i * 3 + 1] = Math.random() * 0.3 + 0.1    // vy upward
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1  // vz

      sizes[i] = Math.random() * 3 + 1.5
      opacities[i] = Math.random() * 0.6 + 0.2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))

    const threeColor = new THREE.Color(color)

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: threeColor },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying float vOpacity;
        uniform float uTime;

        void main() {
          vOpacity = aOpacity * (0.5 + 0.5 * sin(uTime * 1.5 + position.x * 0.01));
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d) * vOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const startTime = Date.now()
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const t = (Date.now() - startTime) * 0.001
      material.uniforms.uTime.value = t

      const pos = geometry.attributes.position.array
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3]
        pos[i * 3 + 1] += velocities[i * 3 + 1]
        pos[i * 3 + 2] += velocities[i * 3 + 2]

        // Reset when particle goes out of view
        if (pos[i * 3 + 1] > 220) {
          pos[i * 3 + 1] = -220
          pos[i * 3] = (Math.random() - 0.5) * 600
        }
      }
      geometry.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [count, color])

  return <div ref={containerRef} className="particles-canvas" />
}

export default FloatingParticles
