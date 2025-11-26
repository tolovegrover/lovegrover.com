'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useAnimationFrame, PanInfo, useSpring } from 'framer-motion'
import ChargingDock from './charging-dock'

type BotState = 'IDLE' | 'ROAMING' | 'INVESTIGATING' | 'SEEKING_DOCK' | 'CHARGING' | 'DRAGGING' | 'DEAD' | 'READING' | 'WAITING_FOR_EXPAND' | 'DIZZY'

export default function InteractiveBot() {
    const [isMounted, setIsMounted] = useState(false)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [botState, setBotState] = useState<BotState>('IDLE')
    const [battery, setBattery] = useState(50)
    const [speech, setSpeech] = useState<string | null>(null)
    const [scanProgress, setScanProgress] = useState(0)
    const [isBlinking, setIsBlinking] = useState(false)
    const [expression, setExpression] = useState<'neutral' | 'happy' | 'sad' | 'squint' | 'bored' | 'amused' | 'sleeping' | 'dizzy'>('neutral')

    // Refs for Game Loop (to avoid stale closures without re-running effects)
    const botStateRef = useRef<BotState>('IDLE')
    const batteryRef = useRef(50)

    // Sync refs with state
    useEffect(() => { botStateRef.current = botState }, [botState])
    useEffect(() => { batteryRef.current = battery }, [battery])

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
        'story': ["A story!", "Reading time.", "Chapter one...", "Once upon a time.", "Narrative found."]
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
                    const marginBottom = 80
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
                        // Weighted Selection: Tiered Priority
                        // Tier 1: Super Priority (Papers, Purushartha) - 50% chance
                        // Tier 2: Priority (Nav, About, CV, Stories) - 30% chance
                        // Tier 3: Regular - 20% chance

                        const superPriorityLinks = links.filter(l => {
                            const p = l.getAttribute('data-bot-priority')
                            return p === 'paper' || p === 'purushartha'
                        })
                        const priorityLinks = links.filter(l => {
                            const p = l.getAttribute('data-bot-priority')
                            return p && p !== 'paper' && p !== 'purushartha'
                        })
                        const regularLinks = links.filter(l => !l.getAttribute('data-bot-priority'))

                        let pool = links
                        const rand = Math.random()

                        if (superPriorityLinks.length > 0 && rand < 0.5) {
                            pool = superPriorityLinks
                        } else if (priorityLinks.length > 0 && rand < 0.8) {
                            pool = priorityLinks
                        } else if (regularLinks.length > 0) {
                            pool = regularLinks
                        } else if (superPriorityLinks.length > 0) {
                            pool = superPriorityLinks // Fallback to super priority if regular is empty
                        } else if (priorityLinks.length > 0) {
                            pool = priorityLinks // Fallback
                        }

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
                        const marginBottom = 80
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

                                    if (wordIndex >= wordRanges.length) {
                                        setSpeech("I read it! Closing it now.")
                                        setTimeout(() => {
                                            element.click()
                                            setBotState('IDLE')
                                            setSpeech("Done.")
                                        }, 2000)
                                        return
                                    }

                                    const range = wordRanges[wordIndex]

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
                                targetElement.click()

                                // Poll for expansion
                                const checkExpand = setInterval(() => {
                                    if (targetElement.getAttribute('data-expanded') === 'true') {
                                        clearInterval(checkExpand)
                                        setSpeech("Opened it!")
                                        setTimeout(() => startReading(targetElement), 500)
                                    }
                                }, 100)

                                // Timeout fallback
                                setTimeout(() => {
                                    clearInterval(checkExpand)
                                    if (botStateRef.current === 'WAITING_FOR_EXPAND') {
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
            }

            if (currentState === 'SEEKING_DOCK') {
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

            if (currentState !== 'CHARGING' && currentState !== 'DRAGGING') {
                if (currentX < repulsionMargin) velocity.current.x += repulsionForce
                if (currentX > window.innerWidth - repulsionMargin) velocity.current.x -= repulsionForce
                if (currentY < repulsionMargin) velocity.current.y += repulsionForce
                if (currentY > window.innerHeight - repulsionMargin - 80) velocity.current.y -= repulsionForce // Extra for bottom dock area
            }

            if ((currentState === 'ROAMING' || currentState === 'INVESTIGATING' || currentState === 'SEEKING_DOCK' || currentState === 'READING') && targetPos.current) {
                const dx = targetPos.current.x - currentX
                const dy = targetPos.current.y - currentY
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist > 10) {
                    const speed = currentState === 'SEEKING_DOCK' ? 0.15 : (currentState === 'INVESTIGATING' ? 0.12 : (currentState === 'READING' ? 0.2 : 0.05))
                    velocity.current.x += (dx / dist) * speed
                    velocity.current.y += (dy / dist) * speed
                }
            } else if (currentState === 'WAITING_FOR_EXPAND' || currentState === 'DIZZY') {
                // Just hover in place or look at the target
                velocity.current.x *= 0.8
                velocity.current.y *= 0.8
            }

            // Apply Velocity
            if (currentState !== 'CHARGING' && currentState !== 'DRAGGING') {
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
                const marginBottom = 80 // Keep well above bottom edge

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
            }
        }

        lastActionTime.current = Date.now() // Reset timer so he doesn't immediately run away
    }

    if (!isMounted) return null

    // Eye Color based on state
    const eyeColor = botState === 'CHARGING' ? 'bg-green-500' : (battery < 20 ? 'bg-red-500' : 'bg-black')
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
            <ChargingDock />
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
                                                (expression === 'amused' ? '0%' : '10%')))
                                }}
                            />
                            <motion.div
                                className="absolute bottom-0 left-0 w-full bg-gray-100 z-30"
                                animate={{
                                    height: expression === 'squint' ? '40%' :
                                        (expression === 'happy' ? '30%' :
                                            (expression === 'amused' ? '30%' :
                                                (expression === 'bored' ? '0%' : '10%')))
                                }}
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
