import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Paper,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useCallback } from 'react'
import CodeEditor from '../../components/CodeEditor'
import { useRequestEditor } from '../../contexts/RequestEditorContext'

const PM_API = [
  'alert(message) · confirm(message)',
  'console.log / warn / error',
  'pm.environment.set/get/unset',
  'pm.collectionVariables.set/get/unset',
  'pm.request.url / .method / .body',
  'pm.response.json() / .text()',
  'pm.test(name, fn) · pm.expect(x).to.equal(y)'
]

export default function ScriptsTab() {
  const { request, patch } = useRequestEditor()

  const patchPreRequest = useCallback(
    (preRequestScript: string) => patch({ preRequestScript }),
    [patch]
  )
  const patchTestScript = useCallback((testScript: string) => patch({ testScript }), [patch])

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        JavaScript runs in a sandbox before and after the request. Use the <code>pm.*</code> API to
        modify variables or assert on responses.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2
        }}
      >
        <Paper variant="outlined" sx={{ overflow: 'hidden', height: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1.25,
                bgcolor: 'action.hover',
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <PlayCircleOutlineIcon fontSize="small" color="primary" />
              <Box>
                <Typography variant="subtitle2">Pre-request Script</Typography>
                <Typography variant="caption" color="text.secondary">
                  Runs before the request is sent
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1 }}>
              <CodeEditor
                editorKey={`${request.id}-pre`}
                height="180px"
                language="javascript"
                value={request.preRequestScript}
                onChange={patchPreRequest}
              />
            </Box>
          </Paper>

        <Paper variant="outlined" sx={{ overflow: 'hidden', height: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1.25,
                bgcolor: 'action.hover',
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <CheckCircleOutlineIcon fontSize="small" color="success" />
              <Box>
                <Typography variant="subtitle2">Tests</Typography>
                <Typography variant="caption" color="text.secondary">
                  Runs after the response — results appear in the response panel
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1 }}>
              <CodeEditor
                editorKey={`${request.id}-test`}
                height="180px"
                language="javascript"
                value={request.testScript}
                onChange={patchTestScript}
              />
            </Box>
          </Paper>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          mt: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: '8px !important',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">pm.* API reference</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box
            component="ul"
            sx={{
              m: 0,
              pl: 2.5,
              fontFamily: 'Consolas, monospace',
              fontSize: 12,
              color: 'text.secondary',
              '& li': { mb: 0.5 }
            }}
          >
            {PM_API.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
