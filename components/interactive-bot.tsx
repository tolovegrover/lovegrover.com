'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useMotionValue, useTransform, useAnimationFrame, PanInfo, useSpring, useAnimation, AnimatePresence } from 'framer-motion'
import FluidSimulation from './fluid-simulation'
import ChargingDock from './charging-dock'

type BotState = 'IDLE' | 'ROAMING' | 'INVESTIGATING' | 'SEEKING_DOCK' | 'CHARGING' | 'DRAGGING' | 'DEAD' | 'READING' | 'WAITING_FOR_EXPAND' | 'DIZZY' | 'SEEKING_JAIL' | 'JAILED' | 'CHAOS' | 'SCARED' | 'SEEKING_INTEREST' | 'LOW_BATTERY'

export default function InteractiveBot() {
    const pathname = usePathname()
    const [isMounted, setIsMounted] = useState(false)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [botState, setBotState] = useState<BotState>('IDLE')
    const [battery, setBattery] = useState(50)
    const [speech, setSpeech] = useState<string | null>(null)
    const [scanProgress, setScanProgress] = useState(0)
    const [isBlinking, setIsBlinking] = useState(false)
    const [expression, setExpression] = useState<'neutral' | 'happy' | 'sad' | 'squint' | 'bored' | 'amused' | 'sleeping' | 'dizzy' | 'angry' | 'scared'>('neutral')
    const [isJailed, setIsJailed] = useState(false)

    // Audio & Genie State
    const [isMuted, setIsMuted] = useState(false)
    const [showGenie, setShowGenie] = useState(false)
    const showGenieRef = useRef(false) // Ref to prevent loop
    const [genieState, setGenieState] = useState<'APPEARING' | 'TALKING' | 'BARGAINING' | 'UNLOCKING' | 'LEAVING'>('APPEARING')
    const [genieSpeech, setGenieSpeech] = useState<string | null>(null)
    const jailStartTime = useRef<number | null>(null)

    // --- CONSTANTS ---
    // Jail is at Bottom-Left.
    // Dock is at Bottom-Right (approx bottom-32).
    // We align Jail Y with Dock Y.
    const JAIL_COORDS = { bottom: 128, left: 32 } // 128px from bottom, 32px from left
    const JAIL_SIZE = 96 // w-24 = 96px
    const LOCK_BUTTON_POS = { bottom: 140, left: 140 } // Slightly right of jail (32 + 96 + 12)

    // Refs for Game Loop (to avoid stale closures without re-running effects)
    const botStateRef = useRef<BotState>('IDLE')
    const batteryRef = useRef(50)
    const isJailedRef = useRef(false)

    // Sync refs with state
    useEffect(() => { botStateRef.current = botState }, [botState])
    useEffect(() => { batteryRef.current = battery }, [battery])
    useEffect(() => { isJailedRef.current = isJailed }, [isJailed])

    // Comments for different types of links/content
    const [visitedPriorityItems, setVisitedPriorityItems] = useState<string[]>([])
    const currentPriorityItem = useRef<string | null>(null)

    // Comments for different types of links/content
    const LINK_COMMENTS = {
        'default': ["Ooh, what's this?", "Interesting...", "Let me check this.", "Looks cool!", "Shiny!", "I wonder...", "Beep boop.", "Analyzing...", "Data found.", "Curious object."],
        'nav': ["Map found.", "Where to?", "Navigation systems online.", "Charting course.", "Waypoints detected."],
        'button': ["A button!", "Should I press it?", "Clicky clicky!", "Input detected.", "Press it? Press it!", "Action required."],
        'social': ["Socials!", "Friends?", "Hello world!", "Human connection protocol.", "Networking...", "Social graph detected."],
        'project': ["A project!", "Hard work here.", "Beep boop, code.", "Building things.", "Innovation detected."],
        'paper': ["Research paper! Must read.", "Knowledge detected.", "Scanning document...", "Reading mode engaged.", "Data input!", "Hypothesis found."],
        'purushartha': ["Purushartha? Interesting.", "Life goals detected.", "Analyzing meaning...", "Deep thoughts.", "Philosophy mode.", "Dharma scanning."],
        'code': ["Code detected!", "I speak this language.", "Python?", "TypeScript!", "Compiling...", "Syntax check."],
        'ai': ["Artificial Intelligence!", "My cousin?", "Neural networks...", "Deep learning detected.", "Hello fellow AI."],
        'robot': ["Another robot!", "Beep boop friend.", "Brother?", "Hardware detected.", "Greetings unit."],
        'about': ["Who is this?", "Analyzing profile...", "The creator?", "Bio data found.", "Identity scan."],
        'cv': ["Curriculum Vitae.", "Experience detected.", "Career path.", "Credentials found.", "Resume scanning."],
        'research-page': ["More science!", "To the lab!", "Research index.", "Hypotheses ahead.", "Data archive."],
        'stories-page': ["Story time!", "Narratives detected.", "Fiction or fact?", "Reading list.", "Library found."],
        'story': ["A story!", "Reading time.", "Chapter one...", "Once upon a time.", "Narrative found."],
        'chaos': ["Do not press!", "Danger!", "Chaos button...", "Entropy detected.", "Red button?"]
    }

    // Physics State
    const x = useMotionValue(100)
    const y = useMotionValue(100)

    // Head Physics State (MotionValues for smooth updates without re-renders)
    const headX = useMotionValue(0)
    const headY = useMotionValue(0)
    const headRotate = useMotionValue(0)

    // Smooth springs for head movement
    const springConfig = { stiffness: 300, damping: 25 }
    const smoothHeadX = useSpring(headX, springConfig)
    const smoothHeadY = useSpring(headY, springConfig)
    const smoothHeadRotate = useSpring(headRotate, springConfig)

    const velocity = useRef({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const targetPos = useRef<{ x: number, y: number } | null>(null)
    const targetElement = useRef<HTMLElement | null>(null)
    const lastActionTime = useRef(0)
    const lookTarget = useRef<{ x: number, y: number } | null>(null)

    // Petting Logic Refs
    const lastMousePos = useRef({ x: 0, y: 0 })
    const rubScore = useRef(0)
    const lastRubTime = useRef(0)
    const hoverTime = useRef(0)

    // Hover Love Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - hoverTime.current < 1000 && Date.now() - hoverTime.current > 50) {
                // Mouse is hovering (updated recently)
            }
        }, 500)
        return () => clearInterval(interval)
    }, [])

    // Fake 3D Rolling (Sliding Texture)
    const bgPosX = useTransform(x, (currentX) => `${currentX * 0.5}px`)
    const bgPosY = useTransform(y, (currentY) => `${currentY * 0.5}px`)

    // Dynamic Bubble Positioning
    const bubbleTop = useTransform(y, (currentY) => currentY < 150 ? '40px' : '-90px')
    const bubbleLeft = useTransform(x, (currentX) => {
        if (typeof window === 'undefined') return '-50%'
        if (currentX < 100) return '0px'
        if (currentX > window.innerWidth - 100) return 'auto'
        return '50%'
    })
    const bubbleRight = useTransform(x, (currentX) => {
        if (typeof window === 'undefined') return 'auto'
        if (currentX > window.innerWidth - 100) return '0px'
        return 'auto'
    })
    const bubbleTranslateX = useTransform(x, (currentX) => {
        if (typeof window === 'undefined') return '-50%'
        if (currentX < 100) return '0%'
        if (currentX > window.innerWidth - 100) return '0%'
        return '-50%'
    })
    const tailRotation = useTransform(y, (currentY) => currentY < 150 ? '225deg' : '45deg')
    const tailTop = useTransform(y, (currentY) => currentY < 150 ? '-6px' : 'auto')
    const tailBottom = useTransform(y, (currentY) => currentY < 150 ? 'auto' : '-6px')

    // Eye tracking logic
    const getEyeOffset = () => {
        if (typeof window === 'undefined') return { x: 0, y: 0 }
        const botX = x.get()
        const botY = y.get()

        // Determine what to look at
        let targetX = mousePos.x
        let targetY = mousePos.y

        // If investigating, look in the direction of the torch (velocity direction)
        if (botState === 'INVESTIGATING') {
            const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2)
            if (speed > 0.1) {
                // Look ahead in movement direction
                targetX = botX + velocity.current.x * 30
                targetY = botY + velocity.current.y * 30
            } else if (lookTarget.current) {
                targetX = lookTarget.current.x
                targetY = lookTarget.current.y
            }
        } else if (botState === 'SEEKING_DOCK') {
            // Look at dock (bottom right)
            targetX = window.innerWidth - 50
            targetY = window.innerHeight - 50
        }

        const dx = targetX - botX
        const dy = targetY - botY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const maxOffset = 6
        const moveX = distance > 0 ? (dx / distance) * Math.min(distance / 20, maxOffset) : 0
        const moveY = distance > 0 ? (dy / distance) * Math.min(distance / 20, maxOffset) : 0
        return { x: moveX, y: moveY }
    }
    const eyeOffset = getEyeOffset()

    // Audio Helper - Procedural Generation
    const audioContextRef = useRef<AudioContext | null>(null)

    const initAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume()
        }
        return audioContextRef.current
    }

    const playAudio = (soundName: string) => {
        if (isMuted) return
        const ctx = initAudio()
        const now = ctx.currentTime

        // Master Gain (Volume)
        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(0.3, now)
        masterGain.connect(ctx.destination)

        if (soundName === 'happy-beep') {
            // R2-D2 style chirps
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(800, now)
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1)
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.2)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(1, now + 0.05)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(now)
            osc.stop(now + 0.3)
        } else if (soundName === 'sad-beep') {
            // Sad descending slide
            const osc = ctx.createOscillator()
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(400, now)
            osc.frequency.linearRampToValueAtTime(100, now + 0.6)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.5, now + 0.1)
            gain.gain.linearRampToValueAtTime(0, now + 0.6)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(now)
            osc.stop(now + 0.6)
        } else if (soundName === 'scared-beep') {
            // Jittery FM
            const osc = ctx.createOscillator()
            osc.type = 'square'
            osc.frequency.setValueAtTime(600, now)

            // LFO for jitter
            const lfo = ctx.createOscillator()
            lfo.type = 'sawtooth'
            lfo.frequency.value = 20
            const lfoGain = ctx.createGain()
            lfoGain.gain.value = 500
            lfo.connect(lfoGain)
            lfoGain.connect(osc.frequency)
            lfo.start(now)
            lfo.stop(now + 0.5)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.5, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(now)
            osc.stop(now + 0.5)
        } else if (soundName === 'coin') {
            // High ping
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(1200, now)
            osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.5, now + 0.05)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(now)
            osc.stop(now + 0.5)
        } else if (soundName === 'unlock') {
            // Mechanical clunk
            const osc = ctx.createOscillator()
            osc.type = 'square'
            osc.frequency.setValueAtTime(100, now)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.5, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(now)
            osc.stop(now + 0.2)
        } else if (soundName === 'poof' || soundName === 'genie-appear') {
            // White Noise Burst
            const bufferSize = ctx.sampleRate * 1.5 // 1.5 seconds
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const data = buffer.getChannelData(0)
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1
            }

            const noise = ctx.createBufferSource()
            noise.buffer = buffer

            const filter = ctx.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(1000, now)
            filter.frequency.linearRampToValueAtTime(100, now + 1.5)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.5, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5)

            noise.connect(filter)
            filter.connect(gain)
            gain.connect(masterGain)
            noise.start(now)
        } else if (soundName === 'chaos-noise') {
            // Low rumble + high screech
            const osc1 = ctx.createOscillator()
            osc1.type = 'sawtooth'
            osc1.frequency.setValueAtTime(50, now)

            const osc2 = ctx.createOscillator()
            osc2.type = 'sawtooth'
            osc2.frequency.setValueAtTime(800, now)
            osc2.frequency.linearRampToValueAtTime(200, now + 2)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.3, now)
            gain.gain.linearRampToValueAtTime(0, now + 2)

            osc1.connect(gain)
            osc2.connect(gain)
            gain.connect(masterGain)
            osc1.start(now)
            osc2.start(now)
            osc1.stop(now + 2)
            osc2.stop(now + 2)
        }
    }

    // TTS Helper for Genie
    const speakGenie = (text: string) => {
        if (isMuted) return
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.pitch = 0.8 // Deeper voice
        utterance.rate = 0.9 // Slightly slower
        // Try to find a good voice
        const voices = window.speechSynthesis.getVoices()
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'))
        if (preferredVoice) utterance.voice = preferredVoice

        window.speechSynthesis.speak(utterance)
    }

    const playSignatureSound = () => {
        if (isMuted) return
        const ctx = initAudio()
        const now = ctx.currentTime
        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(0.2, now)
        masterGain.connect(ctx.destination)

        // Sequence of rapid chirps
        const frequencies = [800, 1200, 600, 1500, 900]
        const durations = [0.08, 0.05, 0.08, 0.1, 0.05]
        let startTime = now

        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            osc.type = i % 2 === 0 ? 'sine' : 'square'
            osc.frequency.setValueAtTime(freq, startTime)
            osc.frequency.exponentialRampToValueAtTime(freq * 1.2, startTime + durations[i] / 2)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, startTime)
            gain.gain.linearRampToValueAtTime(1, startTime + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i])

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(startTime)
            osc.stop(startTime + durations[i])

            startTime += durations[i] + 0.02 // Small gap
        })
    }

    const playClickSound = () => {
        if (isMuted) return
        const ctx = initAudio()
        const now = ctx.currentTime
        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(0.1, now)
        masterGain.connect(ctx.destination)

        // Beep-Boop (High -> Low)
        const osc1 = ctx.createOscillator()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(1200, now)
        osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.05)

        const osc2 = ctx.createOscillator()
        osc2.type = 'square'
        osc2.frequency.setValueAtTime(600, now + 0.06)
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.15)

        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(1, now + 0.01)
        gain.gain.setValueAtTime(0, now + 0.05)
        gain.gain.setValueAtTime(1, now + 0.06)
        gain.gain.linearRampToValueAtTime(0, now + 0.15)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(masterGain)
        osc1.start(now)
        osc1.stop(now + 0.05)
        osc2.start(now + 0.06)
        osc2.stop(now + 0.15)
    }

    const playMoveSound = () => {
        if (isMuted) return
        const ctx = initAudio()
        const now = ctx.currentTime
        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(0.1, now)
        masterGain.connect(ctx.destination)

        // Random Chatter (3-5 beeps)
        const count = Math.floor(Math.random() * 3) + 3
        let startTime = now

        for (let i = 0; i < count; i++) {
            const duration = Math.random() * 0.05 + 0.03
            const freq = Math.random() * 1000 + 500
            const type = Math.random() > 0.5 ? 'sine' : 'square'

            const osc = ctx.createOscillator()
            osc.type = type
            osc.frequency.setValueAtTime(freq, startTime)
            if (Math.random() > 0.5) {
                osc.frequency.exponentialRampToValueAtTime(freq * (Math.random() * 0.5 + 0.5), startTime + duration)
            }

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, startTime)
            gain.gain.linearRampToValueAtTime(1, startTime + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(startTime)
            osc.stop(startTime + duration)

            startTime += duration + 0.02
        }
    }

    // Blinking Logic
    useEffect(() => {
        const blinkLoop = () => {
            setIsBlinking(true)
            setTimeout(() => setIsBlinking(false), 150)
            setTimeout(blinkLoop, Math.random() * 3000 + 2000)
        }
        const timeout = setTimeout(blinkLoop, 2000)
        return () => clearTimeout(timeout)
    }, [])

    // Autonomous Logic Loop
    useEffect(() => {
        if (!isMounted) return

        const thinkInterval = setInterval(() => {
            if (isDragging.current) return

            const now = Date.now()
            const timeSinceAction = now - lastActionTime.current

            // Game Loop (AI Logic) using Refs
            const currentState = botStateRef.current
            const currentBattery = batteryRef.current

            // --- AI LOGIC ---

            // --- PURUSHARTHA MISSION LOGIC ---
            // If on /stories, ALWAYS prioritize finding and opening the Purushartha card if it's not open.
            // BUT: Respect Battery Life!
            if (pathname === '/stories') {
                const purusharthaCard = document.querySelector('[data-bot-priority="purushartha"]') as HTMLElement
                if (purusharthaCard) {
                    const isExpanded = purusharthaCard.getAttribute('data-expanded') === 'true'

                    if (!isExpanded) {
                        // MISSION: GO OPEN IT
                        // Override everything else (unless jailed or dying OR SEEKING DOCK)
                        if (currentState !== 'SEEKING_INTEREST' && currentState !== 'JAILED' && currentState !== 'DRAGGING' && currentState !== 'LOW_BATTERY' && currentState !== 'SEEKING_DOCK' && currentBattery > 20) {
                            setBotState('SEEKING_INTEREST')
                            setExpression('happy')
                            setSpeech("Ooh! Purushartha!")
                            playSignatureSound() // Signature sound!

                            // Target the TEXT specifically
                            const titleElement = purusharthaCard.querySelector('strong') || purusharthaCard
                            const rect = titleElement.getBoundingClientRect()
                            targetPos.current = {
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2
                            }
                            targetElement.current = titleElement as HTMLElement
                            return // Stop thinking about other things
                        }
                    } else if (currentState !== 'READING' && currentState !== 'JAILED' && currentState !== 'DRAGGING' && currentState !== 'LOW_BATTERY' && currentState !== 'SEEKING_DOCK') {
                        // It's open, so read it!
                        // We rely on the existing reading logic, but we can nudge it here if needed.
                        // For now, let the standard "find open card" logic pick it up, 
                        // OR we can force reading state here too.
                    }
                }
            }

            // Jail Logic
            if (isJailedRef.current) {
                // Always enforce SEEKING_JAIL if not already there or jailed
                if (currentState !== 'JAILED' && currentState !== 'SEEKING_JAIL' && currentState !== 'DRAGGING') {
                    setBotState('SEEKING_JAIL')
                    setSpeech("Going to jail...")
                    lookTarget.current = null // Stop looking at other things
                }

                // CONTINUOUSLY set target to jail center if seeking
                // This ensures it doesn't get lost or stuck
                if (currentState === 'SEEKING_JAIL' || (isJailedRef.current && currentState !== 'JAILED' && currentState !== 'DRAGGING')) {
                    const jailCenterX = JAIL_COORDS.left + (JAIL_SIZE / 2)
                    const jailCenterY = window.innerHeight - JAIL_COORDS.bottom - (JAIL_SIZE / 2)
                    targetPos.current = { x: jailCenterX, y: jailCenterY }
                }

                // GENIE RESCUE LOGIC
                if (isJailedRef.current && jailStartTime.current && !showGenieRef.current) {
                    const timeInJail = Date.now() - jailStartTime.current
                    if (timeInJail > 15000) { // 15 seconds (Fast Rescue!)
                        setShowGenie(true)
                        showGenieRef.current = true // Lock it
                        setGenieState('APPEARING')
                        playAudio('genie-appear')

                        // Genie Sequence
                        setTimeout(() => {
                            setGenieState('TALKING')
                            setGenieSpeech("Stuck again, huh?")
                        }, 2000)

                        setTimeout(() => {
                            setGenieState('BARGAINING')
                            setGenieSpeech("That'll be 50 credits.")
                            playAudio('coin')

                            // BB-8 Reply
                            setSpeech("Beep Beep *&^^*#@$")
                            playAudio('happy-beep')
                            setTimeout(() => setSpeech(null), 2000)
                        }, 5000)

                        setTimeout(() => {
                            setGenieState('UNLOCKING')
                            setGenieSpeech("Unlocking...")
                            playAudio('unlock')
                        }, 8000)

                        setTimeout(() => {
                            setIsJailed(false) // FREE HIM!
                            isJailedRef.current = false // Sync Ref immediately for physics
                            setBotState('ROAMING') // Force movement
                            velocity.current = { x: 10, y: -10 } // Run away FAST!
                            targetPos.current = null // Clear jail target
                            lastActionTime.current = Date.now() // Reset AI timer
                            playAudio('happy-beep')
                            setGenieState('LEAVING')
                            setGenieSpeech("Poof!")
                            playAudio('poof')
                            jailStartTime.current = null // Reset timer
                        }, 10000)

                        setTimeout(() => {
                            setShowGenie(false)
                            showGenieRef.current = false // Unlock
                            setGenieSpeech(null)
                        }, 12000)
                    }
                }

                // If jailed, stay jailed.
                // If seeking jail, continue.
                // If dragging, allow it but it will return to jail on release.
                return // Skip other logic
            }

            // Battery Drain
            let newBattery = currentBattery
            if (currentState !== 'CHARGING' && currentState !== 'DEAD') {
                newBattery = Math.max(0, currentBattery - 0.25) // Drain ~100% in ~400s (6.6 mins)
                setBattery(newBattery)
            } else if (currentState === 'CHARGING') {
                newBattery = Math.min(100, currentBattery + 16.5)
                setBattery(newBattery)
            }

            // Check for death
            if (newBattery <= 0 && currentState !== 'DEAD' && currentState !== 'CHARGING') {
                setBotState('DEAD')
                setExpression('sad')
                setSpeech('I need power...')
                velocity.current = { x: 0, y: 0 }
                targetPos.current = null
                return // Stop thinking
            }

            // Low Battery Warning & Seek Dock
            if (newBattery < 20 && currentState !== 'CHARGING' && currentState !== 'SEEKING_DOCK' && currentState !== 'DEAD' && currentState !== 'READING') {
                setBotState('SEEKING_DOCK')
                setExpression('sad')
                setSpeech("Low Battery!")
                // Dynamic Dock Finding
                const dockElement = document.getElementById('charging-dock')
                if (dockElement) {
                    const rect = dockElement.getBoundingClientRect()
                    targetPos.current = {
                        x: rect.left + rect.width / 2 - 16, // Center bot (32px) on dock center
                        y: rect.top + rect.height / 2 - 16
                    }
                } else {
                    // Fallback
                    targetPos.current = {
                        x: window.innerWidth - 140,
                        y: window.innerHeight - 140
                    }
                }
                return
            }

            // Fully Charged
            if (currentState === 'CHARGING' && newBattery >= 100) {
                setBotState('IDLE')
                setExpression('happy')
                setSpeech("Fully Charged!")
                velocity.current = { x: -5, y: -5 }
                setTimeout(() => setExpression('neutral'), 2000)
                return
            }

            // Random Emotional Shifts during movement
            if (currentState === 'ROAMING' || currentState === 'INVESTIGATING') {
                if (Math.random() < 0.02) { // 2% chance per tick
                    const emotions: ('happy' | 'bored' | 'amused' | 'squint')[] = ['happy', 'bored', 'amused', 'squint']
                    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)]
                    setExpression(randomEmotion)
                }
            }

            // CHAOS MODE TRIGGER (Removed Random Trigger)

            // Idle Behaviors (Random Expressions)
            if (currentState === 'IDLE') {
                if (Math.random() < 0.05) {
                    // Shiver
                    setSpeech("*Shiver*")
                    velocity.current = { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 }
                    setTimeout(() => setSpeech(null), 1000)
                } else if (Math.random() < 0.1) {
                    const idleExpr = Math.random() > 0.5 ? 'bored' : 'amused'
                    setExpression(idleExpr)
                    setTimeout(() => setExpression('neutral'), 2000)
                }
            }

            // AI Decision Making (Only if IDLE and enough time passed)
            if (currentState === 'IDLE' && timeSinceAction > 200) {
                // Pick a new random action
                // 30% chance to roam, 70% chance to investigate (Curious!)
                if (Math.random() > 0.7) {
                    setBotState('ROAMING')
                    // Margins for random movement
                    const marginTop = 0
                    const marginLeft = 0
                    const marginRight = 0
                    const marginBottom = 20
                    const botSize = 32

                    // Biased Roaming Logic (Don't get stuck on edges)
                    const currentX = x.get()
                    const currentY = y.get()
                    const width = window.innerWidth
                    const height = window.innerHeight

                    let minX = marginLeft
                    let maxX = width - botSize - marginRight
                    let minY = marginTop
                    let maxY = height - botSize - marginBottom

                    // If on left side, bias towards right
                    if (currentX < width * 0.2) minX = width * 0.3
                    // If on right side, bias towards left
                    if (currentX > width * 0.8) maxX = width * 0.7

                    // If on top side, bias towards bottom
                    if (currentY < height * 0.2) minY = height * 0.3
                    // If on bottom side, bias towards top
                    if (currentY > height * 0.8) maxY = height * 0.7

                    targetPos.current = {
                        x: Math.random() * (maxX - minX) + minX,
                        y: Math.random() * (maxY - minY) + minY
                    }
                } else {

                    // Look for something to investigate
                    const allLinks = Array.from(document.querySelectorAll('a, button, h1, h2, [data-bot-priority]'))

                    // Priority Search
                    let targetLink: Element | null = null
                    let isPriority = false
                    let priorityType = ''

                    // Random Selection Logic (Equal Probability)
                    // Filter out email links and hidden elements
                    const links = allLinks.filter(link => {
                        if (link.tagName === 'A') {
                            const href = (link as HTMLAnchorElement).href
                            return !href.startsWith('mailto:')
                        }
                        // Check if visible (at least partially)
                        const rect = link.getBoundingClientRect()
                        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
                    })

                    if (links.length > 0) {
                        // Weighted Selection: Context Aware
                        const isStoriesPage = pathname?.includes('/stories')

                        const chaosLinks = links.filter(l => l.getAttribute('data-bot-priority') === 'chaos')
                        const purusharthaLinks = links.filter(l => l.getAttribute('data-bot-priority') === 'purushartha')
                        const paperLinks = links.filter(l => l.getAttribute('data-bot-priority') === 'paper')
                        const priorityLinks = links.filter(l => {
                            const p = l.getAttribute('data-bot-priority')
                            return p && p !== 'paper' && p !== 'purushartha' && p !== 'chaos'
                        })
                        const regularLinks = links.filter(l => !l.getAttribute('data-bot-priority'))

                        let pool = links
                        const rand = Math.random()

                        if (isStoriesPage) {
                            // STORIES PAGE LOGIC
                            // 80% Purushartha
                            // 10% Chaos
                            // 10% Others
                            if (purusharthaLinks.length > 0 && rand < 0.8) {
                                pool = purusharthaLinks
                            } else if (chaosLinks.length > 0 && rand < 0.9) {
                                pool = chaosLinks
                            } else {
                                // Remaining 10% distributed among others
                                pool = [...paperLinks, ...priorityLinks, ...regularLinks]
                                if (pool.length === 0) pool = links // Fallback
                            }
                        } else {
                            // NORMAL LOGIC
                            // 25% Chaos (Increased)
                            // 40% Papers/Purushartha
                            // 25% Other Priority
                            // 10% Regular
                            if (chaosLinks.length > 0 && rand < 0.15) {
                                pool = chaosLinks
                            } else if ((paperLinks.length > 0 || purusharthaLinks.length > 0) && rand < 0.65) {
                                pool = [...paperLinks, ...purusharthaLinks]
                            } else if (priorityLinks.length > 0 && rand < 0.90) {
                                pool = priorityLinks
                            } else {
                                pool = regularLinks
                                if (pool.length === 0) pool = links // Fallback
                            }
                        }

                        // Safety fallback if selected pool is empty
                        if (pool.length === 0) pool = links

                        targetLink = pool[Math.floor(Math.random() * pool.length)]

                        // Check if the randomly selected link is a priority item
                        const priorityAttr = targetLink.getAttribute('data-bot-priority')
                        if (priorityAttr) {
                            isPriority = true
                            priorityType = priorityAttr
                        }
                    }

                    if (targetLink) {
                        const rect = targetLink.getBoundingClientRect()

                        // Determine comment
                        let comments = LINK_COMMENTS.default
                        const text = targetLink.textContent?.toLowerCase() || ""

                        // Dad Recognition
                        if (text.includes('love grover')) {
                            setBotState('INVESTIGATING')
                            setExpression('happy')
                            setSpeech("The Boss! Act busy! *Beep*")
                            // Do a little happy jump
                            velocity.current = { x: 0, y: -5 }
                            setTimeout(() => velocity.current = { x: 0, y: 5 }, 200)

                            // Stop here for a bit
                            targetPos.current = null
                            lastActionTime.current = now + 2000 // Delay next action

                            // Reset after a moment
                            setTimeout(() => {
                                if (isJailedRef.current) return // Guard
                                setBotState('IDLE')
                                setSpeech(null)
                            }, 3000)

                            return // Skip normal investigation logic
                        }

                        if (isPriority) {
                            if (priorityType === 'paper') comments = LINK_COMMENTS.paper
                            else if (priorityType === 'purushartha') comments = LINK_COMMENTS.purushartha
                            else if (priorityType === 'about') comments = LINK_COMMENTS.about
                            else if (priorityType === 'cv') comments = LINK_COMMENTS.cv
                            else if (priorityType === 'research-page') comments = LINK_COMMENTS['research-page']
                            else if (priorityType === 'stories-page') comments = LINK_COMMENTS['stories-page']
                            else if (priorityType === 'story') comments = LINK_COMMENTS.story
                            else if (priorityType === 'chaos') comments = LINK_COMMENTS.chaos
                            currentPriorityItem.current = priorityType
                        } else {
                            if (targetLink.tagName === 'BUTTON') comments = LINK_COMMENTS.button
                            else if (text.includes('twitter') || text.includes('github') || text.includes('linkedin')) comments = LINK_COMMENTS.social
                            else if (text.includes('code') || text.includes('git') || text.includes('repo')) comments = LINK_COMMENTS.code
                            else if (text.includes('ai') || text.includes('intelligence') || text.includes('learning')) comments = LINK_COMMENTS.ai
                            else if (text.includes('robot') || text.includes('vector') || text.includes('wire-pod')) comments = LINK_COMMENTS.robot
                            else if (targetLink.closest('nav')) comments = LINK_COMMENTS.nav
                            currentPriorityItem.current = null
                        }

                        const randomComment = comments[Math.floor(Math.random() * comments.length)]

                        setBotState('INVESTIGATING')
                        setExpression('squint')
                        setSpeech(randomComment)

                        // Move TO the link center, but clamp to safe area
                        const marginTop = 0
                        const marginLeft = 0
                        const marginRight = 0
                        const marginBottom = 20
                        const botSize = 32

                        let targetX = rect.left + rect.width / 2 - 16
                        let targetY = rect.top + rect.height / 2 - 16

                        // Clamp target
                        targetX = Math.max(marginLeft, Math.min(targetX, window.innerWidth - botSize - marginRight))
                        targetY = Math.max(marginTop, Math.min(targetY, window.innerHeight - botSize - marginBottom))

                        targetPos.current = { x: targetX, y: targetY }

                        // Store the element we are investigating
                        lookTarget.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

                        // Set a timeout to give up if we can't reach it
                        setTimeout(() => {
                            if (isJailedRef.current) return // Guard
                            setBotState(prev => {
                                if (prev === 'INVESTIGATING') {
                                    setSpeech(null)
                                    return 'IDLE'
                                }
                                return prev
                            })
                        }, 5000)

                        lastActionTime.current = now
                    }
                }
            }

            // Check if we reached the target during investigation
            if (currentState === 'INVESTIGATING' && targetPos.current) {
                const dx = targetPos.current.x - x.get()
                const dy = targetPos.current.y - y.get()
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist < 40) { // Arrived!
                    // Determine if we should click
                    const isPriority = currentPriorityItem.current !== null
                    // High click chance (80%) for everything to be more interactive
                    const shouldClick = isPriority || Math.random() < 0.8

                    if (shouldClick) {
                        setExpression('happy')
                        setSpeech("Clicking!")
                        velocity.current = { x: 0, y: -2 } // Nod
                        setTimeout(() => velocity.current = { x: 0, y: 2 }, 100)

                        // Helper to start reading
                        const startReading = (element: HTMLElement) => {
                            // Find text content (p tag)
                            // Since we clicked the container, we need to find the p tag inside it
                            // We can use querySelector since we have the element
                            // FIX: Look in parent element because the clicked element is the header, but the content is a sibling
                            const parent = element.parentElement
                            const textP = parent?.querySelector('p') || parent?.querySelector('.text-justify') as HTMLElement

                            if (textP && textP.textContent) {
                                setBotState('READING')
                                setExpression('squint')

                                // Collect all text nodes and create ranges for each word
                                const wordRanges: Range[] = []
                                const walker = document.createTreeWalker(textP, NodeFilter.SHOW_TEXT, null)
                                let node: Node | null
                                while (node = walker.nextNode()) {
                                    const text = node.textContent || ''
                                    const regex = /\S+/g
                                    let match
                                    while ((match = regex.exec(text)) !== null) {
                                        const range = document.createRange()
                                        range.setStart(node, match.index)
                                        range.setEnd(node, match.index + match[0].length)
                                        wordRanges.push(range)
                                    }
                                }

                                let wordIndex = 0

                                // Recursive Reading Loop for Dynamic Speed & Sync
                                const readNextWord = () => {
                                    if (botStateRef.current !== 'READING') return
                                    if (isJailedRef.current) return // Guard

                                    if (wordIndex >= wordRanges.length) {
                                        setSpeech("I read it! Closing it now.")
                                        setTimeout(() => {
                                            if (isJailedRef.current) return // Guard
                                            element.click()
                                            setBotState('IDLE')
                                            setSpeech("Done.")
                                        }, 2000)
                                        return
                                    }

                                    // Move to the exact word position
                                    const rect = range.getBoundingClientRect()
                                    targetPos.current = {
                                        x: rect.left + rect.width / 2,
                                        y: rect.top - 10
                                    }

                                    // Check if we are close enough to read it
                                    const dx = targetPos.current.x - x.get()
                                    const dy = targetPos.current.y - y.get()
                                    const dist = Math.sqrt(dx * dx + dy * dy)

                                    if (dist > 30) {
                                        // Wait for arrival
                                        setTimeout(readNextWord, 50)
                                        return
                                    }

                                    // Speak and Advance
                                    const word = range.toString()
                                    setSpeech(word)
                                    wordIndex++

                                    // Calculate delay for next word
                                    let delay = 800 // Slower base speed
                                    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) delay += 400
                                    else if (word.endsWith(',') || word.endsWith(';')) delay += 200
                                    else if (word.length > 8) delay += 100

                                    setTimeout(readNextWord, delay)
                                }

                                // Start reading
                                readNextWord()
                            } else {
                                setBotState('IDLE')
                                setSpeech("No text found.")
                            }
                        }

                        // Find the element at this location to click
                        // We use elementsFromPoint to drill through the bot itself
                        const elements = document.elementsFromPoint(x.get() + 16, y.get() + 16)
                        // Find first element that isn't the bot or its children
                        const targetElement = elements.find(el => !el.closest('.fixed.z-\\[9999\\]')) as HTMLElement

                        if (targetElement) {
                            // Check if it's already expanded
                            const isExpanded = targetElement.getAttribute('data-expanded') === 'true'

                            if (isExpanded) {
                                setSpeech("Already open. Reading...")
                                startReading(targetElement)
                            } else {
                                setSpeech("Opening...")
                                setBotState('WAITING_FOR_EXPAND') // Prevent further clicks
                                if (typeof targetElement.click === 'function') {
                                    targetElement.click()
                                } else {
                                    const clickEvent = new MouseEvent('click', {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true
                                    })
                                    targetElement.dispatchEvent(clickEvent)
                                }

                                // Poll for expansion
                                const checkExpand = setInterval(() => {
                                    if (isJailedRef.current) { clearInterval(checkExpand); return } // Guard
                                    if (targetElement.getAttribute('data-expanded') === 'true') {
                                        clearInterval(checkExpand)
                                        setSpeech("Opened it!")
                                        setTimeout(() => {
                                            if (!isJailedRef.current) startReading(targetElement)
                                        }, 500)
                                    }
                                }, 100)

                                // Timeout fallback
                                setTimeout(() => {
                                    clearInterval(checkExpand)
                                    if (botStateRef.current === 'WAITING_FOR_EXPAND' && !isJailedRef.current) {
                                        setBotState('IDLE')
                                    }
                                }, 2000)
                            }
                        }

                        if (!isPriority) {
                            currentPriorityItem.current = null
                        }
                    } else {
                        // Just look at it
                        setExpression('neutral')
                        setSpeech("Just looking.")
                    }

                    // Reset to IDLE after a moment
                    setTimeout(() => {
                        if (isJailedRef.current) return // Guard
                        setBotState(prev => prev === 'INVESTIGATING' ? 'IDLE' : prev)
                        setSpeech(null)
                        lookTarget.current = null
                    }, 800)

                    targetPos.current = null // Stop moving
                    lastActionTime.current = now
                }
            }

            if (currentState === 'ROAMING' && targetPos.current) {
                const dx = targetPos.current.x - x.get()
                const dy = targetPos.current.y - y.get()
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < 50) {
                    setBotState('IDLE')
                    targetPos.current = null // Clear target
                    lastActionTime.current = now
                }
            } else if (currentState === 'SEEKING_JAIL') {
                // Move towards Jail
                // Target is center of jail
                // Jail Left = 32, Width = 96 -> Center X = 32 + 48 = 80
                // Jail Bottom = 128, Height = 96 -> Center Y = window.innerHeight - 128 - 48 = window.innerHeight - 176

                const jailCenterX = JAIL_COORDS.left + (JAIL_SIZE / 2)
                const jailCenterY = window.innerHeight - JAIL_COORDS.bottom - (JAIL_SIZE / 2)

                // Game Loop only sets the target (like Dock logic)
                targetPos.current = { x: jailCenterX, y: jailCenterY }
            } else if (currentState === 'JAILED') {
                // Stay put
                velocity.current = { x: 0, y: 0 }
                // Optional: Look sad
                if (Math.random() < 0.01) setExpression('sad')
            } else if (currentState === 'SEEKING_DOCK') {
                // Dynamic Dock Finding
                const dockElement = document.getElementById('charging-dock')
                let dockX, dockY

                if (dockElement) {
                    const rect = dockElement.getBoundingClientRect()
                    dockX = rect.left + rect.width / 2 - 16
                    dockY = rect.top + rect.height / 2 - 16
                } else {
                    dockX = window.innerWidth - 140
                    dockY = window.innerHeight - 140
                }

                const dx = dockX - x.get()
                const dy = dockY - y.get()
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < 10) { // Get really close
                    setBotState('CHARGING')
                    velocity.current = { x: 0, y: 0 }
                    // Snap exactly
                    x.set(dockX)
                    y.set(dockY)
                }
            }

        }, 500) // Think every 0.5 seconds

        return () => clearInterval(thinkInterval)
    }, [isMounted, x, y]) // Removed botState and battery from deps to prevent reset

    // Physics Loop
    useAnimationFrame(() => {
        if (!isDragging.current) {
            let currentX = x.get()
            let currentY = y.get()

            // Autonomous Movement Force
            // Autonomous Movement Force
            const currentState = botStateRef.current

            // Edge Repulsion Force (Keep away from walls)
            const repulsionMargin = 50
            const repulsionForce = 0.2

            if (currentState !== 'CHARGING' && currentState !== 'DRAGGING' && currentState !== 'JAILED') {
                if (currentX < repulsionMargin) velocity.current.x += repulsionForce
                if (currentX > window.innerWidth - repulsionMargin) velocity.current.x -= repulsionForce
                if (currentY < repulsionMargin) velocity.current.y += repulsionForce
                if (currentY > window.innerHeight - repulsionMargin - 20) velocity.current.y -= repulsionForce
            }

            if ((currentState === 'ROAMING' || currentState === 'INVESTIGATING' || currentState === 'SEEKING_DOCK' || currentState === 'READING' || currentState === 'SEEKING_JAIL') && targetPos.current) {
                const dx = targetPos.current.x - currentX
                const dy = targetPos.current.y - currentY
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist > 10) {
                    const speed = currentState === 'SEEKING_DOCK' ? 0.15 : (currentState === 'INVESTIGATING' ? 0.12 : (currentState === 'READING' ? 0.2 : (currentState === 'SEEKING_JAIL' ? 0.3 : 0.05)))
                    velocity.current.x += (dx / dist) * speed
                    velocity.current.y += (dy / dist) * speed
                } else if (currentState === 'SEEKING_JAIL') {
                    // Arrival Logic (In Physics Loop for robustness)
                    setBotState('JAILED')
                    setSpeech("Locked up.")
                    velocity.current = { x: 0, y: 0 }

                    const jailCenterX = JAIL_COORDS.left + (JAIL_SIZE / 2)
                    const jailCenterY = window.innerHeight - JAIL_COORDS.bottom - (JAIL_SIZE / 2)
                    x.set(jailCenterX)
                    y.set(jailCenterY)
                    targetPos.current = null
                }
            } else if (currentState === 'WAITING_FOR_EXPAND' || currentState === 'DIZZY' || currentState === 'JAILED') {
                // Just hover in place or look at the target
                velocity.current.x *= 0.8
                velocity.current.y *= 0.8
            } else if (currentState === 'SCARED') {
                // Shiver in place
                velocity.current = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 }
            } else if (currentState === 'CHAOS') {
                // ERRATIC MOVEMENT
                if (Math.random() < 0.1) {
                    velocity.current.x += (Math.random() - 0.5) * 5
                    velocity.current.y += (Math.random() - 0.5) * 5
                }
                // High speed cap
                velocity.current.x = Math.max(-15, Math.min(15, velocity.current.x))
                velocity.current.y = Math.max(-15, Math.min(15, velocity.current.y))
            }

            // Apply Velocity
            if (currentState !== 'CHARGING' && currentState !== 'DRAGGING' && currentState !== 'JAILED') {
                currentX += velocity.current.x
                currentY += velocity.current.y

                // Friction (higher when IDLE to prevent sliding)
                const frictionFactor = botState === 'IDLE' ? 0.85 : 0.92
                velocity.current.x *= frictionFactor
                velocity.current.y *= frictionFactor

                // Stop if velocity is very small
                if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0
                if (Math.abs(velocity.current.y) < 0.01) velocity.current.y = 0
            } else if (currentState === 'CHARGING') {
                // Snap to dock center
                const dockElement = document.getElementById('charging-dock')
                let dockX, dockY
                if (dockElement) {
                    const rect = dockElement.getBoundingClientRect()
                    dockX = rect.left + rect.width / 2 - 16
                    dockY = rect.top + rect.height / 2 - 16
                } else {
                    dockX = window.innerWidth - 140
                    dockY = window.innerHeight - 140
                }

                currentX += (dockX - currentX) * 0.2
                currentY += (dockY - currentY) * 0.2
                velocity.current = { x: 0, y: 0 }
            } else if (currentState === 'JAILED') {
                // Snap to jail center
                const jailCenterX = JAIL_COORDS.left + (JAIL_SIZE / 2)
                const jailCenterY = window.innerHeight - JAIL_COORDS.bottom - (JAIL_SIZE / 2)

                currentX += (jailCenterX - currentX) * 0.2
                currentY += (jailCenterY - currentY) * 0.2
                velocity.current = { x: 0, y: 0 }
            }

            // Hard Screen Boundaries with Inward Margin (No Wrapping)
            if (typeof window !== 'undefined') {
                const width = window.innerWidth
                const height = window.innerHeight
                const size = 32 // Bot size

                // Asymmetric Margins
                const marginTop = 0
                const marginLeft = 0
                const marginRight = 0
                const marginBottom = 20 // Allow reaching bottom buttons

                // Clamp X with margin
                if (currentX < marginLeft) {
                    currentX = marginLeft
                    velocity.current.x *= -0.5 // Bounce
                } else if (currentX > width - size - marginRight) {
                    currentX = width - size - marginRight
                    velocity.current.x *= -0.5 // Bounce
                }

                // Clamp Y with margin
                if (currentY < marginTop) {
                    currentY = marginTop
                    velocity.current.y *= -0.5 // Bounce
                } else if (currentY > height - size - marginBottom) {
                    currentY = height - size - marginBottom
                    velocity.current.y *= -0.5 // Bounce
                }
            }

            // Dynamic Head Tilt & Shift (Linked to Speed)
            const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2)

            // 1. Calculate Shift ("how much ahead")
            // Max shift = 10px, linked to speed
            const maxShift = 10
            const shiftFactor = 2.0
            let shiftX = velocity.current.x * shiftFactor
            let shiftY = velocity.current.y * shiftFactor
            const shiftMag = Math.sqrt(shiftX ** 2 + shiftY ** 2)
            if (shiftMag > maxShift) {
                shiftX = (shiftX / shiftMag) * maxShift
                shiftY = (shiftY / shiftMag) * maxShift
            }

            // 2. Calculate Tilt ("angle")
            // Max tilt = 15 degrees, linked to X velocity (banking/leaning)
            const maxTilt = 15
            const tiltFactor = 3.0
            let tilt = velocity.current.x * tiltFactor
            if (tilt > maxTilt) tilt = maxTilt
            if (tilt < -maxTilt) tilt = -maxTilt

            // 3. Add State-based Offsets
            let stateRotate = 0
            let stateY = 0

            if (currentState === 'INVESTIGATING') {
                stateRotate = 15
                stateY = -2 // Lift slightly
            } else if (currentState === 'CHARGING') {
                stateRotate = -5
            } else if (currentState === 'JAILED') {
                stateRotate = 0
                stateY = 0
            }

            // 4. Update MotionValues
            // Base position is centered (-50% is handled in CSS/layout, here we add pixels)
            // Actually, x/y in style are transforms. 
            // The element has `left-1/2 -translate-x-1/2`. 
            // Adding `x` style adds to the transform.
            // So x=0 is center.

            headX.set(shiftX)
            headY.set(shiftY + stateY)
            headRotate.set(tilt + stateRotate)

            x.set(currentX)
            y.set(currentY)
        }
    })

    useEffect(() => {
        setIsMounted(true)
        if (typeof window !== 'undefined') {
            x.set(Math.random() * (window.innerWidth - 100))
            y.set(Math.random() * (window.innerHeight - 100))
        }
        const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })

        // Click Reactivity (Fist Bump)
        const handleClick = (e: MouseEvent) => {
            const botX = x.get()
            const botY = y.get()
            const dx = e.clientX - (botX + 32)
            const dy = e.clientY - (botY + 32)
            const dist = Math.sqrt(dx * dx + dy * dy)

            // If clicked near (but not on) the bot
            if (dist > 40 && dist < 150) {
                setBotState('INVESTIGATING')
                setExpression('happy')
                setSpeech("Fist bump!")
                // Lunge towards click
                velocity.current = { x: dx * 0.1, y: dy * 0.1 }
                setTimeout(() => {
                    velocity.current = { x: -dx * 0.05, y: -dy * 0.05 } // Recoil
                    setTimeout(() => {
                        setBotState('IDLE')
                        setSpeech(null)
                    }, 500)
                }, 300)
            } else if (dist > 150) {
                // Just look
                setExpression('happy')
                lookTarget.current = { x: e.clientX, y: e.clientY }
                setSpeech("Ooh!")
                setTimeout(() => {
                    setExpression('neutral')
                    setSpeech(null)
                    lookTarget.current = null
                }, 1500)
            }
        }

        // Text Echoing on Hover
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (['P', 'H1', 'H2', 'H3', 'A', 'BUTTON', 'SPAN'].includes(target.tagName)) {
                const text = target.textContent?.trim()
                if (text && text.length > 0) {
                    setSpeech(text.slice(0, 20) + (text.length > 20 ? '...' : ''))
                    setTimeout(() => setSpeech(null), 2000)
                }
            }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('click', handleClick)
        window.addEventListener('mouseover', handleMouseOver)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('click', handleClick)
            window.removeEventListener('mouseover', handleMouseOver)
        }
    }, [])

    const handleDragStart = () => {
        isDragging.current = true
        // If dead, revive on drag
        if (botState === 'DEAD') {
            setBattery(10) // Give some battery
            setSpeech('Thanks!')
            setTimeout(() => setSpeech(null), 1500)
        }
        setBotState('DRAGGING')
        velocity.current = { x: 0, y: 0 }
    }

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        isDragging.current = false

        // Check for dizziness (high velocity release)
        const speed = Math.sqrt(info.velocity.x ** 2 + info.velocity.y ** 2)
        if (speed > 500) {
            setBotState('DIZZY')
            setExpression('dizzy')
            setSpeech("Whoa... Dizzy...")
            setTimeout(() => {
                setBotState('IDLE')
                setExpression('neutral')
                setSpeech(null)
            }, 3000)
        } else {
            setBotState('IDLE')
            setSpeech("Wheee!")
            setTimeout(() => setSpeech(null), 2000)
        }

        // CRITICAL: Clear all targets and stop all movement to prevent sliding
        targetPos.current = null
        velocity.current = { x: 0, y: 0 }

        // Check if dropped near dock
        const dock = document.getElementById('charging-dock')
        if (dock) {
            const dockRect = dock.getBoundingClientRect()
            const botRect = (event.target as HTMLElement).getBoundingClientRect()

            const dist = Math.sqrt(
                Math.pow((dockRect.left + dockRect.width / 2) - (botRect.left + botRect.width / 2), 2) +
                Math.pow((dockRect.top + dockRect.height / 2) - (botRect.top + botRect.height / 2), 2)
            )

            if (dist < 100) {
                setBotState('CHARGING')
                setSpeech("Charging...")
                // Snap to dock center
                x.set(dockRect.left + dockRect.width / 2 - 32)
                y.set(dockRect.top + dockRect.height / 2 - 32)
                return // Exit early
            }
        }

        // Check if dropped near JAIL
        const botRect = (event.target as HTMLElement).getBoundingClientRect()
        const jailCenterX = JAIL_COORDS.left + (JAIL_SIZE / 2)
        const jailCenterY = window.innerHeight - JAIL_COORDS.bottom - (JAIL_SIZE / 2)

        const distToJail = Math.sqrt(
            Math.pow(jailCenterX - (botRect.left + botRect.width / 2), 2) +
            Math.pow(jailCenterY - (botRect.top + botRect.height / 2), 2)
        )

        if (distToJail < 100) {
            setIsJailed(true)
            setBotState('JAILED')
            setSpeech("Oh no! Jail!")
            playAudio('sad-beep')
            jailStartTime.current = Date.now() // START THE TIMER!
            // Snap to jail center
            x.set(jailCenterX - 32)
            y.set(jailCenterY - 32)
        }

        lastActionTime.current = Date.now() // Reset timer so he doesn't immediately run away
    }

    if (!isMounted) return null

    // Eye Color based on state
    const eyeColor = (botState === 'CHAOS' || expression === 'angry') ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' :
        (botState === 'SCARED' || expression === 'scared' ? 'bg-cyan-200 shadow-[0_0_10px_rgba(165,243,252,0.8)]' :
            (botState === 'CHARGING' ? 'bg-green-500' : (battery < 20 ? 'bg-red-500' : 'bg-black')))
    // Petting Logic

    const handlePettingMove = (e: React.MouseEvent) => {
        const now = Date.now()
        const dx = Math.abs(e.clientX - lastMousePos.current.x)
        const dy = Math.abs(e.clientY - lastMousePos.current.y)
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Detect rapid back-and-forth movement (Rubbing)
        if (dist > 2 && dist < 80) { // Lower min, higher max
            if (now - lastRubTime.current < 300) { // Longer window
                rubScore.current += 1
            } else {
                rubScore.current = Math.max(0, rubScore.current - 1)
            }
            lastRubTime.current = now
        }

        if (rubScore.current > 8) { // Lower threshold (was 15)
            if (expression !== 'happy' && expression !== 'sleeping') {
                setExpression('happy')
                setSpeech("Purr... Hehe!")
                // Vibration
                velocity.current = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 }
                rubScore.current = 0 // Reset
            }
        }

        lastMousePos.current = { x: e.clientX, y: e.clientY }
        hoverTime.current = now
    }



    const handleMouseEnter = () => {
        if (expression !== 'sleeping') {
            setExpression('amused') // Look interested
        }
    }

    return (
        <>
            {/* Chaos/Fluid Background */}
            <AnimatePresence>
                {(botState === 'CHAOS' || botState === 'SCARED') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, delay: 1 }} // Wait 1s, then fade in over 2s. Exit fades out over 2s (default or inherited)
                        className="fixed inset-0 z-[-1]"
                    >
                        <FluidSimulation speed={botState === 'CHAOS' ? 1 : 0.5} preWarm={6000} />
                    </motion.div>
                )}
            </AnimatePresence>

            <ChargingDock />

            {/* Genie (Smoke Spirit) */}
            <AnimatePresence>
                {showGenie && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, y: 50 }} // Rise from below
                        animate={{
                            opacity: 1,
                            scale: genieState === 'LEAVING' ? 2 : 1, // Blast size
                            y: (genieState === 'UNLOCKING' || genieState === 'LEAVING') ? 20 : 0, // Stay down
                            x: (genieState === 'UNLOCKING' || genieState === 'LEAVING') ? (window.innerWidth / 2) - (JAIL_COORDS.left + JAIL_SIZE + 50) : 0 // Stay at center button
                        }}
                        exit={{ opacity: 0, scale: 3, filter: "blur(20px)" }} // POOF BLAST
                        transition={{
                            duration: genieState === 'LEAVING' ? 0.2 : 1, // Fast exit
                            ease: "easeInOut"
                        }}
                        className="fixed z-50 pointer-events-none"
                        style={{
                            left: JAIL_COORDS.left + JAIL_SIZE + 20, // Right of jail
                            bottom: JAIL_COORDS.bottom + 20, // Start height
                            width: 40, // Mini Genie (1/3 size)
                            height: 40
                        }}
                    >
                        {/* Organic Smoke Particle System */}
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    y: [0, -5 - Math.random() * 10, 0], // Smaller movement
                                    x: [0, (Math.random() - 0.5) * 10, 0],
                                    scale: [1, 1.2 + Math.random() * 0.5, 1],
                                    rotate: [0, (Math.random() - 0.5) * 60, 0],
                                    opacity: [0.4, 0.7, 0.4]
                                }}
                                transition={{
                                    duration: 3 + Math.random() * 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: Math.random() * 2
                                }}
                                className={`absolute rounded-full blur-md mix-blend-screen ${i % 3 === 0 ? 'bg-blue-600/50' : i % 3 === 1 ? 'bg-cyan-400/50' : 'bg-indigo-500/50'
                                    }`}
                                style={{
                                    inset: `${Math.random() * 20}%`,
                                    width: `${50 + Math.random() * 50}%`,
                                    height: `${50 + Math.random() * 50}%`,
                                }}
                            />
                        ))}
                        {/* Core Glow */}
                        <motion.div
                            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 0.9, 0.6] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-2 bg-white/40 blur-sm rounded-full mix-blend-overlay"
                        />

                        {/* Speech Bubble (Hide when leaving/unlocking) */}
                        {genieSpeech && genieState !== 'UNLOCKING' && genieState !== 'LEAVING' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-black/90 text-black dark:text-white px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-md border border-gray-200 dark:border-gray-700"
                            >
                                {genieSpeech}
                                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/90 dark:bg-black/90 rotate-45 border-b border-r border-gray-200 dark:border-gray-700"></div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Jail / Cage Visuals - Absolute Positioning */}
            <div
                className="fixed z-0 pointer-events-none"
                style={{
                    bottom: JAIL_COORDS.bottom,
                    left: JAIL_COORDS.left,
                    width: JAIL_SIZE,
                    height: JAIL_SIZE
                }}
            >
                {/* Floor */}
                <div className="absolute bottom-0 left-0 w-full h-4 bg-gray-800 rounded-full opacity-50 blur-sm" />

                {/* Bars (Rise up when bot is fully inside) */}
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                        height: botState === 'JAILED' ? '100%' : '0%',
                        opacity: isJailed ? 1 : 0
                    }}
                    transition={{ duration: 0.5, delay: botState === 'JAILED' ? 0.2 : 0 }}
                    className="absolute bottom-0 left-0 w-full bg-black/20 backdrop-blur-[1px] border-4 border-gray-800 rounded-lg overflow-hidden flex justify-evenly items-end"
                >
                    <div className="w-1 h-full bg-gray-700 shadow-md" />
                    <div className="w-1 h-full bg-gray-700 shadow-md" />
                    <div className="w-1 h-full bg-gray-700 shadow-md" />
                    <div className="w-1 h-full bg-gray-700 shadow-md" />
                </motion.div>
            </div>

            {/* Control Buttons Container - Bottom Center - Subtle & Organic */}
            <div className="fixed bottom-0 pb-4 left-1/2 -translate-x-1/2 flex gap-4 z-50">
                {/* Lock/Unlock Button */}
                <button
                    onClick={() => {
                        if (isJailed) {
                            setIsJailed(false)
                            playAudio('happy-beep')
                            setExpression('happy')
                            jailStartTime.current = null
                        } else {
                            setIsJailed(true)
                            playAudio('sad-beep')
                            setExpression('sad')
                            jailStartTime.current = Date.now()
                        }
                    }}
                    className={`p-3 rounded-full transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 backdrop-blur-sm ${isJailed
                        ? 'bg-red-600 text-white border-transparent'
                        : 'bg-black/80 text-white border-transparent hover:bg-black dark:bg-white/80 dark:text-black dark:hover:bg-white'
                        }`}
                    title={isJailed ? "Unlock Bot" : "Lock Bot"}
                >
                    {isJailed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    )}
                </button>

                {/* Fluid Button */}
                <button
                    data-bot-priority="chaos"
                    onClick={() => {
                        // Trigger Scared -> Chaos Sequence
                        setBotState('SCARED')
                        setExpression('scared')
                        setSpeech("What's that sound?!")
                        playAudio('scared-beep')

                        // After 2s -> Chaos
                        setTimeout(() => {
                            if (botStateRef.current === 'SCARED') {
                                setBotState('CHAOS')
                                setExpression('angry')
                                setSpeech("AAHHH! CHAOS!")
                                playAudio('chaos-noise')
                                velocity.current = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 }

                                // After 8s -> Idle
                                setTimeout(() => {
                                    if (botStateRef.current === 'CHAOS') {
                                        setBotState('IDLE')
                                        setExpression('neutral')
                                        setSpeech("Whoa... that was intense!")
                                        setTimeout(() => setSpeech(null), 3000)
                                    }
                                }, 8000)
                            }
                        }, 2000)
                    }}
                    className="p-3 bg-black/80 text-white border-transparent rounded-full shadow-sm hover:bg-black hover:shadow-md transition-all active:scale-95 backdrop-blur-sm dark:bg-white/80 dark:text-black dark:hover:bg-white"
                    title="Unleash Fluid"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                </button>

                {/* Mute Button */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-black/80 text-white border-transparent rounded-full shadow-sm hover:bg-black hover:shadow-md transition-all active:scale-95 backdrop-blur-sm dark:bg-white/80 dark:text-black dark:hover:bg-white"
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.75-4.75a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.75-4.75H4.875a1.125 1.125 0 0 1-1.125-1.125v-4.5c0-.621.504-1.125 1.125-1.125h3.375Z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                    )}
                </button>
            </div >
            <motion.div
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                className="fixed top-0 left-0 z-[9999] cursor-grab active:cursor-grabbing touch-none select-none"
                style={{
                    x,
                    y,
                    pointerEvents: 'auto',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}
                onMouseMove={handlePettingMove}
                onMouseEnter={handleMouseEnter}
            >
                {/* Speech Bubble */}
                {speech && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute bg-white px-4 py-2 rounded-2xl shadow-xl border border-gray-200 whitespace-nowrap z-50"
                        style={{
                            top: bubbleTop,
                            left: bubbleLeft,
                            right: bubbleRight,
                            x: bubbleTranslateX,
                        }}
                    >
                        <span className="text-sm font-bold text-gray-800">{speech}</span>
                        {/* Bubble Tail */}
                        <motion.div
                            className="absolute w-4 h-4 bg-white border-b border-r border-gray-200"
                            style={{
                                left: '50%',
                                x: '-50%',
                                rotate: tailRotation,
                                top: tailTop,
                                bottom: tailBottom
                            }}
                        />
                    </motion.div>
                )}

                {/* Bot Body */}
                <div className="relative w-8 h-8"> {/* Half Size */}

                    {/* Battery Bar (Holographic) - Made Bigger */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                        <motion.div
                            className={`h-full ${battery < 20 ? 'bg-red-500' : 'bg-green-400'} shadow-[0_0_4px_currentColor]`}
                            style={{ width: `${battery}%` }}
                            animate={{
                                opacity: botState === 'CHARGING' ? [0.6, 1, 0.6] : 1,
                                boxShadow: botState === 'CHARGING' ? [
                                    '0 0 4px currentColor',
                                    '0 0 8px currentColor',
                                    '0 0 4px currentColor'
                                ] : '0 0 4px currentColor'
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                        />
                    </div>

                    {/* Antennae - Scaled Down */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-gray-400 origin-bottom rotate-[-10deg]" />
                    <div className="absolute -top-3 left-[60%] w-[1px] h-3 bg-gray-400 origin-bottom" />

                    {/* Main Body (Sphere) - Sliding Texture */}
                    <motion.div
                        className="absolute bottom-0 w-8 h-8 bg-gray-100 rounded-full border border-gray-300 overflow-hidden shadow-xl"
                        style={{
                            background: `
                                radial-gradient(circle at 30% 30%, rgba(255,255,255,1) 0%, rgba(200,200,200,0) 20%),
                                repeating-radial-gradient(circle at 50% 50%, 
                                    #f3f4f6 0, 
                                    #f3f4f6 5px, 
                                    #fb923c 6px, 
                                    #fb923c 8px, 
                                    #9ca3af 9px, 
                                    #9ca3af 10px, 
                                    #f3f4f6 11px, 
                                    #f3f4f6 15px
                                )
                            `,
                            backgroundSize: '200% 200%',
                            backgroundPositionX: bgPosX,
                            backgroundPositionY: bgPosY,
                            boxShadow: 'inset -4px -4px 8px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.8), 0 5px 15px rgba(0,0,0,0.3)'
                        }}
                        animate={{
                            opacity: botState === 'DEAD' ? 0.3 : 1
                        }}
                    />

                    {/* Neck Ring (Connector) - Moves with Head */}
                    <motion.div
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-gray-300 rounded-full border border-gray-400 z-5 shadow-inner"
                        style={{
                            x: smoothHeadX,
                            y: smoothHeadY,
                            rotate: smoothHeadRotate
                        }}
                    />

                    {/* Head Shadow on Body */}
                    <motion.div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full z-5 pointer-events-none"
                        style={{
                            x: smoothHeadX, // Shadow follows head pos
                        }}
                        animate={{
                            scale: botState === 'INVESTIGATING' ? 0.8 : 1
                        }}
                    />

                    {/* Head (Dome) - Scaled Down & Lifted for Neck Gap */}
                    <motion.div
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-5 h-3.5 bg-gray-100 rounded-t-full border border-gray-300 border-b-0 shadow-lg z-10 overflow-visible"
                        style={{
                            background: 'linear-gradient(to bottom, #ffffff 0%, #e5e7eb 100%)',
                            x: smoothHeadX,
                            y: smoothHeadY,
                            rotate: smoothHeadRotate
                        }}
                    >
                        {/* Torch / FOV Cone - Coming from Face, Synced with Eyes */}
                        <motion.div
                            className="absolute left-1/2 top-1/2 origin-left pointer-events-none z-20"
                            style={{
                                width: '80px', // Make cone longer
                                height: '80px',
                                background: 'conic-gradient(from 180deg at 0% 50%, transparent 0deg, rgba(255,215,0,0.5) 30deg, rgba(255,255,255,0.3) 50deg, rgba(255,215,0,0.5) 70deg, transparent 90deg)',
                                filter: 'blur(4px)',
                                mixBlendMode: 'screen',
                                clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)', // Cone shape
                                transform: `rotate(${Math.atan2(eyeOffset.y, eyeOffset.x) * 180 / Math.PI}deg)`,
                                opacity: botState === 'INVESTIGATING' ? 0.9 : (botState === 'DEAD' ? 0 : 0.5)
                            }}
                            animate={{
                                opacity: botState === 'INVESTIGATING' ? [0.7, 1, 0.7] : (botState === 'DEAD' ? 0 : 0.4),
                                scale: botState === 'INVESTIGATING' ? [1, 1.15, 1] : 1
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />{/* Orange Markings on Head */}
                        <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-t-full">
                            <div className="absolute top-0.5 left-0.5 w-1 h-0.5 bg-orange-400 rounded-full opacity-80" />
                            <div className="absolute top-0.5 right-0.5 w-1 h-0.5 bg-orange-400 rounded-full opacity-80" />
                            <div className="absolute bottom-0 w-full h-0.5 bg-gray-300" />
                        </div>

                        {/* Main Eye (Large Lens) - Scaled */}
                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full border border-gray-400 shadow-inner z-20 overflow-hidden">
                            <div className="absolute top-px right-px w-0.5 h-0.5 bg-white rounded-full opacity-40 blur-[0.2px]" />
                            {expression === 'sleeping' ? (
                                // Sleeping Eyes (Dashes)
                                <>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-black rounded-full opacity-80" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-black rounded-full opacity-80" />
                                </>
                            ) : (
                                // Normal Eyes
                                <>
                                    <motion.div
                                        className={`absolute top-0.5 left-0.5 w-1 h-1 ${eyeColor} rounded-full blur-[0.5px] transition-colors duration-500`}
                                        animate={{
                                            x: eyeOffset.x / 3,
                                            y: eyeOffset.y / 3,
                                            opacity: isBlinking ? 0 : 0.8,
                                            scale: botState === 'INVESTIGATING' ? 1.2 : 1,
                                            height: expression === 'happy' ? 6 : 12
                                        }}
                                    />
                                    <motion.div
                                        className={`absolute top-0.5 left-0.5 w-1 h-1 ${eyeColor} rounded-full blur-[0.5px] transition-colors duration-500`}
                                        animate={{
                                            x: eyeOffset.x / 3,
                                            y: eyeOffset.y / 3,
                                            opacity: isBlinking ? 0 : 0.8,
                                            scale: botState === 'INVESTIGATING' ? 1.2 : 1,
                                            height: expression === 'happy' ? 6 : 12
                                        }}
                                    />
                                </>
                            )}
                            {/* Eyelids for Expressions */}
                            <motion.div
                                className="absolute top-0 left-0 w-full bg-gray-100 z-30"
                                animate={{
                                    height: expression === 'squint' ? '40%' :
                                        (expression === 'sad' ? '30%' :
                                            (expression === 'bored' ? '40%' :
                                                (expression === 'amused' ? '0%' :
                                                    (expression === 'angry' ? '30%' :
                                                        (expression === 'scared' ? '0%' : '10%')))))
                                }}
                                style={{ rotate: expression === 'angry' ? 15 : (expression === 'scared' ? -10 : 0) }} // Angry brow tilt
                            />
                            <motion.div
                                className="absolute bottom-0 left-0 w-full bg-gray-100 z-30"
                                animate={{
                                    height: expression === 'squint' ? '40%' :
                                        (expression === 'happy' ? '30%' :
                                            (expression === 'amused' ? '30%' :
                                                (expression === 'bored' ? '0%' :
                                                    (expression === 'angry' ? '20%' :
                                                        (expression === 'scared' ? '0%' : '10%')))))
                                }}
                                style={{ rotate: expression === 'angry' ? -15 : (expression === 'scared' ? 10 : 0) }} // Angry brow tilt
                            />
                        </div>

                        {/* Small Eye - Scaled */}
                        <div className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-black rounded-full border border-gray-600 z-20" />
                        {/* Small Eye - Scaled */}
                        <div className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-black rounded-full border border-gray-600 z-20" />

                        {/* Dizzy Eyes (Spirals) */}
                        {expression === 'dizzy' && (
                            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-40 bg-white rounded-full">
                                <div className="w-4 h-4 border-2 border-black rounded-full border-t-transparent animate-spin" />
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Zzz Animation when Sleeping */}
                {expression === 'sleeping' && (
                    <motion.div
                        initial={{ opacity: 0, y: 0, x: 10 }}
                        animate={{
                            opacity: [0, 1, 0],
                            y: -30,
                            x: 20
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut"
                        }}
                        className="absolute -top-4 right-0 text-blue-300 font-bold text-sm pointer-events-none"
                    >
                        Zzz...
                    </motion.div>
                )}
            </motion.div>
        </>
    )
}
