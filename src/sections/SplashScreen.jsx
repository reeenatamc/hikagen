import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import '../styles/splash-screen.css'

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

function SplashScreen({ durationMs = 3000, onComplete, isExiting = false }) {
  const containerRef = useRef(null)
  const [isSceneReady, setIsSceneReady] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return undefined
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 3000)
    camera.position.z = 6000

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    })
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
      const halfX = window.innerWidth / 2
      const halfY = window.innerHeight / 2
      mouseX = (event.clientX - halfX) * 0.25
      mouseY = (event.clientY - halfY) * 0.15
    }

    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)

      if (!hasMouseInteraction) {
        mouseX = 0
        mouseY = -(height / 2) * 0.15
      }
    }

    const animate = () => {
      frameId = window.requestAnimationFrame(animate)

      const position = ((Date.now() - startTime) * 0.03) % 8000
      camera.position.x += (mouseX - camera.position.x) * 0.01
      camera.position.y += (-mouseY - camera.position.y) * 0.01
      camera.position.z = -position + 8000

      renderer.render(scene, camera)
    }

    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      'https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.magFilter = THREE.LinearFilter
        texture.minFilter = THREE.LinearMipmapLinearFilter

        material.uniforms.map.value = texture

        const planeGeo = new THREE.PlaneGeometry(64, 64)
        const planeObj = new THREE.Object3D()
        const geometries = []

        for (let index = 0; index < 8000; index += 1) {
          planeObj.position.x = Math.random() * 1000 - 500
          planeObj.position.y = -Math.random() * Math.random() * 200 - 15
          planeObj.position.z = index
          planeObj.rotation.z = Math.random() * Math.PI
          planeObj.scale.x = planeObj.scale.y =
            Math.random() * Math.random() * 1.5 + 0.5
          planeObj.updateMatrix()

          const clonedPlaneGeo = planeGeo.clone()
          clonedPlaneGeo.applyMatrix4(planeObj.matrix)
          geometries.push(clonedPlaneGeo)
        }

        const mergedGeometry = mergeGeometries(geometries)
        const planesMesh = new THREE.Mesh(mergedGeometry, material)
        planesMesh.renderOrder = 2

        const planesMeshBackground = planesMesh.clone()
        planesMeshBackground.position.z = -8000
        planesMeshBackground.renderOrder = 1

        scene.add(planesMesh)
        scene.add(planesMeshBackground)

        planeGeo.dispose()
        geometries.forEach((geometry) => geometry.dispose())

        const backgroundCanvas = document.createElement('canvas')
        backgroundCanvas.width = 32
        backgroundCanvas.height = window.innerHeight
        const backgroundContext = backgroundCanvas.getContext('2d')
        backgroundContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
        container.style.background = `url(${backgroundCanvas.toDataURL('image/png')})`
        container.style.backgroundSize = '32px 100%'

        container.appendChild(renderer.domElement)
        onResize()
        animate()
        setIsSceneReady(true)
      },
    )

    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('resize', onResize)

    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)

      scene.traverse((object) => {
        if (!object.isMesh) {
          return
        }

        object.geometry?.dispose()

        if (Array.isArray(object.material)) {
          object.material.forEach((entry) => entry.dispose())
          return
        }

        object.material?.dispose()
      })

      renderer.dispose()

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSceneReady) {
      return undefined
    }

    const transitionTimeout = window.setTimeout(() => {
      setIsTransitioning(true)
    }, Math.floor(durationMs * 0.55))

    const completeTimeout = window.setTimeout(() => {
      onComplete?.()
    }, durationMs)

    return () => {
      window.clearTimeout(transitionTimeout)
      window.clearTimeout(completeTimeout)
    }
  }, [durationMs, isSceneReady, onComplete])

  return (
    <section className={`splash-screen${isExiting ? ' is-exiting' : ''}`}>
      <div ref={containerRef} className="splash-canvas" />

      <div
        className={`splash-overlay${isSceneReady ? ' is-ready' : ''}${isTransitioning ? ' is-transitioning' : ''}`}
      >
        <div className="splash-brand">
          <h1>HIKAGEN</h1>
          <p>Innovamos la educación, porque el límite es el cielo.</p>

          <nav className="splash-menu" aria-label="Menú principal">
            <a href="#inicio">Inicio</a>
            <a href="#servicios">Servicios</a>
            <a href="#nosotros">Nosotros</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </div>
    </section>
  )
}

export default SplashScreen
