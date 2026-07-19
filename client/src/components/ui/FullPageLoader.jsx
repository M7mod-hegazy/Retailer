import React from "react";
import { motion } from "framer-motion";
import LoadingSpinner from "./LoadingSpinner";

export default function FullPageLoader({ text = "جاري تهيئة النظام..." }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-surface/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center"
      >
        <LoadingSpinner text={text} />
      </motion.div>
    </motion.div>
  );
}
