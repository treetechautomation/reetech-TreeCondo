"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export function SplashScreen() {

  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {

    const t = setTimeout(() => {
      setVisible(false);
    }, 1600);

    return () => clearTimeout(t);

  }, []);

  return (
    <AnimatePresence>

      {visible && (

        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, #F7F2EB 0%, #F7F2EB 100%)"
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >

          {/* glow */}
          <motion.div
            className="absolute w-64 h-64 rounded-full"
            style={{
              background: "#00D0E6",
              filter: "blur(120px)",
              opacity: 0.25,
            }}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1.2 }}
            transition={{
              duration: 1.4,
              ease: "easeOut"
            }}
          />

          {/* logo */}
          <motion.div
            initial={{
              scale: 0.7,
              opacity: 0,
              filter: "blur(10px)"
            }}
            animate={{
              scale: 1,
              opacity: 1,
              filter: "blur(0px)"
            }}
            transition={{
              duration: 0.8,
              ease: "easeOut"
            }}
          >

            <Image
              src="/logotreecondo.jpeg"
              alt="TreeCondo"
              width={140}
              height={140}
              priority
              className="rounded-xl shadow-xl"
            />

          </motion.div>

        </motion.div>

      )}

    </AnimatePresence>
  );
}
