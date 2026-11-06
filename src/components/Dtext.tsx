import { useEffect, useState } from "react";
import DecryptedText from "./DecryptedText";

export default function Dtext() {
  const [showSecondLine, setShowSecondLine] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowSecondLine(true);
    }, 800);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col min-h-16 font-orbitron font-bold text-2xl text-accent/80">
      <DecryptedText
        text="Welcome to"
        speed={40}
        maxIterations={18}
        characters="ABCD1234!?XMPLSZQK"
        className="font-normal"
        encryptedClassName="font-orbitron font-normal text-2xl text-accent/25 opacity-70 animate-jitter"
        animateOn="view"
      />
      {showSecondLine && (
        <DecryptedText
          text="VLM Dimensions"
          speed={40}
          maxIterations={18}
          characters="ABCD1234!?XMPLSZQK"
          encryptedClassName="font-orbitron font-bold text-2xl text-accent/25 opacity-70 animate-jitter"
          animateOn="view"
        />
      )}
    </div>
  );
}
