import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography
} from '@mui/material'
import { useEffect, useState } from 'react'
import type { CollectionModel } from '@shared/types'
import { useAppStore } from '../../stores/appStore'

interface Props {
  open: boolean
  collection: CollectionModel | null
  onClose: () => void
}

export default function CollectionDescriptionDialog({ open, collection, onClose }: Props) {
  const loadCollections = useAppStore((s) => s.loadCollections)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (collection) setDescription(collection.description || '')
  }, [collection, open])

  const save = async () => {
    if (!collection) return
    await window.lisek.collections.update(collection.id, { description })
    await loadCollections()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Collection Docs — {collection?.name}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Markdown-friendly notes about this collection
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe endpoints, auth flow, or test notes…"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
