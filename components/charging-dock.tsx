
import { motion } from 'framer-motion'

export default function ChargingDock() {
    return (
        <div id="charging-dock" className="fixed bottom-32 right-32 w-20 h-20 z-0">
            {/* Base Plate - Sleek Glassmorphism (Half Size) */}
            <div className="relative w-14 h-14">
                {/* Floor Mat */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl transform rotate-45 border border-white/20 shadow-xl">
                    {/* Glowing Ring */}
                    <div className="absolute inset-1.5 border border-blue-400/30 rounded-lg blur-[1px]" />
                    {/* Center Pad */}
                    <div className="absolute inset-4 bg-gradient-to-br from-gray-800 to-black rounded-full border border-gray-700 flex items-center justify-center shadow-inner">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
                    </div>
                </div>

                {/* Backstop - Metallic Finish */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-4 bg-gradient-to-b from-gray-700 to-gray-900 rounded-t-md border border-gray-600 border-b-0 z-10 shadow-md">
                    <div className="w-full h-px bg-blue-400/50 mt-1 shadow-[0_0_3px_#60a5fa]" />
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gray-800 rounded-full" />
                </div>
            </div>
        </div>
    )
}
