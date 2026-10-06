import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function VehicleSticker({ code, url }: { code: string; url: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  async function download() {
    setError('');
    const svg = container.current?.querySelector('svg');
    if (!svg) return;
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1000; canvas.height = 1220;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image download is unavailable in this browser.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1000, 1220);
      ctx.fillStyle = '#003D2B'; ctx.textAlign = 'center'; ctx.font = 'bold 60px sans-serif';
      ctx.fillText('TalaRide', 500, 95);
      ctx.drawImage(image, 100, 140, 800, 800);
      ctx.fillStyle = '#111111'; ctx.font = 'bold 76px monospace'; ctx.fillText(code, 500, 1040);
      ctx.font = '32px sans-serif'; ctx.fillText('Scan QR or enter this vehicle code', 500, 1110);
      ctx.font = '26px sans-serif'; ctx.fillText('Check driver and fare details before paying', 500, 1165);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create image.')), 'image/png'));
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = downloadUrl; link.download = `TalaRide-${code}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Download failed.'); }
    finally { URL.revokeObjectURL(source); }
  }
  if (!/^TR-\d{5}$/.test(code) || !url) return <p>Assign a registered vehicle to display its QR code.</p>;
  return <div className="space-y-4 text-center">
    <div ref={container} className="rounded-2xl bg-white p-5 text-slate-900">
      <QRCodeSVG value={url} size={240} marginSize={4} level="M" className="mx-auto max-w-full h-auto" />
      <div className="mt-3 font-mono text-3xl font-black">{code}</div>
      <p className="mt-2 text-xs">Scan QR or enter this vehicle code</p>
    </div>
    <button onClick={() => void download()} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Download QR image</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
