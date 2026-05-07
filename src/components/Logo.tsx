import logoSrc from "@/assets/eurosom-logo.jpg";

export function Logo({ className = "h-10" }: { className?: string }) {
  return <img src={logoSrc} alt="Produções Eurosom" className={className} />;
}
