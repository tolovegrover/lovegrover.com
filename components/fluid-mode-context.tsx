'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type FluidModeContextType = {
    isFluidMode: boolean
    toggleFluidMode: () => void
    showDialog: boolean
    fluidOpacity: number
    simulationSpeed: number
}

const FluidModeContext = createContext<FluidModeContextType | undefined>(undefined)

export function FluidModeProvider({ children }: { children: ReactNode }) {
    const [isFluidMode, setIsFluidMode] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [fluidOpacity, setFluidOpacity] = useState(0)
    const [simulationSpeed, setSimulationSpeed] = useState(1)

    const toggleFluidMode = () => {
        if (!isFluidMode) {
            // Activating
            setIsFluidMode(true)
            setShowDialog(true)
            setFluidOpacity(0)
            setSimulationSpeed(3) // Turbo speed

            // Force light theme immediately
            if (typeof document !== 'undefined') {
                document.documentElement.classList.add('force-light')
            }

            // Sequence
            setTimeout(() => {
                setShowDialog(false)
                setFluidOpacity(1) // Fade in
                setSimulationSpeed(1) // Normal speed
            }, 3000)
        } else {
            // Deactivating
            setIsFluidMode(false)
            setShowDialog(false)
            setFluidOpacity(0)

            // Remove light theme force
            if (typeof document !== 'undefined') {
                document.documentElement.classList.remove('force-light')
            }
        }
    }

    // Toggle body class for global styling (Fluid Mode active state)
    useEffect(() => {
        if (isFluidMode) {
            document.body.classList.add('fluid-mode-active')
        } else {
            document.body.classList.remove('fluid-mode-active')
        }
    }, [isFluidMode])

    return (
        <FluidModeContext.Provider value={{
            isFluidMode,
            toggleFluidMode,
            showDialog,
            fluidOpacity,
            simulationSpeed
        }}>
            {children}
        </FluidModeContext.Provider>
    )
}

export function useFluidMode() {
    const context = useContext(FluidModeContext)
    if (context === undefined) {
        throw new Error('useFluidMode must be used within a FluidModeProvider')
    }
    return context
}
