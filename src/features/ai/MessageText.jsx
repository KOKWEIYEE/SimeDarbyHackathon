// Render emphasis as React nodes, never as raw HTML.
export default function MessageText({text}) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part,index)=>
    part.startsWith('**')&&part.endsWith('**')
      ? <strong key={index}>{part.slice(2,-2)}</strong> : part);
}
