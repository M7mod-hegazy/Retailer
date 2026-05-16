import React from "react";
import { motion } from "framer-motion";

export default function LoadingSpinner({ text = "" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* Ultra-minimal dual spinning rings */}
      <div className="relative flex items-center justify-center w-12 h-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-zinc-950 border-r-zinc-950 opacity-80"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="absolute inset-1 rounded-full border-[1.5px] border-transparent border-b-zinc-400 border-l-zinc-400 opacity-60"
        />
        <motion.div
          animate={{ scale: [0.8, 1, 0.8], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-2 h-2 bg-zinc-950 rounded-full"
        />
      </div>
      
      {text && (
        <motion.p 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-zinc-500"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}
