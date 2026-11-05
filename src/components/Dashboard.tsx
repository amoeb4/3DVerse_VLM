import { useState } from "react";

export function DisplayDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!isExpanded) {
    return (
      <button
        className="fixed top-[3%] left-[3%] z-50 bg-white/10 text-white border border-white/20 backdrop-blur px-3 py-2 rounded-full shadow hover:bg-white/20 transition"
        onClick={() => setIsExpanded(true)}
      >
        Dashboard
      </button>
    );
  }

  return (
    <div className="fixed top-3 left-5 z-50 p-6 rounded-xl backdrop-blur bg-white/10 border border-white/20 shadow-xl text-white space-y-6 w-[90vw] max-w-[600px]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          className="text-sm bg-white/10 border border-white/30 rounded-md px-2 py-1 hover:bg-white/20 transition"
          onClick={() => setIsExpanded(false)}
        >
          Minimize
        </button>
      </div>
      <div className="flex flex-wrap gap-4 items-center justify-between mt-4"></div>
    </div>
  );
}
