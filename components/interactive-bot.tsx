'use client'

import { useFluidMode } from './fluid-mode-context'
import { useState, useEffect, useRef } from 'react'
import { motion, useAnimation, PanInfo, useMotionValue, useTransform } from 'framer-motion'

export default function InteractiveBot() {
    const { isFluidMode, toggleFluidMode, showDialog } = useFluidMode()
    const [emotion, setEmotion] = useState<'idle' | 'bored' | 'scared' | 'active'>('idle')
    const [isHovered, setIsHovered] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [isBlinking, setIsBlinking] = useState(false)

    const controls = useAnimation()
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
    const constraintsRef = useRef(null)
    const botRef = useRef<HTMLDivElement>(null)

    // Motion values for rolling
    const x = useMotionValue(0)
    const rotate = useTransform(x, (currentX) => currentX * 2.5) // Rotate based on X movement

    // Track Mouse for Eyes
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY })
        }
        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    // Blinking Logic
    useEffect(() => {
        const blinkLoop = () => {
            setIsBlinking(true)
            setTimeout(() => setIsBlinking(false), 150)

            // Random blink interval between 2s and 6s
            const nextBlink = Math.random() * 4000 + 2000
            setTimeout(blinkLoop, nextBlink)
        }
        const timeoutId = setTimeout(blinkLoop, 2000)
        return () => clearTimeout(timeoutId)
    }, [])

    // Reset idle timer on interaction
    const resetIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        if (emotion !== 'active' && !isDragging) {
            setEmotion('idle')
            idleTimerRef.current = setTimeout(() => {
                if (!isDragging && !isFluidMode) setEmotion('bored')
            }, 5000) // 5 seconds to boredom
        }
    }

    useEffect(() => {
        resetIdleTimer()
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        }
    }, [isDragging, isFluidMode])

    // Handle Drag
    const handleDragStart = () => {
        setIsDragging(true)
        setEmotion('scared')
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsDragging(false)
        resetIdleTimer()
    }

    // Calculate Eye Movement
    const getEyeOffset = () => {
        if (!botRef.current) return { x: 0, y: 0 }
        const rect = botRef.current.getBoundingClientRect()
        const botX = rect.left + rect.width / 2
        const botY = rect.top + rect.height / 2

        const dx = mousePos.x - botX
        const dy = mousePos.y - botY
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Max eye movement radius
        const maxOffset = 6 // Larger range for the big lens
        const moveX = distance > 0 ? (dx / distance) * Math.min(distance / 15, maxOffset) : 0
        const moveY = distance > 0 ? (dy / distance) * Math.min(distance / 15, maxOffset) : 0

        return { x: moveX, y: moveY }
    }

    const eyeOffset = getEyeOffset()

    // Determine Bubble Text
    let bubbleText = ""
    if (showDialog) bubbleText = "uh oh..."
    else if (isFluidMode) bubbleText = "please deactivate me!"
    else if (isDragging) bubbleText = "wheeeee!"
    else if (emotion === 'bored') bubbleText = "beep boop..."
    else if (isHovered) bubbleText = "beep?"

    const showBubble = showDialog || isHovered || isDragging || emotion === 'bored'

    return (
        <div className="relative flex items-center justify-center w-12 h-12">
            {/* Container to hold space in navbar */}
            {/* Invisible constraint boundary covering the viewport */}
            <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-0" />

            <motion.div
                ref={botRef}
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.2}
                whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onMouseEnter={() => {
                    setIsHovered(true)
                    resetIdleTimer()
                }}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    if (!isDragging) toggleFluidMode()
                }}
                className="relative z-50 cursor-grab touch-none"
                style={{ x }} // Bind x motion value
                animate={controls}
            >
                {/* Speech Bubble */}
                <div
                    className={`absolute right-full mr-5 top-0 transition-all duration-300 ease-in-out origin-right pointer-events-none z-50
            ${showBubble ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
          `}
                >
                    <div className="relative bg-white text-black px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap font-medium text-sm border border-gray-200">
                        {bubbleText}
                        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-t border-r border-gray-200 rotate-45 transform"></div>
                    </div>
                </div>

                {/* BB-8 Head (Floating) */}
                <motion.div
                    className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-5 bg-white rounded-t-full border-2 border-b-0 border-gray-300 z-20 overflow-hidden shadow-sm"
                    animate={{
                        y: isDragging ? [0, -2, 0] : [0, -1, 0],
                        rotate: isDragging ? (x.get() * 0.1) : 0 // Slight tilt when dragging
                    }}
                    transition={{
                        y: { repeat: Infinity, duration: isDragging ? 0.2 : 2, ease: "easeInOut" }
                    }}
                >
                    {/* Orange Head Stripes */}
                    <div className="absolute top-1 w-full h-1 bg-orange-400 opacity-80"></div>

                    {/* Main Lens (Eye) */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-gray-800 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        {/* Inner Lens Reflection */}
                        <motion.div
                            className="w-1.5 h-1.5 bg-black rounded-full relative"
                            animate={{ x: eyeOffset.x / 2, y: eyeOffset.y / 2 }} // Parallax effect
                        >
                            <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
                        </motion.div>
                    </div>

                    {/* Small Lens */}
                    <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-gray-700 rounded-full border border-gray-400"></div>

                    {/* Antenna */}
                    <div className="absolute -top-3 right-2 w-0.5 h-3 bg-gray-400"></div>
                </motion.div>

                {/* BB-8 Body (Rolling) */}
                <motion.div
                    className={`w-10 h-10 rounded-full bg-white border-2 border-gray-300 relative shadow-md overflow-hidden
            ${isFluidMode ? 'shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-400' : ''}
          `}
                    style={{ rotate }} // Rotate body based on movement
                >
                    {/* Orange Circle Patterns */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-orange-400 opacity-90 flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>

                    {/* Side Details (to show rotation) */}
                    <div className="absolute top-1 left-1 w-2 h-2 bg-gray-300 rounded-full"></div>
                    <div className="absolute bottom-2 right-2 w-3 h-1 bg-orange-400 rounded-full"></div>
                    <div className="absolute top-1/2 right-0 w-2 h-4 bg-gray-200 rounded-l-full"></div>
                </motion.div>
            </motion.div>
        </div>
    )
}
