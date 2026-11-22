import { Fragment } from 'react'

function InlineText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[KB:\d+\])/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (/^\[KB:\d+\]$/.test(part)) return <span className="kb-reference" key={index}>{part.slice(1, -1)}</span>
    return <Fragment key={index}>{part}</Fragment>
  })
}

const cells = (line) => line.replace(/^\s*\||\|\s*$/g, '').split('|').map((cell) => cell.trim())
const isDivider = (line) => /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
const isList = (line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line)

export default function MarkdownMessage({ content }) {
  const lines = String(content || '').replace(/\r/g, '').split('\n')
  const blocks = []
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    if (line.trim().startsWith('|') && isDivider(lines[index + 1] || '')) {
      const header = cells(line); const rows = []; index += 2
      while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(cells(lines[index])); index += 1 }
      blocks.push(<div className="chat-table-wrap" key={`table-${index}`}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}><InlineText text={cell} /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} /></td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (isList(line)) {
      const ordered = /^\s*\d+\./.test(line); const items = []
      while (index < lines.length && isList(lines[index]) && /^\s*\d+\./.test(lines[index]) === ordered) {
        items.push(lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')); index += 1
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</List>)
      continue
    }
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push(<h4 key={`heading-${index}`}><InlineText text={line.replace(/^#{1,3}\s+/, '')} /></h4>); index += 1; continue
    }
    const paragraph = []
    while (index < lines.length && lines[index].trim() && !isList(lines[index]) && !/^#{1,3}\s+/.test(lines[index]) && !(lines[index].trim().startsWith('|') && isDivider(lines[index + 1] || ''))) {
      paragraph.push(lines[index].trim()); index += 1
    }
    blocks.push(<p key={`paragraph-${index}`}><InlineText text={paragraph.join(' ')} /></p>)
  }
  return <div className="markdown-message">{blocks}</div>
}
