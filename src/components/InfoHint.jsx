export default function InfoHint({ text }) {
  return (
    <span
      className="info-hint"
      title={text}
      aria-label={text}
      tabIndex={0}
      role="img"
    >
      i
    </span>
  )
}
