import logoSrc from "@/assets/eurosom-logo-mark.png";

export function Logo({ className = "h-10" }: { className?: string }) {
  return <img src={logoSrc} alt="Produções Eurosom" className={`${className} w-auto object-contain`} />;
}
