import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  List,
  ListItemButton,
  Collapse,
  Menu,
  MenuItem,
  ListItemIcon,
  Chip,
  Tooltip,
  Divider
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import FolderIcon from '@mui/icons-material/Folder'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import HttpIcon from '@mui/icons-material/Http'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import TuneIcon from '@mui/icons-material/Tune'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import ConfirmDialog from '../../components/ConfirmDialog'
import PromptDialog from '../../components/PromptDialog'
import CollectionVariablesDialog from './CollectionVariablesDialog'
import CollectionDescriptionDialog from './CollectionDescriptionDialog'
import CollectionRunnerDialog from './CollectionRunnerDialog'
import SidebarPanelHeader from '../../components/SidebarPanelHeader'
import { useCollectionDragDrop } from './useCollectionDragDrop'
import { COMPACT } from '../../theme/compact'
import type { CollectionModel, RequestModel } from '@shared/types'

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7'
}

type ContextTarget =
  | { type: 'collection'; item: CollectionModel }
  | { type: 'request'; item: RequestModel }

type DeleteTarget =
  | { type: 'collection'; id: string; name: string }
  | { type: 'request'; id: string; name: string }

function MethodBadge({ method }: { method: string }) {
  return (
    <Chip
      label={method}
      size="small"
      sx={{
        height: 18,
        fontSize: 10,
        fontWeight: 700,
        bgcolor: METHOD_COLORS[method] || '#999',
        color: '#fff',
        mr: 0.75,
        minWidth: 44,
        flexShrink: 0
      }}
    />
  )
}

function renameInputSx(fontSize = 11) {
  return {
    flex: 1,
    minWidth: 0,
    my: 0,
    ...COMPACT.input,
    '& .MuiInputBase-root': {
      height: 24,
      py: 0,
      fontSize
    },
    '& .MuiInputBase-input': {
      py: 0.25,
      px: 0.5,
      fontSize,
      lineHeight: 1.3
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderWidth: 1
    }
  }
}

/** Full-width sidebar row — highlight reaches both edges. */
function treeItemSx(depth: number, pinned?: boolean) {
  return {
    position: 'relative',
    pl: 1.5 + depth * 1.5,
    pr: 1,
    py: 0.5,
    m: 0,
    mx: 0,
    marginInline: 0,
    borderRadius: 0,
    width: '100%',
    maxWidth: 'none',
    boxSizing: 'border-box' as const,
    ...(pinned ? { bgcolor: 'action.hover' as const } : {}),
    '&:hover .tree-actions, &:focus-within .tree-actions': { opacity: 1, pointerEvents: 'auto' },
    '&:hover .tree-title, &:focus-within .tree-title': {
      maskImage: 'linear-gradient(to right, #000 75%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to right, #000 75%, transparent 100%)'
    }
  }
}

