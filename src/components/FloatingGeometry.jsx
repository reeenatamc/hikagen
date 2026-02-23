import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Subtle wireframe polyhedra floating behind white sections.
 * They rotate slowly, bob gently, and shift with scroll for a parallax feel.
 */
function FloatingGeometry({ scrollRef }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let width = window.innerWidth
    let height = window.innerHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 2000)
    camera.position.z = 600

    /* ---- Create floating shapes ---- */
    const shapes = [
      { geo: new THREE.IcosahedronGeometry(38, 1), pos: [-300, -60, -40] },
      { geo: new THREE.OctahedronGeometry(28, 0), pos: [320, 80, -70] },
      { geo: new THREE.TorusGeometry(22, 7, 16, 32), pos: [-200, 220, -100] },
      { geo: new THREE.DodecahedronGeometry(32, 0), pos: [260, -200, -50] },
      { geo: new THREE.IcosahedronGeometry(22, 0), pos: [60, 300, -110] },
      { geo: new THREE.TetrahedronGeometry(26, 0), pos: [-340, -280, -80] },
      { geo: new THREE.TorusKnotGeometry(16, 5, 64, 8), pos: [380, 260, -60] },
    ]

    const meshes = shapes.map(({ geo, pos }) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6366f1,
        wireframe: true,
        transparent: true,
        opacity: 0.03 + Math.random() * 0.035,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pos[0], pos[1], pos[2])
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      )
      mesh.userData = {
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.004,
          (Math.random() - 0.5) * 0.004,
          (Math.random() - 0.5) * 0.003,
        ),
        bobSpeed: 0.2 + Math.random() * 0.3,
        bobAmount: 8 + Math.random() * 14,
        baseY: pos[1],
      }
      scene.add(mesh)
      return mesh
    })

    /* ---- Scroll tracking ---- */
    let scrollY = 0
    const scrollContainer = scrollRef?.current

    const onScroll = () => {
      if (scrollContainer) scrollY = scrollContainer.scrollTop
    }

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true })
    }

    /* ---- Animation loop ---- */
    const startTime = Date.now()
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const t = (Date.now() - startTime) * 0.001

      // Parallax camera shift based on scroll
      const scrollOffset = scrollY * 0.06
      camera.position.y = -scrollOffset + 80

      meshes.forEach((mesh) => {
        const { rotSpeed, bobSpeed, bobAmount, baseY } = mesh.userData
        mesh.rotation.x += rotSpeed.x
        mesh.rotation.y += rotSpeed.y
        mesh.rotation.z += rotSpeed.z
        mesh.position.y =
          baseY - scrollOffset * 0.5 + Math.sin(t * bobSpeed) * bobAmount
      })

      renderer.render(scene, camera)
    }
    animate()

    /* ---- Resize handler ---- */
    const onResize = () => {
      width = window.innerWidth
      height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', onScroll)
      }
      meshes.forEach((mesh) => {
        mesh.geometry.dispose()
        mesh.material.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [scrollRef])

  return <div ref={containerRef} className="floating-geometry" />
}

export default FloatingGeometry
