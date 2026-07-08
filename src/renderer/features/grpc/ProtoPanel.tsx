import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
  TextField
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SearchIcon from '@mui/icons-material/Search'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { useCallback, useEffect, useState } from 'react'
import type { GrpcServiceInfo, ProtoFileModel } from '@shared/types'
import { useAppStore } from '../../stores/appStore'

function shortPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  if (parts.length <= 3) return normalized
  return `…/${parts.slice(-2).join('/')}`
}
function formatImportedAt(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ProtoPanel() {
  const protoFiles = useAppStore((s) => s.protoFiles)
  const loadProtoFiles = useAppStore((s) => s.loadProtoFiles)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [servicesByProto, setServicesByProto] = useState<Record<string, GrpcServiceInfo[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [reflectTarget, setReflectTarget] = useState('localhost:50051')
  const [reflectError, setReflectError] = useState<string | null>(null)
  const [reflectedServices, setReflectedServices] = useState<GrpcServiceInfo[]>([])
  const [reflecting, setReflecting] = useState(false)

  useEffect(() => {
    void loadProtoFiles()
  }, [loadProtoFiles])

  const importProto = async () => {
    const path = await window.lisek.dialog.openFile([{ name: 'Proto', extensions: ['proto'] }])
    if (path) {
      await window.lisek.proto.import(path)
      await loadProtoFiles()
    }
  }

  const deleteProto = async (id: string) => {
    await window.lisek.proto.delete(id)
    await loadProtoFiles()
    setExpanded((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setServicesByProto((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const toggleProto = useCallback(
    async (proto: ProtoFileModel) => {
      const isOpen = expanded[proto.id] ?? false
      setExpanded((prev) => ({ ...prev, [proto.id]: !isOpen }))

      if (!isOpen && !servicesByProto[proto.id]) {
        setLoadingId(proto.id)
        try {
          const services = await window.lisek.grpc.getServices(proto.id)
          setServicesByProto((prev) => ({ ...prev, [proto.id]: services }))
        } catch {
          setServicesByProto((prev) => ({ ...prev, [proto.id]: [] }))
        } finally {
          setLoadingId(null)
        }
      }
    },
    [expanded, servicesByProto]
  )

  const reflect = async () => {
    if (!reflectTarget.trim()) return
    setReflecting(true)
    setReflectError(null)
    try {
      const services = await window.lisek.grpc.reflect(reflectTarget.trim())
      setReflectedServices(services)
    } catch (e) {
      setReflectError(e instanceof Error ? e.message : String(e))
      setReflectedServices([])
    } finally {
      setReflecting(false)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          Server reflection
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="localhost:50051"
            value={reflectTarget}
            onChange={(e) => setReflectTarget(e.target.value)}
          />
          <Button size="small" variant="contained" onClick={() => void reflect()} disabled={reflecting}>
            {reflecting ? '…' : 'Reflect'}
          </Button>
        </Box>
        {reflectError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
            {reflectError}
          </Typography>
        )}
        {reflectedServices.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {reflectedServices.map((service) => (
              <Box key={service.name} sx={{ py: 0.25 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                  {service.name}
                </Typography>
                {service.methods.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                    {service.methods.map((method) => (
                      <Chip key={method.name} label={method.name} size="small" sx={{ height: 18, fontSize: 10 }} />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {protoFiles.length > 0 ? `${protoFiles.length} file${protoFiles.length > 1 ? 's' : ''}` : 'gRPC definitions'}
        </Typography>
      </Box>

      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={<UploadFileIcon />}
        onClick={() => void importProto()}
        sx={{ mb: 1.5 }}
      >
        Import .proto
      </Button>

      {protoFiles.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, py: 1 }}>
          No proto files yet
        </Typography>
      ) : (
        <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {protoFiles.map((proto) => {
            const isOpen = expanded[proto.id] ?? false
            const services = servicesByProto[proto.id]
            const isLoading = loadingId === proto.id

            return (
              <Box
                key={proto.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'background.paper'
                }}
              >
                <ListItemButton
                  sx={{
                    py: 0.75,
                    pr: 0.5,
                    '&:hover .proto-delete': { opacity: 1 }
                  }}
                  onClick={() => void toggleProto(proto)}
                >
                  {isOpen ? (
                    <ExpandLess fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />
                  ) : (
                    <ExpandMore fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />
                  )}
                  <DescriptionOutlinedIcon sx={{ fontSize: 18, mr: 1, opacity: 0.6, flexShrink: 0 }} />
                  <ListItemText
                    primary={proto.name}
                    secondary={
                      <Tooltip title={proto.filePath} placement="bottom-start">
                        <span>
                          {shortPath(proto.filePath)} · {formatImportedAt(proto.importedAt)}
                        </span>
                      </Tooltip>
                    }
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      noWrap: true,
                      sx: { fontFamily: 'Consolas, monospace', opacity: 0.8 }
                    }}
                  />
                  {services && (
                    <Chip
                      label={`${services.length} svc`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 10, mr: 0.5, flexShrink: 0 }}
                    />
                  )}
                  <IconButton
                    className="proto-delete"
                    size="small"
                    sx={{ opacity: 0.35, flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteProto(proto.id)
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </ListItemButton>

                <Collapse in={isOpen}>
                  <Box sx={{ px: 1.5, pb: 1, pt: 0.25, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                    {isLoading && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 0.75, pl: 0.5 }}>
                        Loading services…
                      </Typography>
                    )}
                    {!isLoading && services?.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 0.75, pl: 0.5 }}>
                        No services found
                      </Typography>
                    )}
                    {services?.map((service) => (
                      <Box key={service.name} sx={{ py: 0.5, pl: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontFamily: 'Consolas, monospace',
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 0.25
                          }}
                        >
                          {service.name}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {service.methods.map((method) => (
                            <Chip
                              key={method.name}
                              label={method.name}
                              size="small"
                              variant="outlined"
                              title={method.callType}
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontFamily: 'Consolas, monospace',
                                '& .MuiChip-label': { px: 0.75 }
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )
          })}
        </List>
      )}
    </Box>
  )
}
