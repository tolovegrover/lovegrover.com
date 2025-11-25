'use client'

import { useFluidMode } from './fluid-mode-context'
import dynamic from 'next/dynamic'

// Dynamically import to avoid SSR issues with WebGL/Canvas
const FluidSimulation = dynamic(() => import('./fluid-simulation'), { ssr: false })

export default function FluidBackground() {
    const { isFluidMode, fluidOpacity, simulationSpeed } = useFluidMode()

    if (!isFluidMode) return null

    return (
        <>
            <div style={{ opacity: fluidOpacity, transition: 'opacity 1s ease-in-out' }}>
                <FluidSimulation speed={simulationSpeed} />
            </div>
        </>
    )
}