function treeTitleSx(active: boolean) {
  return {
    display: 'block',
    flex: '1 1 auto',
    minWidth: 0,
    my: 0,
    fontSize: 11,
    lineHeight: 1.3,
    fontWeight: active ? 600 : 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as const
}

const collectionListSx = {
  flex: 1,
  overflow: 'auto',
  width: '100%',
  py: 0,
  '& .MuiListItemButton-root': {
    m: 0,
    mx: 0,
    marginInline: 0,
    borderRadius: 0,
    width: '100%',
    maxWidth: 'none'
  }
} as const

function ItemActions({
  target,
  onRename,
  onDuplicate,
  onDelete,
  onTogglePin,
  onOpenMenu
}: {
  target: ContextTarget
  onRename: (type: 'collection' | 'request', id: string, name: string) => void
  onDuplicate: (req: RequestModel) => void
  onDelete: (target: DeleteTarget) => void
  onTogglePin: (target: ContextTarget) => void
  onOpenMenu: (e: React.MouseEvent<HTMLElement>, target: ContextTarget) => void
}) {
  const pinned = target.item.pinned

  return (
    <Box
      className="tree-actions"
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 0.15s',
        pl: 3,
        pr: 0.25,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(to right, transparent, rgba(17, 17, 19, 0.92) 28px, rgba(17, 17, 19, 1))'
            : 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.92) 28px, #fff)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip title={pinned ? 'Unpin' : 'Pin'}>
        <IconButton
          size="small"
          color={pinned ? 'primary' : 'default'}
          onClick={() => onTogglePin(target)}
        >
          {pinned ? (
            <PushPinIcon sx={{ fontSize: 16 }} />
          ) : (
            <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
      <Tooltip title="Rename">
        <IconButton
          size="small"
          onClick={() => onRename(target.type, target.item.id, target.item.name)}
        >
          <DriveFileRenameOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      {target.type === 'request' && (
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={() => onDuplicate(target.item)}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={() =>
            onDelete({
              type: target.type,
              id: target.item.id,
              name: target.item.name
            })
          }
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} color="error" />
        </IconButton>
      </Tooltip>
      <IconButton size="small" onClick={(e) => onOpenMenu(e, target)}>
        <MoreVertIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  )
}

const comparePinnedSortOrder = <T extends { pinned: boolean; sortOrder: number }>(a: T, b: T) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return a.sortOrder - b.sortOrder
}

export default function CollectionsPanel() {
  const collections = useAppStore((s) => s.collections)
  const requests = useAppStore((s) => s.requests)
  const activeRequestId = useAppStore((s) => s.activeRequest?.id ?? null)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const selectRequest = useAppStore((s) => s.selectRequest)
  const updateActiveRequest = useAppStore((s) => s.updateActiveRequest)
  const createCollection = useAppStore((s) => s.createCollection)
  const deleteCollection = useAppStore((s) => s.deleteCollection)
  const renameCollection = useAppStore((s) => s.renameCollection)
  const createRequest = useAppStore((s) => s.createRequest)
  const deleteRequest = useAppStore((s) => s.deleteRequest)
  const setCollectionPinned = useAppStore((s) => s.setCollectionPinned)
  const setRequestPinned = useAppStore((s) => s.setRequestPinned)
  const loadRequests = useAppStore((s) => s.loadRequests)
  const setImportDialog = useAppStore((s) => s.setImportDialog)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<{ type: 'collection' | 'request'; id: string; value: string } | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number; target: ContextTarget } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const [variablesCollection, setVariablesCollection] = useState<CollectionModel | null>(null)
  const [descriptionCollection, setDescriptionCollection] = useState<CollectionModel | null>(null)
  const [runnerCollection, setRunnerCollection] = useState<CollectionModel | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) editInputRef.current?.focus()
  }, [editing])

  const dragEnabled = !searchQuery && !editing

  const handleMoveRequest = useCallback(
    async (requestId: string, targetCollectionId: string | null, beforeRequestId: string | null) => {
      try {
        await window.lisek.requests.move(requestId, targetCollectionId, beforeRequestId)
        const active = useAppStore.getState().activeRequest
        if (active?.id === requestId) {
          useAppStore.getState().updateActiveRequest({ collectionId: targetCollectionId })
        }
        await loadRequests()
      } catch (err) {
        console.error('[CollectionsPanel] move request failed:', err)
      }
    },
    [loadRequests]
  )

  const {
    dragRequestId,
    bindDragHandle,
    isDropBefore,
    isDropAfter,
    isDropIntoCollection
  } = useCollectionDragDrop({
    enabled: dragEnabled,
    onMove: handleMoveRequest,
    onExpandCollection: (collectionId) => setExpanded((e) => ({ ...e, [collectionId]: true })),
    getInsertBeforeId: (collectionId, afterRequestId, excludeRequestId) => {
      const list = requests
        .filter((r) => r.collectionId === collectionId && r.id !== excludeRequestId)
        .sort(comparePinnedSortOrder)
      const idx = list.findIndex((r) => r.id === afterRequestId)
      if (idx < 0) return null
      return list[idx + 1]?.id ?? null
    }
  })

  const rootCollections = useMemo(
    () => collections.filter((c) => !c.parentId).sort(comparePinnedSortOrder),
    [collections]
  )

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests
    const q = searchQuery.toLowerCase()
    return requests.filter(
      (r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
    )
  }, [requests, searchQuery])

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: e[id] === false }))

  const startRename = (type: 'collection' | 'request', id: string, name: string) => {
    setMenuAnchor(null)
    setEditing({ type, id, value: name })
  }

  const commitRename = async () => {
    if (!editing || !editing.value.trim()) {
      setEditing(null)
      return
    }
    const name = editing.value.trim()
    if (editing.type === 'collection') {
      await renameCollection(editing.id, name)
    } else {
      const req = requests.find((r) => r.id === editing.id)
      if (req) {
        const updated = { ...req, name }
        await window.lisek.requests.save(updated)
        if (activeRequestId === editing.id) updateActiveRequest({ name })
        await loadRequests()
      }
    }
    setEditing(null)
  }

  const togglePin = async (target: ContextTarget) => {
    setMenuAnchor(null)
    if (target.type === 'collection') {
      await setCollectionPinned(target.item.id, !target.item.pinned)
    } else {
      await setRequestPinned(target.item.id, !target.item.pinned)
    }
  }

  const duplicateRequest = async (req: RequestModel) => {
    setMenuAnchor(null)
    const copy = await window.lisek.requests.save({
      ...req,
      id: undefined,
      name: `${req.name} (Copy)`,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    void selectRequest(copy)
    await loadRequests()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'collection') {
      await deleteCollection(deleteTarget.id)
    } else {
      await deleteRequest(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

  const openMenu = (e: React.MouseEvent<HTMLElement>, target: ContextTarget) => {
    e.stopPropagation()
    e.preventDefault()
    setMenuAnchor({ top: e.clientY, left: e.clientX, target })
  }

  const closeMenu = () => setMenuAnchor(null)

  const handleCreateCollection = async (name: string) => {
    await createCollection(name)
    setNewCollectionOpen(false)
  }

  const exportCollection = async (collectionId: string, format: 'postman' | 'openapi' | 'insomnia') => {
    setMenuAnchor(null)
    const col = collections.find((c) => c.id === collectionId)
    const safeName = (col?.name || 'collection').replace(/[^\w.-]+/g, '_')
    const filePath = await window.lisek.dialog.saveFile(`${safeName}.json`, [
      { name: 'JSON', extensions: ['json'] },
      { name: 'YAML', extensions: ['yaml', 'yml'] }
    ])
    if (!filePath) return
    if (format === 'postman') {
      await window.lisek.export.postman(collectionId, filePath)
    } else if (format === 'insomnia') {
      await window.lisek.export.insomnia(collectionId, filePath)
    } else {
      await window.lisek.export.openapi(collectionId, filePath)
    }
  }

  const renderRequest = (req: RequestModel, depth: number) => {
    const isActive = activeRequestId === req.id
    const isEditing = editing?.type === 'request' && editing.id === req.id

    return (
      <Box
        key={req.id}
        data-request-id={req.id}
        data-collection-id={req.collectionId ?? '__none__'}
        sx={{ width: '100%' }}
      >
      <ListItemButton
        disableGutters
        selected={isActive}
        sx={{
          ...treeItemSx(depth, req.pinned),
          opacity: dragRequestId === req.id ? 0.45 : 1,
          ...(isDropBefore(req.id)
            ? { boxShadow: (t) => `inset 0 2px 0 0 ${t.palette.primary.main}` }
            : isDropAfter(req.id)
              ? { boxShadow: (t) => `inset 0 -2px 0 0 ${t.palette.primary.main}` }
              : {})
        }}
        onClick={() => !isEditing && void selectRequest(req)}
        onDoubleClick={() => startRename('request', req.id, req.name)}
      >
        {dragEnabled && (
          <Box
            component="span"
            {...bindDragHandle(req.id)}
            onClick={(e) => e.stopPropagation()}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'grab',
              mr: 0.25,
              flexShrink: 0,
              color: 'text.disabled',
              touchAction: 'none',
              '&:active': { cursor: 'grabbing' }
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 14, pointerEvents: 'none' }} />
          </Box>
        )}
        {req.pinned && (
          <PushPinIcon
            sx={{ fontSize: 12, mr: 0.5, color: 'primary.main', transform: 'rotate(45deg)' }}
          />
        )}
        <MethodBadge method={req.method} />
        {isEditing ? (
          <TextField
            inputRef={editInputRef}
            size="small"
            variant="outlined"
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(null)
            }}
            onClick={(e) => e.stopPropagation()}
            sx={renameInputSx(11)}
          />
        ) : (
          <Tooltip
            title={
              <Box>
                <Typography variant="caption" component="div" fontWeight={600}>
                  {req.name}
                </Typography>
                <Typography variant="caption" component="div" color="inherit" sx={{ opacity: 0.85 }}>
                  {req.method}
                  {req.url ? ` · ${req.url}` : req.protocol !== 'http' ? ` · ${req.protocol}` : ''}
                </Typography>
              </Box>
            }
            placement="right"
            enterDelay={500}
          >
            <Box component="span" className="tree-title" sx={treeTitleSx(isActive)}>
              {req.name}
            </Box>
          </Tooltip>
        )}
        {!isEditing && (
          <ItemActions
            target={{ type: 'request', item: req }}
            onRename={startRename}
            onDuplicate={duplicateRequest}
            onDelete={setDeleteTarget}
            onTogglePin={togglePin}
            onOpenMenu={openMenu}
          />
        )}
      </ListItemButton>
      </Box>
    )
  }

  const renderCollection = (col: CollectionModel, depth = 0) => {
    const children = collections.filter((c) => c.parentId === col.id).sort(comparePinnedSortOrder)
    const colRequests = filteredRequests.filter((r) => r.collectionId === col.id).sort(comparePinnedSortOrder)
    const isOpen = expanded[col.id] !== false
    const isEditing = editing?.type === 'collection' && editing.id === col.id

    return (
      <Box key={col.id}>
        <ListItemButton
          disableGutters
          data-collection-drop={col.id}
          sx={{
            ...treeItemSx(depth, col.pinned),
            ...(isDropIntoCollection(col.id)
              ? {
                  bgcolor: 'action.selected',
                  outline: (t) => `1px dashed ${t.palette.primary.main}`,
                  outlineOffset: -1
                }
              : {})
          }}
          onClick={() => !isEditing && toggle(col.id)}
          onDoubleClick={() => startRename('collection', col.id, col.name)}
        >
          {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          {col.pinned ? (
            <PushPinIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.main', transform: 'rotate(45deg)' }} />
          ) : (
            <FolderIcon sx={{ fontSize: 16, mr: 0.75, opacity: 0.7 }} />
          )}
          {isEditing ? (
            <TextField
              inputRef={editInputRef}
              size="small"
              variant="outlined"
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(null)
              }}
              onClick={(e) => e.stopPropagation()}
              sx={renameInputSx(13)}
            />
          ) : (
            <Box className="tree-title" sx={{ flex: 1, minWidth: 0, my: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500, fontSize: 13, lineHeight: 1.3 }}>
                {col.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.2 }}>
                {colRequests.length} request{colRequests.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
          {!isEditing && (
            <ItemActions
              target={{ type: 'collection', item: col }}
              onRename={startRename}
              onDuplicate={duplicateRequest}
              onDelete={setDeleteTarget}
              onTogglePin={togglePin}
              onOpenMenu={openMenu}
            />
          )}
        </ListItemButton>
        <Collapse in={isOpen} data-collection-drop={col.id}>
          {children.map((c) => renderCollection(c, depth + 1))}
          {colRequests.map((req) => renderRequest(req, depth + 1))}
        </Collapse>
      </Box>
    )
  }

  const uncategorized = filteredRequests.filter((r) => !r.collectionId).sort(comparePinnedSortOrder)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0 }}>
      <SidebarPanelHeader
        panel="collections"
        actions={
          <>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => void loadRequests()}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New collection">
              <IconButton size="small" onClick={() => setNewCollectionOpen(true)}>
                <CreateNewFolderIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New request">
              <IconButton size="small" onClick={() => void createRequest()}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Import">
              <IconButton size="small" onClick={() => setImportDialog(true)}>
                <ImportExportIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </>
        }
      />
      <Box sx={{ px: 1, pt: 1, pb: 0.5, flexShrink: 0 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search endpoints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {dragEnabled && (
          <Typography sx={{ ...COMPACT.caption, display: 'block', mt: 0.5, px: 0.25 }}>
            Drag requests by the ⋮⋮ handle — drop above/below rows or onto a collection folder
          </Typography>
        )}
      </Box>
      <List dense disablePadding sx={collectionListSx}>
        {rootCollections.length === 0 && uncategorized.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No collections yet. Create one to get started.
          </Typography>
        )}
        {rootCollections.map((c) => renderCollection(c))}
        {uncategorized.length > 0 && (
          <Box data-collection-drop="__none__">
            <Divider sx={{ my: 1 }} />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                px: 1.5,
                py: 0.75,
                color: 'text.secondary',
                fontWeight: 600,
                ...(isDropIntoCollection(null)
                  ? {
                      bgcolor: 'action.selected',
                      outline: (t) => `1px dashed ${t.palette.primary.main}`,
                      outlineOffset: -1
                    }
                  : {})
              }}
            >
              Uncategorized
            </Typography>
            {uncategorized.map((req) => renderRequest(req, 0))}
          </Box>
        )}
      </List>

      <Menu
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor ? { top: menuAnchor.top, left: menuAnchor.left } : undefined
        }
        open={!!menuAnchor}
        onClose={closeMenu}
      >
        {menuAnchor?.target.type === 'collection' && (
          <>
            <MenuItem onClick={() => createRequest(menuAnchor.target.item.id)}>
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              New Request in folder
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                setVariablesCollection(menuAnchor.target.item as CollectionModel)
              }}
            >
              <ListItemIcon>
                <TuneIcon fontSize="small" />
              </ListItemIcon>
              Collection Variables
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                setDescriptionCollection(menuAnchor.target.item as CollectionModel)
              }}
            >
              <ListItemIcon>
                <DescriptionOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Collection Docs
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                setRunnerCollection(menuAnchor.target.item as CollectionModel)
              }}
            >
              <ListItemIcon>
                <PlayArrowIcon fontSize="small" />
              </ListItemIcon>
              Run Collection
            </MenuItem>
            <MenuItem onClick={() => void exportCollection(menuAnchor.target.item.id, 'postman')}>
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as Postman
            </MenuItem>
            <MenuItem onClick={() => void exportCollection(menuAnchor.target.item.id, 'openapi')}>
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as OpenAPI
            </MenuItem>
            <MenuItem onClick={() => void exportCollection(menuAnchor.target.item.id, 'insomnia')}>
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as Insomnia
            </MenuItem>
          </>
        )}
        <MenuItem
          onClick={() => menuAnchor && void togglePin(menuAnchor.target)}
        >
          <ListItemIcon>
            {menuAnchor?.target.item.pinned ? (
              <PushPinOutlinedIcon fontSize="small" />
            ) : (
              <PushPinIcon fontSize="small" />
            )}
          </ListItemIcon>
          {menuAnchor?.target.item.pinned ? 'Unpin' : 'Pin'}
        </MenuItem>
        <MenuItem
          onClick={() =>
            menuAnchor &&
            startRename(
              menuAnchor.target.type,
              menuAnchor.target.item.id,
              menuAnchor.target.item.name
            )
          }
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          Rename
        </MenuItem>
        {menuAnchor?.target.type === 'request' && (
          <MenuItem onClick={() => duplicateRequest(menuAnchor.target.item as RequestModel)}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            Duplicate
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (!menuAnchor) return
            setDeleteTarget({
              type: menuAnchor.target.type,
              id: menuAnchor.target.item.id,
              name: menuAnchor.target.item.name
            })
            setMenuAnchor(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      <PromptDialog
        open={newCollectionOpen}
        title="New Collection"
        label="Collection name"
        defaultValue=""
        confirmLabel="Create"
        onConfirm={(name) => void handleCreateCollection(name)}
        onCancel={() => setNewCollectionOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'collection' ? 'Delete Collection' : 'Delete Request'}
        message={
          deleteTarget?.type === 'collection'
            ? `Delete "${deleteTarget.name}" and all nested folders and requests? This cannot be undone.`
            : `Delete request "${deleteTarget?.name}"? This cannot be undone.`
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CollectionVariablesDialog
        open={!!variablesCollection}
        collection={variablesCollection}
        onClose={() => setVariablesCollection(null)}
      />

      <CollectionDescriptionDialog
        open={!!descriptionCollection}
        collection={descriptionCollection}
        onClose={() => setDescriptionCollection(null)}
      />

      <CollectionRunnerDialog
        open={!!runnerCollection}
        collection={runnerCollection}
        onClose={() => setRunnerCollection(null)}
      />
    </Box>
  )
}
