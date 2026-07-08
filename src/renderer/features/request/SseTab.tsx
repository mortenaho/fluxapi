import { Box, Button, List, ListItem, Typography } from '@mui/material'
import { memo, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useRequestEditorActions } from '../../contexts/RequestEditorContext'
import type { SseMessage } from '@shared/types'

const SseMessageList = memo(function SseMessageList({ messages }: { messages: SseMessage[] }) {
  return (
    <List dense sx={{ maxHeight: 240, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
      {messages.map((m) => (
        <ListItem key={m.id} sx={{ py: 0.25, display: 'block' }}>
          <Typography variant="caption" sx={{ color: 'success.main', display: 'block' }}>
            [{m.event || 'message'}] {m.data}
          </Typography>
        </ListItem>
      ))}
    </List>
  )
})

export default function SseTab() {
  const { flush } = useRequestEditorActions()
  const sseConnectionId = useAppStore((s) => s.sseConnectionId)
  const sseMessages = useAppStore((s) => s.sseMessages)

  useEffect(() => {
    const unsub = window.lisek.sse.onMessage((_, msg) => {
      useAppStore.setState((s) => ({ sseMessages: [...s.sseMessages, msg] }))
    })
    return unsub
  }, [])

  const connect = async () => {
    flush()
    const req = useAppStore.getState().activeRequest
    if (!req) return
    const id = await window.lisek.sse.connect(req.sseUrl || req.url, req.headers)
    useAppStore.setState({ sseConnectionId: id, sseMessages: [] })
  }

  const disconnect = async () => {
    if (sseConnectionId) {
      await window.lisek.sse.disconnect(sseConnectionId)
      useAppStore.setState({ sseConnectionId: null })
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" onClick={() => void connect()} disabled={!!sseConnectionId}>
          Connect
        </Button>
        <Button onClick={() => void disconnect()} disabled={!sseConnectionId}>
          Disconnect
        </Button>
      </Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Events
      </Typography>
      <SseMessageList messages={sseMessages} />
    </Box>
  )
}
