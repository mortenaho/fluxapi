import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { RequestModel } from '@shared/types'
import { useAppStore } from '../stores/appStore'

interface RequestEditorActions {
  patch: (partial: Partial<RequestModel>) => void
  flush: () => void
}

const RequestDraftContext = createContext<RequestModel | null>(null)
const RequestEditorActionsContext = createContext<RequestEditorActions | null>(null)

export function RequestEditorProvider({
  requestId,
  children
}: {
  requestId: string
  children: ReactNode
}) {
  const hasActiveRequest = useAppStore((s) => s.activeRequest !== null)
  const [draft, setDraft] = useState<RequestModel>(
    () => useAppStore.getState().activeRequest!
  )
  const lastRequestId = useRef(requestId)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    lastRequestId.current = requestId
  }, [requestId])

  const storeRequest = useAppStore((s) =>
    s.activeRequest?.id === requestId ? s.activeRequest : null
  )

  useEffect(() => {
    if (storeRequest) setDraft(storeRequest)
  }, [storeRequest])

  const flush = useCallback(() => {
    useAppStore.setState({ activeRequest: draftRef.current })
  }, [])

  const patch = useCallback((partial: Partial<RequestModel>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }, [])

  const actions = useMemo(() => ({ patch, flush }), [patch, flush])

  if (!hasActiveRequest) return null

  return (
    <RequestEditorActionsContext.Provider value={actions}>
      <RequestDraftContext.Provider value={draft}>{children}</RequestDraftContext.Provider>
    </RequestEditorActionsContext.Provider>
  )
}

export function useRequestDraft(): RequestModel {
  const draft = useContext(RequestDraftContext)
  if (!draft) throw new Error('useRequestDraft must be used within RequestEditorProvider')
  return draft
}

export function useRequestEditorActions(): RequestEditorActions {
  const actions = useContext(RequestEditorActionsContext)
  if (!actions) throw new Error('useRequestEditorActions must be used within RequestEditorProvider')
  return actions
}

export function useRequestEditor() {
  return { request: useRequestDraft(), ...useRequestEditorActions() }
}

export function useRequestField<K extends keyof RequestModel>(key: K): RequestModel[K] {
  const draft = useRequestDraft()
  return draft[key]
}
