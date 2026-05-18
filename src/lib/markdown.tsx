import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={[
          'p',
          'strong',
          'em',
          'code',
          'pre',
          'ul',
          'ol',
          'li',
          'blockquote',
          'a',
          'h1',
          'h2',
          'h3',
          'br',
        ]}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
