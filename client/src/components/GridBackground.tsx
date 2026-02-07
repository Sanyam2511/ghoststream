export default function GridBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-[#050505]">
      <div 
        className="absolute inset-0 h-full w-full bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:24px_24px] opacity-25" 
      />
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_center,transparent_0%,#050505_100%)]" />
    </div>
  );
}