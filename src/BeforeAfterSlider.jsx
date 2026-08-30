import { useId, useState } from 'react'

export function BeforeAfterSlider({ before, after, heading = 'Before and after' }) {
  const [position, setPosition] = useState(50)
  const labelId = useId()

  if (!before?.url || !after?.url) return null

  return (
    <figure className="before-after" style={{ '--before-after-position': `${position}%` }}>
      <div className="before-after-frame">
        <img className="before-after-image is-after" src={after.url} alt={after.alt || ''} loading="lazy" />
        <img className="before-after-image is-before" src={before.url} alt={before.alt || ''} loading="lazy" />
        <div className="before-after-divider" aria-hidden="true"><span>↔</span></div>
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-labelledby={labelId}
          aria-valuetext={`${position}% before image visible`}
        />
        <span className="before-after-label is-before" aria-hidden="true">Before</span>
        <span className="before-after-label is-after" aria-hidden="true">After</span>
      </div>
      <figcaption id={labelId}>{heading}</figcaption>
    </figure>
  )
}
