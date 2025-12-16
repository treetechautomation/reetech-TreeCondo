import Image from "next/image";

export function BrandLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/brand/logo.png"
        alt="TreeCondo"
        width={size}
        height={size}
        priority
      />
      <span className="font-headline text-lg font-bold text-primary">
        TreeCondo
      </span>
    </div>
  );
}
