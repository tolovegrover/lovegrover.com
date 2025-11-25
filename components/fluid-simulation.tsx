'use client'

import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import * as THREE from 'three'

// Obstacle type definition
type Obstacle = {
    x: number
    y: number
    strength: number // 0 to 1
    age: number
    lifetime: number
}

const MAX_OBSTACLES = 20

const FluidSimulationScene = ({ speed }: { speed: number }) => {
    const { gl, viewport } = useThree()

    // Create render targets for ping-pong with RepeatWrapping for periodic boundaries
    const velocityFBOs = useRef([
        useFBO(512, 512, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.FloatType,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
        }),
        useFBO(512, 512, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.FloatType,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
        })
    ])

    const dyeFBOs = useRef([
        useFBO(512, 512, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.FloatType,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
        }),
        useFBO(512, 512, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.FloatType,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
        })
    ])

    const velocityIndex = useRef(0)
    const dyeIndex = useRef(0)
    const initialized = useRef(false)

    // Obstacle Management
    const obstacles = useRef<Obstacle[]>([])
    // Uniform arrays for obstacles (x, y, strength)
    const obstacleData = useMemo(() => new Float32Array(MAX_OBSTACLES * 3), [])
    const obstacleCount = useRef(0)

    // Initialization Shader (Draws stripes)
    const initMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                resolution: { value: new THREE.Vector2(512, 512) },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        varying vec2 vUv;
        
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          // Create horizontal stripes
          float layers = 8.0;
          float layerIndex = floor(vUv.y * layers);
          float hue = layerIndex / layers;
          
          // Add some variation
          vec3 color = hsv2rgb(vec3(hue, 1.0, 1.0)); // Max saturation and value
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
        })
    }, [])

    // Fluid solver shader
    const fluidMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                velocityField: { value: null },
                resolution: { value: new THREE.Vector2(512, 512) },
                obstacles: { value: obstacleData },
                obstacleCount: { value: 0 },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform sampler2D velocityField;
        uniform vec2 resolution;
        uniform float obstacleCount;
        uniform vec3 obstacles[${MAX_OBSTACLES}]; // x, y, strength
        varying vec2 vUv;

        #define dt 0.15
        #define vorticityThreshold 0.25
        #define velocityThreshold 10.0
        #define viscosityThreshold 0.6

        void main() {
          vec2 uv = vUv;
          vec2 stepSize = 1.0 / resolution;
          float k = 0.2, s = k / dt;

          vec4 fluidData = texture2D(velocityField, uv);
          vec4 fr = texture2D(velocityField, uv + vec2(stepSize.x, 0.0));
          vec4 fl = texture2D(velocityField, uv - vec2(stepSize.x, 0.0));
          vec4 ft = texture2D(velocityField, uv + vec2(0.0, stepSize.y));
          vec4 fd = texture2D(velocityField, uv - vec2(0.0, stepSize.y));

          vec3 ddx = (fr - fl).xyz * 0.5;
          vec3 ddy = (ft - fd).xyz * 0.5;
          float divergence = ddx.x + ddy.y;
          vec2 densityDiff = vec2(ddx.z, ddy.z);

          fluidData.z -= dt * dot(vec3(densityDiff, divergence), fluidData.xyz);

          vec2 laplacian = fr.xy + fl.xy + ft.xy + fd.xy - 4.0 * fluidData.xy;
          vec2 viscosityForce = viscosityThreshold * laplacian;

          vec2 densityInvariance = s * densityDiff;
          vec2 uvHistory = uv - dt * fluidData.xy * stepSize;
          fluidData.xyw = texture2D(velocityField, uvHistory).xyw;

          // Constant Flow Force (Left to Right) - Increased speed
          vec2 extForce = vec2(0.005, 0.0);

          // Apply Obstacle Forces (Invisible Deflectors)
          for(int i = 0; i < ${MAX_OBSTACLES}; i++) {
            if (float(i) >= obstacleCount) break;
            vec3 obs = obstacles[i]; // x, y, strength
            
            vec2 dir = uv - obs.xy;
            float dist = length(dir);
            float radius = 0.05; // Fixed radius of influence
            
            if (dist < radius) {
                // Radial repulsion force
                float force = (1.0 - dist / radius) * obs.z * 0.02; // obs.z is strength
                extForce += normalize(dir) * force;
            }
          }

          fluidData.xy += dt * (viscosityForce - densityInvariance + extForce);
          fluidData.xy = max(vec2(0.0), abs(fluidData.xy) - 1e-4) * sign(fluidData.xy); // Decay

          fluidData.w = (fd.x - ft.x + fr.y - fl.y);
          vec2 vorticity = vec2(abs(ft.w) - abs(fd.w), abs(fl.w) - abs(fr.w));
          vorticity *= vorticityThreshold / (length(vorticity) + 1e-5) * fluidData.w;
          fluidData.xy += vorticity;

          fluidData.y *= smoothstep(0.5, 0.48, abs(uv.y - 0.5));
          
          fluidData = clamp(fluidData, vec4(vec2(-velocityThreshold), 0.5, -vorticityThreshold),
                                       vec4(vec2(velocityThreshold), 3.0, vorticityThreshold));

          gl_FragColor = fluidData;
        }
      `,
        })
    }, [obstacleData])

    // Dye advection shader
    const dyeMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                velocityField: { value: null },
                dyeField: { value: null },
                resolution: { value: new THREE.Vector2(512, 512) },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform sampler2D velocityField;
        uniform sampler2D dyeField;
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec2 stepSize = 1.0 / resolution;
          vec4 vel = texture2D(velocityField, uv);
          vec4 col = texture2D(dyeField, uv - 0.1 * vel.xy * stepSize * 3.0); // Advection

          // No obstacle drawing here - they are invisible!
          
          gl_FragColor = col;
        }
      `,
        })
    }, [])

    // Display shader
    const displayMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                dyeField: { value: null },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform sampler2D dyeField;
        varying vec2 vUv;

        void main() {
          vec4 col = texture2D(dyeField, vUv);
          // Tone mapping
          gl_FragColor = vec4(pow(col.rgb, vec3(1.0/2.2)), 1.0);
        }
      `,
        })
    }, [])

    const meshRef = useRef<THREE.Mesh>(null)
    const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
    const quad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), [])

    useFrame((state) => {
        // --- Initialization ---
        if (!initialized.current) {
            // Draw stripes to dye buffers
            quad.material = initMaterial
            gl.setRenderTarget(dyeFBOs.current[0])
            gl.render(quad, camera)
            gl.setRenderTarget(dyeFBOs.current[1])
            gl.render(quad, camera)
            initialized.current = true
        }

        // Run simulation loop multiple times based on speed
        const iterations = Math.ceil(speed)

        for (let iter = 0; iter < iterations; iter++) {
            // --- Obstacle Logic ---
            const targetCount = 12
            const spawnRate = 0.05 // Probability per frame

            // Spawn new obstacles
            if (obstacles.current.length < targetCount && Math.random() < spawnRate) {
                obstacles.current.push({
                    x: 0.2 + Math.random() * 0.6, // Spawn in middle area
                    y: 0.1 + Math.random() * 0.8,
                    strength: 0.0,
                    age: 0,
                    lifetime: 400 + Math.random() * 200 // Frames
                })
            }

            // Update obstacles
            for (let i = obstacles.current.length - 1; i >= 0; i--) {
                const obs = obstacles.current[i]
                obs.age++

                // Fade In / Fade Out Logic
                const fadeTime = 100
                if (obs.age < fadeTime) {
                    obs.strength = obs.age / fadeTime // 0 -> 1
                } else if (obs.age > obs.lifetime - fadeTime) {
                    obs.strength = (obs.lifetime - obs.age) / fadeTime // 1 -> 0
                } else {
                    obs.strength = 1.0
                }

                if (obs.age >= obs.lifetime) {
                    obstacles.current.splice(i, 1)
                }
            }

            // Pack obstacle data for shader
            obstacleCount.current = obstacles.current.length
            for (let i = 0; i < MAX_OBSTACLES; i++) {
                if (i < obstacles.current.length) {
                    const obs = obstacles.current[i]
                    obstacleData[i * 3] = obs.x
                    obstacleData[i * 3 + 1] = obs.y
                    obstacleData[i * 3 + 2] = obs.strength
                } else {
                    obstacleData[i * 3 + 2] = 0 // Zero strength for unused
                }
            }

            // --- Simulation Steps ---

            // Update velocity field
            for (let i = 0; i < 2; i++) {
                const readVelocity = velocityFBOs.current[velocityIndex.current]
                const writeVelocity = velocityFBOs.current[(velocityIndex.current + 1) % 2]

                fluidMaterial.uniforms.velocityField.value = readVelocity.texture
                fluidMaterial.uniforms.obstacleCount.value = obstacleCount.current

                quad.material = fluidMaterial
                gl.setRenderTarget(writeVelocity)
                gl.render(quad, camera)

                velocityIndex.current = (velocityIndex.current + 1) % 2
            }

            // Update dye field
            const readDye = dyeFBOs.current[dyeIndex.current]
            const writeDye = dyeFBOs.current[(dyeIndex.current + 1) % 2]
            const currentVelocity = velocityFBOs.current[velocityIndex.current]

            dyeMaterial.uniforms.velocityField.value = currentVelocity.texture
            dyeMaterial.uniforms.dyeField.value = readDye.texture
            // No obstacle uniforms needed for dye anymore

            quad.material = dyeMaterial
            gl.setRenderTarget(writeDye)
            gl.render(quad, camera)

            dyeIndex.current = (dyeIndex.current + 1) % 2
        }

        // Update display
        if (meshRef.current) {
            const currentDye = dyeFBOs.current[dyeIndex.current]
                ; (meshRef.current.material as THREE.ShaderMaterial).uniforms.dyeField.value = currentDye.texture
        }

        gl.setRenderTarget(null)
    })

    return (
        <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
            <planeGeometry args={[1, 1]} />
            <primitive object={displayMaterial} attach="material" />
        </mesh>
    )
}

export default function FluidSimulation({ speed = 1 }: { speed?: number }) {
    return (
        <div className="fixed inset-0 z-[-1] pointer-events-none">
            <Canvas
                camera={{ position: [0, 0, 1], fov: 75 }}
                style={{ background: '#000000' }}
                gl={{ preserveDrawingBuffer: false, alpha: false, antialias: false }}
                dpr={[1, 2]}
            >
                <FluidSimulationScene speed={speed} />
            </Canvas>
        </div>
    )
}
