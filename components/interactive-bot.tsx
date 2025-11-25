'use client'

import { useFluidMode } from './fluid-mode-context'
import { useState, useEffect, useRef } from 'react'
import { motion, useAnimation, PanInfo } from 'framer-motion'

export default function InteractiveBot() {
    const { isFluidMode, toggleFluidMode, showDialog } = useFluidMode()
    const [emotion, setEmotion] = useState<'idle' | 'bored' | 'scared' | 'active'>('idle')
    const [isHovered, setIsHovered] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const controls = useAnimation()
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
    const constraintsRef = useRef(null)

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
        // Snap back if not fluid mode? Or stay? Let's let it stay for fun, or snap back to navbar.
        // For now, let's let it be free but maybe snap to a grid or just stay.
        // Actually, to keep it accessible, let's snap it back to its original spot in the navbar layout
        // by using layoutId or just letting framer motion handle the spring back if we don't update position state.
        // If we want it to snap back, we just don't update any layout state.
    }

    // Determine Bubble Text
    let bubbleText = ""
    if (showDialog) bubbleText = "uh oh..."
    else if (isFluidMode) bubbleText = "please deactivate me!"
    else if (isDragging) bubbleText = "wheeeee!"
    else if (emotion === 'bored') bubbleText = "i'm bored..."
    else if (isHovered) bubbleText = "don't touch me!"

    const showBubble = showDialog || isHovered || isDragging || emotion === 'bored'

    return (
        <div className="relative flex items-center justify-center w-10 h-10">
            {/* Container to hold space in navbar */}
            {/* Invisible constraint boundary covering the viewport */}
            <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-0" />

            <motion.div
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.2}
                whileDrag={{ scale: 1.2, cursor: 'grabbing' }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onMouseEnter={() => {
                    setIsHovered(true)
                    resetIdleTimer()
                }}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    // Only toggle if not dragging (simple check)
                    if (!isDragging) toggleFluidMode()
                }}
                className="relative z-50 cursor-grab touch-none"
                animate={controls}
            >
                {/* Speech Bubble */}
                <div
                    className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out origin-right pointer-events-none
            ${showBubble ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
          `}
                >
                    <div className="relative bg-white text-black px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap font-medium text-sm border border-gray-200">
                        {bubbleText}
                        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-t border-r border-gray-200 rotate-45 transform"></div>
                    </div>
                </div>

                {/* The Bot Body */}
                <div
                    className={`w-6 h-6 rounded-full transition-colors duration-300 flex items-center justify-center relative shadow-md
            ${isFluidMode
                            ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]'
                            : 'bg-rurikon-400 hover:bg-red-400'
                        }
          `}
                >
                    {/* Eyes */}
                    <div className="flex gap-1">
                        <motion.div
                            className="w-1 h-1 bg-white rounded-full"
                            animate={{
                                scaleY: emotion === 'bored' ? [1, 0.1, 1] : 1,
                                height: emotion === 'scared' ? 6 : 4
                            }}
                            transition={{
                                duration: emotion === 'bored' ? 2 : 0.2,
                                repeat: emotion === 'bored' ? Infinity : 0,
                                repeatDelay: 3
                            }}
                        />
                        <motion.div
                            className="w-1 h-1 bg-white rounded-full"
                            animate={{
                                scaleY: emotion === 'bored' ? [1, 0.1, 1] : 1,
                                height: emotion === 'scared' ? 6 : 4
                            }}
                            transition={{
                                duration: emotion === 'bored' ? 2 : 0.2,
                                repeat: emotion === 'bored' ? Infinity : 0,
                                repeatDelay: 3
                            }}
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
