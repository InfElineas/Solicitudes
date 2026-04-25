import React from 'react';
import { FileText, Download } from 'lucide-react';

function isImage(url) { return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url || ''); }
function fileName(url) { return decodeURIComponent(url.split('/').pop().split('?')[0]) || 'archivo'; }

/**
 * Displays a list of attached file URLs.
 * Shows image thumbnails and file chips for docs.
 */
export default function AttachmentsViewer({ urls = [] }) {
  if (!urls.length) return (
    <p className="text-sm text-gray-500">Sin archivos adjuntos.</p>
  );

  const images = urls.filter(isImage);
  const docs = urls.filter(u => !isImage(u));

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative">
              <img
                src={url}
                alt={`adjunto-${i}`}
                className="rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                style={{ maxHeight: 140, maxWidth: 200 }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/60 rounded-full p-1.5">
                  <Download className="w-4 h-4 text-white" />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity"
              style={{ background: 'hsl(222,47%,20%)', border: '1px solid hsl(217,33%,28%)', color: '#60a5fa' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[160px]">{fileName(url)}</span>
              <Download className="w-3 h-3 shrink-0 ml-1 opacity-60" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}