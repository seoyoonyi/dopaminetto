"use client";

interface LinkifiedTextProps {
  text: string;
}

export function LinkifiedText({ text }: LinkifiedTextProps) {
  const urlRegex =
    /(https?:\/\/[^\s]+?)(?=[.,;:!?)\]]*(?:\s|$))|((www\.[^\s]+?)(?=[.,;:!?)\]]*(?:\s|$)))/g;
  const parts = text.split(urlRegex).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        const isUrl = /^(https?:\/\/|www\.)/i.test(part);

        if (isUrl) {
          const href = part.startsWith("www.") ? `https://${part}` : part;

          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline break-all hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={`새 탭에서 ${part} 열기`}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
