import './BlinkStar.css';
export function BlinkStar() {
  return <svg className="blink-star" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5C36 23 41 28 59 32C41 36 36 41 32 59C28 41 23 36 5 32C23 28 28 23 32 5Z" fill="currentColor"/><g className="star-eyes" fill="var(--surface,#fffdf6)"><ellipse cx="27" cy="32" rx="1.7" ry="3.3"/><ellipse cx="37" cy="32" rx="1.7" ry="3.3"/></g></svg>;
}
