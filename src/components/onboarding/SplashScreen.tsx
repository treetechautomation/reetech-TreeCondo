"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const KEY = "tc_splash_seen_v2";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(KEY);
    if (!seen) {
      setVisible(true);
      localStorage.setItem(KEY, "1");

      setTimeout(() => {
        setVisible(false);
      }, 1600);
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #F7F2EB 0%, #EEF7F8 50%, #F7F2EB 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* glow */}
          <motion.div
            className="absolute w-72 h-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(0,208,230,0.25), transparent)",
              filter: "blur(40px)",
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.4, opacity: 1 }}
            transition={{ duration: 1 }}
          />

          {/* partículas */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: i % 2 ? "#00D0E6" : "#B9CF0E",
                left: `${40 + i * 5}%`,
                bottom: "40%",
              }}
              initial={{ opacity: 0, y: 40 }}
              animate={{
                opacity: [0, 1, 0],
                y: -60,
              }}
              transition={{
                duration: 1.4,
                delay: i * 0.1,
              }}
            />
          ))}

          {/* logo */}
          <motion.img
            src="/logotreecondo.jpeg"
            alt="TreeCondo"
            className="relative z-10 w-24 h-24 rounded-2xl shadow-xl"
            initial={{
              scale: 0.6,
              opacity: 0,
              filter: "blur(10px)",
            }}
            animate={{
              scale: [0.6, 1.1, 1],
              opacity: 1,
              filter: "blur(0px)",
            }}
            transition={{
              duration: 1,
              ease: "easeOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
