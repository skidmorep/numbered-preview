import { useId, useRef, useState } from 'react'

export function BeforeAfterSlider({ before, after, heading = 'Before and after' }) {
  const [position, setPosition] = useState(50)
  const labelId = useId()
  const frameRef = useRef(null)
  const gesture = useRef(null)

  if (!before?.url || !after?.url) return null

  const updateFromPointer = (event) => {
    const frame = frameRef.current
    if (!frame) return
    const bounds = frame.getBoundingClientRect()
    const next = ((event.clientX - bounds.left) / bounds.width) * 100
    setPosition(Math.min(100, Math.max(0, Math.round(next))))
  }

  const startDrag = (event) => {
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: event.pointerType === 'touch' ? 'pending' : 'dragging',
    }
    if (gesture.current.mode === 'dragging') {
      event.currentTarget.setPointerCapture?.(event.pointerId)
      updateFromPointer(event)
    }
  }

  const moveDrag = (event) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId || current.mode === 'vertical') return
    if (current.mode === 'pending') {
      const deltaX = Math.abs(event.clientX - current.startX)
      const deltaY = Math.abs(event.clientY - current.startY)
      if (deltaY > 6 && deltaY > deltaX) {
        current.mode = 'vertical'
        return
      }
      if (deltaX < 8 || deltaX <= deltaY) return
      current.mode = 'dragging'
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    updateFromPointer(event)
  }

  const endDrag = (event) => {
    gesture.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <figure className="before-after" style={{ '--before-after-position': `${position}%` }}>
      <div
        className="before-after-frame"
        ref={frameRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
