import { useEffect, useState } from "react";
import DecryptedText from "./DecryptedText";
import "../src/index.css";

export default function Dtext() {
  const [showSecondLine, setShowSecondLine] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowSecondLine(true);
    }, 800);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <DecryptedText
        text="Welcome to"
        speed={40}
        maxIterations={18}
        characters="ABCD1234!?XMPLSZQK"
        className="font-orbitron font-bold text-2xl text-gray-700"
        encryptedClassName="font-orbitron font-bold text-2xl text-gray-400 opacity-70 animate-jitter"
        animateOn="view"
      />
      {showSecondLine && (
        <DecryptedText
          text="VLM Dimensions"
          speed={40}
          maxIterations={18}
          characters="ABCD1234!?XMPLSZQK"
          className="font-orbitron font-bold text-2xl text-gray-700"
          encryptedClassName="font-orbitron font-bold text-2xl text-gray-400 opacity-70 animate-jitter"
          animateOn="view"
        />
      )}
    </div>
  );
}
