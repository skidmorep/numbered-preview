import { useEffect, useState } from 'react'
import './site.css'
import './chair.css'
import { defaultContent, mergeContent } from './siteContent'
import { PublicSite } from './TheChairSite'
import { Editor } from './Editor'

function App() {
  const isEditor = window.location.pathname.startsWith('/admin')
  const [content, setContent] = useState(defaultContent)
  const [contentStatus, setContentStatus] = useState('loading')

  useEffect(() => {
    if (isEditor) return undefined

    const controller = new AbortController()

    fetch('/api/content', {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 401) {
          window.location.replace('/login/')
          throw new DOMException('Authentication required', 'AbortError')
        }
        if (!response.ok) throw new Error('Content service unavailable')
        return response.json()
      })
      .then((payload) => {
        setContent(mergeContent(payload.content))
        setContentStatus('live')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setContentStatus('fallback')
      })

    return () => controller.abort()
  }, [isEditor])

  if (isEditor) return <Editor defaults={defaultContent} />
  return <PublicSite content={content} contentStatus={contentStatus} />
}

export default App
