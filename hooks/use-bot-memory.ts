'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function useBotMemory() {
    const pathname = usePathname()
    const [battery, setBattery] = useState(100)
    const [visitHistory, setVisitHistory] = useState<Record<string, number>>({})
    const [isDead, setIsDead] = useState(false)
    const [totalStolen, setTotalStolen] = useState(0)
    const [lastSeen, setLastSeen] = useState<number>(Date.now())
    const [personality, setPersonality] = useState({ naughtiness: 0.5, curiosity: 0.5 })

    // Load state from local storage on mount
    useEffect(() => {
        const savedBattery = localStorage.getItem('bot_battery')
        const savedHistory = localStorage.getItem('bot_visit_history')
        const savedStolen = localStorage.getItem('bot_total_stolen')
        const savedLastSeen = localStorage.getItem('bot_last_seen')
        const savedPersonality = localStorage.getItem('bot_personality')

        if (savedBattery) {
            const bat = parseInt(savedBattery)
            if (!isNaN(bat)) {
                setBattery(bat)
                if (bat <= 0) setIsDead(true)
            }
        }

        if (savedHistory) setVisitHistory(JSON.parse(savedHistory))
        if (savedStolen) setTotalStolen(parseInt(savedStolen))
        if (savedLastSeen) setLastSeen(parseInt(savedLastSeen))
        if (savedPersonality) setPersonality(JSON.parse(savedPersonality))

        // Update Last Seen
        localStorage.setItem('bot_last_seen', Date.now().toString())
    }, [])

    // Track visits
    useEffect(() => {
        if (!pathname) return

        setVisitHistory(prev => {
            const newHistory = { ...prev, [pathname]: (prev[pathname] || 0) + 1 }
            localStorage.setItem('bot_visit_history', JSON.stringify(newHistory))
            return newHistory
        })
    }, [pathname])

    // Update battery
    const updateBattery = (newLevel: number) => {
        const clamped = Math.max(0, Math.min(100, newLevel))
        setBattery(clamped)
        localStorage.setItem('bot_battery', clamped.toString())
        if (clamped <= 0) setIsDead(true)
        else setIsDead(false)
    }

    // Update Stolen Count
    const incrementStolen = () => {
        setTotalStolen(prev => {
            const newVal = prev + 1
            localStorage.setItem('bot_total_stolen', newVal.toString())
            return newVal
        })
    }

    return {
        battery,
        updateBattery,
        visitHistory,
        isDead,
        currentVisits: visitHistory[pathname] || 0,
        totalStolen,
        incrementStolen,
        lastSeen,
        personality
    }
}
