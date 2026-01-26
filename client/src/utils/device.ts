export const getDeviceName = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac") && !ua.includes("Mobile")) os = "MacOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  return `${os} • ${browser}`;
};