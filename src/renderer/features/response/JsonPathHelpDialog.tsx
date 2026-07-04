import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface Example {
  label: string
  query: string
  description: string
}

const EXAMPLES: Example[] = [
  { label: 'Root', query: '$', description: 'Entire JSON document' },
  { label: 'Property', query: '$.data', description: 'Top-level field named data' },
  { label: 'Shorthand', query: 'data.user.name', description: '$ prefix is added automatically' },
  { label: 'Array index', query: '$.items[0]', description: 'First element of items array' },
  { label: 'Last item', query: '$.items[-1]', description: 'Last element (JSONPath syntax)' },
  { label: 'All in array', query: '$.items[*].name', description: 'name from every item' },
  { label: 'Recursive', query: '$..id', description: 'Find id anywhere in the tree' },
  { label: 'Wildcard key', query: '$.*', description: 'All top-level property values' },
  { label: 'Filter', query: '$.items[?(@.price > 10)]', description: 'Items where price > 10' },
  { label: 'Slice', query: '$.items[0:3]', description: 'First three array elements' }
]

const OPERATORS = [
  { op: '$', desc: 'Root element' },
  { op: '.', desc: 'Child property (data.user)' },
  { op: '[n]', desc: 'Array index (items[0])' },
  { op: '[*]', desc: 'All elements in array' },
  { op: '..', desc: 'Recursive descent (find at any depth)' },
  { op: '[?()]', desc: 'Filter expression' }
]

interface Props {
  open: boolean
  onClose: () => void
  onUseExample: (query: string) => void
}

export default function JsonPathHelpDialog({ open, onClose, onUseExample }: Props) {
  const copy = async (text: string) => {
    await window.fluxAPI.clipboard.writeText(text)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          JSONPath Help
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Query the response JSON with JSONPath. You can omit the leading{' '}
          <Box component="code" sx={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>
            $
          </Box>{' '}
          — it is added automatically.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Operators
        </Typography>
        <Table size="small" sx={{ mb: 2.5, '& td, & th': { py: 0.75, borderColor: 'divider' } }}>
          <TableHead>
            <TableRow>
              <TableCell width="20%">Syntax</TableCell>
              <TableCell>Meaning</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {OPERATORS.map((row) => (
              <TableRow key={row.op}>
                <TableCell>
                  <Box component="code" sx={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>
                    {row.op}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.desc}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Examples
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {EXAMPLES.map((ex) => (
            <Box
              key={ex.query}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {ex.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'Consolas, monospace', display: 'block', color: 'primary.main' }}
                >
                  {ex.query}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ex.description}
                </Typography>
              </Box>
              <Tooltip title="Copy">
                <IconButton size="small" onClick={() => void copy(ex.query)}>
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  onUseExample(ex.query)
                  onClose()
                }}
              >
                Use
              </Button>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
